import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './dialog';
import { Button } from './button';
import { Input } from './input';
import { Label } from './label';
import { AlertTriangle, CheckCircle } from 'lucide-react';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * May be sync OR async. When it returns a promise the dialog now STAYS OPEN
   * showing a spinner until that promise settles, then closes itself. That
   * fixes the silent-gap bug where the dialog vanished while the write was
   * still in flight (and made double-confirm possible).
   */
  onConfirm: () => void | Promise<void>;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  hideCancel?: boolean;
  destructive?: boolean;
  success?: boolean;
  requirePhrase?: boolean;
  confirmationPhrase?: string;
  loading?: boolean;
  /** Label to show on the confirm button while busy. Defaults to confirmLabel. */
  loadingText?: string;
  /**
   * Set to false when the caller's `onConfirm` manages its own closing (e.g. it
   * keeps the dialog open on a failed verification so the user can retry).
   * Defaults to true: the dialog closes itself once the promise settles.
   */
  closeOnConfirm?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  hideCancel = false,
  destructive = false,
  success = false,
  requirePhrase = false,
  confirmationPhrase = "Docufy",
  loading = false,
  loadingText,
  closeOnConfirm = true,
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');
  // True only while OUR OWN onConfirm promise is in flight. `loading` lets a
  // caller force the busy state (e.g. work that continues after the dialog is
  // dismissed); the two are OR-ed so existing usages behave as before.
  const [pending, setPending] = useState(false);
  const busy = loading || pending;

  useEffect(() => {
    if (!open) {
      setInputValue('');
      setError('');
      setPending(false);
    }
  }, [open]);

  const canConfirm = requirePhrase ? inputValue.trim() === confirmationPhrase : true;

  const handleConfirm = async () => {
    if (busy) return;
    if (requirePhrase && inputValue.trim() !== confirmationPhrase) {
      setError(`Please type "${confirmationPhrase}" exactly to confirm.`);
      return;
    }

    let result: void | Promise<void>;
    try {
      result = onConfirm();
    } catch (err) {
      console.error('[confirmation-dialog] onConfirm threw:', err);
      return;
    }

    // A sync onConfirm (the majority of call sites) closes immediately, exactly
    // as it always has.
    if (!(result instanceof Promise)) {
      if (closeOnConfirm) {
        onOpenChange(false);
        setInputValue('');
        setError('');
      }
      return;
    }

    setPending(true);
    try {
      await result;
    } catch (err) {
      // The dialog stays open on failure so the user can retry without losing
      // what they typed into the phrase field.
      console.error('[confirmation-dialog] onConfirm rejected:', err);
      return;
    } finally {
      setPending(false);
    }

    if (!closeOnConfirm) return;

    onOpenChange(false);
    setInputValue('');
    setError('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        {/* Wrapping in a form lets the shared dialog Enter handler (which finds a
            submit button) trigger the confirm action consistently with mouse clicks.
            The cancel button is type="button" so it never becomes the primary. */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleConfirm();
          }}
          className="contents"
        >
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div
                className={`w-10 h-10 rounded-full ring-1 flex items-center justify-center flex-shrink-0 ${
                  success
                    ? "bg-green-50 ring-green-200"
                    : destructive
                    ? "bg-red-50 ring-red-200"
                    : "bg-[#F2F7FF] ring-[#1668D9]/10"
                }`}
              >
                {success ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <AlertTriangle
                    className={`w-5 h-5 ${destructive ? "text-red-500" : "text-[#1668D9]"}`}
                  />
                )}
              </div>
              <DialogTitle className="text-xl">{title}</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              {description}
            </DialogDescription>
          </DialogHeader>

          {requirePhrase && (
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="confirmation-input" className="text-sm font-medium">
                  Type <span className="font-bold text-red-500">"{confirmationPhrase}"</span> to confirm
                </Label>
                <Input
                  id="confirmation-input"
                  value={inputValue}
                  onChange={(e) => {
                    setInputValue(e.target.value);
                    setError('');
                  }}
                  placeholder={confirmationPhrase}
                  className={error ? 'border-red-500 focus-visible:ring-red-500' : ''}
                  autoComplete="off"
                />
                {error && (
                  <p className="text-sm text-red-400 font-medium">{error}</p>
                )}
              </div>

              <div className="bg-red-50 border-2 border-red-200 rounded-lg p-3">
                <p className="text-sm text-red-700">
                  <strong>Warning:</strong> This action cannot be undone. It requires confirmation for maximum protection.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {!hideCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={busy}
                className="bg-gray-100 border-gray-300 text-gray-700 hover:bg-gray-200 hover:text-gray-900"
              >
                {cancelLabel}
              </Button>
            )}
            <Button
              type="submit"
              variant={destructive ? "destructive" : "default"}
              disabled={!canConfirm || busy}
              loading={busy}
              loadingText={loadingText ?? confirmLabel}
              className={destructive ? "bg-red-600 hover:bg-red-700" : "bg-[#2F6FD6] text-white hover:bg-[#2557b8]"}
            >
              {confirmLabel}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
