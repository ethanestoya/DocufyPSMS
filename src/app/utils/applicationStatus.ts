// One place for how an application status looks and reads.
//
// The five states are deliberately different hues: the shop works them in
// sequence, and the old board painted four of them the same blue, so neither
// "needs attention" nor "done" stood out at a glance.
export type ApplicationStatus =
  | 'Pending'
  | 'Under Review'
  | 'For Interview'
  | 'Approved'
  | 'Rejected';

export const APPLICATION_STATUSES: ApplicationStatus[] = [
  'Pending',
  'Under Review',
  'For Interview',
  'Approved',
  'Rejected',
];

type StatusStyle = {
  /** Badge classes, border included. */
  badge: string;
  /** Solid dot / icon chip used beside the status in lists. */
  dot: string;
};

const STYLES: Record<ApplicationStatus, StatusStyle> = {
  Pending: {
    badge: 'bg-slate-100 text-slate-700 border-slate-200',
    dot: 'bg-slate-400',
  },
  'Under Review': {
    badge: 'bg-amber-100 text-amber-800 border-amber-200',
    dot: 'bg-amber-500',
  },
  'For Interview': {
    badge: 'bg-blue-100 text-blue-800 border-blue-200',
    dot: 'bg-[#1668D9]',
  },
  Approved: {
    badge: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    dot: 'bg-emerald-500',
  },
  Rejected: {
    badge: 'bg-red-100 text-red-700 border-red-200',
    dot: 'bg-red-500',
  },
};

export function applicationStatusStyle(status: string): StatusStyle {
  return STYLES[status as ApplicationStatus] ?? STYLES.Pending;
}
