import React, { createContext, useContext, useState, useCallback, useEffect } from "react";
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

interface PopupAction {
  label: string;
  onClick: () => void;
}

interface PopupState {
  message: string;
  type: PopupType;
  title?: string;
  action?: PopupAction;
}

interface PopupContextValue {
  showPopup: (message: string, type?: PopupType, title?: string, action?: PopupAction) => void;
  closePopup: () => void;
}

const PopupContext = createContext<PopupContextValue | null>(null);

export function triggerGlobalPopup(
  message: string,
  type: PopupType = "info",
  title?: string,
  action?: PopupAction,
) {
  window.dispatchEvent(
    new CustomEvent("docufy:popup", { detail: { message, type, title, action } }),
  );
}

export function closeGlobalPopup() {
  window.dispatchEvent(new CustomEvent("docufy:popup-close"));
}

export function PopupProvider({ children }: { children: React.ReactNode }) {
  const [popup, setPopup] = useState<PopupState | null>(null);

  const showPopup = useCallback(
    (message: string, type: PopupType = "info", title?: string, action?: PopupAction) => {
      setPopup({ message, type, title, action });
    },
    [],
  );

  const closePopup = useCallback(() => setPopup(null), []);

  // Listen for popups triggered outside React (e.g. sessionManager).
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as PopupState;
      setPopup(detail);
    };
    const closeHandler = () => setPopup(null);
    window.addEventListener("docufy:popup", handler);
    window.addEventListener("docufy:popup-close", closeHandler);
    return () => {
      window.removeEventListener("docufy:popup", handler);
      window.removeEventListener("docufy:popup-close", closeHandler);
    };
  }, []);

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
    <PopupContext.Provider value={{ showPopup, closePopup }}>
      {children}
      {popup && (
        <Dialog open onOpenChange={() => closePopup()}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <div className="flex justify-center mb-2">{icon}</div>
              <DialogTitle className="text-center text-lg">{heading}</DialogTitle>
              <DialogDescription className="text-center pt-1 whitespace-pre-line">
                {popup.message}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="sm:justify-center gap-2">
              {popup.action && (
                <Button
                  onClick={() => {
                    popup.action!.onClick();
                    closePopup();
                  }}
                  className="bg-[#1668D9] text-white border-2 border-[#1668D9] hover:bg-[#10316B]"
                >
                  {popup.action.label}
                </Button>
              )}
              <Button
                onClick={closePopup}
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