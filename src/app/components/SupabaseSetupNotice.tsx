import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, RefreshCw } from "lucide-react";
import { SUPABASE_ENV_TEMPLATE } from "../../lib/supabaseEnv";

// Shown INSTEAD of the app when the Supabase environment variables are missing.
//
// Before this screen existed the app rendered a completely blank white page with
// no console hint, because `createClient(undefined, undefined)` threw during
// module evaluation — React never mounted, so there was nothing to show. This
// component is imported by `main.tsx` on its own (it does not pull in the app
// graph), so it can always render even when the backend is unconfigured.
export default function SupabaseSetupNotice({
  missing,
  reason,
}: {
  missing: string[];
  reason?: string;
}) {
  const [copied, setCopied] = useState(false);

  // Make the tab name say why nothing is loading instead of "Docufy".
  useEffect(() => {
    document.title = "Setup required — Docufy";
  }, []);

  const hasMissing = missing.length > 0;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(SUPABASE_ENV_TEMPLATE);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable (insecure context / older browser): the block below
      // is selectable, so the user can still copy it manually.
      setCopied(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f6f7f9] p-4 sm:p-6">
      <section
        role="alert"
        className="w-full max-w-2xl rounded-2xl border border-slate-200/70 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-8"
      >
        <header className="flex items-start gap-4">
          <span className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-amber-50 ring-2 ring-amber-200">
            <AlertTriangle className="h-5 w-5 text-amber-700" />
          </span>
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight text-[#1c1f26] sm:text-xl">
              Supabase isn&apos;t configured yet
            </h1>
            <p className="mt-1 text-sm leading-relaxed text-slate-500">
              {hasMissing
                ? "Docufy loaded, but it has no backend to talk to, so there’s nothing to show yet. This is a one-time setup step — no application code is broken."
                : "Docufy loaded, but the Supabase connection could not be opened, so there’s nothing to show yet. Check the configuration below, then restart."}
            </p>
          </div>
        </header>

        {/* What Vite could not find / what went wrong. */}
        {hasMissing && (
          <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50/60 p-4">
            <p className="text-[13px] font-semibold text-amber-900">
              Missing {missing.length === 1 ? "variable" : "variables"}
            </p>
            <ul className="mt-2 space-y-1.5">
              {missing.map((key) => (
                <li
                  key={key}
                  className="font-mono text-[13px] text-amber-900 break-all"
                >
                  {key}
                </li>
              ))}
            </ul>
          </div>
        )}

        {reason && (
          <div className="mt-5 rounded-xl border border-red-200 bg-red-50/60 p-4">
            <p className="text-[13px] font-semibold text-red-900">
              Connection error
            </p>
            <p className="mt-1.5 font-mono text-[13px] text-red-900 break-words">
              {reason}
            </p>
          </div>
        )}

        {/* What to do. */}
        <ol className="mt-5 space-y-3 text-sm text-slate-600">
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#F2F7FF] text-[11px] font-semibold text-[#1668D9]">
              1
            </span>
            <span className="leading-relaxed">
              Create a file named <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-700">.env.local</code> in the project root (the same folder as <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-700">package.json</code>).
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#F2F7FF] text-[11px] font-semibold text-[#1668D9]">
              2
            </span>
            <span className="leading-relaxed">
              Paste the block below and fill it in from your Supabase Dashboard under{" "}
              <strong className="font-semibold text-slate-700">Project Settings → API</strong>.
            </span>
          </li>
          <li className="flex gap-3">
            <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-[#F2F7FF] text-[11px] font-semibold text-[#1668D9]">
              3
            </span>
            <span className="leading-relaxed">
              Restart the dev server — Vite only reads{" "}
              <code className="rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[13px] text-slate-700">.env.local</code>{" "}
              at startup, so it will not pick the file up while running.
            </span>
          </li>
        </ol>

        {/* Copyable template. */}
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200">
          <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-2">
            <span className="font-mono text-[12.5px] text-slate-500">.env.local</span>
            <button
              type="button"
              onClick={handleCopy}
              className="inline-flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 py-1 text-[12.5px] font-medium text-slate-600 transition-colors hover:border-[#1668D9] hover:text-[#1668D9]"
            >
              {copied ? (
                <>
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>
          <pre className="overflow-x-auto bg-white px-4 py-3 font-mono text-[12.5px] leading-relaxed text-slate-700 select-text">
{SUPABASE_ENV_TEMPLATE}
          </pre>
        </div>

        <footer className="mt-5 flex items-start gap-2 rounded-xl bg-[#F2F7FF] px-4 py-3">
          <RefreshCw className="mt-0.5 h-4 w-4 flex-shrink-0 text-[#1668D9]" />
          <p className="text-[13px] leading-relaxed text-slate-600">
            After saving, run{" "}
            <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[13px] text-slate-700">npm run dev</code>{" "}
            again. This screen disappears on its own once both values are present.
          </p>
        </footer>
      </section>
    </main>
  );
}
