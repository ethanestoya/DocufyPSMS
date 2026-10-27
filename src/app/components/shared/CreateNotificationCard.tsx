import React, { useState } from "react";
import { Megaphone, Plus, BellRing, AlertOctagon, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ZoomSafeDropdown } from "../ui/zoom-safe-dropdown";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { announcementsStore, type AnnouncementPriority, ANNOUNCEMENT_PRIORITY_LABELS } from "../../utils/announcementsStore";
import { useAuth } from "../../contexts/AuthContext";

export default function CreateNotificationCard() {
  const { user } = useAuth();
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [priority, setPriority] = useState<AnnouncementPriority>("regular");
  const [showSendConfirm, setShowSendConfirm] = useState(false);

  const reset = () => {
    setTitle("");
    setMessage("");
    setPriority("regular");
  };

  const handleSend = () => {
    if (!title.trim()) {
      toast.error("Please enter an announcement title");
      return;
    }
    if (!message.trim()) {
      toast.error("Please write a message for the announcement");
      return;
    }
    announcementsStore.createAnnouncement({
      title: title.trim(),
      message: message.trim(),
      type: "announcement",
      priority,
      sentBy: user?.email ?? "",
    });
    toast.success(
      priority === "regular"
        ? "Announcement sent to customers."
        : `${ANNOUNCEMENT_PRIORITY_LABELS[priority]} announcement sent to customers.`,
    );
    setCreateOpen(false);
    setShowSendConfirm(false);
    reset();
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setCreateOpen(true)}
        className="h-10 bg-[#1668D9] text-white border-2 border-[#1668D9] hover:bg-[#10316B] hover:border-[#10316B] shadow-md px-4 text-sm font-semibold"
      >
        <Plus className="w-4 h-4 mr-1.5" />
        Create Announcement
      </Button>

      {/* Create Announcement Dialog */}
      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) reset();
        }}
      >
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-[#F2F7FF] text-[#1668D9] flex items-center justify-center">
                <BellRing className="w-5 h-5" />
              </div>
              <DialogTitle className="text-[#10316B]">
                Create Announcement
              </DialogTitle>
            </div>
            <DialogDescription>
              This announcement will be sent to customers across the system.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="dash-notif-title">Title</Label>
              <Input
                id="dash-notif-title"
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Docufy is temporarily paused"
                className="h-11 bg-white text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dash-notif-message">Message</Label>
              <Textarea
                id="dash-notif-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your announcement..."
                className="min-h-32 bg-white text-sm"
              />
            </div>
            <div className="space-y-2">
              <Label>Announcement Type</Label>
              <ZoomSafeDropdown
                label="Announcement type"
                value={priority}
                onChange={(v) => setPriority(v as AnnouncementPriority)}
                placeholder="Select type"
                triggerClassName="h-11 bg-white"
                options={[
                  { value: "regular", label: "Regular Announcement" },
                  { value: "important", label: "Important Announcement" },
                  { value: "emergency", label: "Emergency Announcement" },
                ]}
              />
              <p className="text-xs text-gray-500">
                {priority === "regular" &&
                  "Normal system announcement — appears in the unified notifications list."}
                {priority === "important" &&
                  "Highlighted announcement — shown with an Important badge in the list."}
                {priority === "emergency" &&
                  "Critical announcement — shown with an Emergency badge at the top of the list."}
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 w-full bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900 sm:w-auto"
              onClick={() => setCreateOpen(false)}
            >
              Cancel
            </Button>
            <Button
              className={`h-11 w-full sm:w-auto ${
                priority === "emergency"
                  ? "bg-red-600 hover:bg-red-700"
                  : priority === "important"
                    ? "bg-amber-500 hover:bg-amber-600"
                    : "bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              }`}
              onClick={() => setShowSendConfirm(true)}
            >
              {priority === "emergency" ? (
                <AlertOctagon className="w-4 h-4 mr-2" />
              ) : priority === "important" ? (
                <AlertTriangle className="w-4 h-4 mr-2" />
              ) : (
                <Megaphone className="w-4 h-4 mr-2" />
              )}
              Send {ANNOUNCEMENT_PRIORITY_LABELS[priority]} Announcement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Send Announcement Confirmation */}
      {showSendConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowSendConfirm}
          onConfirm={() => {
            handleSend();
            setShowSendConfirm(false);
          }}
          title={`Send ${ANNOUNCEMENT_PRIORITY_LABELS[priority]} announcement?`}
          description={`"${title}" goes to every customer and cannot be recalled.`}
          confirmLabel={`Send ${ANNOUNCEMENT_PRIORITY_LABELS[priority]} Announcement`}
          cancelLabel="Go Back"
          destructive={false}
        />
      )}
    </>
  );
}