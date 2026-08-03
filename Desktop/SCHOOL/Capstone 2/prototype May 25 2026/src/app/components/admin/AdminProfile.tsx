import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { adminMenuItems } from '../../utils/adminMenuItems';
import { User, Mail, Phone, Calendar, Shield, Save, ArrowLeft, CheckCircle, Key, BriefcaseBusiness, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import Layout from '../Layout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '../ui/dialog';
import { useAuth } from '../../contexts/AuthContext';
import { PasswordStrengthIndicator, validatePassword } from '../ui/password-strength-indicator';

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
  const { user, enableMFA, disableMFA, resetPassword } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [showSavedMessage, setShowSavedMessage] = useState(false);
  const [showChangePasswordDialog, setShowChangePasswordDialog] = useState(false);
  const [mfaEnabled, setMfaEnabled] = useState(user?.mfaEnabled || false);
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

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    setIsEditing(false);
    setShowSavedMessage(true);
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

  const handleToggleMFA = () => {
    if (mfaEnabled) {
      disableMFA();
      setMfaEnabled(false);
      toast.success('MFA disabled');
    } else {
      enableMFA();
      setMfaEnabled(true);
      toast.success('MFA enabled');
    }
  };

  return (
    <Layout menuItems={menuItems} title="Profile Settings" showBackButton>
      <div className="space-y-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">Administrator Profile</h1>
              <p className="text-gray-600">Manage your admin account and system settings</p>
            </div>
            <Button variant="outline" onClick={() => navigate('/admin/dashboard')}>
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
              <div className="w-32 h-32 bg-[#1D73EC] rounded-full flex items-center justify-center">
                <Shield className="w-16 h-16 text-white" />
              </div>
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
                    className="bg-[#2F6FD6] hover:bg-[#2557b8] text-white"
                  >
                    <Save className="w-4 h-4 mr-2" />
                    {isEditing ? 'Save Changes' : 'Edit Profile'}
                  </Button>
                  <Badge className="bg-green-100 text-blue-700 font-medium">{formData.workStatus}</Badge>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
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
                        onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                        className="text-sm font-medium text-gray-900 bg-transparent border-b border-gray-300 focus:outline-none focus:border-[#2F6FD6]"
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
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {[
              'Manage Users & Accounts',
              'Payment Verification',
              'Order Management',
              'Inventory Control',
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

            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div>
                <p className="font-medium text-gray-900">Multi-Factor Authentication (MFA)</p>
                <p className="text-sm text-gray-500">Add an extra layer of security to your account</p>
              </div>
              <button
                onClick={handleToggleMFA}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  mfaEnabled ? 'bg-[#1D73EC]' : 'bg-gray-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    mfaEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </Card>
      </div>

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

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs ${className}`}>
      {children}
    </span>
  );
}
