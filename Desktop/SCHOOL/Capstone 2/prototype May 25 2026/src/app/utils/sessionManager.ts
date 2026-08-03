// Session Manager for handling auto-logout after inactivity

const INACTIVITY_TIMEOUT = 15 * 60 * 1000; // 15 minutes in milliseconds

class SessionManager {
  private timeoutId: NodeJS.Timeout | null = null;
  private onLogout: (() => void) | null = null;

  init(logoutCallback: () => void) {
    this.onLogout = logoutCallback;
    this.resetTimer();
    this.attachEventListeners();
  }

  private resetTimer() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    this.timeoutId = setTimeout(() => {
      if (this.onLogout) {
        this.onLogout();
      }
    }, INACTIVITY_TIMEOUT);
  }

  private handleActivity = () => {
    this.resetTimer();
  };

  private attachEventListeners() {
    // Track user activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.addEventListener(event, this.handleActivity);
    });
  }

  destroy() {
    if (this.timeoutId) {
      clearTimeout(this.timeoutId);
    }

    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'];

    events.forEach(event => {
      document.removeEventListener(event, this.handleActivity);
    });

    this.onLogout = null;
  }
}

export const sessionManager = new SessionManager();
