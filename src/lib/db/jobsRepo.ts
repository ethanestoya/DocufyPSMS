import { supabase } from '../supabaseClient';
import type { JobDto, JobInsert, JobRow, JobStatus } from './types';

// Jobs domain repo — CRUD against the `jobs` table. RLS governs visibility:
// anonymous visitors and customers only see `active` rows; staff/admin see all.

function postedLabel(postedDate: string): string {
  if (!postedDate) return 'Recently';
  const d = new Date(`${postedDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return 'Recently';
  const days = Math.max(0, Math.floor((Date.now() - d.getTime()) / 86_400_000));
  if (days <= 0) return 'Today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return months === 1 ? '1 month ago' : `${months} months ago`;
  const years = Math.floor(months / 12);
  return years === 1 ? '1 year ago' : `${years} years ago`;
}

function toDto(row: JobRow): JobDto {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    type: row.job_type,
    duration: row.duration,
    department: row.department,
    location: row.location,
    salary: row.salary,
    schedule: row.schedule,
    requirements: row.requirements ?? [],
    responsibilities: row.responsibilities ?? [],
    status: row.status,
    postedDate: row.posted_date,
    posted: postedLabel(row.posted_date),
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

// Fetch all jobs the calling role may see (RLS-filtered), newest first.
export async function fetchJobs(): Promise<JobDto[]> {
  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toDto);
}

export interface SaveJobInput {
  id?: string;
  title: string;
  description: string;
  type: string;
  duration?: string | null;
  department?: string | null;
  location?: string | null;
  salary?: string | null;
  schedule?: string | null;
  requirements?: string[];
  responsibilities?: string[];
  status: JobStatus;
  postedDate: string;
}

// Insert (no id) or update (with id) a job. Returns the saved row as a DTO so
// the caller can adopt the server-assigned uuid id.
export async function saveJob(input: SaveJobInput): Promise<JobDto> {
  const body: JobInsert = {
    title: input.title,
    description: input.description,
    job_type: input.type,
    duration: input.duration ?? null,
    department: input.department ?? null,
    location: input.location ?? null,
    salary: input.salary ?? null,
    schedule: input.schedule ?? null,
    requirements: input.requirements ?? [],
    responsibilities: input.responsibilities ?? [],
    status: input.status,
    posted_date: input.postedDate,
  };

  const query = input.id
    ? supabase.from('jobs').update(body).eq('id', input.id).select('*').single()
    : supabase.from('jobs').insert(body).select('*').single();
  const { data, error } = await query;
  if (error) throw error;
  return toDto(data);
}

// Flip a job's lifecycle status (active ⇄ closed/archived).
export async function setJobStatus(id: string, status: JobStatus): Promise<void> {
  const { error } = await supabase.from('jobs').update({ status }).eq('id', id);
  if (error) throw error;
}
