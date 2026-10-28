// Centralized jobs store for Job Board management.
//
// Supabase-backed facade: the sync read API (getJobs / getActiveJobs /
// getArchivedJobs / getJobById / subscribe) is unchanged for consumers, and the
// localStorage mirror + version-based default seeds are RETAINED so the job
// board still renders demo data when the backend is unreachable or the DB tables
// aren't set up yet. Hydration from Supabase replaces the mock list when the DB
// returns rows; every mutation applies locally first, then best-effort syncs to
// the DB (kept locally + surfaced on failure — never thrown).
import { fetchJobs, saveJob, setJobStatus } from '../../lib/db/jobsRepo';
import { authReady } from '../../lib/supabaseClient';
import type { JobDto } from '../../lib/db/types';
import { subscribeTableChanges } from '../../lib/db/hooks';
import { showDbError } from '../../lib/db/errors';
import { todayPHTKey } from './pht';

export type JobType = {
  id: string;
  title: string;
  description: string;
  type: string;
  duration: string;
  status: 'active' | 'closed' | 'archived';
  postedDate?: string;
  location?: string;
  requirements?: string[];
  responsibilities?: string[];
  department?: string;
  posted?: string;
  salary?: string;
  schedule?: string;
};

type Subscriber = () => void;

function toJobType(dto: JobDto): JobType {
  return {
    id: dto.id,
    title: dto.title,
    description: dto.description,
    type: dto.type,
    duration: dto.duration ?? '',
    status: dto.status,
    postedDate: dto.postedDate,
    location: dto.location ?? undefined,
    requirements: dto.requirements,
    responsibilities: dto.responsibilities,
    department: dto.department ?? undefined,
    posted: dto.posted,
    salary: dto.salary ?? undefined,
    schedule: dto.schedule ?? undefined,
  };
}

function padId(n: number): string {
  return `JOB-${String(n).padStart(3, '0')}`;
}

class JobsStore {
  private jobs: JobType[] = [];
  private subscribers: Set<Subscriber> = new Set();
  private initialized: boolean = false;
  private busy: boolean = false;
  private nextId: number = 0;

  constructor() {
    this.loadFromLocalStorage();
    // Live refresh when another device/tab mutates jobs.
    subscribeTableChanges('jobs', () => {
      void this.refresh();
    });
    void this.refresh();
  }

  // Initialize from localStorage on first access (mock/offline fallback).
  private loadFromLocalStorage(): void {
    if (this.initialized) return;

    try {
      const JOBS_VERSION = '1.1'; // Increment this to force jobs reset
      const storedVersion = localStorage.getItem('jobsStoreVersion');
      const stored = localStorage.getItem('jobsStore');

      // Reset jobs if version changed or no stored data
      if (!stored || storedVersion !== JOBS_VERSION) {
        this.jobs = this.getDefaultJobs();
        localStorage.setItem('jobsStoreVersion', JOBS_VERSION);
        this.saveToLocalStorage();
      } else {
        const parsed = JSON.parse(stored);
        this.jobs = Array.isArray(parsed) ? parsed : [];
      }
    } catch (error) {
      console.error('Failed to load jobs from localStorage:', error);
      this.jobs = this.getDefaultJobs();
    }

    this.syncNextId();
    this.initialized = true;
  }

  private syncNextId(): void {
    let max = 0;
    for (const job of this.jobs) {
      const match = /^JOB-(\d+)$/.exec(job.id);
      if (match) max = Math.max(max, Number(match[1]));
    }
    this.nextId = max;
  }

  private mintId(): string {
    this.nextId += 1;
    return padId(this.nextId);
  }

  // Save to localStorage
  private saveToLocalStorage(): void {
    try {
      localStorage.setItem('jobsStore', JSON.stringify(this.jobs));
    } catch (error) {
      console.error('Failed to save jobs to localStorage:', error);
    }
  }

  // Default job listings shown on first load
  private getDefaultJobs(): JobType[] {
    return [
      {
        id: 'JOB-001',
        title: 'Part-Time Print Shop Assistant',
        description:
          'Assist customers with print requests, handle document processing, operate printing and binding equipment, and help maintain the print shop. Ideal for students looking to gain hands-on experience in a fast-paced environment.',
        type: 'Part-Time',
        duration: '15-20 hours/week',
        status: 'active',
        department: 'General',
        posted: '2 days ago',
        postedDate: '2026-08-26',
      },
      {
        id: 'JOB-002',
        title: 'Document Encoding / Layout Assistant',
        description:
          'Handle document formatting, encoding, and layout design for customer print jobs. Requires attention to detail and basic familiarity with office/document software.',
        type: 'Part-Time',
        duration: '10-15 hours/week',
        status: 'active',
        department: 'General',
        posted: '5 days ago',
        postedDate: '2026-08-23',
      },
    ];
  }

