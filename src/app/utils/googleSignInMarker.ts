// Written the moment a Google sign-in attempt starts and read back by whichever
// page the browser returns to. A round trip that finishes the normal way lands
// on /auth/callback, which clears it here — so a marker that is still set means
// the provider sent the tab somewhere else and nobody has taken the session
// home yet.
const GOOGLE_ATTEMPT_KEY = 'docufy_google_attempt';

// Only a marker from the last minute counts as an interrupted attempt. An older
// one is leftover from a sign-in that already completed in this tab, and must
// not hijack a page the visitor chose to open.
export const GOOGLE_ATTEMPT_TTL_MS = 60_000;

export function readGoogleAttemptStartedAt(): number | null {
  try {
    const value = sessionStorage.getItem(GOOGLE_ATTEMPT_KEY);
    if (!value) return null;
    const startedAt = Number(value);
    return Number.isFinite(startedAt) ? startedAt : null;
  } catch (error) {
    console.warn('[auth:google] Could not read the sign-in recovery marker:', error);
    return null;
  }
}

export function writeGoogleAttemptStartedAt(): void {
  try {
    sessionStorage.setItem(GOOGLE_ATTEMPT_KEY, String(Date.now()));
  } catch (error) {
    console.warn('[auth:google] Could not save the sign-in recovery marker:', error);
  }
}

export function clearGoogleAttemptStartedAt(): void {
  try {
    sessionStorage.removeItem(GOOGLE_ATTEMPT_KEY);
  } catch (error) {
    console.warn('[auth:google] Could not clear the sign-in recovery marker:', error);
  }
}
