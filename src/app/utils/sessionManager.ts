// Session Manager for handling auto-logout after inactivity.
//
// Two behaviours matter here and both were missing:
//  1. The timer used to reset on `mousemove`, so merely nudging the mouse kept
//     a walk-away session alive indefinitely — the "15-minute timeout" never
//     actually fired for anyone with a live mouse (F36).
//  2. There was no warning: an idle user was signed out with no notice and lost
//     whatever they had typed (F36).
//
// Activity now means an intentional input (key, click, scroll, touch, focus).
// One minute before the sign-out, a persistent toast offers "Stay signed in"
// which resets the clock.
import { toast } from 'sonner';

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes
const WARNING_LEAD = 60 * 1000; // warn 1 minute before sign-out
const WARNING_TOAST_ID = 'docufy-idle-warning';

class SessionManager {
  private timeoutId: ReturnType<typeof setTimeout> | null = null;
  private warningId: ReturnType<typeof setTimeout> | null = null;
  private onLogout: (() => void) | null = null;
  private initialised = false;

  init(logoutCallback: () => void) {
    this.onLogout = logoutCallback;
    this.resetTimer();
    if (!this.initialised) {
      this.attachEventListeners();
      this.initialised = true;
    }
  }

  /** Call after a deliberate action (e.g. the warning's "Stay signed in"). */
  touch() {
    this.resetTimer();
  }

  private clearTimers() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
      this.timeoutId = null;
    }
    if (this.warningId) {
      clearTimeout(this.warningId);
      this.warningId = null;
    }
    toast.dismiss(WARNING_TOAST_ID);
  }

  private resetTimer() {
    this.clearTimers();

    this.warningId = setTimeout(() => {
      toast('Still there?', {
        id: WARNING_TOAST_ID,
        description:
          "You'll be signed out in 1 minute because of inactivity. Any unsaved changes will be lost.",
        duration: Infinity,
        action: {
          label: 'Stay signed in',
          onClick: () => this.resetTimer(),
        },
      });
    }, Math.max(INACTIVITY_TIMEOUT - WARNING_LEAD, 0));

    this.timeoutId = setTimeout(() => {
      this.clearTimers();
      if (this.onLogout) this.onLogout();
    }, INACTIVITY_TIMEOUT);
  }

  private handleActivity = () => {
    this.resetTimer();
  };

  private attachEventListeners() {
    // Deliberately NOT `mousemove`: it fires from ambient pointer drift and
    // would make the idle timeout unreachable.
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'focusin',
    ] as const;

    events.forEach((event) => {
      document.addEventListener(event, this.handleActivity, { passive: true });
    });
  }

  destroy() {
    this.clearTimers();
    const events = [
      'mousedown',
      'keydown',
      'scroll',
      'touchstart',
      'click',
      'focusin',
    ] as const;
    events.forEach((event) => {
      document.removeEventListener(event, this.handleActivity);
    });
    this.onLogout = null;
    this.initialised = false;
  }
}

export const sessionManager = new SessionManager();
