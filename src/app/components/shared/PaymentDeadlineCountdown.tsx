// Reusable countdown for payment deadlines (awaiting-payment orders).
// Shows remaining time (hh:mm:ss, then days) until the deadline, turning red
// when less than 24h remain or the deadline has already passed.
import { useEffect, useState } from "react";

function remainingParts(deadline: Date, now: Date) {
  const diff = deadline.getTime() - now.getTime();
  const past = diff < 0;
  const abs = Math.abs(diff);
  const days = Math.floor(abs / 86_400_000);
  const hours = Math.floor((abs % 86_400_000) / 3_600_000);
  const minutes = Math.floor((abs % 3_600_000) / 60_000);
  const seconds = Math.floor((abs % 60_000) / 1000);
  return { past, days, hours, minutes, seconds };
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

export function PaymentDeadlineCountdown({
  deadline,
  className = "",
}: {
  deadline: string;
  className?: string;
}) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  let parsed: Date;
  try {
    parsed = new Date(deadline);
    if (isNaN(parsed.getTime())) return null;
  } catch {
    return null;
  }

  const { past, days, hours, minutes, seconds } = remainingParts(parsed, now);
  const soon = !past && parsed.getTime() - now.getTime() < 86_400_000;
  const tone = past ? "text-red-600" : soon ? "text-amber-600" : "text-slate-700";

  const label = past ? "Expired" : `${days > 0 ? `${days}d ` : ""}${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  return (
    <span className={`inline-flex items-center gap-1 font-mono text-xs font-semibold ${tone} ${className}`}>
      {past && <span className="font-sans">⏳</span>}
      {label}
    </span>
  );
}
