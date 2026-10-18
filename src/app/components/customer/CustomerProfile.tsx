import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { LayoutDashboard, FileText, Briefcase, Package, User, Mail, Phone, ArrowLeft, AlertCircle, Key, Camera, ChevronRight, Lock, LogOut, Pencil } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '../Layout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import { useAuth, type User as AuthUser } from '../../contexts/AuthContext';
import { PasswordStrengthIndicator, validatePassword } from '../ui/password-strength-indicator';
import { isDataUrl } from '../../utils/supabaseAvatar';
import type { Database } from '../../../lib/database.types';

const menuItems = [
  { label: 'Dashboard', path: '/customer/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Print Request', path: '/customer/new-request', icon: <FileText className="w-5 h-5" /> },
  { label: 'My Orders', path: '/customer/orders', icon: <Package className="w-5 h-5" /> },
  { label: 'Job Board', path: '/customer/job-board', icon: <Briefcase className="w-5 h-5" /> },
];

// Profile data (name/phone/student ID) is stored PER ACCOUNT so a customer who
// signs out cannot leave their details behind for the next person on the same
// browser. The legacy shared key is adopted ONLY when it embeds the signed-in
// account's own email — otherwise it is ignored (leak-safe migration).
// Profile PICTURES are never stored locally — they live only in Supabase
// (profiles.profile_image_path), and legacy localStorage avatar keys are
// purged at boot (see supabaseAvatar.purgeLocalAvatarKeys).
const LEGACY_PROFILE_KEY = 'customer_profile_data';
const PROFILE_KEY_PREFIX = 'customer_profile_data_v2';

function accountKeyFor(user: AuthUser | null): string {
  if (!user) return 'unknown';
  if (user.id) return user.id;
  return user.email ? user.email.trim().toLowerCase() : 'unknown';
}

function profileStorageKey(user: AuthUser | null): string {
  return `${PROFILE_KEY_PREFIX}:${accountKeyFor(user)}`;
}

/** Reads the signed-in account's saved profile from its per-account key,
 * adopting the legacy shared blob only when it is attributable to THIS account
 * (its embedded email matches). Any other blob is left untouched so one
 * customer's data can never surface for another. Returns null when there is
 * nothing to show for the current account. */
function readSavedProfile(
  user: AuthUser | null,
): { firstName?: string; lastName?: string; email?: string; phone?: string; studentId?: string } | null {
  if (!user) return null;

  try {
    const raw = localStorage.getItem(profileStorageKey(user));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object') return parsed;
    }
  } catch {
    // ignore storage failures — fall through to legacy
  }

  try {
    const raw = localStorage.getItem(LEGACY_PROFILE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    const embedded =
      typeof parsed.email === 'string' ? parsed.email.trim().toLowerCase() : '';
    if (!embedded || embedded !== user.email?.trim().toLowerCase()) return null;

    // Adopt into the per-account key, then retire the legacy key so no later
    // account can be misattributed. (The legacy picture, if any, is NOT touched
    // here — avatars are Supabase-only, and legacy avatar keys were purged at boot.)
    try {
      localStorage.setItem(profileStorageKey(user), raw);
      localStorage.removeItem(LEGACY_PROFILE_KEY);
    } catch {
      // storage unavailable — legacy stays, but the form still renders
    }
    return parsed;
  } catch {
    return null;
  }
}

function buildFormData(
  user: AuthUser | null,
  saved: { firstName?: string; lastName?: string; email?: string; phone?: string; studentId?: string } | null,
) {
  const nameParts = (user?.name || '').split(' ');
  const defaultFirstName = nameParts[0] || '';
  const defaultLastName = nameParts.slice(1).join(' ') || '';
  return {
    firstName: saved?.firstName || defaultFirstName,
    lastName: saved?.lastName || defaultLastName,
    email: user?.email || saved?.email || '',
    phone: saved?.phone ?? user?.phone ?? '',
    studentId: saved?.studentId || '',
  };
}

