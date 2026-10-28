import { useLogo } from "../hooks/useLogo";
import { usePageTitle } from "../hooks/usePageTitle";
import React, { useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import {
  ArrowLeft,
  Eye,
  EyeOff,
} from "lucide-react";
import { usePopup } from "../contexts/PopupContext";
import { Button } from "./ui/button";
import { Spinner } from "./ui/spinner";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import LegalPolicyDialog from "./shared/LegalPolicyDialog";
import { useAuth } from "../contexts/AuthContext";
import { ImageWithFallback } from "./shared/ImageWithFallback";
import { useAuthBackgroundUrl } from "../hooks/useAuthBackgroundUrl";
import { PasswordStrengthIndicator, validatePassword } from "./ui/password-strength-indicator";
import { FieldError, describedBy } from "./ui/field-error";
import { checkEmailAllowed } from "../utils/authEmailPolicy";

/** Order in which invalid signup fields take focus (visual order on the form). */
const FIELD_ORDER = [
  "firstName",
  "lastName",
  "email",
  "contactNumber",
  "password",
  "confirmPassword",
  "terms",
];

export default function SignUpPage() {
  const { showPopup } = usePopup();
  const navigate = useNavigate();
  usePageTitle("Create an account");
  const [searchParams] = useSearchParams();
  // Landing-page "Apply" links arrive as /signup?jobId=…; after the account is
  // created the visitor goes straight to that position's application instead of
  // the dashboard (F02).
  const pendingJobId = searchParams.get("jobId");
  const logo = useLogo();
  const authBg = useAuthBackgroundUrl();
  const { signup, signInWithGoogle } = useAuth();
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    contactNumber: "",
    password: "",
    confirmPassword: "",
    agreeTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [profileImage, setProfileImage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  // Inline validation. Every reason a signup can be refused is shown next to the
  // field that caused it, and the submit button is never silently disabled.
  const [errors, setErrors] = useState<Record<string, string>>({});
  // Whether the person has actually started filling the form in. Until they
  // have, pressing the button gets one calm pointer at the first field instead
  // of a wall of red — plenty of people press it out of curiosity before they
  // have decided to sign up.
  const [hasEngaged, setHasEngaged] = useState(false);

  const handleProfileImageChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      showPopup("Please choose an image smaller than 2MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : null;
      setProfileImage(result);
    };
    reader.readAsDataURL(file);
  };

  const handleGoogleSignIn = async () => {
    if (googleLoading) return;
    setGoogleLoading(true);
    const result = await signInWithGoogle();
    if (!result.success) {
      setGoogleLoading(false);
      showPopup("Could not start Google sign-in. Please try again.", "error");
    }
  };

  // Check every rule up front, then show each failure on its own field. The
  // submit button stays clickable: a disabled button with no explanation tells
  // the person nothing about what is wrong.
  const validateForm = () => {
    const next: Record<string, string> = {};

    if (!formData.firstName.trim()) next.firstName = "Enter your first name.";
    if (!formData.lastName.trim()) next.lastName = "Enter your last name.";

    const emailCheck = checkEmailAllowed(formData.email);
    if (!formData.email.trim()) {
      next.email = "Enter your email address.";
    } else if (!emailCheck.allowed) {
      next.email = emailCheck.message || "Enter a valid email address.";
    }

    if (!formData.contactNumber.trim()) {
      next.contactNumber = "Enter your contact number.";
    } else if (formData.contactNumber.length !== 11) {
      next.contactNumber =
        "Enter an 11-digit mobile number, e.g. 09171234567.";
    }

    const passwordValidation = validatePassword(formData.password);
    if (!formData.password) {
      next.password = "Choose a password.";
    } else if (!passwordValidation.isValid) {
      next.password = `${passwordValidation.errors[0]}.`;
    }

    if (!formData.confirmPassword) {
      next.confirmPassword = "Re-enter your password.";
    } else if (formData.password !== formData.confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

    if (!formData.agreeTerms) {
      next.terms =
        "Agree to the Terms and Conditions to create an account.";
    }

    const firstInvalid = FIELD_ORDER.find((field) => next[field]);

    // Flag a field only once the person has given the form a real go. An
    // untouched form reveals just the first thing to fill in; a form they have
    // started reveals everything they forgot, in one pass.
    const shown = hasEngaged
      ? next
      : firstInvalid
        ? { [firstInvalid]: next[firstInvalid] }
        : {};
    setErrors(shown);

    if (firstInvalid) document.getElementById(firstInvalid)?.focus();

    return !firstInvalid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (!validateForm()) return;

    setIsSubmitting(true);
    const success = await signup({ ...formData, profileImage: profileImage ?? undefined });
    setIsSubmitting(false);
    if (success)
      navigate(
        pendingJobId
          ? `/customer/job-apply/${pendingJobId}`
          : "/customer/dashboard",
        { replace: Boolean(pendingJobId) },
      );
  };

  const handleChange = (field: string, value: any) => {
    if (value) setHasEngaged(true);
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => {
      if (!prev[field]) return prev;
      const next = { ...prev };
      delete next[field];
      return next;
    });
  };

  return (
    <div className="min-h-[100dvh] flex flex-col lg:flex-row font-poppins bg-white lg:h-screen lg:overflow-hidden max-lg:overflow-x-hidden animate-in fade-in duration-200">
      {/* Left Side - Logo & Illustration (desktop only) */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#10316B] items-center justify-center">
        {authBg ? (
          <>
            <img
              src={authBg}
              alt="Docufy background"
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/45" />
          </>
        ) : (
          <ImageWithFallback
            src="https://images.unsplash.com/photo-1758518725921-1eb74ed293be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBidXNpbmVzcyUyMGNvbGxhYm9yYXRpb258ZW58MXx8fHwxNzc1ODI4NTk2fDA&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Modern Printing Services"
            className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
          />
        )}

        <button
          onClick={() => navigate("/")}
          className="absolute top-6 left-6 z-20 text-white/80 hover:text-white flex items-center gap-2 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="relative z-10 p-8 max-w-md text-center flex flex-col items-center">
          <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-2xl p-1 bg-white">
            <img
              src={logo}
              alt="Docufy Logo"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            Docufy<span className="text-[#1668D9]">.</span>
          </h1>
          <h2 className="text-xl font-medium text-white mb-4">
            Partner with Docufy
          </h2>
          <p className="text-base text-blue-100/80 leading-relaxed">
            Create an account to securely submit files, approve
            proofs, and engage directly with our team.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-5 sm:px-8 lg:px-16 py-5 sm:py-8 lg:py-4 bg-white relative z-10 lg:h-full lg:overflow-y-auto">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile only — Back to Home */}
          <button
            type="button"
            onClick={() => navigate("/")}
            className="lg:hidden inline-flex items-center gap-1.5 text-sm font-medium text-[#1668D9] py-2 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Home
          </button>

          {/* Mobile branding + heading */}
          <div className="mt-1 mb-5 text-center lg:text-left">
            <div className="lg:hidden flex justify-center mb-3">
              <div className="w-16 h-16 rounded-full bg-white p-1 border border-slate-100 shadow-sm flex items-center justify-center">
                <img
                  src={logo}
                  alt="Docufy Logo"
                  className="w-full h-full object-contain rounded-full"
                />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-[#1c1f26] tracking-tight">
              Create Account
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Join our printing community today.
            </p>
          </div>

          {/* Profile photo — compact */}
          <div className="mb-5 flex items-center justify-center lg:justify-start gap-3 lg:gap-4 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 lg:p-3">
            <div className="relative h-12 w-12 shrink-0 lg:h-16 lg:w-16 overflow-hidden rounded-full border-2 border-[#1668D9] bg-[#EAF2FF] text-sm lg:text-xl font-bold text-[#1668D9] flex items-center justify-center">
              {profileImage ? (
                <img src={profileImage} alt="Profile preview" className="h-full w-full object-cover" />
              ) : (
                (formData.firstName || formData.lastName) ? `${(formData.firstName || "")[0] || ""}${(formData.lastName || "")[0] || ""}`.toUpperCase() || "U" : "U"
              )}
            </div>
            <div className="flex flex-col gap-1.5">
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-lg bg-[#1668D9] px-3 py-2 text-xs font-medium text-white">
                  Upload photo
                  <input type="file" accept="image/*" className="hidden" onChange={handleProfileImageChange} />
                </label>
                <button
                  type="button"
                  onClick={() => setProfileImage(null)}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium text-slate-600"
                >
                  Skip
                </button>
              </div>
              <p className="text-[10px] lg:text-[11px] text-slate-500">Optional. Default initials are used if skipped.</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="firstName"
                  className="text-xs font-medium"
                >
                  First Name
                </Label>
                <Input
                  id="firstName"
                  type="text"
                  value={formData.firstName}
                  onChange={(e) =>
                    handleChange("firstName", e.target.value)
                  }
                  placeholder="e.g. Juan"
                  autoComplete="given-name"
                  enterKeyHint="next"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  aria-invalid={!!errors.firstName || undefined}
                  aria-describedby={describedBy(
                    errors.firstName && "firstName-error",
                  )}
                  required
                />
                <FieldError id="firstName-error" message={errors.firstName} />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="lastName"
                  className="text-xs font-medium"
                >
                  Last Name
                </Label>
                <Input
                  id="lastName"
                  type="text"
                  value={formData.lastName}
                  onChange={(e) =>
                    handleChange("lastName", e.target.value)
                  }
                  placeholder="e.g. Dela Cruz"
                  autoComplete="family-name"
                  enterKeyHint="next"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  aria-invalid={!!errors.lastName || undefined}
                  aria-describedby={describedBy(
                    errors.lastName && "lastName-error",
                  )}
                  required
                />
                <FieldError id="lastName-error" message={errors.lastName} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label
                  htmlFor="email"
                  className="text-xs font-medium"
                >
                  Email
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) =>
                    handleChange("email", e.target.value)
                  }
                  placeholder="e.g. name@psu.palawan.edu.ph"
                  autoComplete="email"
                  enterKeyHint="next"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  aria-invalid={!!errors.email || undefined}
                  aria-describedby={describedBy(
                    errors.email && "email-error",
                  )}
                  required
                />
                <FieldError id="email-error" message={errors.email} />
              </div>
              <div className="space-y-1">
                <Label
                  htmlFor="contactNumber"
                  className="text-xs font-medium"
                >
                  Contact Number
                </Label>
                <Input
                  id="contactNumber"
                  type="tel"
                  value={formData.contactNumber}
                  onChange={(e) =>
                    handleChange(
                      "contactNumber",
                      e.target.value.replace(/\D/g, ""),
                    )
                  }
                  placeholder="09XX XXX XXXX"
                  autoComplete="tel"
                  enterKeyHint="next"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  aria-invalid={!!errors.contactNumber || undefined}
                  aria-describedby={describedBy(
                    errors.contactNumber && "contactNumber-error",
                  )}
                  required
                  maxLength={11}
                />
                <FieldError
                  id="contactNumber-error"
                  message={errors.contactNumber}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label
                    htmlFor="password"
                    className="text-xs font-medium"
                  >
                    Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={formData.password}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      enterKeyHint="next"
                      onChange={(e) =>
                        handleChange("password", e.target.value)
                      }
                      className="h-10 bg-[#F2F7FF] border-transparent rounded-xl pr-10 text-sm"
                      aria-invalid={!!errors.password || undefined}
                      aria-describedby={describedBy(
                        errors.password && "password-error",
                      )}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      aria-pressed={showPassword}
                      onClick={() =>
                        setShowPassword(!showPassword)
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
                    >
                      {showPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  <FieldError id="password-error" message={errors.password} />
                </div>
                <div className="space-y-1">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-xs font-medium"
                  >
                    Confirm Password
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={
                        showConfirmPassword ? "text" : "password"
                      }
                      value={formData.confirmPassword}
                      placeholder="Re-enter your password"
                      autoComplete="new-password"
                      enterKeyHint="done"
                      onChange={(e) =>
                        handleChange(
                          "confirmPassword",
                          e.target.value,
                        )
                      }
                      className="h-10 bg-[#F2F7FF] border-transparent rounded-xl pr-10 text-sm"
                      aria-invalid={!!errors.confirmPassword || undefined}
                      aria-describedby={describedBy(
                        errors.confirmPassword && "confirmPassword-error",
                      )}
                      required
                    />
                    <button
                      type="button"
                      aria-label={showConfirmPassword ? "Hide password" : "Show password"}
                      aria-pressed={showConfirmPassword}
                      onClick={() =>
                        setShowConfirmPassword(
                          !showConfirmPassword,
                        )
                      }
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 p-2 rounded-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={18} />
                      ) : (
                        <Eye size={18} />
                      )}
                    </button>
                  </div>
                  <FieldError
                    id="confirmPassword-error"
                    message={errors.confirmPassword}
                  />
                </div>
              </div>

              {formData.password && (
                <div className="lg:col-span-2">
                  <PasswordStrengthIndicator password={formData.password} />
                </div>
              )}
            </div>

            <div className="flex items-start space-x-2.5 pt-1.5 pb-1">
              <Checkbox
                id="terms"
                checked={formData.agreeTerms}
                onCheckedChange={(checked) =>
                  handleChange("agreeTerms", checked)
                }
                className="mt-0.5 size-5 rounded-[6px]"
                aria-invalid={!!errors.terms || undefined}
                aria-describedby={describedBy(
                  errors.terms && "terms-error",
                )}
              />
              <label
                htmlFor="terms"
                className="text-xs lg:text-[11px] text-gray-500 leading-snug cursor-pointer py-1 min-h-6"
              >
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowTerms(true);
                  }}
                  className="inline-block py-1 -my-1 text-[#1668D9] hover:underline font-medium"
                >
                  Terms and Conditions
                </button>
              </label>
            </div>
            <FieldError id="terms-error" message={errors.terms} />

            <Button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-11 lg:h-10 rounded-xl text-sm font-semibold transition-all duration-200 bg-[#1668D9] text-white border-2 border-[#1668D9] hover:bg-[#10316B] hover:border-[#10316B] shadow-md cursor-pointer lg:bg-white lg:text-[#1668D9] lg:border-blue-200 lg:hover:bg-[#1668D9] lg:hover:text-white lg:hover:border-blue-200"
            >
              {isSubmitting ? (
                <Spinner size="xs" label="Creating Account..." stack={false} />
              ) : (
                "Create Account"
              )}
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-gray-500">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-11 lg:h-10 border-gray-200 rounded-xl text-sm"
            onClick={handleGoogleSignIn}
            disabled={googleLoading}
          >
            {googleLoading ? (
              <span className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-gray-300 border-t-[#2F6FD6]" />
            ) : (
            <svg className="w-4 h-4 mr-2" viewBox="0 0 24 24">
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              />
            </svg>
            )}
            Sign in with Google
          </Button>

          <div className="mt-4 text-center text-xs text-gray-500">
            Already have an account?{" "}
            <button
              type="button"
              onClick={() =>
                navigate(`/login${pendingJobId ? `?jobId=${pendingJobId}` : ""}`)
              }
              className="text-[#1668D9] font-semibold"
            >
              Log in
            </button>
          </div>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      <LegalPolicyDialog
        open={showTerms}
        onOpenChange={setShowTerms}
        initialTab="terms"
      />
    </div>
  );
}
