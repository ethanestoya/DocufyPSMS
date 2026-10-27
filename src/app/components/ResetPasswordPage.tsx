import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { usePopup } from '../contexts/PopupContext';
import { AlertTriangle, ArrowLeft, Link2Off } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLogo } from '../hooks/useLogo';
import { usePageTitle } from '../hooks/usePageTitle';
import { supabase } from '../../lib/supabaseClient';
import { PasswordStrengthIndicator, validatePassword } from './ui/password-strength-indicator';
import { Card } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Spinner } from './ui/spinner';

type LinkState = 'checking' | 'ready' | 'invalid';

// The emailed recovery link carries a one-time token in the URL, which
// supabase-js exchanges for a recovery session when the app boots. If that
// token is missing, expired or already used, there is nothing to update - the
// user needs to be told that plainly and given a way to request a fresh link,
// instead of a bare "invalid or expired" toast on a form that can never work.
export default function ResetPasswordPage() {
  usePageTitle('Choose a new password');
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const logo = useLogo();
  const { showPopup } = usePopup();
  const { resetForgottenPassword } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [linkState, setLinkState] = useState<LinkState>('checking');
  const [linkError, setLinkError] = useState('');

  useEffect(() => {
    let active = true;

    // A link that already failed carries the reason in the query string
    // (?error_code=otp_expired&error_description=...) or in the hash.
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ''));
    const errorCode = searchParams.get('error_code') || hash.get('error_code');
    const errorDescription =
      searchParams.get('error_description') || hash.get('error_description');
    if (errorCode || errorDescription) {
      setLinkError(errorDescription || 'This reset link is invalid or has expired.');
      setLinkState('invalid');
      return;
    }

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active) return;
      if (session) setLinkState('ready');
    });

    const confirmSession = async () => {
      const { data } = await supabase.auth.getSession();
      if (!active) return;
      if (data.session) {
        setLinkState('ready');
        return;
      }
      // The token in the URL may still be exchanging for a session.
      window.setTimeout(async () => {
        const { data: retry } = await supabase.auth.getSession();
        if (!active) return;
        setLinkState(retry.session ? 'ready' : 'invalid');
      }, 1500);
    };

    void confirmSession();

    return () => {
      active = false;
      subscription.subscription.unsubscribe();
    };
  }, [searchParams]);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!validatePassword(password).isValid) {
      showPopup('Password does not meet security requirements.', 'error');
      return;
    }
    if (password !== confirmPassword) {
      showPopup('Passwords do not match.', 'error');
      return;
    }

    setSaving(true);
    const result = await resetForgottenPassword('', password);
    setSaving(false);

    if (!result.success) {
      if (result.reason === 'no_session') {
        setLinkError(result.error || 'This reset link is invalid or has expired.');
        setLinkState('invalid');
      } else {
        showPopup(result.error || 'We could not update your password. Please try a different one.', 'error');
      }
      return;
    }
    showPopup('Password updated successfully.', 'success');
    navigate('/login', { replace: true });
  };

  return (
    <div className="min-h-screen bg-[#F2F7FF] flex items-center justify-center p-4 font-poppins">
      <Card className="w-full max-w-md p-8 bg-white shadow-lg">
        <img src={logo} alt="Docufy Logo" className="w-16 h-16 mx-auto mb-4 rounded-full" />

        {linkState === 'checking' && (
          <div className="flex flex-col items-center py-8 text-center space-y-3">
            <Spinner size="md" label="Checking your reset link..." stack />
            <p className="text-sm text-gray-500">One moment while we open your reset link.</p>
          </div>
        )}

        {linkState === 'invalid' && (
          <div className="text-center space-y-4">
            <div className="w-14 h-14 mx-auto rounded-full bg-red-50 text-red-600 flex items-center justify-center">
              <Link2Off className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-[#1c1f26]">This link can&apos;t be used</h1>
              <p className="text-sm text-gray-600 mt-2">
                {linkError || 'This reset link is invalid or has expired.'}
              </p>
            </div>
            <div className="flex items-start gap-2 text-left text-xs text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>Reset links can only be used once and expire after a short while. Request a new one to continue.</span>
            </div>
            <Button
              type="button"
              onClick={() => navigate('/forgot-password')}
              className="w-full bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
            >
              Request a New Reset Link
            </Button>
            <Button type="button" variant="ghost" onClick={() => navigate('/login')} className="w-full">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Login
            </Button>
          </div>
        )}

        {linkState === 'ready' && (
          <>
            <h1 className="text-2xl font-bold text-center text-[#1c1f26]">Create a new password</h1>
            <p className="text-sm text-gray-500 text-center mt-2 mb-6">Choose a secure password for your account.</p>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="new-password">New password</Label>
                <Input
                  id="new-password"
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
                {password && <PasswordStrengthIndicator password={password} />}
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-password">Confirm password</Label>
                <Input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  required
                />
              </div>
              <Button
                type="submit"
                loading={saving}
                loadingText="Updating..."
                className="w-full bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              >
                Update Password
              </Button>
            </form>
          </>
        )}
      </Card>
    </div>
  );
}
