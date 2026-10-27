import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { adminMenuItems } from '../../utils/adminMenuItems';
import { User, Mail, Phone, Calendar, Shield, Save, ArrowLeft, CheckCircle, Key, BriefcaseBusiness, AlertCircle, Camera } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '../Layout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { ConfirmationDialog } from '../ui/confirmation-dialog';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordStrengthIndicator, validatePassword } from '../ui/password-strength-indicator';
import { isDataUrl } from '../../utils/supabaseAvatar';
import type { Database } from '../../../lib/database.types';

const menuItems = adminMenuItems;

const STORAGE_KEY = 'admin_profile_data';

const defaultProfileData = {
  firstName: 'Admin',
  lastName: 'User',
  email: 'admin@test.com',
  phone: '+63 917 123 4567',
  adminId: 'ADM-001',
  position: 'System Administrator',
  joinDate: 'January 1, 2024',
  workStatus: 'Active',
};

export default function AdminProfile() {
  const navigate = useNavigate();
  const { user, resetPassword, updateProfile, updateProfileImage, syncProfileDetails, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  // Saving uploads the avatar to Supabase Storage, so it is a real round-trip.
  const [saving, setSaving] = useState(false);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(() => user?.profileImage || null);
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const nameParts = (user?.name || '').split(' ');
    const defaultFirstName = nameParts[0] || defaultProfileData.firstName;
    const defaultLastName = nameParts.slice(1).join(' ') || defaultProfileData.lastName;

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Handle migration from old 'fullName' field to firstName/lastName
        if (parsed.fullName && !parsed.firstName && !parsed.lastName) {
          const parts = parsed.fullName.split(' ');
          return {
            ...parsed,
            firstName: parts[0] || defaultFirstName,
            lastName: parts.slice(1).join(' ') || defaultLastName,
            email: user?.email || parsed.email
          };
        }
        return {
          ...parsed,
          firstName: parsed.firstName || defaultFirstName,
          lastName: parsed.lastName || defaultLastName,
          email: user?.email || parsed.email
        };
      } catch {
        return {
          ...defaultProfileData,
          firstName: defaultFirstName,
          lastName: defaultLastName,
          email: user?.email || defaultProfileData.email
        };
      }
    }
    return {
      ...defaultProfileData,
      firstName: defaultFirstName,
      lastName: defaultLastName,
      email: user?.email || defaultProfileData.email
    };
  });

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Please choose an image smaller than 2MB.');
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfileImage(typeof reader.result === 'string' ? reader.result : null);
    reader.readAsDataURL(file);
  };

  const handleSave = async () => {
    const displayName =
      `${formData.firstName} ${formData.lastName}`.trim() || user?.name || 'Admin User';
    setSaving(true);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
      // The picture is Supabase-ONLY: it must reach storage + the profiles table
      // before it counts. A failed upload never falls back to localStorage — the
      // chosen picture stays in the form so the user can retry, clearly surfaced.
      const pictureChanged = (profileImage ?? null) !== (user?.profileImage ?? null);
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
      };
      let detailsSynced = false;
      try {
        detailsSynced = await syncProfileDetails(patch);
      } catch {
        detailsSynced = false;
      }

      updateProfile({ name: displayName });
      setSaving(false);

      const failures: string[] = [];
      if (!detailsSynced) failures.push('saving your details to the server');
      if (!pictureSynced) failures.push('uploading your profile picture');

      if (failures.length > 0) {
        toast.error(
          `Your details were kept on this device, but ${failures.join(' and ')} failed. `
          + 'Please try again — the form is still open.',
        );
        return;
      }

      setIsEditing(false);
      setShowSavedMessage(true);
      setShowSuccessDialog(true);
    } finally {
      setSaving(false);
    }
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
    <Layout menuItems={menuItems} title="Profile Settings" showBackButton>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Administrator Profile</h2>
              <p className="text-gray-600">Manage your admin account and system settings</p>
            </div>
            <Button variant="outline" className="hidden md:inline-flex bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900" onClick={() => navigate('/admin/dashboard')}>
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back
            </Button>
          </div>
        </div>

        {/* Success Message */}
        {showSavedMessage && (
          <div className="bg-white border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium text-blue-900">Profile changes saved successfully!</p>
          </div>
        )}

        {/* Profile Card */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex flex-col md:flex-row gap-6 mb-6">
            {/* Avatar */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-32 w-32 items-center justify-center rounded-full bg-[#1668D9] text-3xl font-semibold text-white">
                {profileImage ? <img src={profileImage} alt="Profile" className="h-full w-full rounded-full object-cover" /> : (user?.name || 'User').split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase()}
                {isEditing && (
                  <label className="absolute -bottom-1 -right-1 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-[#1668D9] text-white shadow-lg ring-2 ring-white">
                    <Camera className="h-4 w-4" />
                    <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
                  </label>
                )}
                {isEditing && profileImage && (
                  <button type="button" onClick={() => setProfileImage(null)} className="absolute -bottom-9 left-1/2 -translate-x-1/2 whitespace-nowrap text-xs font-medium text-red-600 hover:underline">Remove photo</button>
                )}
              </div>
              {!isEditing && profileImage && isDataUrl(profileImage) && (
                <span className="whitespace-nowrap rounded-md bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-700 ring-1 ring-amber-200">
                  Profile picture was not saved — upload failed
                </span>
              )}
              <Badge className="bg-red-100 text-red-700 font-medium">Administrator</Badge>
            </div>

            {/* Info with Admin ID and Work Status in Header */}
            <div className="flex-1">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900">{formData.firstName} {formData.lastName}</h2>
                  <p className="text-gray-600">{formData.position}</p>
                  <div className="flex items-center gap-2 mt-2">
                    <BriefcaseBusiness className="w-4 h-4 text-gray-500" />
                    <p className="text-sm text-gray-600 font-medium">{formData.adminId}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Button
                    onClick={() => isEditing ? handleSave() : setIsEditing(true)}
                    loading={saving && isEditing}
                    loadingText="Saving..."
                    className="bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
                  >
                    {!saving || !isEditing ? <Save className="w-4 h-4 mr-2" /> : null}
                    {isEditing ? 'Save Changes' : 'Edit Profile'}
                  </Button>
                  <Badge className="bg-blue-100 text-blue-700 font-medium">{formData.workStatus}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-4 mt-4">
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-[#2F6FD6]" />
                  <div>
                    <p className="text-xs text-gray-500">First Name</p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.firstName}
                        onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                        className="text-sm font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none focus:border-[#2F6FD6]"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.firstName}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <User className="w-5 h-5 text-[#2F6FD6]" />
                  <div>
                    <p className="text-xs text-gray-500">Last Name</p>
                    {isEditing ? (
                      <input
                        type="text"
                        value={formData.lastName}
                        onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                        className="text-sm font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none focus:border-[#2F6FD6]"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.lastName}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Mail className="w-5 h-5 text-[#2F6FD6]" />
                  <div>
                    <p className="text-xs text-gray-500">Email</p>
                    {isEditing ? (
                      <input
                        type="email"
                        value={formData.email}
                        disabled
                        aria-disabled="true"
                        title="Your registered email address cannot be changed"
                        className="text-sm font-medium text-gray-900 bg-transparent border-b border-gray-300 opacity-60 cursor-not-allowed"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.email}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Phone className="w-5 h-5 text-[#2F6FD6]" />
                  <div>
                    <p className="text-xs text-gray-500">Phone</p>
                    {isEditing ? (
                      <input
                        type="tel"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        className="text-sm font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none focus:border-[#2F6FD6]"
                      />
                    ) : (
                      <p className="text-sm font-medium text-gray-900">{formData.phone}</p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                  <Calendar className="w-5 h-5 text-[#2F6FD6]" />
                  <div>
                    <p className="text-xs text-gray-500">Join Date</p>
                    <p className="text-sm font-medium text-gray-900">{formData.joinDate}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Admin Permissions */}
        <Card className="p-6 bg-white shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Administrator Permissions</h3>
          <div className="grid grid-cols-1 @min-[640px]:grid-cols-2 gap-3">
            {[
              'Manage Users & Accounts',
              'Payment Verification',
              'Order Management',
              'Manage shop operations and staff',
              'Staff Management',
              'Generate Reports',
              'System Configuration',
              'Job Board Management',
            ].map((permission, index) => (
              <div key={index} className="flex items-center gap-3 p-3 bg-white border-2 border-blue-200 rounded-lg">
                <Shield className="w-5 h-5 text-blue-600" />
                <span className="text-sm text-gray-900">{permission}</span>
              </div>
            ))}
          </div>
        </Card>

        {/* Security Settings */}
        <Card className="p-6 bg-white shadow-sm">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Security Settings</h3>
          <div className="space-y-4">
            <Button
              variant="outline"
              onClick={() => setShowChangePasswordDialog(true)}
              className="w-full md:w-auto border-[#2F6FD6] text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white"
            >
              <Key className="w-4 h-4 mr-2" />
              Change Password
            </Button>
          </div>
        </Card>
        <Button variant="outline" onClick={() => setShowLogoutConfirm(true)} className="w-full border-red-600 bg-red-600 text-white hover:bg-red-700">Sign Out</Button>
      </div>

      {/* Change Password Dialog */}
      <Dialog open={showChangePasswordDialog} onOpenChange={setShowChangePasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Key className="w-6 h-6 text-[#1668D9]" />
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
              data-primary-action
              onClick={handleChangePassword}
              disabled={!validatePassword(passwordData.newPassword).isValid || (passwordData.currentPassword === passwordData.newPassword && passwordData.currentPassword !== '')}
              className={`${
                validatePassword(passwordData.newPassword).isValid && !(passwordData.currentPassword === passwordData.newPassword && passwordData.currentPassword !== '')
                  ? "bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {showSuccessDialog && (
        <Dialog open onOpenChange={setShowSuccessDialog}>
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle className="text-[#10316B] flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-500" /> Profile updated
              </DialogTitle>
              <DialogDescription>
                Your profile has been updated successfully.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button onClick={() => setShowSuccessDialog(false)} className="bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white">
                OK
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {showLogoutConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowLogoutConfirm}
          onConfirm={() => { logout(); setShowLogoutConfirm(false); }}
          title="Sign out of Docufy?"
          description="You'll need to sign in again to continue."
          confirmLabel="Sign Out"
          cancelLabel="Stay Signed In"
          destructive={false}
        />
      )}
    </Layout>
  );
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs ${className}`}>
      {children}
    </span>
  );
}
