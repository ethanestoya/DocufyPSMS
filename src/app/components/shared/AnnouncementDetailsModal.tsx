import React from "react";
import { AlertTriangle, Megaphone, Calendar, ArrowRight } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { toPHT } from "../../utils/pht";

export interface AnnouncementDetailData {
  title: string;
  message: string;
  timestamp: Date;
  priority?: "emergency" | "important";
  typeLabel?: string;
  priorityLabel?: string;
  action?: { label: string; run: () => void } | null;
}

interface AnnouncementDetailsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  announcement: AnnouncementDetailData | null;
}

function formatDetailTime(date: Date): string {
  const pht = toPHT(date);
  return pht.toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function AnnouncementDetailsModal({
  open,
  onOpenChange,
  announcement,
}: AnnouncementDetailsModalProps) {
  if (!announcement) return null;

  const isEmergency = announcement.priority === "emergency";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <div className="flex items-center gap-2 mb-2 flex-wrap">
            {announcement.priorityLabel && (
              <span
                className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
                  isEmergency
                    ? "bg-red-600 text-white"
                    : "bg-amber-500 text-white"
                }`}
              >
                <AlertTriangle className="w-3 h-3" />
                {announcement.priorityLabel}
              </span>
            )}
            {announcement.typeLabel && (
              <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded border bg-[#F2F7FF] text-[#1668D9] border-[#1668D9]/20">
                {announcement.typeLabel}
              </span>
            )}
          </div>
          <DialogTitle className="text-[#10316B] text-lg leading-snug">
            {announcement.title}
          </DialogTitle>
          <DialogDescription className="text-sm">
            <span className="inline-flex items-center gap-1.5 text-gray-500">
              <Calendar className="w-3.5 h-3.5" />
              {formatDetailTime(announcement.timestamp)}
            </span>
          </DialogDescription>
        </DialogHeader>
        <div className="whitespace-pre-wrap text-gray-700 text-sm leading-relaxed">
          {announcement.message}
        </div>
        <DialogFooter className="flex-col gap-2 sm:flex-row sm:items-center">
          <Button
            variant="outline"
            className="h-10 w-full sm:w-auto"
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
          {announcement.action && (
            <Button
              onClick={() => {
                onOpenChange(false);
                announcement.action?.run();
              }}
              className="h-10 w-full sm:w-auto bg-[#1668D9] text-white hover:bg-[#10316B]"
            >
              <ArrowRight className="w-4 h-4" /> {announcement.action.label}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
