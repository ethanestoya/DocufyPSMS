// Centralized job applications store.
//
// Supabase-backed facade: the sync read API (getApplications / getApplicationById /
// getApplicationByJobId / subscribe) is unchanged for consumers. Hydration pulls
// the caller's RLS-visible rows (customers see only their own applications); the
// in-memory mirror is retained as the offline/Mock fallback so demo submissions
// keep working while the backend is unreachable. Mutations apply locally first,
// then best-effort sync to the DB — kept locally + surfaced on failure, never
// thrown.
import { isRlsDenied, showDbError } from '../../lib/db/errors';
import { authReady } from '../../lib/supabaseClient';
import { subscribeTableChanges } from '../../lib/db/hooks';
import {
  createApplication,
  fetchApplications,
  getPortfolioSignedUrl,
  updateApplication,
  uploadPortfolio,
} from '../../lib/db/jobApplicationsRepo';
import type { JobApplicationDto } from '../../lib/db/types';

export type ApplicationType = {
  id: string;
  jobId: string;
  jobTitle: string;
  firstName: string;
  lastName: string;
  name: string;
  email: string;
  contact: string;
  position: string;
  skills: string;
  portfolio: string;
  portfolioType?: 'link' | 'file';
  portfolioFile?: File | null;
  portfolioFileName?: string;
  portfolioStoragePath?: string | null;
  appliedDateTime: string;
  status: 'Pending' | 'Under Review' | 'For Interview' | 'Approved' | 'Rejected';
  appliedDate: string;
  interviewDate?: string;
  interviewTime?: string;
  interviewLocation?: string;
  rejectionReason?: string;
};

type Subscriber = () => void;

function toApplicationType(dto: JobApplicationDto): ApplicationType {
  const d = new Date(dto.appliedAt);
  const dateStr = d.toISOString().split('T')[0];
  const timeStr = Number.isNaN(d.getTime())
    ? ''
    : d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  const isFile = Boolean(dto.portfolioStoragePath);
  return {
    id: dto.id,
    jobId: dto.jobId,
    jobTitle: dto.jobTitle ?? '',
    firstName: dto.firstName,
    lastName: dto.lastName,
    name: dto.fullName,
    email: dto.email,
    contact: dto.contact,
    position: dto.position,
    skills: dto.skills ?? '',
    portfolio: dto.portfolioUrl ?? '',
    portfolioType: isFile ? 'file' : dto.portfolioUrl ? 'link' : undefined,
    portfolioFileName: dto.portfolioFileName ?? undefined,
    portfolioStoragePath: dto.portfolioStoragePath,
    appliedDateTime: `${dateStr} ${timeStr}`.trim(),
    status: dto.status,
    appliedDate: dateStr,
    interviewDate: dto.interviewDate ?? undefined,
    interviewTime: dto.interviewTime ?? undefined,
    interviewLocation: dto.interviewLocation ?? undefined,
    rejectionReason: dto.rejectionReason ?? undefined,
  };
}

// Stable human-readable app id: keeps the legacy APP-000 style for mock rows and
// derives a short APP-XXXX tag from the server uuid otherwise.
export function applicationDisplayId(id: string): string {
  if (/^APP-/i.test(id)) return id;
  const short = id.replace(/-/g, '').slice(0, 4).toUpperCase();
  return `APP-${short}`;
}

// Open an application's portfolio in the browser's native viewer / new tab:
// real files resolve a signed URL for the private bucket first, fall back to an
// in-memory File (same-session Mock), then to a plain link. Nothing to show →
// returns false so callers can toast.
export async function openApplicationPortfolio(
  app: {
    portfolioType?: 'link' | 'file';
    portfolio?: string;
    portfolioUrl?: string;
    portfolioFile?: File | null;
    portfolioStoragePath?: string | null;
  },
): Promise<boolean> {
  const storagePath = app.portfolioStoragePath;
  if (storagePath) {
    const signed = await getPortfolioSignedUrl(storagePath);
    if (signed) {
      window.open(signed, '_blank', 'noopener,noreferrer');
      return true;
    }
  }
  const file = app.portfolioFile;
  const url = app.portfolioUrl ?? app.portfolio;
  if (file && app.portfolioType === 'file') {
    const objectUrl = URL.createObjectURL(file);
    const win = window.open(objectUrl, '_blank', 'noopener,noreferrer');
    if (!win) {
      const a = document.createElement('a');
      a.href = objectUrl;
      a.target = '_blank';
      a.rel = 'noopener,noreferrer';
      a.click();
    }
    setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000);
    return true;
  }
  if (url) {
    window.open(url, '_blank', 'noopener,noreferrer');
    return true;
  }
  return false;
}

