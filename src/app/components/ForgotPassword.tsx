import React, { useState } from 'react';
import { useNavigate } from 'react-router';
import { ArrowLeft, Mail, MailCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { useAuth } from '../contexts/AuthContext';
import { useLogo } from '../hooks/useLogo';
import { usePageTitle } from '../hooks/usePageTitle';

// Password recovery is link-based: Supabase emails a one-time link that opens
// /reset-password on THIS deployment, where the new password is set. The old
// "we emailed you a 6-digit code" copy belonged to the retired mock flow and
// never matched what the backend actually sends.
export default function ForgotPassword() {
  usePageTitle('Reset password');
  const navigate = useNavigate();
  const logo = useLogo();
  const { requestPasswordReset } = useAuth();
  const [email, setEmail] = useState('');
  const [sentTo, setSentTo] = useState('');
  const [sending, setSending] = useState(false);

  const sendLink = async (event: React.FormEvent) => {
    event.preventDefault();
    const target = email.trim();
    if (!target) return;

    setSending(true);
    const result = await requestPasswordReset(target);
    setSending(false);

    if (result.success) {
      setSentTo(target);
      toast.success('Password reset link sent. Check your inbox.');
    } else {
      toast.error(result.error || 'We could not send the reset link. Please try again.');
    }
  };

  const handleResend = async () => {
    setSending(true);
    const result = await requestPasswordReset(sentTo);
    setSending(false);

    if (result.success) {
      toast.success('A new reset link is on its way.');
    } else {
      toast.error(result.error || 'We could not resend the reset link. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F7FF] flex items-center justify-center p-4 font-poppins">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="Docufy Logo" className="w-16 h-16 mx-auto mb-4 rounded-full" />
          <h1 className="text-3xl font-bold text-[#1c1f26] mb-2">Reset Password</h1>
          <p className="text-gray-600">
            {sentTo
              ? 'We sent you a link to set a new password.'
              : 'Enter your email and we will send you a link to set a new password.'}
          </p>
        </div>

        <Card className="p-8 bg-white shadow-lg">
          {!sentTo ? (
            <form onSubmit={sendLink} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@psu.palawan.edu.ph"
                    className="pl-10"
                    required
                    autoComplete="email"
                  />
                </div>
                <p className="text-xs text-gray-500">
                  The link opens Docufy on this device, where you can choose a new password.
                </p>
              </div>

              <Button
                type="submit"
                loading={sending}
                loadingText="Sending link..."
                className="w-full bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              >
                Send Reset Link
              </Button>
            </form>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center space-y-3">
                <div className="w-14 h-14 rounded-full bg-blue-50 text-[#2F6FD6] flex items-center justify-center">
                  <MailCheck className="w-7 h-7" />
                </div>
                <div>
                  <p className="font-semibold text-[#1c1f26]">Check your email</p>
                  <p className="text-sm text-gray-600 mt-1">
                    We sent a password reset link to <span className="font-medium text-gray-800">{sentTo}</span>.
                    Open it on this device to choose a new password.
                  </p>
                </div>
                <p className="text-xs text-gray-500">
                  The link expires shortly. If it does not arrive, check your spam folder or request a new one.
                </p>
              </div>

              <div className="space-y-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleResend}
                  loading={sending}
                  loadingText="Resending..."
                  className="w-full"
                >
                  {!sending && <RefreshCw className="w-4 h-4" />}
                  Resend Link
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setSentTo('')}
                  className="w-full"
                >
                  Use a different email
                </Button>
              </div>
            </div>
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
