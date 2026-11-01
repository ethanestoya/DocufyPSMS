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

function toDto(row: RowWithJob, avatar?: string | null): JobApplicationDto {
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
    applicantProfileImage: avatar ?? null,
  };
}

// `profiles.profile_image_path` holds the public URL for pictures uploaded by
// this build, but older rows can carry a bare storage path.
function resolveAvatar(value: string | null | undefined): string | null {
  if (!value) return null;
  if (/^(https?:\/\/|data:)/i.test(value)) return value;
  const { data } = supabase.storage.from('profile-images').getPublicUrl(value);
  return data.publicUrl;
}

// The applicant's photo lives on `profiles`, which the applications row only
// references by uuid. PostgREST cannot embed it without knowing the constraint
// name, so this is a second best-effort read: if it fails (or the caller may not
// read profiles) the board simply renders initials.
async function fetchApplicantAvatars(profileIds: string[]): Promise<Map<string, string>> {
  const ids = Array.from(new Set(profileIds.filter(Boolean)));
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('profiles')
    .select('id, profile_image_path')
    .in('id', ids);
  if (error) {
    console.warn('[db:jobApplications.avatars]', error);
    return new Map();
  }
  const map = new Map<string, string>();
  for (const row of (data ?? []) as Array<{ id: string; profile_image_path: string | null }>) {
    const url = resolveAvatar(row.profile_image_path);
    if (url) map.set(row.id, url);
  }
  return map;
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
  const rows = (data ?? []) as RowWithJob[];
  const avatars = await fetchApplicantAvatars(
    rows.map((row) => row.applicant_profile_id).filter((id): id is string => Boolean(id)),
  );
  return rows.map((row) => toDto(row, avatars.get(row.applicant_profile_id ?? '')));
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
  // Only the fields the caller actually supplied are written. Building the row
  // from every key with `?? null` meant moving an application to "Under Review"
  // also erased its interview slot and any rejection reason.
  const row: JobApplicationUpdate = {};
  if (input.status !== undefined) row.status = input.status;
  if (input.interviewDate !== undefined) row.interview_date = input.interviewDate;
  if (input.interviewTime !== undefined) row.interview_time = input.interviewTime;
  if (input.interviewLocation !== undefined) row.interview_location = input.interviewLocation;
  if (input.rejectionReason !== undefined) row.rejection_reason = input.rejectionReason;
  if (input.portfolioStoragePath !== undefined) row.portfolio_storage_path = input.portfolioStoragePath;
  if (Object.keys(row).length === 0) return;

  // `.select('id')` is what makes a rejected write visible: without it an
  // update that matches no visible row (deleted, or blocked by RLS) returns no
  // error and the caller would report success.
  const { data, error } = await supabase
    .from('job_applications')
    .update(row)
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if ((data ?? []).length === 0) {
    const notFound = new Error('No application row was updated') as Error & { code: string };
    notFound.code = 'PGRST116';
    throw notFound;
  }
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
