import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import { LayoutDashboard, FileText, Briefcase, Package, User, Mail, Phone, ArrowLeft, CheckCircle, AlertCircle, Key, Shield } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '../Layout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordStrengthIndicator, validatePassword } from '../ui/password-strength-indicator';

const menuItems = [
  { label: 'Dashboard', path: '/customer/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Print Request', path: '/customer/new-request', icon: <FileText className="w-5 h-5" /> },
  { label: 'My Orders', path: '/customer/orders', icon: <Package className="w-5 h-5" /> },
  { label: 'Job Board', path: '/customer/job-board', icon: <Briefcase className="w-5 h-5" /> },
];

const STORAGE_KEY = 'customer_profile_data';

const defaultProfileData = {
  firstName: '',
  lastName: '',
  email: '',
  phone: '0912 345 6789',
  studentId: 'STU-2024-001',
};

export default function CustomerProfile() {
  const navigate = useNavigate();
  // Layout will be updated with showBackButton prop below
  const { user, enableMFA, disableMFA, resetPassword } = useAuth();
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [showMFADialog, setShowMFADialog] = useState(false);
  const [mfaSecret, setMfaSecret] = useState('');
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: '',
  });
  const [formData, setFormData] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const nameParts = (user?.name || '').split(' ');
    const defaultFirstName = nameParts[0] || '';
    const defaultLastName = nameParts.slice(1).join(' ') || '';

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Handle migration from old 'name' field to firstName/lastName
        if (parsed.name && !parsed.firstName && !parsed.lastName) {
          const parts = parsed.name.split(' ');
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
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const nameParts = (user?.name || '').split(' ');
    const defaultFirstName = nameParts[0] || '';
    const defaultLastName = nameParts.slice(1).join(' ') || '';

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Handle migration from old 'name' field to firstName/lastName
        if (parsed.name && !parsed.firstName && !parsed.lastName) {
          const parts = parsed.name.split(' ');
          setFormData({
            ...parsed,
            firstName: parts[0] || defaultFirstName,
            lastName: parts.slice(1).join(' ') || defaultLastName,
            email: user?.email || parsed.email
          });
        } else {
          setFormData({
            ...parsed,
            firstName: parsed.firstName || defaultFirstName,
            lastName: parsed.lastName || defaultLastName,
            email: user?.email || parsed.email
          });
        }
      } catch {
        setFormData({
          ...defaultProfileData,
          firstName: defaultFirstName,
          lastName: defaultLastName,
          email: user?.email || defaultProfileData.email
        });
      }
    }
  }, [user]);

  const handleSave = () => {
    setShowSaveDialog(true);
  };

  const confirmSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    setIsEditing(false);
    setShowSavedMessage(true);
    setShowSaveDialog(false);
    setTimeout(() => setShowSavedMessage(false), 3000);
  };

  const handleChangePassword = () => {
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
    if (user && resetPassword(user.email, passwordData.currentPassword, passwordData.newPassword)) {
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

  const handleEnableMFA = () => {
    const secret = enableMFA();
    setMfaSecret(secret);
    setShowMFADialog(true);
  };

  const handleDisableMFA = () => {
    disableMFA();
    toast.success('Multi-factor authentication disabled');
  };

  return (
    <Layout menuItems={menuItems} title="Profile Settings" showBackButton backButtonPath="/customer/dashboard">
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-semibold text-gray-900">Profile</h1>
          <p className="text-gray-500 mt-1">Manage your account information</p>
        </div>

        {/* Success Message */}
        {showSavedMessage && (
          <div className="bg-white border-2 border-blue-200 rounded-xl p-4 flex items-center gap-3 animate-in fade-in slide-in-from-top-2 duration-300">
            <CheckCircle className="w-5 h-5 text-blue-600" />
            <p className="text-sm font-medium text-blue-900">Profile changes saved successfully!</p>
          </div>
        )}

        {/* Profile Card */}
        <Card className="p-8 bg-white shadow-sm">
          <div className="flex items-start justify-between mb-8">
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 bg-[#1D73EC] rounded-full flex items-center justify-center text-white text-2xl font-semibold">
                {user?.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h2 className="text-2xl font-semibold text-gray-900">{user?.name}</h2>
                <p className="text-gray-500 capitalize">{user?.role} Account</p>
              </div>
            </div>
            {!isEditing ? (
              <Button
                variant="outline"
                onClick={() => setIsEditing(true)}
              >
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setIsEditing(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-[#2F6FD6] hover:bg-[#2557b8]"
                  onClick={handleSave}
                >
                  Save Changes
                </Button>
              </div>
            )}
          </div>

          {/* Profile Information */}
          <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="firstName">First Name</Label>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData(prev => ({ ...prev, firstName: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="lastName">Last Name</Label>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400" />
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData(prev => ({ ...prev, lastName: e.target.value }))}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">Email Address</Label>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-gray-400" />
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Contact Number</Label>
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                  disabled={!isEditing}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="studentId">Student ID</Label>
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" />
                <Input
                  id="studentId"
                  type="text"
                  value={formData.studentId}
                  disabled
                  className="bg-gray-50"
                />
              </div>
            </div>
          </div>
        </Card>

        {/* Security Section */}
        <Card className="p-8 bg-white shadow-sm">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Security</h3>

          <div className="space-y-4">
            <div className="flex items-center justify-between pb-4 border-b">
              <div>
                <p className="font-medium text-gray-900">Password</p>
                <p className="text-sm text-gray-500 mt-1">Change your account password</p>
              </div>
              <Button
                variant="outline"
                onClick={() => setShowChangePasswordDialog(true)}
                className="border-[#2F6FD6] text-[#2F6FD6] hover:bg-white border-2 border-blue-200"
              >
                <Key className="w-4 h-4 mr-2" />
                Change Password
              </Button>
            </div>

            <div className="flex items-center justify-between pt-2">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-medium text-gray-900">Multi-Factor Authentication</p>
                  {user?.mfaEnabled && (
                    <span className="px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full font-medium">
                      Enabled
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-500 mt-1">
                  {user?.mfaEnabled
                    ? 'Additional security layer is active'
                    : 'Add an extra layer of security to your account'}
                </p>
              </div>
              <Button
                variant="outline"
                onClick={user?.mfaEnabled ? handleDisableMFA : handleEnableMFA}
                className={
                  user?.mfaEnabled
                    ? 'border-blue-300 text-red-400 hover:bg-white border-2 border-blue-200'
                    : 'border-blue-600 text-blue-600 hover:bg-white border-2 border-blue-200'
                }
              >
                <Shield className="w-4 h-4 mr-2" />
                {user?.mfaEnabled ? 'Disable MFA' : 'Enable MFA'}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Save Confirmation Dialog */}
      <Dialog open={showSaveDialog} onOpenChange={setShowSaveDialog}>
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
            >
              Cancel
            </Button>
            <Button
              onClick={confirmSave}
              className="bg-[#1D73EC] hover:bg-[#10316B] text-white"
            >
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MFA Setup Dialog */}
      <Dialog open={showMFADialog} onOpenChange={setShowMFADialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <DialogTitle className="text-xl">Enable Multi-Factor Authentication</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Scan this QR code with your authenticator app
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-white p-4 border-2 border-gray-200 rounded-lg">
              <div className="bg-gray-100 h-48 flex items-center justify-center rounded">
                <p className="text-sm text-gray-500 text-center px-4">
                  QR Code Placeholder<br />
                  <span className="text-xs">In production, show actual TOTP QR code</span>
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Or enter this code manually:</Label>
              <Input
                value={mfaSecret}
                readOnly
                className="font-mono text-xs"
              />
            </div>
            <div className="p-3 bg-white border-2 border-blue-200 rounded-lg">
              <p className="text-sm text-blue-900">
                <strong>Setup Instructions:</strong>
              </p>
              <ol className="text-xs text-blue-800 mt-2 space-y-1 list-decimal list-inside">
                <li>Download an authenticator app (Google Authenticator, Authy, etc.)</li>
                <li>Scan the QR code or enter the code manually</li>
                <li>Enter the 6-digit code from your app when logging in</li>
              </ol>
            </div>
          </div>
          <DialogFooter>
            <Button
              onClick={() => {
                setShowMFADialog(false);
                toast.success('Multi-factor authentication enabled successfully!');
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Done
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
                  ? "bg-[#1D73EC] hover:bg-[#10316B] text-white"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Change Password
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}