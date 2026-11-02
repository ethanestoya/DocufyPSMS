import * as React from "react";
import { AlertCircle } from "lucide-react";

import { cn } from "./utils";

/**
 * Inline field error.
 *
 * Rendered directly under the field it belongs to, linked from the control with
 * `aria-describedby` and marked with `aria-invalid`, so the reason a form will
 * not submit is visible next to the input that needs fixing — and announced by a
 * screen reader — instead of appearing as a toast that vanishes and leaves no
 * trace on the form.
 *
 * `role="alert"` is correct here because the element is only inserted when the
 * message exists; it does not interrupt while the user is typing.
 */
export function FieldError({
  id,
  message,
  className,
}: {
  /** id referenced by the field's `aria-describedby`. */
  id?: string;
  /** Nothing renders when this is empty. */
  message?: string | null;
  className?: string;
}) {
  if (!message) return null;
  return (
    <p
      id={id}
      role="alert"
      className={cn(
        "flex items-start gap-1.5 text-sm font-medium text-[#B42318]",
        className,
      )}
    >
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </p>
  );
}

/**
 * `aria-describedby` value for a field that shows both a helper line and an
 * error. Pass the ids that are actually rendered.
 */
export function describedBy(
  ...ids: (string | false | null | undefined)[]
): string | undefined {
  const value = ids.filter(Boolean).join(" ");
  return value || undefined;
}
