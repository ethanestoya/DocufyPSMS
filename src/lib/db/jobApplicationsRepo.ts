import { supabase } from '../supabaseClient';
import { BUCKETS, getSignedObjectUrl, uploadObjectAndGetPath } from './storage';
import type {
  ApplicationStatus,
  JobApplicationDto,
  JobApplicationInsert,
  JobApplicationRow,
  JobApplicationUpdate,
} from './types';

// Job applications repo — CRUD against `job_applications` + portfolio file
// uploads into the private `job-applications` bucket. RLS governs visibility:
// customers only see their own rows (applicant_profile_id = auth.uid()),
// staff/admin see everything.

// Joined job title comes through the `jobs(title)` relationship. The tables
// type may not model the FK, so the join result is read defensively.
interface RowWithJob extends JobApplicationRow {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  jobs?: { title: string } | any[] | null;
}

function readJoinedTitle(row: RowWithJob): string | null {
  const j = row.jobs;
  if (!j) return null;
  if (Array.isArray(j)) return j[0]?.title ?? null;
  return j.title ?? null;
}

function toDto(row: RowWithJob): JobApplicationDto {
  return {
    id: row.id,
    jobId: row.job_id,
    jobTitle: readJoinedTitle(row),
    applicantProfileId: row.applicant_profile_id,
    firstName: row.first_name,
    lastName: row.last_name,
    fullName: row.full_name,
    email: row.email,
    contact: row.contact,
    address: row.address,
    position: row.position,
    skills: row.skills,
    coverLetter: row.cover_letter,
    portfolioUrl: row.portfolio_url,
    portfolioStoragePath: row.portfolio_storage_path,
    portfolioFileName: null,
    portfolioFileType: null,
    status: row.status,
    interviewDate: row.interview_date,
    interviewTime: row.interview_time,
    interviewLocation: row.interview_location,
    rejectionReason: row.rejection_reason,
    appliedAt: row.applied_at,
    updatedAt: row.updated_at,
  };
}

// Fetch applications the calling role may see (RLS-filtered), newest first,
// with the job title joined back so admin lists can show it without a second
// lookup.
export async function fetchApplications(): Promise<JobApplicationDto[]> {
  const { data, error } = await supabase
    .from('job_applications')
    .select('*, jobs(title)')
    .order('applied_at', { ascending: false });
  if (error) throw error;
  return (data ?? []).map((row) => toDto(row as RowWithJob));
}

export interface CreateApplicationInput {
  applicantProfileId?: string | null;
  jobId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  contact: string;
  address?: string | null;
  position: string;
  skills?: string | null;
  coverLetter?: string | null;
  portfolioUrl?: string | null;
  portfolioStoragePath?: string | null;
}

export async function createApplication(input: CreateApplicationInput): Promise<JobApplicationDto> {
  const row: JobApplicationInsert = {
    applicant_profile_id: input.applicantProfileId ?? null,
    job_id: input.jobId,
    first_name: input.firstName,
    last_name: input.lastName,
    full_name: input.fullName,
    email: input.email,
    contact: input.contact,
    address: input.address ?? null,
    position: input.position,
    skills: input.skills ?? null,
    cover_letter: input.coverLetter ?? null,
    portfolio_url: input.portfolioUrl ?? null,
    portfolio_storage_path: input.portfolioStoragePath ?? null,
    status: 'Pending',
  };
  const { data, error } = await supabase
    .from('job_applications')
    .insert(row)
    .select('*')
    .single();
  if (error) throw error;
  return toDto(data as RowWithJob);
}

export interface UpdateApplicationInput {
  status?: ApplicationStatus;
  interviewDate?: string | null;
  interviewTime?: string | null;
  interviewLocation?: string | null;
  rejectionReason?: string | null;
  portfolioStoragePath?: string | null;
}

export async function updateApplication(id: string, input: UpdateApplicationInput): Promise<void> {
  const row: JobApplicationUpdate = {
    status: input.status,
    interview_date: input.interviewDate,
    interview_time: input.interviewTime,
    interview_location: input.interviewLocation,
    rejection_reason: input.rejectionReason,
    portfolio_storage_path: input.portfolioStoragePath,
  };
  const { error } = await supabase.from('job_applications').update(row).eq('id', id);
  if (error) throw error;
}

// Upload the applicant's portfolio file. The bucket is private and its storage
// RLS expects the FIRST folder segment to be the owner's uid, so the folder is
// the applicant's profile id. Returns the storage path.
export async function uploadPortfolio(
  applicantProfileId: string,
  file: Blob,
  fileName: string,
): Promise<string> {
  return uploadObjectAndGetPath({
    bucket: BUCKETS.jobApplications,
    folder: applicantProfileId,
    file,
    fileName,
    contentType: file.type || 'application/octet-stream',
  });
}

// Resolve a stored portfolio object to a short-lived signed URL so the private
// file can be opened in the browser's native viewer. Returns null when there's
// no path or the signed-URL call fails.
export async function getPortfolioSignedUrl(
  storagePath: string | null | undefined,
): Promise<string | null> {
  return getSignedObjectUrl(BUCKETS.jobApplications, storagePath);
}
