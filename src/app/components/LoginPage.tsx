import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { ImageWithFallback } from "./shared/ImageWithFallback";
import { useLogo } from "../hooks/useLogo";
import { useAuthBackgroundUrl } from "../hooks/useAuthBackgroundUrl";
import {
  ArrowLeft,
  Printer,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Input } from "./ui/input";
import { Checkbox } from "./ui/checkbox";
import { Alert, AlertDescription } from "./ui/alert";
import { EMAIL_POLICY_MESSAGE } from "../utils/authEmailPolicy";

export default function LoginPage() {
  const navigate = useNavigate();
  const logo = useLogo();
  const authBg = useAuthBackgroundUrl();
  const { login, signInWithGoogle, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  React.useEffect(() => {
    if (user) {
      if (user.role === "customer") {
        navigate("/customer/dashboard");
      } else if (user.role === "staff") {
        navigate("/staff/dashboard");
      } else if (user.role === "admin") {
        navigate("/admin/dashboard");
      }
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const result = await login(email, password);
      if (!result.success) {
        setError(
          result.reason === "inactive"
            ? "This account has been deactivated. Please contact your administrator."
            : result.reason === "domain"
              ? EMAIL_POLICY_MESSAGE
              : result.reason === "invalid"
                ? "Please enter a valid email address."
                : "Invalid email or password",
        );
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    setError("");
    const result = await signInWithGoogle();
    if (!result.success) {
      setGoogleLoading(false);
      setError("Could not start Google sign-in. Please try again.");
    }
  };

  return (
    <div className="min-h-[100dvh] flex font-poppins overflow-y-auto">

      {/* Left Side - Logo & Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#1c1f26] items-center justify-center min-h-screen">
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
            src="https://images.unsplash.com/photo-1595142545813-06fee27f3dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBwcmludCUyMHNob3AlMjBwcmludGluZyUyMHNlcnZpY2VzfGVufDF8fHx8MTc3NTgyODU1OXww&ixlib=rb-4.1.0&q=80&w=1080"
            alt="Modern Print Shop"
            className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
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
            Docufy PSMS<span className="text-[#1D73EC]"></span>
          </h1>
          <h2 className="text-xl font-medium text-white mb-4">
            Your Complete Printing Solution
          </h2>
          <p className="text-base text-blue-100/80 leading-relaxed">
            Manage files, track orders, and streamline your
            workflow in one convenient dashboard.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-start lg:justify-center px-5 sm:px-12 lg:px-16 py-5 sm:py-8 bg-white relative z-10 min-h-[100dvh]">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile Only Header */}
          <div className="lg:hidden mb-8 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <img src={logo} alt="Docufy Logo" className="h-12 w-12 object-contain" />
              <h1 className="truncate text-xl font-bold text-[#1c1f26]">Docufy PSMS</h1>
            </div>
            <button onClick={() => navigate("/")} className="inline-flex shrink-0 items-center gap-1 text-xs font-medium text-[#1D73EC]">
              <ArrowLeft className="h-3.5 w-3.5" /> Home
            </button>
          </div>

          <div className="mb-6 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-[#1c1f26] mb-1">
              Log in
            </h2>
            <p className="text-sm text-gray-500">
              Welcome back! Please enter your details.
            </p>
          </div>

          <Button
            variant="outline"
            className="w-full border-gray-200 text-[#1c1f26] h-10 text-sm mb-4"
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
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-gray-500">
                Or continue with email
              </span>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
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
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@psu.palawan.edu.ph"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  required
                />
                <p className="text-[11px] text-slate-500">
                  Sign in with your organization email address.
                </p>
              </div>

              <div className="space-y-1">
                <div className="flex justify-between items-center">
                  <Label
                    htmlFor="password"
                    className="text-xs font-medium"
                  >
                    Password
                  </Label>
                  <button
                    type="button"
                    onClick={() => navigate("/forgot-password")}
                    className="text-[11px] font-medium text-[#1D73EC] hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) =>
                      setPassword(e.target.value)
                    }
                    placeholder="Enter your password"
                    className="h-10 bg-[#F2F7FF] border-transparent rounded-xl pr-10 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500"
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              {/* <div className="flex items-center space-x-2">
                <Checkbox
                  id="remember"
                  checked={rememberMe}
                  onCheckedChange={(checked) =>
                    setRememberMe(checked as boolean)
                  }
                  className="w-4 h-4"
                />
                <label
                  htmlFor="remember"
                  className="text-xs text-gray-500 cursor-pointer"
                >
                  Remember me
                </label>
              </div> */}

              {error && (
                <Alert
                  variant="destructive"
                  className="py-2 px-3 rounded-xl"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                  <AlertDescription className="text-xs">
                    {error}
                  </AlertDescription>
                </Alert>
              )}

              <Button
                type="submit"
                loading={submitting}
                loadingText="Logging In..."
                className="w-full h-10 bg-[#1D73EC] text-white border-2 border-[#1D73EC] hover:bg-[#10316B] hover:border-[#10316B] rounded-xl text-sm font-semibold shadow-md hover:shadow-lg transition-all duration-200 active:scale-[0.97] active:bg-[#0c2a5c] disabled:opacity-60 disabled:pointer-events-none"
              >
                Log In
              </Button>
            </form>

          <div className="mt-4 text-center text-xs text-gray-500">
            Need an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-[#1D73EC] text-xs font-semibold"
            >
              Create account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}