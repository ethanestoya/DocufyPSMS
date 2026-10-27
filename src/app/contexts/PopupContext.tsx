import React, { createContext, useContext, useState, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog";
import { Button } from "../components/ui/button";
import { CheckCircle2, AlertCircle, Info } from "lucide-react";

type PopupType = "success" | "error" | "info";

interface PopupState {
  message: string;
  type: PopupType;
  title?: string;
}

interface PopupContextValue {
  showPopup: (message: string, type?: PopupType, title?: string) => void;
}

const PopupContext = createContext<PopupContextValue | null>(null);

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const showPopup = useCallback(
    (message: string, type: PopupType = "info", title?: string) => {
      setPopup({ message, type, title });
    },
    [],
  );

  const close = () => setPopup(null);

  const icon =
    popup?.type === "success" ? (
      <CheckCircle2 className="w-10 h-10 text-emerald-500" />
    ) : popup?.type === "error" ? (
      <AlertCircle className="w-10 h-10 text-red-500" />
    ) : (
      <Info className="w-10 h-10 text-[#2F6FD6]" />
    );

  const heading =
    popup?.title ||
    (popup?.type === "success"
      ? "Success"
      : popup?.type === "error"
        ? "Error"
        : "Notice");

  return (
    <PopupContext.Provider value={{ showPopup }}>
      {children}
      {popup && (
        <Dialog open onOpenChange={() => close()}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <div className="flex justify-center mb-2">{icon}</div>
              <DialogTitle className="text-center text-lg">{heading}</DialogTitle>
              <DialogDescription className="text-center pt-1 whitespace-pre-line">
                {popup.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center">
              <Button
                onClick={close}
                className="bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
              >
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </PopupContext.Provider>
  );
}

export function usePopup() {
  const ctx = useContext(PopupContext);
  if (!ctx) throw new Error("usePopup must be used within PopupProvider");
  return ctx;
}