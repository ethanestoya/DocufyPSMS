// ── Attendance management system — Morning / Afternoon session model ────────

export type SessionRecord = {
  timeIn?: Date;
  timeOut?: Date;
};

export type DailyAttendanceRecord = {
  id: string;
  userId: string;
  userName: string;
  role: 'admin' | 'staff';
  date: string; // YYYY-MM-DD
  morning: SessionRecord;
  afternoon: SessionRecord;
};

// Determines which action the user should perform next
export type NextAction =
  | 'morning-time-in'    // No morning session started yet
  | 'morning-time-out'   // Morning started but not ended
  | 'afternoon-time-in'  // Morning complete; afternoon not started
  | 'afternoon-time-out' // Afternoon started but not ended
  | 'complete';          // Both sessions fully recorded for today

// Backward-compat shapes kept for NewPrintRequest.tsx
export type AttendanceLog = {
  id: string;
  userId: string;
  userName: string;
  role: 'admin' | 'staff';
  timeIn: Date;
  timeOut?: Date;
  status: 'active' | 'inactive';
};

export type UserAvailability = {
  isTimedIn: boolean;
  currentLog?: AttendanceLog;
};

type Subscriber = () => void;

// ── Helpers ────────────────────────────────────────────────────────────────
const toDateKey = (d: Date = new Date()): string =>
  d.toISOString().split('T')[0]; // YYYY-MM-DD

const calcDurationMs = (start: Date, end: Date = new Date()): number =>
  Math.max(0, end.getTime() - start.getTime());

