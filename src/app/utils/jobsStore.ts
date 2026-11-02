// Centralized jobs store for Job Board management.
//
// Supabase-backed facade: the sync read API (getJobs / getActiveJobs /
// getArchivedJobs / getJobById / subscribe) is unchanged for consumers, and the
// localStorage mirror + version-based default seeds are RETAINED so the job
// board still renders demo data when the backend is unreachable or the DB tables
// aren't set up yet. Hydration from Supabase replaces the mock list when the DB
// returns rows.
//
// Writes are NOT fire-and-forget: every mutation returns whether the row actually
// reached the server, and a failed write puts the local mirror back the way it
// was. A posting the shop believes it archived must not stay visible to
// applicants just because the request was rejected.
import { fetchJobs, saveJob, type SaveJobInput } from '../../lib/db/jobsRepo';
import { authReady } from '../../lib/supabaseClient';
import type { JobDto } from '../../lib/db/types';
import { subscribeTableChanges } from '../../lib/db/hooks';
import { showDbError } from '../../lib/db/errors';
import { isUuid } from '../../lib/db/uuid';
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

export type AddJobResult = { job: JobType; saved: boolean };

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

function toSaveInput(job: JobType, id?: string): SaveJobInput {
  return {
    id,
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
      const JOBS_VERSION = '1.2'; // Increment this to force jobs reset
      const storedVersion = localStorage.getItem('jobsStoreVersion');
      const stored = localStorage.getItem('jobsStore');

      // Reset jobs if version changed or no stored data
      if (!stored || storedVersion !== JOBS_VERSION) {
        this.jobs = this.getDefaultJobs();
        localStorage.setItem('jobsStoreVersion', JOBS_VERSION);
        this.saveToLocalStorage();
      } else {
        const parsed = JSON.parse(stored);
        this.jobs = Array.isArray(parsed) ? parsed.map((j: JobType) => this.withDemoDetails(j)) : [];
      }
    } catch (error) {
      console.error('Failed to load jobs from localStorage:', error);
      this.jobs = this.getDefaultJobs();
    }

    this.syncNextId();
    this.initialized = true;
  }

  // A browser that stored the demo postings before rate/schedule/duties existed
  // would otherwise keep showing the bare card forever. Only the two built-in
  // demo rows are filled in, and only when the field is still empty, so this can
  // never overwrite something the shop typed.
  private withDemoDetails(job: JobType): JobType {
    const demo = this.getDefaultJobs().find((d) => d.id === job.id);
    if (!demo) return job;
    return {
      ...job,
      salary: job.salary || demo.salary,
      schedule: job.schedule || demo.schedule,
      location: job.location || demo.location,
      department: job.department || demo.department,
      responsibilities: job.responsibilities?.length ? job.responsibilities : demo.responsibilities,
      requirements: job.requirements?.length ? job.requirements : demo.requirements,
    };
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
        department: 'Print Operations',
        location: 'Room 4, TBI Building, Palawan State University',
        salary: '₱80–₱100 per hour',
        schedule: 'Mon–Fri · 3–4 hour shifts',
        responsibilities: [
          'Take print requests at the counter and check each file before printing',
          'Run and monitor the printers, then check every job for quality',
          'Prepare binding, lamination and other finishing work',
          'Record released orders and keep the counter area tidy',
        ],
        requirements: [
          'Currently enrolled at PSU (any course)',
          'Comfortable opening and checking Word, Excel and PDF files',
          'Can commit to at least 15 hours a week',
          'No shop experience needed — we train you',
        ],
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
        department: 'Customer Support',
        location: 'Room 4, TBI Building, Palawan State University',
        salary: '₱75–₱95 per hour',
        schedule: 'Mon–Sat · flexible 2–4 hour shifts',
        responsibilities: [
          'Re-type and format customer documents before printing',
          'Fix page layout, margins and spacing on submitted files',
          'Check encoded work against the original for typos',
          'Send finished files back to the counter for printing',
        ],
        requirements: [
          'Currently enrolled at PSU (any course)',
          'Fast and accurate typing',
          'Working knowledge of Word, Excel and Google Docs',
          'Can work in short afternoon shifts',
        ],
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

  // Create a posting. The row appears locally at once, then the server decides:
  // on success its row (with the server uuid) replaces the optimistic one, on
  // failure the optimistic row is withdrawn so the shop is never shown a posting
  // that doesn't exist. `saved` tells the caller which happened.
  async addJob(input: Omit<JobType, 'id' | 'status'> & { id?: string; status?: JobType['status'] }): Promise<AddJobResult> {
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
      const saved = await saveJob(toSaveInput(job));
      const mapped = toJobType(saved);
      this.jobs = this.jobs.map(j => (j.id === job.id ? mapped : j));
      this.saveToLocalStorage();
      this.notify();
      return { job: mapped, saved: true };
    } catch (err) {
      this.jobs = this.jobs.filter(j => j.id !== job.id);
      this.saveToLocalStorage();
      this.notify();
      showDbError('jobs.create', err);
      return { job, saved: false };
    }
  }

  // Update any field or the lifecycle status in ONE write. Returns whether the
  // server accepted it; on failure the row is restored so the board keeps
  // matching the database.
  async updateJob(id: string, updates: Partial<JobType>): Promise<boolean> {
    this.loadFromLocalStorage();
    const current = this.jobs.find(j => j.id === id);
    if (!current) return false;
    const merged: JobType = { ...current, ...updates };

    const apply = (next: JobType) => {
      this.jobs = this.jobs.map(j => (j.id === id ? next : j));
      this.saveToLocalStorage();
      this.notify();
    };
    apply(merged);

    try {
      // A browser-only id (the demo seeds) has no row to update, so it is
      // inserted instead and adopts the uuid the server mints.
      const saved = await saveJob(toSaveInput(merged, isUuid(id) ? id : undefined));
      apply(toJobType(saved));
      return true;
    } catch (err) {
      apply(current);
      showDbError('jobs.update', err);
      return false;
    }
  }

  archiveJob(id: string): Promise<boolean> {
    return this.updateJob(id, { status: 'archived' });
  }

  unarchiveJob(id: string): Promise<boolean> {
    return this.updateJob(id, { status: 'active' });
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
