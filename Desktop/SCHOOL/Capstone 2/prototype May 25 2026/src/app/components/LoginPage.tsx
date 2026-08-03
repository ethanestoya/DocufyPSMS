import React, { useState } from "react";
import { useNavigate } from "react-router";
import { useAuth } from "../contexts/AuthContext";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import logoImage from "figma:asset/75a8c7ffb8323b19e5416b93ad0b6211b6413f2c.png";
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

export default function LoginPage() {
  const navigate = useNavigate();
  const { login, verifyMFA, user } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [requiresMFA, setRequiresMFA] = useState(false);
  const [mfaCode, setMfaCode] = useState([
    "",
    "",
    "",
    "",
    "",
    "",
  ]);
  const mfaInputRefs = React.useRef<
    (HTMLInputElement | null)[]
  >([]);

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

  React.useEffect(() => {
    if (requiresMFA && mfaInputRefs.current[0]) {
      mfaInputRefs.current[0]?.focus();
    }
  }, [requiresMFA]);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = login(email, password);
    if (!result.success) {
      setError("Invalid email or password");
    } else if (result.requiresMFA) {
      setRequiresMFA(true);
    }
  };

  const handleMFAVerify = (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const code = mfaCode.join("");
    const success = verifyMFA(code);
    if (!success) {
      setError("Invalid MFA code. Please try again.");
    }
  };

  const handleMFAInputChange = (
    index: number,
    value: string,
  ) => {
    // Check if all previous boxes are filled
    for (let i = 0; i < index; i++) {
      if (!mfaCode[i]) {
        mfaInputRefs.current[i]?.focus();
        return;
      }
    }

    // Only allow digits
    if (value && !/^\d$/.test(value)) return;

    const newCode = [...mfaCode];
    newCode[index] = value;
    setMfaCode(newCode);

    // Auto-focus next input without selecting
    if (value && index < 5) {
      setTimeout(() => {
        mfaInputRefs.current[index + 1]?.focus();
      }, 0);
    }
  };

  const handleMFAKeyDown = (
    index: number,
    e: React.KeyboardEvent<HTMLInputElement>,
  ) => {
    if (e.key === "Backspace" && !mfaCode[index] && index > 0) {
      mfaInputRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-screen flex font-poppins overflow-hidden">

      {/* Left Side - Logo & Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#1c1f26] items-center justify-center min-h-screen">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1595142545813-06fee27f3dcb?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBwcmludCUyMHNob3AlMjBwcmludGluZyUyMHNlcnZpY2VzfGVufDF8fHx8MTc3NTgyODU1OXww&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Modern Print Shop"
          className="absolute inset-0 w-full h-full object-cover opacity-20 mix-blend-overlay"
        />

        <button
          onClick={() => navigate("/")}
          className="absolute top-6 left-6 z-20 text-white/80 hover:text-white flex items-center gap-2 transition-colors text-sm font-medium"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Home
        </button>

        <div className="relative z-10 p-8 max-w-md text-center flex flex-col items-center">
          <div className="w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-2xl p-1 bg-white">
            <img
              src={logoImage}
              alt="DocuFy Logo"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            DocuFy<span className="text-[#1D73EC]">.</span>
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
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-8 bg-white relative z-10 overflow-y-auto min-h-screen">
        <div className="max-w-md w-full mx-auto">
          {/* Mobile Only Header */}
          <div className="lg:hidden flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <div className="bg-[#1D73EC] p-1.5 rounded-lg text-white">
                <Printer size={20} strokeWidth={2.5} />
              </div>
              <span className="font-semibold text-lg text-[#1c1f26] tracking-tight">
                DocuFy.
              </span>
            </div>
            <button
              onClick={() => navigate("/")}
              className="text-xs text-gray-500 flex items-center gap-1"
            >
              <ArrowLeft className="w-3 h-3" /> Home
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
            onClick={() => {}}
          >
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
            Continue with Google
          </Button>

          <div className="relative mb-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-gray-400">
                Or continue with email
              </span>
            </div>
          </div>

          {requiresMFA ? (
            <form
              onSubmit={handleMFAVerify}
              className="space-y-4"
            >
              <div className="space-y-3">
                <Label className="text-xs font-medium">
                  Enter 6-Digit MFA Code
                </Label>
                <div className="flex gap-2 justify-center">
                  {mfaCode.map((digit, index) => (
                    <Input
                      key={index}
                      ref={(el) =>
                        (mfaInputRefs.current[index] = el)
                      }
                      type="text"
                      inputMode="numeric"
                      maxLength={1}
                      value={digit}
                      onChange={(e) =>
                        handleMFAInputChange(
                          index,
                          e.target.value,
                        )
                      }
                      onKeyDown={(e) =>
                        handleMFAKeyDown(index, e)
                      }
                      onFocus={(e) => {
                        // Check if previous boxes are filled
                        for (let i = 0; i < index; i++) {
                          if (!mfaCode[i]) {
                            e.preventDefault();
                            mfaInputRefs.current[i]?.focus();
                            return;
                          }
                        }
                        // Don't select - just let cursor sit at end
                      }}
                      className="w-12 h-14 bg-[#F2F7FF] border-2 border-gray-200 rounded-xl text-center text-2xl font-bold focus:border-[#1D73EC] focus:ring-0"
                      required
                    />
                  ))}
                </div>
                <p className="text-[10px] text-gray-500 text-center">
                  Enter the code from your email
                </p>
              </div>

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
                className="w-full h-10 bg-[#1D73EC] hover:bg-[#10316B] text-white rounded-xl shadow-md text-sm"
              >
                Verify MFA Code
              </Button>

              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setRequiresMFA(false);
                  setMfaCode(["", "", "", "", "", ""]);
                  setError("");
                }}
                className="w-full text-sm"
              >
                Back to Login
              </Button>
            </form>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-1">
                <Label
                  htmlFor="email"
                  className="text-xs font-medium"
                >
                  Email / Username
                </Label>
                <Input
                  id="email"
                  type="text"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter email"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  required
                />
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
                    Forgot?
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
                    placeholder="Enter password"
                    className="h-10 bg-[#F2F7FF] border-transparent rounded-xl pr-10 text-sm"
                    required
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setShowPassword(!showPassword)
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                  >
                    {showPassword ? (
                      <EyeOff size={16} />
                    ) : (
                      <Eye size={16} />
                    )}
                  </button>
                </div>
              </div>

              <div className="flex items-center space-x-2">
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
              </div>

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
                className="w-full h-10 bg-[#1D73EC] hover:bg-[#10316B] text-white rounded-xl shadow-md text-sm"
              >
                Log In
              </Button>
            </form>
          )}

          <div className="mt-4 text-center text-xs text-gray-500">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-[#1D73EC] font-semibold"
            >
              Sign up
            </button>
          </div>

          <div className="mt-6 p-3 bg-[#F2F7FF] rounded-lg text-[10px] text-gray-500 border border-blue-50">
            <p className="font-semibold text-[#10316B] mb-1">Demo access:</p>
            <div className="grid grid-cols-1 gap-0.5">
              <div><span className="text-[#1D73EC]">Customer:</span> customer@test.com / customer123</div>
              <div><span className="text-[#1D73EC]">Staff:</span> staff@test.com / staff123</div>
              <div><span className="text-[#10316B]">Admin:</span> admin@test.com / admin123</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}