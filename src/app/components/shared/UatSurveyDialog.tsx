import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";

const UAT_SURVEY_SHOWN_KEY = "docufy_uat_survey_shown_orders";
const UAT_SURVEY_LINK =
  "https://docs.google.com/forms/u/1/d/e/1FAIpQLSezdGyy4lcqa8K2-LNGPncg63LIaIBBc4VSwTEJ4yBAeQtCtQ/viewform";

function shownOrderIds(): string[] {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(UAT_SURVEY_SHOWN_KEY) ?? "[]",
    );
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    // A corrupt blob must never break the flow it is annotating.
    return [];
  }
}

/** Orders the survey has already been put in front of, so a reload or a retry
 *  of the same order does not ask a second time. */
export function hasSeenUatSurvey(orderId: string | null | undefined): boolean {
  return Boolean(orderId) && shownOrderIds().includes(orderId as string);
}

function markUatSurveySeen(orderId: string): void {
  try {
    const ids = shownOrderIds();
    if (!ids.includes(orderId)) {
      ids.push(orderId);
      localStorage.setItem(UAT_SURVEY_SHOWN_KEY, JSON.stringify(ids));
    }
  } catch {
    // Nothing to do if the browser refuses to store it.
  }
}

interface UatSurveyDialogProps {
  /** The completed order this ask is attached to; also the de-duplication key. */
  orderId: string | null;
  open: boolean;
  onDismiss: () => void;
}

/**
 * The UAT feedback ask, shown once per order at the points where a customer
 * finishes with Docufy for that order — an order placed (Cash on Pickup
 * included) or a payment submitted for verification.
 */
export function UatSurveyDialog({
  orderId,
  open,
  onDismiss,
}: UatSurveyDialogProps) {
  if (!orderId) return null;

  // Take, Skip, the X, Escape and a click outside all record the order as
  // asked; only the survey itself opens a new tab, and it closes back onto
  // whatever screen the customer was on so they choose their own next step.
  const closeAndRemember = (openForm: boolean) => {
    markUatSurveySeen(orderId);
    onDismiss();
    if (openForm) window.open(UAT_SURVEY_LINK, "_blank", "noopener,noreferrer");
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeAndRemember(false);
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Help Us Improve</DialogTitle>
          <DialogDescription className="text-[15px] leading-relaxed text-slate-600">
            Thank you for your order! To help us evaluate and refine the
            platform during this User Acceptance Testing (UAT) phase, please
            take a minute to complete our feedback survey. Your input is vital
            in making Docufy PSMS better for everyone.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-3 mt-2">
          <Button
            variant="primary"
            className="w-full h-11"
            data-primary-action
            onClick={() => closeAndRemember(true)}
          >
            Take Survey
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => closeAndRemember(false)}
          >
            Skip for Now
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
