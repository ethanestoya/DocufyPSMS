import React, { useState, createContext, useContext, useEffect } from 'react';
import { toast } from 'sonner';
import { sessionManager } from '../utils/sessionManager';

// Auth Types
export interface User {
  name: string;
  email: string;
  role: 'customer' | 'staff' | 'admin';
  mfaEnabled?: boolean;
  mfaVerified?: boolean;
}

export interface AuthContextType {
  user: User | null;
  login: (email: string, password: string) => { success: boolean; requiresMFA?: boolean };
  verifyMFA: (code: string) => boolean;
  enableMFA: () => string;
  disableMFA: () => void;
  signup: (data: any) => boolean;
  logout: () => void;
  resetPassword: (email: string, currentPassword: string, newPassword: string) => boolean;
  sendPasswordResetCode: (email: string) => boolean;
  verifyResetCode: (email: string, code: string) => boolean;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

// Mock users database - MFA is MANDATORY for all users
const mockUsers = [
  {
    email: 'customer@test.com',
    password: 'customer123',
    name: 'Ethan Laureen',
    role: 'customer' as const,
    mfaEnabled: true,
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    passwordHistory: [] as string[],
  },
  {
    // Demo suspended account — 5 no-shows, account suspended
    email: 'suspended@test.com',
    password: 'suspended123',
    name: 'Maria Santos',
    role: 'customer' as const,
    mfaEnabled: true,
    mfaSecret: 'JBSWY3DPEHPK3PXP',
    passwordHistory: [] as string[],
  },
  {
    email: 'staff@test.com',
    password: 'staff123',
    name: 'Heaven Rica',
    role: 'staff' as const,
    mfaEnabled: true,
    mfaSecret: 'HXDMVJECJJWSRB3H',
    passwordHistory: [] as string[],
  },
  {
    email: 'admin@test.com',
    password: 'admin123',
    name: 'Admin User',
    role: 'admin' as const,
    mfaEnabled: true,
    mfaSecret: 'JBSWY3DPFQQHO33S',
    passwordHistory: [] as string[],
  },
];

// Store for password reset codes
const passwordResetCodes: { [email: string]: string } = {};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [pendingMFAUser, setPendingMFAUser] = useState<any>(null);

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

  const login = (email: string, password: string) => {
    const foundUser = mockUsers.find(u => u.email === email && u.password === password);
    if (foundUser) {
      setPendingMFAUser(foundUser);
      return { success: true, requiresMFA: true };
    }
    return { success: false };
  };

  const verifyMFA = (code: string) => {
    if (pendingMFAUser) {
      if (code.length === 6 && /^\d{6}$/.test(code)) {
        setUser({
          name: pendingMFAUser.name,
          email: pendingMFAUser.email,
          role: pendingMFAUser.role,
          mfaEnabled: true,
          mfaVerified: true,
        });
        setPendingMFAUser(null);
        return true;
      } else {
        toast.error('Invalid MFA code. Please enter a 6-digit code.');
      }
    }
    return false;
  };

  const enableMFA = () => {
    const secret =
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15);
    if (user) {
      const userIndex = mockUsers.findIndex(u => u.email === user.email);
      if (userIndex !== -1) {
        mockUsers[userIndex].mfaEnabled = true;
        mockUsers[userIndex].mfaSecret = secret;
        setUser({ ...user, mfaEnabled: true });
      }
    }
    return secret;
  };

  const disableMFA = () => {
    if (user) {
      const userIndex = mockUsers.findIndex(u => u.email === user.email);
      if (userIndex !== -1) {
        mockUsers[userIndex].mfaEnabled = false;
        mockUsers[userIndex].mfaSecret = '';
        setUser({ ...user, mfaEnabled: false });
      }
    }
  };

  const signup = (data: any) => {
    // Combine firstName and lastName to create full name
    const fullName = data.firstName && data.lastName
      ? `${data.firstName} ${data.lastName}`.trim()
      : data.fullName || data.name || 'User';

    const newUser = {
      email: data.email,
      password: data.password,
      name: fullName,
      role: 'customer' as const,
      mfaEnabled: true,
      mfaSecret: Math.random().toString(36).substring(2, 15),
      passwordHistory: [] as string[],
    };
    mockUsers.push(newUser);
    toast.success(
      'Account created! MFA is required for all accounts. You will be prompted to verify on login.'
    );
    return true;
  };

  const logout = () => {
    setUser(null);
    setPendingMFAUser(null);
    sessionManager.destroy();
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

  const resetPassword = (email: string, currentPassword: string, newPassword: string) => {
    console.log('resetPassword called for:', email);
    console.log('Current user in mockUsers:', mockUsers.find(u => u.email === email));

    const userIndex = mockUsers.findIndex(
      u => u.email === email && u.password === currentPassword
    );

    console.log('User index found:', userIndex);

    if (userIndex !== -1) {
      const user = mockUsers[userIndex];

      // Check password reuse - prevent using any of the last 5 passwords
      const passwordHistory = user.passwordHistory || [];
      const recentPasswords = [user.password, ...passwordHistory].slice(0, 5);

      console.log('Recent passwords:', recentPasswords);
      console.log('New password:', newPassword);

      if (recentPasswords.includes(newPassword)) {
        console.log('Password reuse detected');
        return false; // Error will be shown by the calling component
      }

      // Update password history
      mockUsers[userIndex].passwordHistory = [user.password, ...passwordHistory].slice(0, 5);
      mockUsers[userIndex].password = newPassword;

      console.log('Password updated successfully');
      console.log('New password is now:', mockUsers[userIndex].password);

      // Update the current user's session state if they're logged in
      if (user && user.email === email) {
        setUser({ ...user, name: user.name, email: user.email, role: user.role, mfaEnabled: user.mfaEnabled });
      }

      return true; // Success will be shown by the calling component
    }

    console.log('User not found or current password incorrect');
    return false;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        verifyMFA,
        enableMFA,
        disableMFA,
        signup,
        logout,
        resetPassword,
        sendPasswordResetCode,
        verifyResetCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}