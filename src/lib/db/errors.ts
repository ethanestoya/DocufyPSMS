import { toast } from 'sonner';

// PostgREST/GoTrue errors are developer diagnostics, not user copy. The raw
// text ("duplicate key value violates unique constraint \"...\"") used to be
// dropped straight into a toast (F22). Everything below maps a known failure
// family to a sentence a print-shop user can act on; anything unrecognised
// falls back to a neutral message, and the original error is still logged.
// The one sentence used when the failure has no recognisable cause. Exported so
// callers can tell "we know what went wrong" apart from "we don't".
export const UNKNOWN_SAVE_MESSAGE = 'Something went wrong while saving. Please try again.';

function humanize(raw: string): string {
  const msg = raw.toLowerCase();

  if (msg.includes('order file size limit exceeded')) {
    return 'Each order file must be 50 MB or smaller.';
  }
  if (
    msg.includes('duplicate key') ||
    msg.includes('unique constraint') ||
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already')
  ) {
    return 'That record already exists. Try editing it instead of adding a new one.';
  }
  // PGRST116 is PostgREST's "expected exactly one row, got zero". It is what a
  // `.single()` returns when the row was deleted on another device or never
  // reached the server, so the honest answer is "this is gone", not "something
  // went wrong". `getErrorMessage` prefixes the error code so this matches even
  // when the message wording changes between PostgREST versions.
  if (msg.includes('pgrst116') || msg.includes('json object requested')) {
    return 'This record no longer exists. Refresh the page and try again.';
  }
  // 42703: the query names a column the database doesn't have — the app and the
  // schema are out of step, which the person can fix by refreshing, not retrying.
  if (msg.includes('42703') || (msg.includes('does not exist') && msg.includes('column'))) {
    return 'This page is out of date with the server. Refresh the page and try again.';
  }
  // 22P02: a malformed uuid/literal reached a typed column.
  if (msg.includes('22p02') || msg.includes('invalid input syntax for type uuid')) {
    return "That record couldn't be identified. Refresh the page and try again.";
  }
  if (msg.includes('row-level security') || msg.includes('permission denied') || msg.includes('not allowed')) {
    return "You don't have permission to make that change.";
  }
  if (msg.includes('jwt') || msg.includes('not authenticated') || msg.includes('session') && msg.includes('expired')) {
    return 'Your session has expired. Please sign in again.';
  }
  if (
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('network error') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    msg.includes('fetch failed')
  ) {
    return "We couldn't reach the server. Check your connection and try again.";
  }
  if (msg.includes('foreign key')) {
    return "A related record is missing, so this change couldn't be saved.";
  }
  if (msg.includes('violates not-null') || msg.includes('null value in column')) {
    return 'A required field is missing. Please review the form and try again.';
  }
  if (msg.includes('check constraint')) {
    return "Some of the details aren't valid. Please review the form and try again.";
  }
  if (msg.includes('invalid input syntax') || msg.includes('out of range') || msg.includes('too long')) {
    return "One of the values isn't valid. Please check it and try again.";
  }
  // PGRST204/205/202 + 42P01: PostgREST can't find the table, column or function
  // the query names — the deployed page and the database schema are out of step.
  // Same remedy as 42703 (refresh), but these arrive with different wording.
  if (
    msg.includes('pgrst204') ||
    msg.includes('pgrst205') ||
    msg.includes('pgrst202') ||
    msg.includes('schema cache') ||
    msg.includes('could not find the table') ||
    msg.includes('could not find the function') ||
    msg.includes('42p01') ||
    msg.includes('undefined_table')
  ) {
    return 'This page is out of date with the server. Refresh the page and try again.';
  }
  if (
    msg.includes('payload too large') ||
    msg.includes('entity too large') ||
    msg.includes('exceeded the maximum allowed size') ||
    msg.includes('maximum allowed size') ||
    msg.includes('413')
  ) {
    return 'That file is too large to upload. Try a smaller file.';
  }
  if (msg.includes('mime') || msg.includes('content type') || msg.includes('invalid file type')) {
    return "That file type isn't supported. Use a PDF, Word, Excel, or image file.";
  }
  if (msg.includes('bucket') || msg.includes('storage')) {
    return "The file couldn't be uploaded. Please try again.";
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return UNKNOWN_SAVE_MESSAGE;
}

// Normalize any thrown value into a readable human message. Supabase library
// errors surface as Error instances whose message embeds the PostgREST text;
// auth errors are plain strings/maps. Never throw on inspection.
export function getErrorMessage(err: unknown): string {
  if (!err) return 'Something went wrong. Please try again.';
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error && err.message
        ? err.message
        : typeof err === 'object'
          ? (() => {
              const obj = err as Record<string, unknown>;
              if (typeof obj.message === 'string' && obj.message) return obj.message;
              if (typeof obj.error_description === 'string' && obj.error_description) return obj.error_description;
              if (typeof obj.error === 'string' && obj.error) return obj.error;
              if (typeof obj.details === 'string' && obj.details) return obj.details;
              if (typeof obj.hint === 'string' && obj.hint) return obj.hint;
              return '';
            })()
          : '';
  if (!raw) return 'Something went wrong. Please try again.';
  // PostgREST puts the machine-readable code in `code` and a prose message in
  // `message`. The prose is localized/unstable across versions, so the code is
  // folded in front of it for `humanize` to match on.
  const code =
    typeof err === 'object' && err && typeof (err as Record<string, unknown>).code === 'string'
      ? ((err as Record<string, unknown>).code as string)
      : '';
  return humanize(code ? `${code} ${raw}` : raw);
}

// Like `getErrorMessage`, but null when the cause is unrecognised. A caller that
// already knows the outcome ("saved here, rejected by the server") uses this so
// our neutral fallback never contradicts the sentence it builds itself.
export function getErrorDetail(err: unknown): string | null {
  const message = getErrorMessage(err);
  return message === UNKNOWN_SAVE_MESSAGE ? null : message;
}

// Log a DB failure and surface it as a toast. `action` names the operation so
// the console trail is greppable.
export function showDbError(action: string, err: unknown): void {
  const message = getErrorMessage(err);
  console.error(`[db:${action}]`, err);
  toast.error(message);
}

// Heuristic for "the request was rejected by Row Level Security" — used to
// decide whether a best-effort background operation should degrade quietly.
export function isRlsDenied(err: unknown): boolean {
  const raw =
    typeof err === 'string'
      ? err
      : err instanceof Error
        ? err.message
        : typeof err === 'object' && err
          ? String((err as Record<string, unknown>).message ?? '')
          : '';
  const msg = raw.toLowerCase();
  return (
    msg.includes('row-level security') ||
    msg.includes('permission denied') ||
    msg.includes('violates row-level security') ||
    msg.includes('new row violates') ||
    msg.includes('security barrier') ||
    msg.includes('is not allowed')
  );
}
