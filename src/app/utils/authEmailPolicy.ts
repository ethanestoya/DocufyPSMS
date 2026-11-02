/**
 * Organization-email policy.
 *
 * Docufy is an internal print-shop system: only addresses on the organization's
 * own domain may create an account or sign in. Personal email providers
 * (Gmail, Yahoo, Outlook, ...) are rejected everywhere.
 *
 * The SAME lists are enforced a second time by a Postgres trigger on
 * `auth.users` (see the SQL handed over in chat - it is deliberately NOT kept
 * in supabase/migrations/). When you change anything here, change it there
 * too, or a signup can pass one gate and be stopped by the other.
 */

/** Domains that may hold an account. */
export const ALLOWED_EMAIL_DOMAINS = [
  'psu.palawan.edu.ph', // the organization's own domain
  'test.com', // demo staff / admin / customer logins
];

/**
 * Domains that are allowed even though they are not on the main list.
 * Empty by default - used to re-open a group of addresses in one line.
 */
export const EXEMPT_DOMAINS: string[] = [];

/**
 * Individual addresses that are allowed regardless of their domain.
 * Used for a single personal account that must keep working.
 */
export const EXEMPT_EMAILS = [
  'printwithdocufy@gmail.com', // the shop owner's own account
];

/** Shown wherever a personal / non-organization address is rejected. */
export const EMAIL_POLICY_MESSAGE =
  'Use your organization email address (e.g. name@psu.palawan.edu.ph). Personal email providers like Gmail, Yahoo, or Outlook are not allowed.';

/** The lowercased domain part of an address, or '' when there isn't one. */
export function getEmailDomain(email: string | null | undefined): string {
  if (!email) return '';
  const at = email.lastIndexOf('@');
  if (at < 0 || at === email.length - 1) return '';
  return email.slice(at + 1).trim().toLowerCase();
}

/** True when the address may hold an account. */
export function isAllowedEmail(email: string | null | undefined): boolean {
  const value = (email || '').trim().toLowerCase();
  if (!value || !value.includes('@')) return false;

  if (EXEMPT_EMAILS.includes(value)) return true;

  const domain = getEmailDomain(value);
  if (!domain) return false;

  if (EXEMPT_DOMAINS.includes(domain)) return true;

  return ALLOWED_EMAIL_DOMAINS.includes(domain);
}

/**
 * The database trigger on `auth.users` refuses the insert of a disallowed
 * address, and Supabase reports that as a generic "Database error saving new
 * user" failure. Detect it so the UI can explain the real reason instead of
 * showing a raw database error.
 */
export function isPolicyTriggerError(message?: string | null): boolean {
  const text = (message || '').toLowerCase();
  if (!text) return false;
  return (
    text.includes('not allowed to create an account') ||
    text.includes('saving new user')
  );
}

/**
 * Gate used by every sign-up / sign-in path.
 * `reason` lets the callers word the failure the way their screen needs it.
 */
export function checkEmailAllowed(
  email: string | null | undefined,
): { allowed: boolean; reason?: 'domain' | 'invalid'; message?: string } {
  const value = (email || '').trim();
  if (!value || !value.includes('@')) {
    return {
      allowed: false,
      reason: 'invalid',
      message: 'Please enter a valid email address.',
    };
  }
  if (!isAllowedEmail(value)) {
    return { allowed: false, reason: 'domain', message: EMAIL_POLICY_MESSAGE };
  }
  return { allowed: true };
}