const formatDuration = (ms: number): string => {
  const h = Math.floor(ms / 3_600_000);
  const m = Math.floor((ms % 3_600_000) / 60_000);
  const s = Math.floor((ms % 60_000) / 1_000);
  return `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
};

export { formatDuration, calcDurationMs };

// ── Store ──────────────────────────────────────────────────────────────────
class AttendanceStore {
  private records: DailyAttendanceRecord[] = [];
  private subscribers: Set<Subscriber> = new Set();

  constructor() {
    const today = toDateKey();

    // Seed: admin has morning already clocked in (active)
    this.records = [
      {
        id: 'ATT-001',
        userId: 'admin@test.com',
        userName: 'Admin User',
        role: 'admin',
        date: today,
        morning: { timeIn: new Date() },
        afternoon: {},
      },
      // Historical records for admin
      {
        id: 'ATT-H1',
        userId: 'admin@test.com',
        userName: 'Admin User',
        role: 'admin',
        date: '2026-04-27',
        morning: {
          timeIn:  new Date('2026-04-27T08:00:00'),
          timeOut: new Date('2026-04-27T12:00:00'),
        },
        afternoon: {
          timeIn:  new Date('2026-04-27T13:00:00'),
          timeOut: new Date('2026-04-27T17:00:00'),
        },
      },
      {
        id: 'ATT-H2',
        userId: 'admin@test.com',
        userName: 'Admin User',
        role: 'admin',
        date: '2026-04-26',
        morning: {
          timeIn:  new Date('2026-04-26T08:05:00'),
          timeOut: new Date('2026-04-26T12:00:00'),
        },
        afternoon: {
          timeIn:  new Date('2026-04-26T13:00:00'),
          timeOut: new Date('2026-04-26T17:00:00'),
        },
      },
      // Historical records for staff
      {
        id: 'ATT-H3',
        userId: 'staff@test.com',
        userName: 'Staff User',
        role: 'staff',
        date: '2026-04-27',
        morning: {
          timeIn:  new Date('2026-04-27T08:00:00'),
          timeOut: new Date('2026-04-27T12:00:00'),
        },
        afternoon: {
          timeIn:  new Date('2026-04-27T13:00:00'),
          timeOut: new Date('2026-04-27T17:00:00'),
        },
      },
      {
        id: 'ATT-H4',
        userId: 'staff@test.com',
        userName: 'Staff User',
        role: 'staff',
        date: '2026-04-26',
        morning: {
          timeIn:  new Date('2026-04-26T08:10:00'),
          timeOut: new Date('2026-04-26T12:00:00'),
        },
        afternoon: {
          timeIn:  new Date('2026-04-26T13:00:00'),
          timeOut: new Date('2026-04-26T16:55:00'),
        },
      },
    ];
  }

  subscribe(callback: Subscriber): () => void {
    this.subscribers.add(callback);
    return () => this.subscribers.delete(callback);
  }

  private notify(): void {
    this.subscribers.forEach(cb => cb());
  }

  // ── Get or create today's record ──────────────────────────────────────
  private getOrCreateTodayRecord(
    userId: string,
    userName: string,
    role: 'admin' | 'staff',
  ): DailyAttendanceRecord {
    const today = toDateKey();
    let record = this.records.find(r => r.userId === userId && r.date === today);
    if (!record) {
      record = {
        id: `ATT-${Date.now()}`,
        userId,
        userName,
        role,
        date: today,
        morning: {},
        afternoon: {},
      };
      this.records.push(record);
    }
    return record;
  }

  // ── Determine next action for user ────────────────────────────────────
  getNextAction(userId: string): NextAction {
    const today = toDateKey();
    const record = this.records.find(r => r.userId === userId && r.date === today);
    if (!record || !record.morning.timeIn) return 'morning-time-in';
    if (!record.morning.timeOut)           return 'morning-time-out';
    if (!record.afternoon.timeIn)          return 'afternoon-time-in';
    if (!record.afternoon.timeOut)         return 'afternoon-time-out';
    return 'complete';
  }

  // ── Time In (smart — applies to next unfilled session) ────────────────
  timeIn(userId: string, userName: string, role: 'admin' | 'staff'): DailyAttendanceRecord {
    const record = this.getOrCreateTodayRecord(userId, userName, role);
    const now = new Date();

    if (!record.morning.timeIn) {
      record.morning.timeIn = now;
    } else if (!record.morning.timeOut) {
      throw new Error('You are still in your Morning session. Please Time Out first.');
    } else if (!record.afternoon.timeIn) {
      record.afternoon.timeIn = now;
    } else if (!record.afternoon.timeOut) {
      throw new Error('You are still in your Afternoon session. Please Time Out first.');
    } else {
      throw new Error('Both Morning and Afternoon sessions have already been recorded for today.');
    }

    this.notify();
    return record;
  }

  // ── Time Out (smart — closes the currently active session) ───────────
  timeOut(userId: string): DailyAttendanceRecord {
    const today = toDateKey();
    const record = this.records.find(r => r.userId === userId && r.date === today);

    if (!record) {
      throw new Error('No attendance record found for today. Please Time In first.');
    }

    const now = new Date();

    if (record.morning.timeIn && !record.morning.timeOut) {
      record.morning.timeOut = now;
    } else if (record.afternoon.timeIn && !record.afternoon.timeOut) {
      record.afternoon.timeOut = now;
    } else {
      throw new Error('No active session to Time Out from.');
    }

    this.notify();
    return record;
  }

  // ── Today's record for a user ─────────────────────────────────────────
  getTodayRecord(userId: string): DailyAttendanceRecord | null {
    const today = toDateKey();
    return this.records.find(r => r.userId === userId && r.date === today) ?? null;
  }

  // ── All records for a user (newest date first) ───────────────────────
  getUserLogs(userId: string): DailyAttendanceRecord[] {
    return this.records
      .filter(r => r.userId === userId)
      .sort((a, b) => b.date.localeCompare(a.date));
  }

  // ── All records ───────────────────────────────────────────────────────
  getAllLogs(): DailyAttendanceRecord[] {
    return [...this.records].sort((a, b) => b.date.localeCompare(a.date));
  }

  // ── Check if a specific user is currently clocked in ─────────────────
  isUserAvailable(userId: string): boolean {
    return this.getNextAction(userId) === 'morning-time-out'
        || this.getNextAction(userId) === 'afternoon-time-out';
  }

  // ── Check if any user in a role is currently clocked in ──────────────
  isRoleAvailable(role: 'admin' | 'staff'): boolean {
    const today = toDateKey();
    return this.records.some(r => {
      if (r.role !== role || r.date !== today) return false;
      const morningActive   = !!r.morning.timeIn   && !r.morning.timeOut;
      const afternoonActive = !!r.afternoon.timeIn && !r.afternoon.timeOut;
      return morningActive || afternoonActive;
    });
  }

  // ── Backward-compat: availability for NewPrintRequest.tsx ────────────
  getAvailability(): { admin: UserAvailability; staff: UserAvailability } {
    const buildAvailability = (role: 'admin' | 'staff'): UserAvailability => {
      const today = toDateKey();
      const activeRecord = this.records.find(r => {
        if (r.role !== role || r.date !== today) return false;
        const morningActive   = !!r.morning.timeIn   && !r.morning.timeOut;
        const afternoonActive = !!r.afternoon.timeIn && !r.afternoon.timeOut;
        return morningActive || afternoonActive;
      });

      if (!activeRecord) return { isTimedIn: false };

      // Find active session's timeIn
      const activeTimeIn = !activeRecord.morning.timeOut && activeRecord.morning.timeIn
        ? activeRecord.morning.timeIn
        : activeRecord.afternoon.timeIn!;

      const legacyLog: AttendanceLog = {
        id:       activeRecord.id,
        userId:   activeRecord.userId,
        userName: activeRecord.userName,
        role:     activeRecord.role,
        timeIn:   activeTimeIn,
        status:   'active',
      };

      return { isTimedIn: true, currentLog: legacyLog };
    };

    return {
      admin: buildAvailability('admin'),
      staff: buildAvailability('staff'),
    };
  }

  // ── Backward-compat: getCurrentSession for existing consumers ─────────
  getCurrentSession(userId: string): AttendanceLog | null {
    const today = toDateKey();
    const record = this.records.find(r => r.userId === userId && r.date === today);
    if (!record) return null;

    const morningActive   = !!record.morning.timeIn   && !record.morning.timeOut;
    const afternoonActive = !!record.afternoon.timeIn && !record.afternoon.timeOut;

    if (!morningActive && !afternoonActive) return null;

    const activeTimeIn = morningActive
      ? record.morning.timeIn!
      : record.afternoon.timeIn!;

    return {
      id:       record.id,
      userId:   record.userId,
      userName: record.userName,
      role:     record.role,
      timeIn:   activeTimeIn,
      status:   'active',
    };
  }

  // ── Compute total worked hours for a record ───────────────────────────
  getTotalHours(record: DailyAttendanceRecord): number {
    let ms = 0;
    if (record.morning.timeIn && record.morning.timeOut) {
      ms += calcDurationMs(record.morning.timeIn, record.morning.timeOut);
    }
    if (record.afternoon.timeIn && record.afternoon.timeOut) {
      ms += calcDurationMs(record.afternoon.timeIn, record.afternoon.timeOut);
    }
    return parseFloat((ms / 3_600_000).toFixed(2));
  }

  // ── Overall daily status ──────────────────────────────────────────────
  getDayStatus(record: DailyAttendanceRecord): 'Complete' | 'Half-Day' | 'Incomplete' | 'Active' {
    const mDone = !!(record.morning.timeIn && record.morning.timeOut);
    const aDone = !!(record.afternoon.timeIn && record.afternoon.timeOut);
    const mActive = !!(record.morning.timeIn && !record.morning.timeOut);
    const aActive = !!(record.afternoon.timeIn && !record.afternoon.timeOut);

    if (mActive || aActive) return 'Active';
    if (mDone && aDone)     return 'Complete';
    if (mDone || aDone)     return 'Half-Day';
    return 'Incomplete';
  }
}

export const attendanceStore = new AttendanceStore();