class ApplicationsStore {
  private applications: ApplicationType[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private busy: boolean = false;
  private nextId: number = 0;

  constructor() {
    // Live refresh when another device/tab updates applications.
    subscribeTableChanges('job_applications', () => {
      void this.refresh();
    });
    void this.refresh();
  }

  private mintId(): string {
    let max = 0;
    for (const app of this.applications) {
      const match = /^APP-(\d+)$/.exec(app.id);
      if (match) max = Math.max(max, Number(match[1]));
    }
    this.nextId = Math.max(this.nextId, max) + 1;
    return `APP-${String(this.nextId).padStart(3, '0')}`;
  }

  // Pull the RLS-visible rows from Supabase. On success the DB list replaces the
  // in-memory mirror; on failure the mirror is kept (submissions stay visible).
  private async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await authReady;
    try {
      const rows = await fetchApplications();
      this.applications = rows.map(toApplicationType);
      this.notify();
    } catch (err) {
      console.warn('[applicationsStore] hydration kept local data:', err);
    } finally {
      this.busy = false;
    }
  }

  // Public force-refetch entry (used by storeSync when auth settles — a
  // customer logging in must re-read their own RLS rows after an anon boot).
  refreshFromBackend(): Promise<void> {
    return this.refresh();
  }

  getApplications(): ApplicationType[] {
    return [...this.applications];
  }

  getApplicationById(id: string): ApplicationType | undefined {
    return this.applications.find((a) => a.id === id);
  }

  // In DB mode RLS means this only ever matches the signed-in customer's own
  // application for the job, which is exactly what the customer Job Board's
  // "Applied" badge checks. The Mock fallback mirror holds only rows created in
  // this session by this user.
  getApplicationByJobId(jobId: string): ApplicationType | undefined {
    return this.applications.find((a) => a.jobId === jobId);
  }

  // Submit an application. The local row is created and returned immediately;
  // the portfolio is uploaded and the row synced to the DB in the background.
  // On DB failure the local row is kept and the error is surfaced.
  async addApplication(
    app: Omit<ApplicationType, 'id' | 'status' | 'appliedDate' | 'appliedDateTime'> & {
      applicantProfileId?: string | null;
    },
  ): Promise<ApplicationType> {
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });

    const newApp: ApplicationType = {
      ...app,
      id: this.mintId(),
      status: 'Pending',
      appliedDate: dateStr,
      appliedDateTime: `${dateStr} ${timeStr}`,
    };
    this.applications = [...this.applications, newApp];
    this.notify();
    this.busy = true;

    try {
      let storagePath: string | null = null;
      if (
        app.portfolioType === 'file' &&
        app.portfolioFile &&
        app.applicantProfileId
      ) {
        storagePath = await uploadPortfolio(
          app.applicantProfileId,
          app.portfolioFile,
          app.portfolioFileName ?? (app.portfolioFile.name || 'resume'),
        );
      }

      const saved = await createApplication({
        applicantProfileId: app.applicantProfileId ?? null,
        jobId: app.jobId,
        firstName: app.firstName,
        lastName: app.lastName,
        fullName: app.name,
        email: app.email,
        contact: app.contact,
        position: app.position,
        skills: app.skills,
        coverLetter: app.skills,
        portfolioUrl: app.portfolioType === 'link' ? app.portfolio || null : null,
        portfolioStoragePath: storagePath,
      });

      // Adopt the DB row (server uuid id + storage path) so the cache matches
      // what a refresh/realtime will return.
      const mapped = toApplicationType(saved);
      mapped.portfolioFile = app.portfolioFile ?? null;
      mapped.portfolioFileName = app.portfolioFileName;
      this.applications = this.applications.map((a) => (a.id === newApp.id ? mapped : a));
      this.notify();
      return mapped;
    } catch (err) {
      // Keep the local submission; surface the sync failure but only when it's
      // not a plain RLS rejection we can quietly degrade on.
      if (!isRlsDenied(err)) {
        showDbError('applications.create', err);
      }
      return newApp;
    } finally {
      this.busy = false;
    }
  }

  updateStatus(id: string, status: ApplicationType['status']): void {
    this.updateApplication(id, { status });
  }

  // Local-first status/fields update, then best-effort DB sync.
  updateApplication(id: string, updates: Partial<ApplicationType>): void {
    this.applications = this.applications.map((a) =>
      a.id === id ? { ...a, ...updates } : a
    );
    this.notify();

    void (async () => {
      this.busy = true;
      try {
        await updateApplication(id, {
          status: updates.status,
          interviewDate: updates.interviewDate ?? null,
          interviewTime: updates.interviewTime ?? null,
          interviewLocation: updates.interviewLocation ?? null,
          rejectionReason: updates.rejectionReason ?? null,
        });
      } catch (err) {
        if (!isRlsDenied(err)) {
          showDbError('applications.update', err);
        }
      } finally {
        this.busy = false;
      }
    })();
  }

  subscribe(fn: Subscriber): () => void {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  }

  private notify(): void {
    this.subscribers.forEach((fn) => fn());
  }
}

export const applicationsStore = new ApplicationsStore();
