import { Navigate } from 'react-router';
import { Loader2 } from 'lucide-react';

import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children: React.ReactNode;
  role: 'customer' | 'staff' | 'admin';
}

export default function ProtectedRoute({ children, role }: ProtectedRouteProps) {
  const { user, authLoading } = useAuth();

  // The session check is a real Supabase round-trip on every refresh, and
  // rendering nothing during it produced a blank white flash. Show the boot
  // state in the app's own language instead.
  if (authLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-busy="true"
        className="min-h-screen bg-[#f6f7f9] flex flex-col items-center justify-center gap-3 font-poppins"
      >
        <Loader2 className="h-7 w-7 animate-spin text-[#2F6FD6]" aria-hidden="true" />
        <p className="text-sm font-medium text-slate-500">Restoring your session…</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user.role !== role) {
    return <Navigate to={`/${user.role}/dashboard`} replace />;
  }

  return <>{children}</>;
}
