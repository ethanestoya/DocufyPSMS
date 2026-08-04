import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Mail, Key, Lock } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/AuthContext';
import { PasswordStrengthIndicator, validatePassword } from './ui/password-strength-indicator';
import logoImage from 'figma:asset/32cd46dac3d06839e0db69b6c6ad22c9a8ac17a6.png';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const { sendPasswordResetCode, verifyResetCode, resetPassword } = useAuth();
  const [step, setStep] = useState<'email' | 'code' | 'password'>('email');
  const [email, setEmail] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');

  const handleSendCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (sendPasswordResetCode(email)) {
      setStep('code');
    } else {
      toast.error('Email not found');
    }
  };

  const handleVerifyCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (verifyResetCode(email, resetCode)) {
      setStep('password');
      toast.success('Code verified! Enter your new password.');
    } else {
      toast.error('Invalid code. Please try again.');
    }
  };

  const handleResetPassword = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.isValid) {
      toast.error('Password does not meet security requirements');
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    if (resetPassword(email, currentPassword, newPassword)) {
      toast.success('Password reset successful! Please login.');
      navigate('/login');
    } else {
      toast.error('Failed to reset password. Please check your current password.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F7FF] flex items-center justify-center p-4 font-poppins">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logoImage} alt="DocuFy Logo" className="w-16 h-16 mx-auto mb-4 rounded-full" />
          <h1 className="text-3xl font-bold text-[#1c1f26] mb-2">Reset Password</h1>
          <p className="text-gray-600">
            {step === 'email' && "Enter your email to receive a reset code"}
            {step === 'code' && "Enter the 6-digit code sent to your email"}
            {step === 'password' && "Create your new password"}
          </p>
        </div>

        <Card className="p-8 bg-white shadow-lg">
          {step === 'email' && (
            <form onSubmit={handleSendCode} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="Enter your email"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button type="submit" className="w-full bg-[#2F6FD6] hover:bg-[#2557b8]">
                Send Reset Code
              </Button>
            </form>
          )}

          {step === 'code' && (
            <form onSubmit={handleVerifyCode} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="code">Verification Code</Label>
                <div className="relative">
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="code"
                    type="text"
                    value={resetCode}
                    onChange={(e) => setResetCode(e.target.value)}
                    placeholder="Enter 6-digit code"
                    maxLength={6}
                    className="pl-10 text-center text-2xl tracking-widest"
                    required
                  />
                </div>
                <p className="text-xs text-gray-500">Check the browser console for the demo code</p>
              </div>

              <Button type="submit" className="w-full bg-[#2F6FD6] hover:bg-[#2557b8]">
                Verify Code
              </Button>
            </form>
          )}

          {step === 'password' && (
            <form onSubmit={handleResetPassword} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="currentPassword">Current Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="currentPassword"
                    type="password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword">New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="newPassword"
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                    className="pl-10"
                    required
                  />
                </div>
                {newPassword && (
                  <div className="mt-2">
                    <PasswordStrengthIndicator password={newPassword} />
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                    className="pl-10"
                    required
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={!validatePassword(newPassword).isValid}
                className={`w-full ${
                  validatePassword(newPassword).isValid
                    ? "bg-[#2F6FD6] hover:bg-[#2557b8]"
                    : "bg-gray-300 text-gray-500 cursor-not-allowed"
                }`}
              >
                Reset Password
              </Button>
            </form>
          )}

          <div className="mt-6">
            <Button
              type="button"
              variant="ghost"
              onClick={() => navigate('/login')}
              className="w-full"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}