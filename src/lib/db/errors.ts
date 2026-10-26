import { toast } from 'sonner';

// PostgREST/GoTrue errors are developer diagnostics, not user copy. The raw
// text ("duplicate key value violates unique constraint \"...\"") used to be
// dropped straight into a toast (F22). Everything below maps a known failure
// family to a sentence a print-shop user can act on; anything unrecognised
// falls back to a neutral message, and the original error is still logged.
function humanize(raw: string): string {
  const msg = raw.toLowerCase();

  if (
    msg.includes('duplicate key') ||
    msg.includes('unique constraint') ||
    msg.includes('already registered') ||
    msg.includes('already exists') ||
    msg.includes('user already')
  ) {
    return 'That record already exists. Try editing it instead of adding a new one.';
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
  if (msg.includes('bucket') || msg.includes('storage')) {
    return "The file couldn't be uploaded. Please try again.";
  }
  if (msg.includes('rate limit') || msg.includes('too many requests')) {
    return 'Too many attempts. Please wait a moment and try again.';
  }
  return 'Something went wrong while saving. Please try again.';
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
  return humanize(raw);
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
