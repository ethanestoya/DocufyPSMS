import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { Spinner } from "./ui/spinner";
import { isAllowedEmail, isPolicyTriggerError } from "../utils/authEmailPolicy";
import { usePopup } from "../contexts/PopupContext";

// Supabase reports an OAuth failure either as query params (PKCE flow) or in
// the URL hash (implicit flow). The hash carries the useful codes — notably
// `error_code=saving_new_user` with the database trigger's message, which is
// how a blocked organization email announces itself.
function readHashParams(): URLSearchParams {
  const hash = window.location.hash?.replace(/^#/, "");
  return new URLSearchParams(hash || "");
}

// Landing page for the Supabase Google OAuth redirect (the URL configured as
// redirectTo in AuthContext.signInWithGoogle). Supabase restores the session
// and AuthProvider's session-restore effect loads the profile BEFORE the first
// render settles, so this page only has to wait for `authLoading` to finish
// and then route by role. It also surfaces Supabase's own ?error= params
// (e.g. access_denied) instead of letting the user stare at a blank screen.
export default function AuthCallbackPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, authLoading, emailPolicyBlocked } = useAuth();
  const { showPopup } = usePopup();

  useEffect(() => {
    const hashParams = readHashParams();
    const error = searchParams.get("error") || hashParams.get("error");
    const description =
      searchParams.get("error_description") || hashParams.get("error_description");
    const errorCode = searchParams.get("error_code") || hashParams.get("error_code");

    if (error || errorCode || description) {
      // The database trigger refuses the insert of an account on a domain
      // that may not hold one, and Supabase reports that as a generic
      // "saving new user" failure — translate it back into the policy.
      const blocked = isPolicyTriggerError(
        [error, errorCode, description].filter(Boolean).join(" "),
      );
      if (blocked) {
        // The login screen opens a window for this that stays until dismissed,
        // so the refusal is handed over through router state instead of a toast
        // that would be gone before the redirect finishes.
        navigate("/login", {
          replace: true,
          state: { emailPolicyBlocked: true },
        });
      } else {
        showPopup(description || "Sign-in was not completed.", "error");
        navigate("/login", { replace: true });
      }
      return;
    }

    if (authLoading) return;

    if (emailPolicyBlocked) {
      // AuthProvider already refused the session and explained why; just send
      // the user back to the login form.
      navigate("/login", { replace: true });
      return;
    }

    if (user) {
      if (!isAllowedEmail(user.email)) {
        // Belt and braces: an allowed-looking session that is not allowed by
        // the policy never reaches the app.
        navigate("/login", { replace: true });
        return;
      }
      navigate(`/${user.role}/dashboard`, { replace: true });
    } else {
      showPopup("Sign-in was not completed. Please try again.", "error");
      navigate("/login", { replace: true });
    }
  }, [user, authLoading, emailPolicyBlocked, navigate, searchParams]);

  return (
    <div className="min-h-[100dvh] flex items-center justify-center bg-[#f6f7f9]">
      <Spinner size="md" label="Signing you in…" stack />
    </div>
  );
}
