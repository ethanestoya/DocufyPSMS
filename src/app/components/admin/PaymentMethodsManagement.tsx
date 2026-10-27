import React, { useState, useEffect, useRef } from "react";
import {
  QrCode,
  Plus,
  Edit2,
  Ban,
  UserCheck,
  Trash2,
  Download,
  Upload,
  X,
  User,
  Hash,
  Image,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { SummaryCard } from "../ui/summary-card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import { TableSkeleton } from "../ui/table-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { adminMenuItems } from "../../utils/adminMenuItems";
import { showDbError } from "../../../lib/db/errors";
import {
  paymentMethodsStore,
  downloadQRCode,
  methodQRFilename,
  type PaymentMethodType,
} from "../../utils/paymentMethodsStore";

const menuItems = adminMenuItems;

const QR_FILE_TYPES = ["image/png", "image/jpeg", "image/jpg", "image/webp", "image/svg+xml", "image/gif"];
const MAX_QR_SIZE_MB = 3;

type MethodForm = {
  name: string;
  accountName: string;
  accountNumber: string;
  qrCode?: string;
};

export default function PaymentMethodsManagement() {
  const [methods, setMethods] = useState<PaymentMethodType[]>([]);
  const [showFormDialog, setShowFormDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<MethodForm>({
    name: "",
    accountName: "",
    accountNumber: "",
    qrCode: undefined,
  });
  const [deleting, setDeleting] = useState<PaymentMethodType | null>(null);
  const [showSaveConfirm, setShowSaveConfirm] = useState(false);
  const [toggleMethod, setToggleMethod] = useState<PaymentMethodType | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const load = () => setMethods(paymentMethodsStore.getAllPaymentMethods());
    load();
    const unsubscribe = paymentMethodsStore.subscribe(load);
    return unsubscribe;
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm({ name: "", accountName: "", accountNumber: "", qrCode: undefined });
    setShowFormDialog(true);
  };

  const openEdit = (method: PaymentMethodType) => {
    setEditingId(method.id);
    setForm({
      name: method.name,
      accountName: method.accountName,
      accountNumber: method.accountNumber,
      qrCode: method.qrCode,
    });
    setShowFormDialog(true);
  };

  const handleQRUpload = (file: File | undefined) => {
    if (!file) return;
    if (!QR_FILE_TYPES.includes(file.type)) {
      toast.error("Please upload an image file (PNG, JPG, WebP, SVG, or GIF).");
      return;
    }
    if (file.size > MAX_QR_SIZE_MB * 1024 * 1024) {
      toast.error(`QR image is too large. Please use an image under ${MAX_QR_SIZE_MB} MB.`);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setForm((f) => ({ ...f, qrCode: reader.result as string }));
      toast.success("QR code image added.");
    };
    reader.onerror = () => toast.error("Could not read the QR image file.");
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const name = form.name.trim();
    const accountName = form.accountName.trim();
    const accountNumber = form.accountNumber.trim();

    if (!name) return toast.error("Please enter the payment method name");
    if (!accountName) return toast.error("Please enter the account name / account holder");
    if (paymentMethodsStore.nameExists(name, editingId || undefined)) {
      return toast.error("A payment method with this name already exists");
    }

    try {
      if (editingId) {
        await paymentMethodsStore.updatePaymentMethod(editingId, {
          name,
          accountName,
          accountNumber,
          qrCode: form.qrCode,
        });
        toast.success("Payment method updated successfully");
      } else {
        await paymentMethodsStore.addPaymentMethod({
          name,
          accountName,
          accountNumber,
          qrCode: form.qrCode,
        });
        toast.success("Payment method created successfully");
      }
    } catch (err) {
      showDbError("saving the payment method", err);
      return;
    }
    setShowSaveConfirm(false);
    setShowFormDialog(false);
    setEditingId(null);
    setForm({ name: "", accountName: "", accountNumber: "", qrCode: undefined });
  };

  const toggleActive = async (method: PaymentMethodType) => {
    try {
      await paymentMethodsStore.setActive(method.id, !method.active);
    } catch (err) {
      showDbError("updating the payment method", err);
      return;
    }
    toast.success(
      method.active
        ? `${method.name} deactivated - no longer available to customers`
        : `${method.name} activated - now available to customers`,
    );
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    try {
      await paymentMethodsStore.deletePaymentMethod(deleting.id);
    } catch (err) {
      showDbError("removing the payment method", err);
      return;
    }
    toast.success(`${deleting.name} payment method removed`);
    setDeleting(null);
  };

  const hydrating = useHydrating();
  const activeCount = methods.filter((m) => m.active).length;

  return (
    <Layout menuItems={menuItems} title="Payment Methods" showBackButton>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
          <p className="text-gray-600 mt-1">
            Manage the online payment methods customers can use. Any changes
            here instantly update the customer side.
          </p>
          <Button
            className="h-11 sm:h-10 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
            onClick={openAdd}
          >
            <Plus className="w-4 h-4 mr-2" />
            Add Payment Method
          </Button>
        </div>

        {/* Summary */}
        <div className="grid grid-cols-1 @min-[720px]:grid-cols-3 gap-3 sm:gap-4">
          <SummaryCard icon={QrCode} label="Total Methods" value={methods.length} iconBg="bg-[#F2F7FF]" iconColor="text-[#1668D9]" />
          <SummaryCard icon={UserCheck} label="Active for Customers" value={activeCount} iconBg="bg-green-50" iconColor="text-green-600" />
          <SummaryCard icon={Ban} label="Inactive" value={methods.length - activeCount} iconBg="bg-gray-100" iconColor="text-gray-500" />
        </div>

        {/* Method Cards */}
        {hydrating ? (
          <Card className="p-8">
            <TableSkeleton columns={3} rows={6} />
          </Card>
        ) : methods.length === 0 ? (
          <Card className="p-16 text-center">
            <QrCode className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">No payment methods yet</p>
            <p className="text-sm text-gray-500 mt-1">
              Add your first online payment method to make it available to customers.
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 @min-[1100px]:grid-cols-3 gap-6">
            {methods.map((method) => (
              <Card
                key={method.id}
                className={`p-6 shadow-sm hover:shadow-md transition-shadow ${
                  method.active ? "" : "opacity-75"
                }`}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-100 bg-white flex items-center justify-center shrink-0">
                      {method.qrCode ? (
                        <img
                          src={method.qrCode}
                          alt={`${method.name} QR`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <QrCode className="w-6 h-6 text-gray-300" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-gray-900 truncate">{method.name}</h3>
                      <p className="text-xs text-gray-500 truncate">
                        {method.accountName}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={
                      method.active
                        ? "bg-green-50 text-green-700 border border-green-200"
                        : "bg-red-50 text-red-700 border border-red-200"
                    }
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 ${
                        method.active ? "bg-green-500" : "bg-red-400"
                      }`}
                    />
                    {method.active ? "Active" : "Inactive"}
                  </Badge>
                </div>

                <div className="space-y-2 text-sm mb-4">
                  <div className="flex items-center gap-2 text-gray-600">
                    <User className="w-4 h-4 text-[#2F6FD6] shrink-0" />
                    <span className="truncate">{method.accountName}</span>
                  </div>
                  {method.accountNumber?.trim() && (
                    <div className="flex items-center gap-2 text-gray-600">
                      <Hash className="w-4 h-4 text-[#2F6FD6] shrink-0" />
                      <span className="font-mono truncate">{method.accountNumber}</span>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t flex items-center justify-between gap-2 flex-wrap">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-[#2F6FD6] border-[#2F6FD6]/40 hover:bg-[#F2F7FF] h-8"
                    onClick={() => downloadQRCode(method.qrCode, methodQRFilename(method))}
                    disabled={!method.qrCode}
                  >
                    <Download className="w-3.5 h-3.5 mr-1" />
                    Download QR
                  </Button>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Edit payment method"
                      onClick={() => openEdit(method)}
                    >
                      <Edit2 className="w-4 h-4 text-[#2F6FD6]" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={method.active ? "Deactivate" : "Activate"}
                      className={method.active ? "group bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-all" : "hover:bg-green-50"}
                      onClick={() => setToggleMethod(method)}
                    >
                      {method.active ? (
                        <Ban className="w-4 h-4 text-red-500 group-hover:text-white" />
                      ) : (
                        <UserCheck className="w-4 h-4 text-green-600" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Delete payment method"
                      className="group bg-red-50 hover:bg-red-500 text-red-500 hover:text-white transition-all"
                      onClick={() => setDeleting(method)}
                    >
                      <Trash2 className="w-4 h-4 text-red-500 group-hover:text-white" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Add / Edit Dialog */}
      <Dialog
        open={showFormDialog}
        onOpenChange={(open) => {
          setShowFormDialog(open);
          if (!open) {
            setEditingId(null);
            setForm({ name: "", accountName: "", accountNumber: "", qrCode: undefined });
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-[#10316B]">
              {editingId ? "Edit Payment Method" : "Add Payment Method"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Customers see changes immediately."
                : "Available to customers right away."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="pm-name">Payment Method Name <span className="text-red-500">*</span></Label>
              <Input
                id="pm-name"
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. GCash"
                className="h-11 bg-white text-sm border-gray-300 focus:border-[#2F6FD6] focus:ring-[#2F6FD6]/20"
              />
              <p className="text-xs text-gray-500">
                Auto-detection of the reference number only works for GCash.
                Other methods require the customer to enter the reference manually.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-account-name">Account Name / Account Holder <span className="text-red-500">*</span></Label>
              <Input
                id="pm-account-name"
                type="text"
                value={form.accountName}
                onChange={(e) => setForm({ ...form, accountName: e.target.value })}
                placeholder="e.g. Juan Dela Cruz"
                className="h-11 bg-white text-sm border-gray-300 focus:border-[#2F6FD6] focus:ring-[#2F6FD6]/20"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="pm-account-number">
                Account Number / Payment Account{" "}
                <span className="font-normal text-gray-500">(optional)</span>
              </Label>
              <Input
                id="pm-account-number"
                type="text"
                value={form.accountNumber}
                onChange={(e) => setForm({ ...form, accountNumber: e.target.value })}
                placeholder="e.g. 09XXXXXXXXX"
                className="h-11 bg-white text-sm border-gray-300 focus:border-[#2F6FD6] focus:ring-[#2F6FD6]/20"
              />
              <p className="text-xs text-gray-500">
                Leave this blank if the method has no account number to show.
              </p>
            </div>

            <div className="space-y-2">
              <Label>QR Code</Label>
              {form.qrCode ? (
                <div className="flex items-center gap-3 p-3 bg-white border-2 border-[#1668D9]/15 rounded-lg">
                  <img
                    src={form.qrCode}
                    alt="QR preview"
                    className="w-20 h-20 object-contain border border-gray-100 rounded-lg bg-white shrink-0"
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">QR image ready</p>
                    <p className="text-xs text-gray-500">
                      This QR will be shown to customers and can be downloaded.
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    title="Remove QR"
                   className="text-red-500 hover:bg-red-500 hover:text-white rounded p-0.5 transition-all"
                   onClick={() => setForm({ ...form, qrCode: undefined })}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <label className="cursor-pointer block">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-[#2F6FD6] transition-colors">
                    <Image className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-sm font-medium text-gray-700">Upload QR Code</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Image files only (PNG, JPG, WebP, SVG, GIF) · under 3 MB
                    </p>
                  </div>
                  <Input
                    ref={fileInputRef}
                    type="file"
                    accept={QR_FILE_TYPES.join(",")}
                    className="hidden"
                    onChange={(e) => {
                      handleQRUpload(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
              <p className="text-xs text-gray-500 flex items-start gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                Optional — if you skip this, a placeholder QR will be generated
                for the payment method.
              </p>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="h-11 w-full sm:w-auto"
              onClick={() => setShowFormDialog(false)}
            >
              Cancel
            </Button>
            <Button
              data-primary-action
              className="h-11 w-full sm:w-auto bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowSaveConfirm(true)}
            >
              {editingId ? (
                <>
                  <Edit2 className="w-4 h-4 mr-2" /> Save Changes
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-2" /> Add Payment Method
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Save / Add Payment Method Confirmation */}
      {showSaveConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowSaveConfirm}
          onConfirm={async () => {
            await handleSave();
          }}
          loadingText={editingId ? "Saving..." : "Adding..."}
          closeOnConfirm={false}
          title={editingId ? "Save Changes?" : "Add Payment Method?"}
          description={
            editingId
              ? `Are you sure you want to update "${form.name.trim()}"? Its name, account details, and QR code will change immediately for customers.`
              : `Create payment method "${form.name.trim()}"? It becomes available on the customer payment page immediately.`
          }
          confirmLabel={editingId ? "Save Changes" : "Add Payment Method"}
          cancelLabel="Go Back"
          destructive={false}
        />
      )}

      {/* Activate / Deactivate Confirmation */}
      {toggleMethod && (
        <ConfirmationDialog
          open
          onOpenChange={() => setToggleMethod(null)}
          onConfirm={async () => {
            await toggleActive(toggleMethod);
            setToggleMethod(null);
          }}
          loadingText={toggleMethod.active ? "Deactivating..." : "Activating..."}
          closeOnConfirm={false}
          title={toggleMethod.active ? "Deactivate Payment Method?" : "Activate Payment Method?"}
          description={
            toggleMethod.active
              ? `Deactivate "${toggleMethod.name}"? Customers can no longer choose it. Existing orders keep their reference.`
              : `Activate "${toggleMethod.name}" so customers can pay with it again?`
          }
          confirmLabel={toggleMethod.active ? "Deactivate" : "Activate"}
          cancelLabel="Go Back"
          destructive={toggleMethod.active}
        />
      )}

      {/* Delete Confirm */}
      {deleting && (
        <ConfirmationDialog
          open
          onOpenChange={() => setDeleting(null)}
          onConfirm={confirmDelete}
          loadingText="Removing..."
          closeOnConfirm={false}
          title="Remove Payment Method?"
          description={`Remove "${deleting.name}"? Existing orders keep their reference. This cannot be undone.`}
          confirmLabel="Remove"
          cancelLabel="Keep Item"
          destructive
          requirePhrase
        />
      )}
    </Layout>
  );
}