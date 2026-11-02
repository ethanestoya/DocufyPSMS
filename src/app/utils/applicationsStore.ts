// Centralized job applications store.
//
// Supabase-backed facade: the sync read API (getApplications / getApplicationById /
// getApplicationByJobId / subscribe) is unchanged for consumers. Hydration pulls
// the caller's RLS-visible rows (customers see only their own applications); the
// in-memory mirror is retained as the offline/Mock fallback so demo submissions
// keep working while the backend is unreachable.
//
// Submissions and status changes report whether the row actually landed. An
// applicant must never be shown a confirmation for an application that the shop
// never received, so a failed write withdraws the optimistic row instead of
// leaving a phantom entry in the board.
import { getErrorMessage, showDbError } from '../../lib/db/errors';
import { authReady } from '../../lib/supabaseClient';
import { subscribeTableChanges } from '../../lib/db/hooks';
import {
  createApplication,
  deleteApplicantPhoto,
  fetchApplications,
  getPortfolioSignedUrl,
  updateApplication,
  uploadApplicantPhoto,
  uploadPortfolio,
} from '../../lib/db/jobApplicationsRepo';
import type { JobApplicationDto } from '../../lib/db/types';
import { formatPHTime, toPHTKey } from './pht';

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
  // Photo sent with this application (optional). `applicantPhotoUrl` is its
  // resolved signed URL on the admin side; the fallback chain is
  // application photo → account profile photo → initials.
  photoFile?: File | null;
  photoStoragePath?: string | null;
  applicantPhotoUrl?: string | null;
  appliedDateTime: string;
  status: 'Pending' | 'Under Review' | 'For Interview' | 'Approved' | 'Rejected';
  appliedDate: string;
  interviewDate?: string;
  interviewTime?: string;
  interviewLocation?: string;
  rejectionReason?: string;
  // Profile photo of the applicant, resolved from `profiles` at read time.
  applicantProfileImage?: string | null;
};

export type AddApplicationResult = {
  application: ApplicationType;
  saved: boolean;
  error?: string;
};

type Subscriber = () => void;

function toApplicationType(dto: JobApplicationDto): ApplicationType {
  // PHT everywhere: `applied_at` is a UTC instant, and slicing its ISO string
  // would file an 11 PM submission under the next day.
  const dateStr = toPHTKey(dto.appliedAt);
  const timeStr = dto.appliedAt ? formatPHTime(dto.appliedAt) : '';
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
    photoStoragePath: dto.photoStoragePath,
    applicantPhotoUrl: dto.applicantPhotoUrl ?? null,
    appliedDateTime: `${dateStr} ${timeStr}`.trim(),
    status: dto.status,
    appliedDate: dateStr,
    interviewDate: dto.interviewDate ?? undefined,
    interviewTime: dto.interviewTime ?? undefined,
    interviewLocation: dto.interviewLocation ?? undefined,
    rejectionReason: dto.rejectionReason ?? undefined,
    applicantProfileImage: dto.applicantProfileImage ?? null,
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

  // Submit an application. The optimistic row appears immediately so the submit
  // feels instant, but the portfolio upload and the insert both have to succeed:
  // if either fails the row is withdrawn and `saved` is false, so the applicant
  // is told the truth instead of being handed an APP- id for nothing.
  async addApplication(
    app: Omit<ApplicationType, 'id' | 'status' | 'appliedDate' | 'appliedDateTime'> & {
      applicantProfileId?: string | null;
    },
  ): Promise<AddApplicationResult> {
    // One application per job per applicant. The board hides its Apply button
    // once a row exists, but a direct link, a double-tap or a resubmitted form
    // still reaches this path — so the check sits here, before any row is
    // pushed and before a file is uploaded, and leaves nothing behind.
    const existing = this.getApplicationByJobId(app.jobId);
    if (existing) {
      return {
        application: existing,
        saved: false,
        error: `You've already applied to this position (${applicationDisplayId(existing.id)}).`,
      };
    }

    const now = new Date();
    const dateStr = toPHTKey(now);
    const timeStr = formatPHTime(now);

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
    let photoPath: string | null = null;

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

      // The photo is uploaded before the row so the table never points at an
      // object that was never written. Without a profile id there is no owner
      // folder for the bucket's RLS, so it is skipped rather than attempted.
      if (app.photoFile && app.applicantProfileId) {
        photoPath = await uploadApplicantPhoto(
          app.applicantProfileId,
          app.photoFile,
          app.photoFile.name || 'photo',
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
        photoStoragePath: photoPath,
      });

      // The repo drops the photo (and says so) when the database has no
      // `photo_storage_path` column yet; the upload would then be an orphan.
      if (photoPath && !saved.photoStoragePath) {
        void deleteApplicantPhoto(photoPath);
        photoPath = null;
      }

      // Adopt the DB row (server uuid id + storage path) so the cache matches
      // what a refresh/realtime will return.
      const mapped = toApplicationType(saved);
      mapped.portfolioFile = app.portfolioFile ?? null;
      mapped.portfolioFileName = app.portfolioFileName;
      mapped.photoFile = app.photoFile ?? null;
      this.applications = this.applications.map((a) => (a.id === newApp.id ? mapped : a));
      this.notify();
      return { application: mapped, saved: true };
    } catch (err) {
      this.applications = this.applications.filter((a) => a.id !== newApp.id);
      this.notify();
      // The row never landed, so its photo must not linger in the bucket.
      if (photoPath) void deleteApplicantPhoto(photoPath);
      console.error('[db:applications.create]', err);
      return { application: newApp, saved: false, error: getErrorMessage(err) };
    } finally {
      this.busy = false;
    }
  }

  // Status / interview / rejection update. Resolves to whether the server took
  // it; on failure the previous row is put back so the admin's list keeps
  // matching the database (and the caller can say so instead of toasting
  // "updated" over a rejected write).
  async updateApplication(id: string, updates: Partial<ApplicationType>): Promise<boolean> {
    const previous = this.applications.find((a) => a.id === id);
    if (!previous) return false;
    const merged: ApplicationType = { ...previous, ...updates };

    const apply = (next: ApplicationType) => {
      this.applications = this.applications.map((a) => (a.id === id ? next : a));
      this.notify();
    };
    apply(merged);

    this.busy = true;
    try {
      await updateApplication(id, {
        status: merged.status,
        interviewDate: merged.interviewDate ?? null,
        interviewTime: merged.interviewTime ?? null,
        interviewLocation: merged.interviewLocation ?? null,
        rejectionReason: merged.rejectionReason ?? null,
      });
      return true;
    } catch (err) {
      apply(previous);
      showDbError('applications.update', err);
      return false;
    } finally {
      this.busy = false;
    }
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
