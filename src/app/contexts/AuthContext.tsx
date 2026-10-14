import React, { useState, createContext, useContext, useEffect } from 'react';
import { toast } from 'sonner';
import { sessionManager } from '../utils/sessionManager';
import { supabase } from '../../lib/supabaseClient';
import type { Database } from '../../lib/database.types';
import {
  uploadAvatar,
  getAvatarPublicUrl,
  deleteAvatar,
  isDataUrl,
  isSupabaseAvatarUrl,
} from '../utils/supabaseAvatar';
import { refreshAllStores } from '../utils/storeSync';

// Auth Types
export interface User {
  name: string;
  email: string;
  role: 'customer' | 'staff' | 'admin';
  profileImage?: string;
  active?: boolean;
  // Contact number from the profiles table (loaded on sign-in so the customer
  // profile form can prefill it instead of leaking demo defaults).
  phone?: string;
  // Supabase auth uid (set when a real Supabase session is loaded; absent for
  // local mock accounts).
  id?: string;
}

export interface AuthContextType {
  user: User | null;
  authLoading: boolean;
  login: (email: string, password: string) => Promise<{ success: boolean; reason?: 'inactive' }>;
  signInWithGoogle: () => Promise<{ success: boolean }>;
  signup: (data: any) => Promise<boolean>;
  registerStaff: (data: { name: string; email: string; password: string; role?: 'staff' | 'admin' }) => Promise<{ success: boolean; message?: string }>;
  updateStaffAccount: (currentEmail: string, updates: { email?: string; name?: string; role?: 'staff' | 'admin'; active?: boolean }) => boolean;
  getStaffAccounts: () => { email: string; name: string; role: string; active?: boolean; isAdminRegistered?: boolean }[];
  updateProfile: (data: Partial<User> & { profileImage?: string | null }) => void;
  updateProfileImage: (image: string | null) => Promise<boolean>;
  syncProfileDetails: (patch: Database['public']['Tables']['profiles']['Update']) => Promise<boolean>;
  logout: () => void;
  resetPassword: (email: string, currentPassword: string, newPassword: string) => Promise<boolean>;
  resetForgottenPassword: (email: string, newPassword: string) => Promise<boolean>;
  requestPasswordReset: (email: string) => Promise<boolean>;
  sendPasswordResetCode: (email: string) => boolean;
  verifyResetCode: (email: string, code: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Test accounts for local UI testing only
type MockUser = {
  email: string;
  password: string;
  name: string;
  role: 'customer' | 'staff' | 'admin';
  active: boolean;
  passwordHistory: string[];
  profileImage?: string;
  isAdminRegistered?: boolean;
};

const mockUsers: MockUser[] = [
  {
    email: 'customer@test.com',
    password: 'customer123',
    name: 'Customer User',
    role: 'customer' as const,
    active: true,
    passwordHistory: [] as string[],
    profileImage: undefined,
  },
  {
    email: 'staff@test.com',
    password: 'staff123',
    name: 'Staff User',
    role: 'staff' as const,
    active: true,
    passwordHistory: [] as string[],
    profileImage: undefined,
  },
  {
    email: 'admin@test.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin' as const,
    active: true,
    passwordHistory: [] as string[],
    profileImage: undefined,
  },
];

// Store for password reset codes
const passwordResetCodes: { [email: string]: string } = {};

// Staff/admin sign-in accounts persist to localStorage so role and status
// changes made in Staff Management survive a page refresh — otherwise the
// freshly-updated MockUser list is re-seeded to the defaults on reload and the
// changed role reverts. Only staff/admin accounts are persisted (customer
// sign-ups stay in-memory, matching the original prototype behavior).
const STAFF_ACCOUNTS_KEY = 'docufy_auth_users_v1';

function loadStaffAccounts(): void {
  try {
    const raw = localStorage.getItem(STAFF_ACCOUNTS_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return;
    for (const acc of parsed) {
      if (!acc || typeof acc !== 'object') continue;
      if (!acc.email || !acc.name || !acc.role) continue;
      const idx = mockUsers.findIndex(u => u.email.toLowerCase() === acc.email.toLowerCase());
      if (idx >= 0) {
        mockUsers[idx] = { ...mockUsers[idx], ...acc };
      } else {
        mockUsers.push(acc);
      }
    }
  } catch {
    // storage unavailable — in-memory accounts are enough
  }
}

function persistStaffAccounts(): void {
  try {
    localStorage.setItem(
      STAFF_ACCOUNTS_KEY,
      JSON.stringify(mockUsers.filter(u => u.role !== 'customer')),
    );
  } catch {
    // storage unavailable — accounts stay in-memory for the session
  }
}

loadStaffAccounts();

// Persist the logged-in user across page reloads so refreshing while signed in
// does not bounce the user back to the login page. Uses sessionStorage (NOT
// localStorage) so each browser tab keeps its own logged-in user — a prototype
// convenience that lets separate tabs run as customer and staff/admin without
// one refresh wiping the other tab's session.
const AUTH_SESSION_KEY = 'docufy_auth_session_tab';

function readStoredUser(): User | null {
  try {
    const raw = sessionStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (!parsed.email || !parsed.name || !parsed.role) return null;
    return parsed as User;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);

  const loadProfile = async (authUser: { id: string; email?: string | null; user_metadata?: Record<string, unknown> }) => {
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('full_name, email, role, phone, profile_image_path, active, suspended')
      .eq('id', authUser.id)
      .maybeSingle();

    if (error) {
      console.error('Failed to load user profile:', error);
    }

    // If the profile has no phone yet but the signup put one in user_metadata
    // (covers the email-confirmation-ON path where signup has no session),
    // backfill the phone column so it ends up stored in the profiles table.
    const metadataPhone =
      typeof authUser.user_metadata?.phone === 'string' ? authUser.user_metadata.phone : '';

    if (profile && !profile.phone && metadataPhone) {
      await supabase
        .from('profiles')
        .update({ phone: metadataPhone })
        .eq('id', authUser.id);
      profile.phone = metadataPhone;
    }

    const role = profile?.role === 'admin' || profile?.role === 'staff'
      ? profile.role
      : 'customer';

    setUser({
      name: profile?.full_name || String(authUser.user_metadata?.full_name || authUser.email || 'User'),
      email: profile?.email || authUser.email || '',
      role,
      profileImage: profile?.profile_image_path || undefined,
      phone: profile?.phone || undefined,
      active: profile?.active !== false && profile?.suspended !== true,
      id: authUser.id,
    });
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) console.error('Failed to restore Supabase session:', error);
        if (mounted && data.session?.user) {
          await loadProfile(data.session.user);
          // Fetch the stores with the authenticated token (the module-constructor
          // hydration ran anonymous and may have cached empty snapshots).
          void refreshAllStores();
        }
      } finally {
        // Single owner of the initial auth-gate: only release it AFTER the
        // session/profile restore above has settled (and `setUser` ran), so a
        // reload paints a blank `null` frame instead of flashing to /login.
        // The onAuthStateChange callback deliberately does NOT clear this —
        // its INITIAL_SESSION event fires before loadProfile resolves.
        if (mounted) setAuthLoading(false);
      }
    };

    void initializeAuth();

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mounted) return;
      if (session?.user) {
        void loadProfile(session.user);
        void refreshAllStores();
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    try {
      if (user) {
        sessionStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(user));
      } else {
        sessionStorage.removeItem(AUTH_SESSION_KEY);
      }
    } catch {
      // ignore storage errors
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      sessionManager.init(() => {
        toast.error('Session expired due to inactivity. Please log in again.');
        logout();
      });
    }
    return () => {
      sessionManager.destroy();
    };
  }, [user]);

  const login = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.user) {
      return { success: false };
    }

    await loadProfile(data.user);
    const { data: profile } = await supabase
      .from('profiles')
      .select('active, suspended')
      .eq('id', data.user.id)
      .maybeSingle();

    if (profile?.active === false || profile?.suspended === true) {
      await supabase.auth.signOut();
      return { success: false, reason: 'inactive' as const };
    }

    void refreshAllStores();

    toast.success("Logged in successfully.");

    return { success: true };
  };

  // Kick off the Google OAuth flow. Supabase redirects the whole tab to Google,
  // then back to window.location.origin/auth/callback with a session, which the
  // AuthProvider session-restore effect picks up like any other login.
  const signInWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      console.warn('[auth:google] failed to start OAuth:', error.message);
      return { success: false };
    }
    return { success: true };
  };

  const signup = async (data: any) => {
    // Combine firstName and lastName to create full name
    const fullName = data.firstName && data.lastName
      ? `${data.firstName} ${data.lastName}`.trim()
      : data.fullName || data.name || 'User';

    const { data: result, error } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: {
        data: {
          full_name: fullName,
          phone: data.contactNumber,
        },
      },
    });

    if (error || !result.user) {
      toast.error(error?.message || 'Unable to create account.');
      return false;
    }

    if (result.session) {
      const profileUpdates: Database['public']['Tables']['profiles']['Update'] = {};
      if (data.contactNumber) {
        profileUpdates.phone = data.contactNumber;
      }
      if (data.profileImage && isDataUrl(data.profileImage)) {
        try {
          // Upload the picture to Supabase Storage and keep the public URL in
          // the profiles table so the avatar survives across devices/sessions.
          const path = await uploadAvatar(result.user.id, data.profileImage);
          profileUpdates.profile_image_path = getAvatarPublicUrl(path);
        } catch (uploadError) {
          console.warn('Failed to upload profile image during signup:', uploadError);
        }
      }
      if (Object.keys(profileUpdates).length > 0) {
        await supabase
          .from('profiles')
          .update(profileUpdates)
          .eq('id', result.user.id);
      }
      await loadProfile(result.user);
      void refreshAllStores();
    }

    toast.success(
      result.session
        ? 'Account created successfully.'
        : 'Account created. Check your email to confirm your account.',
    );
    return true;
  };

  const registerStaff = async (data: { name: string; email: string; password: string; role?: 'staff' | 'admin' }) => {
    if (!data.name || !data.email || !data.password) {
      return { success: false, message: 'All fields are required.' };
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }
    if (mockUsers.some(u => u.email.toLowerCase() === data.email.toLowerCase())) {
      return { success: false, message: 'An account with this email already exists.' };
    }

    // Snapshot the acting admin's session: with email confirmation OFF, signUp
    // returns (and would ACTIVATE) a session for the brand-new staff user,
    // which would silently swap the admin out of their own session. We restore
    // the admin session right after so the staff creation never logs the admin out.
    const { data: beforeSession } = await supabase.auth.getSession();
    const actingSession = beforeSession.session;

    // Create a REAL Supabase Auth user (so the new staff can actually sign in).
    const { data: signUpResult, error: signUpError } = await supabase.auth.signUp({
      email: data.email,
      password: data.password,
      options: { data: { full_name: data.name, role: data.role || 'staff' } },
    });

    if (signUpError || !signUpResult.user) {
      // Already a real auth user (e.g. staff@test.com or a customer) →
      // friendly duplicate message instead of a raw "User already registered".
      return {
        success: false,
        message: signUpError?.message?.toLowerCase().includes('already')
          ? 'An account with this email already exists.'
          : signUpError?.message || 'Could not create staff account.',
      };
    }

    const newUserId = signUpResult.user.id;

    // Restore the admin's session (see the comment above).
    if (actingSession) {
      await supabase.auth.setSession({
        access_token: actingSession.access_token,
        refresh_token: actingSession.refresh_token,
      });
    }

    // The handle_new_user() trigger only copies full_name/email, so the new
    // profile's role defaults to 'customer' — raise it to the requested role
    // so the account actually logs in with staff/admin permissions.
    const roleUpdate = await supabase
      .from('profiles')
      .update({ role: data.role || 'staff', active: true })
      .eq('id', newUserId);
    if (roleUpdate.error) {
      console.warn('[auth:registerStaff] could not elevate the new profile role:', roleUpdate.error.message);
    }

    // Keep the local mirror (roster display + demo reset codes) in sync too.
    const newStaff: any = {
      email: data.email,
      password: data.password,
      name: data.name,
      role: data.role || 'staff',
      active: true,
      passwordHistory: [] as string[],
      profileImage: undefined,
      isAdminRegistered: true,
    };
    mockUsers.push(newStaff);
    persistStaffAccounts();
    return { success: true };
  };

  // Push role/active changes to the REAL Supabase profile row (the login gate
  // reads profiles.role/active). Best-effort: a row missing a matching real
  // account keeps the local mirror only.
  const syncRealStaffProfile = async (currentEmail: string, updates: {
    email?: string;
    name?: string;
    role?: 'staff' | 'admin';
    active?: boolean;
  }) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', currentEmail.toLowerCase())
        .maybeSingle();
      if (!profile) return;
      const patch: Database['public']['Tables']['profiles']['Update'] = {};
      if (typeof updates.name === 'string') patch.full_name = updates.name;
      if (updates.role === 'staff' || updates.role === 'admin') patch.role = updates.role;
      if (typeof updates.active === 'boolean') patch.active = updates.active;
      if (Object.keys(patch).length === 0) return;
      await supabase.from('profiles').update(patch).eq('id', profile.id);
    } catch (err) {
      console.warn('[auth:updateStaffAccount] could not sync real profile:', err);
    }
  };

  const updateStaffAccount = (currentEmail: string, updates: {
    email?: string;
    name?: string;
    role?: 'staff' | 'admin';
    active?: boolean;
  }) => {
    const userIndex = mockUsers.findIndex(
      u => u.email.toLowerCase() === currentEmail.toLowerCase() && u.role !== 'customer'
    );
    if (userIndex === -1) return false;
    if (updates.email) {
      const conflict = mockUsers.some(
        (u, i) => i !== userIndex && u.email.toLowerCase() === updates.email!.toLowerCase()
      );
      if (conflict) return false;
      mockUsers[userIndex].email = updates.email;
    }
    if (typeof updates.name === 'string') mockUsers[userIndex].name = updates.name;
    if (updates.role === 'staff' || updates.role === 'admin') mockUsers[userIndex].role = updates.role;
    if (typeof updates.active === 'boolean') mockUsers[userIndex].active = updates.active;
    persistStaffAccounts();

    // Best-effort: push role/active changes up to the REAL Supabase profile too
    // (the account may have been created as a real Auth user). The login gate
    // reads profiles.active/role, so a deactivate or role change here must be
    // reflected there or the DB row would override it on the next sign-in.
    void syncRealStaffProfile(currentEmail, updates);
    return true;
  };

  const getStaffAccounts = () =>
    mockUsers
      .filter(u => u.role !== 'customer')
      .map(u => ({
        email: u.email,
        name: u.name,
        role: u.role,
        active: u.active,
        isAdminRegistered: u.isAdminRegistered,
      }));

  const updateProfile = (data: Partial<User> & { profileImage?: string | null }) => {
    setUser((current) => {
      if (!current) return current;
      return {
        ...current,
        ...data,
        profileImage: Object.prototype.hasOwnProperty.call(data, "profileImage")
          ? data.profileImage || undefined
          : current.profileImage,
      };
    });
  };

  // Persist editable profile text fields (name, phone, student/employee id) to
  // the signed-in user's OWN `profiles` row. Unlike the avatar, these are
  // local-first: the profile pages already wrote the text to their per-account
  // localStorage blob before calling this, so a failed push must be surfaced
  // (return false) for the page to keep the editor open and let the user retry.
  const syncProfileDetails = async (patch: Database['public']['Tables']['profiles']['Update']): Promise<boolean> => {
    if (!patch || Object.keys(patch).length === 0) return true;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUserId = authData.user?.id;
      if (!authUserId) return false;
      const { error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', authUserId);
      if (error) {
        console.warn('[db:profiles] profile details sync failed — changes stay local only:', error.message);
        return false;
      }
      const localSync: Partial<User> = {};
      if (typeof patch.full_name === 'string') localSync.name = patch.full_name;
      if (patch.phone !== undefined) localSync.phone = patch.phone ?? undefined;
      if (Object.keys(localSync).length > 0) updateProfile(localSync);
      return true;
    } catch (err) {
      console.warn('[db:profiles] profile details sync threw — changes stay local only:', err);
      return false;
    }
  };

  // Persist a profile picture to Supabase Storage + the profiles table.
  // - image (base64 data URL): uploads a new avatar and stores its public URL.
  // - image (already-public URL): no change, nothing to do.
  // - image === null: clears the stored avatar.
  // Returns true when Supabase was updated; false when the picture could NOT be
  // saved (no session, offline, or a storage error) — callers should surface the
  // failure rather than treat the save as complete. Avatars are NEVER stored
  // locally; Supabase is the only home for profile pictures.
  const updateProfileImage = async (image: string | null): Promise<boolean> => {
    if (!user) return false;
    if ((image ?? null) === (user.profileImage ?? null)) return true;
    try {
      const { data: authData } = await supabase.auth.getUser();
      const authUserId = authData.user?.id;
      if (!authUserId) return false;

      if (image && !isDataUrl(image)) {
        // Already a persisted URL (unchanged picture) — nothing to upload.
        return true;
      }

      const previous = user.profileImage;
      if (image) {
        const path = await uploadAvatar(authUserId, image);
        const url = getAvatarPublicUrl(path);
        await supabase
          .from('profiles')
          .update({ profile_image_path: url })
          .eq('id', authUserId);
        updateProfile({ profileImage: url });
        if (previous && previous !== url && isSupabaseAvatarUrl(previous)) {
          void deleteAvatar(previous);
        }
      } else {
        await supabase
          .from('profiles')
          .update({ profile_image_path: null })
          .eq('id', authUserId);
        updateProfile({ profileImage: undefined });
        if (previous && isSupabaseAvatarUrl(previous)) {
          void deleteAvatar(previous);
        }
      }
      return true;
    } catch (err) {
      console.warn('Supabase avatar persistence failed — picture NOT saved:', err);
      return false;
    }
  };

  const logout = () => {
    setUser(null);
    sessionManager.destroy();
    void supabase.auth.signOut();
  };

  const sendPasswordResetCode = (email: string) => {
    const foundUser = mockUsers.find(u => u.email === email);
    if (foundUser) {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      passwordResetCodes[email] = code;
      console.log(`Password reset code for ${email}: ${code}`);
      toast.success(`Reset code sent to ${email}. Check console for demo code.`);
      return true;
    }
    return false;
  };

  const verifyResetCode = (email: string, code: string) => {
    return passwordResetCodes[email] === code;
  };

  const resetPassword = async (email: string, currentPassword: string, newPassword: string) => {
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password: currentPassword,
    });
    if (signInError) return false;

    const { error } = await supabase.auth.updateUser({ password: newPassword });
    return !error;
  };

  const resetForgottenPassword = async (_email: string, newPassword: string) => {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) return false;

    // The password-recovery link logs the user in with a recovery session.
    // Without signing out, that lingering session makes LoginPage's "already
    // signed in" effect redirect straight to /<role>/dashboard instead of
    // showing the login form the user needs after resetting their password.
    await supabase.auth.signOut();
    return true;
  };

  const requestPasswordReset = async (email: string) => {
    const redirectTo = `${window.location.origin}/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
    return !error;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        authLoading,
        login,
        signInWithGoogle,
        signup,
        registerStaff,
        updateStaffAccount,
        getStaffAccounts,
        updateProfile,
        updateProfileImage,
        syncProfileDetails,
        logout,
        resetPassword,
        resetForgottenPassword,
        requestPasswordReset,
        sendPasswordResetCode,
        verifyResetCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}