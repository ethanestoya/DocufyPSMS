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
import { AlertTriangle } from 'lucide-react';

interface ConfirmationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmationPhrase?: string;
  destructive?: boolean;
}

export function ConfirmationDialog({
  open,
  onOpenChange,
  onConfirm,
  title,
  description,
  confirmationPhrase = "DocuFy",
  destructive = true,
}: ConfirmationDialogProps) {
  const [inputValue, setInputValue] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) {
      setInputValue('');
      setError('');
    }
  }, [open]);

  const handleConfirm = () => {
    if (inputValue.trim() === confirmationPhrase) {
      onConfirm();
      onOpenChange(false);
      setInputValue('');
      setError('');
    } else {
      setError(`Please type "${confirmationPhrase}" exactly to confirm.`);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleConfirm();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <div className="flex items-center gap-3 mb-2">
            {destructive && (
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
            )}
            <DialogTitle className="text-xl">{title}</DialogTitle>
          </div>
          <DialogDescription className="text-base">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="confirmation-input" className="text-sm font-medium">
              Type <span className="font-bold text-red-400">"{confirmationPhrase}"</span> to confirm
            </Label>
            <Input
              id="confirmation-input"
              value={inputValue}
              onChange={(e) => {
                setInputValue(e.target.value);
                setError('');
              }}
              onKeyPress={handleKeyPress}
              placeholder={confirmationPhrase}
              className={error ? 'border-blue-500 focus-visible:ring-red-500' : ''}
              autoComplete="off"
            />
            {error && (
              <p className="text-sm text-red-400 font-medium">{error}</p>
            )}
          </div>

          <div className="bg-white border-2 border-blue-200 border border-green-200 rounded-lg p-3">
            <p className="text-sm text-amber-800">
              <strong>Warning:</strong> This action requires confirmation for maximum protection.
            </p>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            variant={destructive ? "destructive" : "default"}
            onClick={handleConfirm}
            disabled={!inputValue.trim()}
          >
            Confirm
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