  // Pull the latest rows from Supabase. DB wins when it returns rows; when the
  // table is empty or unreachable the local (mock/mirror) list is kept so the
  // board never appears blank during the migration.
  private async refresh(): Promise<void> {
    if (this.busy) return;
    this.busy = true;
    await authReady;
    try {
      const rows = await fetchJobs();
      if (rows.length > 0) {
        this.jobs = rows.map(toJobType);
        this.saveToLocalStorage();
        this.notify();
      }
    } catch (err) {
      console.warn('[jobsStore] hydration kept local data:', err);
    } finally {
      this.busy = false;
    }
  }

  // Public force-refetch entry (used by storeSync when auth settles; e.g. the
  // anon boot left the Board with mock rows because backend reads were denied).
  refreshFromBackend(): Promise<void> {
    return this.refresh();
  }

  getJobs(): JobType[] {
    this.loadFromLocalStorage();
    return [...this.jobs];
  }

  getActiveJobs(): JobType[] {
    this.loadFromLocalStorage();
    return this.jobs.filter(job => job.status === 'active');
  }

  getArchivedJobs(): JobType[] {
    this.loadFromLocalStorage();
    return this.jobs.filter(job => job.status === 'archived');
  }

  getJobById(id: string): JobType | undefined {
    this.loadFromLocalStorage();
    return this.jobs.find(job => job.id === id);
  }

  // Create a job. Applies locally immediately (so the board updates even while
  // offline), then tries the DB. On success the server-assigned id wins; on
  // failure the job stays local and a toast surfaces the sync error.
  async addJob(input: Omit<JobType, 'id' | 'status'> & { id?: string; status?: JobType['status'] }): Promise<JobType> {
    this.loadFromLocalStorage();
    const job: JobType = {
      ...input,
      id: input.id || this.mintId(),
      status: input.status ?? 'active',
      posted: input.posted ?? 'Just now',
      postedDate: input.postedDate ?? todayPHTKey(),
    };
    this.jobs = [...this.jobs, job];
    this.saveToLocalStorage();
    this.notify();

    try {
      const saved = await saveJob({
        title: job.title,
        description: job.description,
        type: job.type,
        duration: job.duration || null,
        department: job.department ?? null,
        location: job.location ?? null,
        salary: job.salary ?? null,
        schedule: job.schedule ?? null,
        requirements: job.requirements ?? [],
        responsibilities: job.responsibilities ?? [],
        status: job.status,
        postedDate: job.postedDate ?? todayPHTKey(),
      });
      // Adopt the DB row (server uuid id) so this instance matches what a
      // refresh/realtime will return.
      const mapped = toJobType(saved);
      this.jobs = this.jobs.map(j => (j.id === job.id ? mapped : j));
      this.saveToLocalStorage();
      this.notify();
      return mapped;
    } catch (err) {
      showDbError('jobs.create', err);
      return job;
    }
  }

  // Update a job (fields or lifecycle status). Local-first, then DB sync.
  async updateJob(id: string, updates: Partial<JobType>): Promise<void> {
    this.loadFromLocalStorage();
    const current = this.jobs.find(j => j.id === id);
    if (!current) return;
    const merged: JobType = { ...current, ...updates };
    this.jobs = this.jobs.map(j => (j.id === id ? merged : j));
    this.saveToLocalStorage();
    this.notify();

    try {
      if (updates.status && updates.status !== current.status) {
        await setJobStatus(id, updates.status);
        return;
      }
      const saved = await saveJob({
        id: current.id,
        title: merged.title,
        description: merged.description,
        type: merged.type,
        duration: merged.duration || null,
        department: merged.department ?? null,
        location: merged.location ?? null,
        salary: merged.salary ?? null,
        schedule: merged.schedule ?? null,
        requirements: merged.requirements ?? [],
        responsibilities: merged.responsibilities ?? [],
        status: merged.status,
        postedDate: merged.postedDate ?? todayPHTKey(),
      });
      const mapped = toJobType(saved);
      this.jobs = this.jobs.map(j => (j.id === id ? mapped : j));
      this.saveToLocalStorage();
      this.notify();
    } catch (err) {
      showDbError('jobs.update', err);
    }
  }

  archiveJob(id: string): void {
    void this.updateJob(id, { status: 'archived' });
  }

  unarchiveJob(id: string): void {
    void this.updateJob(id, { status: 'active' });
  }

  // Jobs have an archive-only lifecycle (no delete UI). Kept for API parity:
  // removes from the local list only — rows stay in the DB.
  deleteJob(id: string): void {
    this.loadFromLocalStorage();
    this.jobs = this.jobs.filter(job => job.id !== id);
    this.saveToLocalStorage();
    this.notify();
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => { this.subscribers.delete(callback); };
  }

  private notify(): void {
    this.subscribers.forEach(callback => callback());
  }
}

export const jobsStore = new JobsStore();