/** Scannable read-only row used in the profile VIEW state. */
function InfoRow({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-3">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F7FF] text-[#1D73EC]">
        {icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-gray-500">{label}</p>
        <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{value || '—'}</p>
      </div>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400">{children}</h2>
  );
}

export default function CustomerProfile() {
  const navigate = useNavigate();
  const { user, resetPassword, updateProfile, updateProfileImage, syncProfileDetails, logout } = useAuth();
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState<{
    firstName: string;
    lastName: string;
    email: string;
    phone: string;
    studentId: string;
  }>(() => buildFormData(user, readSavedProfile(user)));
  const [isEditing, setIsEditing] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(() =>
    user?.profileImage ?? null,
  );

  useEffect(() => {
    setFormData(buildFormData(user, readSavedProfile(user)));
  }, [user]);

  useEffect(() => {
    setProfileImage(user?.profileImage ?? null);
  }, [user]);

  const displayName = `${formData.firstName} ${formData.lastName}`.trim() || user?.name || 'Customer User';
  const initials = displayName.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || 'U';

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Please choose an image smaller than 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      setProfileImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSave = () => {
    setShowSaveDialog(true);
  };

  const confirmSave = async () => {
    if (isSaving) return;
    if (!user) {
      setShowSaveDialog(false);
      return;
    }
    setIsSaving(true);

    // Text details (name/phone/student ID) write to the per-account blob
    // regardless of the upload/backend result, so nothing is lost locally.
    localStorage.setItem(profileStorageKey(user), JSON.stringify(formData));

    // The picture is Supabase-ONLY: upload first, best-effort.
    const pictureChanged = (profileImage ?? null) !== (user.profileImage ?? null);
    let pictureSynced = !pictureChanged;
    if (pictureChanged) {
      try {
        pictureSynced = await updateProfileImage(profileImage ?? null);
      } catch {
        pictureSynced = false;
      }
    }

    // Push text details to the signed-in user's OWN profiles row. The email is
    // excluded — it is the registered account email and is not editable.
    const patch: Database['public']['Tables']['profiles']['Update'] = {
      full_name: displayName,
      phone: formData.phone.trim() || null,
      student_id: formData.studentId.trim() || null,
    };
    let detailsSynced = false;
    try {
      detailsSynced = await syncProfileDetails(patch);
    } catch {
      detailsSynced = false;
    }

    updateProfile({ name: displayName });
    setIsSaving(false);

    const failures: string[] = [];
    if (!detailsSynced) failures.push('saving your details to the server');
    if (!pictureSynced) failures.push('uploading your profile picture');

    if (failures.length > 0) {
      toast.error(
        `Your details were kept on this device, but ${failures.join(' and ')} failed. `
        + 'Please try again — the dialog is still open.',
      );
      return;
    }

    setIsEditing(false);
    setShowSaveDialog(false);
    toast.success('Profile updated successfully.');
  };

  const handleChangePassword = async () => {
    console.log('Change password clicked');

    if (!passwordData.currentPassword || !passwordData.newPassword || !passwordData.confirmPassword) {
      toast.error('Please fill in all password fields');
      return;
    }

    // Check if current password is the same as new password
    if (passwordData.currentPassword === passwordData.newPassword) {
      toast.error('New password must be different from your current password');
      return;
    }

    // Validate password strength
    const passwordValidation = validatePassword(passwordData.newPassword);
    if (!passwordValidation.isValid) {
      toast.error('Password does not meet security requirements');
      return;
    }

    if (passwordData.newPassword !== passwordData.confirmPassword) {
      toast.error('New passwords do not match');
      return;
    }

    console.log('All validations passed, calling resetPassword');

    // Use the resetPassword function from AuthContext (with user email)
    if (user && await resetPassword(user.email, passwordData.currentPassword, passwordData.newPassword)) {
      console.log('Password reset successful');
      toast.success('Password changed successfully!');
      setShowChangePasswordDialog(false);
      setPasswordData({
        currentPassword: '',
        newPassword: '',
        confirmPassword: '',
      });
    } else {
      console.log('Password reset failed');
      toast.error('Current password is incorrect or password was previously used');
    }
  };

  return (
    <Layout menuItems={menuItems} title="Profile Settings" showBackButton backButtonPath="/customer/dashboard" hideMobileBackButton>
      <div className="max-w-2xl mx-auto space-y-5 px-4 pb-12 sm:px-0">
        {/* Back + page header (edit/view aware) */}
        <div className="pt-2 md:pt-6">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D73EC]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>
          <div className="mt-1 md:mt-6">
            <h1 className="text-xl font-bold tracking-tight text-gray-900 sm:text-2xl">
              {isEditing ? 'Edit Profile' : 'Profile'}
            </h1>
            <p className="mt-0.5 text-sm text-gray-500">
              {isEditing ? 'Update your personal information' : 'Manage your account information'}
            </p>
          </div>
        </div>

        {/* Profile Identity Card */}
        <Card className="bg-white shadow-sm">
          <div className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-4">
                <div className="flex shrink-0 flex-col items-start gap-1">
                  <div className="relative flex h-16 w-16 items-center justify-center rounded-full bg-[#1D73EC] text-lg font-semibold text-white ring-4 ring-white shadow-sm">
                    {profileImage ? (
                      <img src={profileImage} alt="Profile preview" className="h-full w-full rounded-full object-cover" />
                    ) : (
                      <span>{initials}</span>
                    )}
                    {isEditing && (
                      <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#1D73EC] text-white shadow-lg ring-2 ring-white">
                        <Camera className="h-4 w-4" />
                        <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
                      </label>
                    )}
                  </div>
                  {isEditing && profileImage && (
                    <button
                      type="button"
                      onClick={() => setProfileImage(null)}
                      className="whitespace-nowrap text-[11px] font-medium text-red-600 hover:underline"
                    >
                      Remove photo
                    </button>
                  )}
                  {!isEditing && profileImage && isDataUrl(profileImage) && (
                    <span className="whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                      Profile picture was not saved — upload failed
                    </span>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-lg font-semibold text-gray-900">{displayName}</p>
                  <p className="text-sm text-gray-500 capitalize">{user?.role} Account</p>
                </div>
              </div>
              {!isEditing && (
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(true)}
                  className="w-full shrink-0 sm:w-auto bg-white text-[#1D73EC] border-2 border-blue-200 hover:bg-[#1D73EC] hover:text-white"
                >
                  <Pencil className="w-4 h-4 mr-2" />
                  Edit Profile
                </Button>
              )}
            </div>
          </div>
        </Card>

        {/* Personal Information */}
        {isEditing ? (
          <Card className="bg-white shadow-sm">
            <div className="p-5">
              <SectionHeading>Personal Information</SectionHeading>
              <div className="mt-4 space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="firstName">First Name</Label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <Input
                      id="firstName"
                      type="text"
                      value={formData.firstName}
                      onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="lastName">Last Name</Label>
                  <div className="flex items-center gap-2">
                    <User className="w-4 h-4 text-gray-400" />
                    <Input
                      id="lastName"
                      type="text"
                      value={formData.lastName}
                      onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      disabled
                      aria-disabled="true"
                      title="Your registered email address cannot be changed"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="phone">Contact Number</Label>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <Input
                      id="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="studentId">Student ID</Label>
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    <Input
                      id="studentId"
                      type="text"
                      value={formData.studentId}
                      disabled
                      className="bg-gray-50 text-gray-500"
                    />
                  </div>
                  <p className="flex items-center gap-1 text-xs text-gray-400">
                    <Lock className="h-3 w-3" />
                    Student ID cannot be changed.
                  </p>
                </div>
              </div>

              {/* Edit mode actions */}
              <div className="mt-6 flex gap-3 border-t border-gray-100 pt-5">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                  className="flex-1 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900 h-12"
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleSave}
                  className="flex-1 bg-[#1D73EC] text-white hover:bg-[#10316B] h-12"
                >
                  Save Changes
                </Button>
              </div>
            </div>
          </Card>
        ) : (
          <Card className="bg-white shadow-sm">
            <div className="px-5 py-4">
              <SectionHeading>Personal Information</SectionHeading>
              <div className="mt-1 divide-y divide-gray-100">
                <InfoRow icon={<User className="h-4 w-4" />} label="First Name" value={formData.firstName} />
                <InfoRow icon={<User className="h-4 w-4" />} label="Last Name" value={formData.lastName} />
                <InfoRow icon={<Mail className="h-4 w-4" />} label="Email Address" value={formData.email} />
                <InfoRow icon={<Phone className="h-4 w-4" />} label="Contact Number" value={formData.phone} />
                <InfoRow icon={<FileText className="h-4 w-4" />} label="Student ID" value={formData.studentId} />
              </div>
            </div>
          </Card>
        )}

        {/* Account Security */}
        <Card className="bg-white shadow-sm">
          <div className="px-5 py-4">
            <SectionHeading>Account Security</SectionHeading>
            <button
              type="button"
              onClick={() => setShowChangePasswordDialog(true)}
              className="-mx-2 mt-2 flex w-full items-center justify-between gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-gray-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1D73EC]"
            >
              <span className="flex min-w-0 items-center gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#F2F7FF] text-[#1D73EC]">
                  <Key className="h-4 w-4" />
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-gray-900">Password</span>
                  <span className="block text-xs text-gray-500">Change your password</span>
                </span>
              </span>
              <ChevronRight className="h-5 w-5 shrink-0 text-gray-400" />
            </button>
          </div>
        </Card>

        {/* Sign Out (destructive, separate from profile content) */}
        <div className="pt-1 pb-4">
          <Button
            variant="outline"
            onClick={() => setShowLogoutConfirm(true)}
            className="h-12 w-full border-red-600 bg-red-600 text-white hover:bg-red-700 hover:border-red-700"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Sign Out
          </Button>
        </div>
      </div>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={(open) => { if (!isSaving) setShowSaveDialog(open); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-[#1D73EC]" />
              </div>
              <DialogTitle className="text-xl">Save Changes?</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Are you sure you want to save these changes to your profile?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowSaveDialog(false)}
              disabled={isSaving}
              className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900"
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSave}
              disabled={isSaving}
              loading={isSaving}
              loadingText="Saving..."
              className="bg-white text-[#1D73EC] border-2 border-blue-200 hover:bg-[#1D73EC] hover:text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Key className="w-6 h-6 text-[#1D73EC]" />
              </div>
              <DialogTitle className="text-xl">Change Password</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Enter your current password and choose a new one
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="currentPassword">Current Password</Label>
              <Input
                id="currentPassword"
                type="password"
                value={passwordData.currentPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, currentPassword: e.target.value }))}
                placeholder="Enter current password"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="newPassword">New Password</Label>
              <Input
                id="newPassword"
                type="password"
                value={passwordData.newPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, newPassword: e.target.value }))}
                placeholder="Enter new password (min. 8 characters)"
                className={passwordData.currentPassword && passwordData.newPassword && passwordData.currentPassword === passwordData.newPassword ? "border-red-500" : ""}
              />
              {passwordData.currentPassword && passwordData.newPassword && passwordData.currentPassword === passwordData.newPassword && (
                <div className="flex items-center gap-2 text-red-600 text-sm mt-1">
                  <AlertCircle className="w-4 h-4" />
                  <span>New password must be different from current password</span>
                </div>
              )}
              {passwordData.newPassword && (
                <div className="mt-2">
                  <PasswordStrengthIndicator password={passwordData.newPassword} />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm New Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={passwordData.confirmPassword}
                onChange={(e) => setPasswordData(prev => ({ ...prev, confirmPassword: e.target.value }))}
                placeholder="Re-enter new password"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900"
              onClick={() => {
                setShowChangePasswordDialog(false);
                setPasswordData({
                  currentPassword: '',
                  newPassword: '',
                  confirmPassword: '',
                });
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={!validatePassword(passwordData.newPassword).isValid || (passwordData.currentPassword === passwordData.newPassword && passwordData.currentPassword !== '')}
              className={`${
                validatePassword(passwordData.newPassword).isValid && !(passwordData.currentPassword === passwordData.newPassword && passwordData.currentPassword !== '')
                  ? "bg-white text-[#1D73EC] border-2 border-blue-200 hover:bg-[#1D73EC] hover:text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showLogoutConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowLogoutConfirm}
          onConfirm={() => { logout(); setShowLogoutConfirm(false); }}
          title="Sign out of Docufy?"
          description="You will be returned to the sign-in page. Your session will be preserved, but sign-in will be required to continue."
          confirmLabel="Sign Out"
          cancelLabel="Stay Signed In"
          destructive={false}
        />
      )}
    </Layout>
  );
}