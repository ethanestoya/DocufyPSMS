import image_75a8c7ffb8323b19e5416b93ad0b6211b6413f2c from "figma:asset/75a8c7ffb8323b19e5416b93ad0b6211b6413f2c.png";
import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  ArrowLeft,
  Info,
  Printer,
  Eye,
  EyeOff,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { Checkbox } from "./ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "./ui/dialog";
import { useAuth } from "../contexts/AuthContext";
import { ImageWithFallback } from "./figma/ImageWithFallback";
import { PasswordStrengthIndicator, validatePassword } from "./ui/password-strength-indicator";

export default function SignUpPage() {
  const navigate = useNavigate();
  const { signup } = useAuth();
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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Validate password strength
    const passwordValidation = validatePassword(formData.password);
    if (!passwordValidation.isValid) {
      toast.error("Password does not meet security requirements");
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    if (!formData.agreeTerms) {
      toast.error(
        "Please agree to the terms and file retention policy",
      );
      return;
    }
    signup(formData);
    toast.success("Account created successfully!");
    navigate("/customer/dashboard");
  };

  const handleChange = (field: string, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="h-screen flex flex-col lg:flex-row font-poppins bg-white overflow-hidden">
      {/* Left Side - Logo & Illustration */}
      <div className="hidden lg:flex lg:w-1/2 relative bg-[#10316B] items-center justify-center">
        <ImageWithFallback
          src="https://images.unsplash.com/photo-1758518725921-1eb74ed293be?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxtb2Rlcm4lMjBidXNpbmVzcyUyMGNvbGxhYm9yYXRpb258ZW58MXx8fHwxNzc1ODI4NTk2fDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral"
          alt="Modern Printing Services"
          className="absolute inset-0 w-full h-full object-cover opacity-30 mix-blend-overlay"
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
              src={
                image_75a8c7ffb8323b19e5416b93ad0b6211b6413f2c
              }
              alt="DocuFy Logo"
              className="w-full h-full object-contain rounded-full"
            />
          </div>
          <h1 className="text-4xl font-bold text-white mb-2 tracking-tight">
            DocuFy<span className="text-[#1D73EC]">.</span>
          </h1>
          <h2 className="text-xl font-medium text-white mb-4">
            Partner with DocuFy
          </h2>
          <p className="text-base text-blue-100/80 leading-relaxed">
            Create an account to securely submit files, approve
            proofs, and engage directly with our team.
          </p>
        </div>
      </div>

      {/* Right Side - Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 sm:px-12 lg:px-16 py-4 bg-white relative z-10 overflow-y-auto h-full">
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

          <div className="mb-4 text-center lg:text-left">
            <h2 className="text-2xl font-bold text-[#1c1f26]">
              Create Account
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Join our printing community today.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
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
                  placeholder="First name"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  required
                />
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
                  placeholder="Last name"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
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
                  placeholder="Email address"
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  required
                />
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
                  className="h-10 bg-[#F2F7FF] border-transparent rounded-xl text-sm"
                  required
                  maxLength={11}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-2 gap-3">
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
                      placeholder="Enter password"
                      onChange={(e) =>
                        handleChange("password", e.target.value)
                      }
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
                <div className="space-y-1">
                  <Label
                    htmlFor="confirmPassword"
                    className="text-xs font-medium"
                  >
                    Confirm
                  </Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={
                        showConfirmPassword ? "text" : "password"
                      }
                      value={formData.confirmPassword}
                      placeholder="Confirm password"
                      onChange={(e) =>
                        handleChange(
                          "confirmPassword",
                          e.target.value,
                        )
                      }
                      className="h-10 bg-[#F2F7FF] border-transparent rounded-xl pr-10 text-sm"
                      required
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setShowConfirmPassword(
                          !showConfirmPassword,
                        )
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showConfirmPassword ? (
                        <EyeOff size={16} />
                      ) : (
                        <Eye size={16} />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              {formData.password && (
                <div className="col-span-2">
                  <PasswordStrengthIndicator password={formData.password} />
                </div>
              )}
            </div>

            <div className="flex items-start space-x-2 py-1">
              <Checkbox
                id="terms"
                checked={formData.agreeTerms}
                onCheckedChange={(checked) =>
                  handleChange("agreeTerms", checked)
                }
                className="mt-0.5"
              />
              <label
                htmlFor="terms"
                className="text-[11px] text-gray-500 leading-tight cursor-pointer"
              >
                I agree to the{" "}
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setShowTerms(true);
                  }}
                  className="text-[#1D73EC] hover:underline font-medium"
                >
                  Terms and Conditions
                </button>
              </label>
            </div>

            <Button
              type="submit"
              disabled={!formData.agreeTerms || !validatePassword(formData.password).isValid}
              className={`w-full h-10 rounded-xl shadow-md text-sm transition-all ${
                formData.agreeTerms && validatePassword(formData.password).isValid
                  ? "bg-[#1D73EC] hover:bg-[#10316B] text-white cursor-pointer"
                  : "bg-gray-300 text-gray-500 cursor-not-allowed"
              }`}
            >
              Create Account
            </Button>
          </form>

          <div className="relative my-4">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-100"></div>
            </div>
            <div className="relative flex justify-center text-[10px] uppercase">
              <span className="bg-white px-2 text-gray-400">
                Or continue with
              </span>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            className="w-full h-10 border-gray-200 rounded-xl text-sm"
            onClick={() =>
              toast.info("Google Sign-In coming soon!")
            }
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
            Sign in with Google
          </Button>

          <div className="mt-4 text-center text-xs text-gray-500">
            Already have an account?{" "}
            <button
              onClick={() => navigate("/login")}
              className="text-[#1D73EC] font-semibold"
            >
              Log in
            </button>
          </div>

          <div className="mt-4 p-3 bg-white border-2 border-blue-200/50 rounded-lg flex items-start gap-2">
            <Info className="text-[#1D73EC] shrink-0 w-4 h-4 mt-0.5" />
            <p className="text-[10px] text-gray-500 leading-relaxed">
              <strong className="text-[#10316B]">Note:</strong>{" "}
              Staff accounts are managed by administrators and
              cannot sign up here.
            </p>
          </div>
        </div>
      </div>

      {/* Terms and Conditions Modal */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#10316B]">Terms and Conditions</DialogTitle>
            <DialogDescription className="text-gray-600">
              Last updated: April 27, 2026
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">1. Acceptance of Terms</h3>
              <p>
                By accessing and using DocuFy PSMS (Print Shop Management System), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">2. Use License</h3>
              <p>
                Permission is granted to use DocuFy PSMS for personal and academic purposes within Palawan State University. This license shall automatically terminate if you violate any of these restrictions and may be terminated by DocuFy at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">3. Service Description</h3>
              <p>
                DocuFy PSMS provides printing services for students and faculty of Palawan State University. Services include document printing, color printing, binding, and related print shop services. We reserve the right to modify, suspend, or discontinue any aspect of the service at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">4. User Accounts</h3>
              <p>
                You are responsible for maintaining the confidentiality of your account credentials. You agree to accept responsibility for all activities that occur under your account. You must notify us immediately of any unauthorized use of your account.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">5. Payment Terms</h3>
              <p>
                All payments must be made through the approved payment methods (GCash or Cash on Pickup). Prices are subject to change without notice.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">6. Content Restrictions</h3>
              <p>
                Users may not upload, print, or distribute content that is illegal, offensive, defamatory, or infringes on intellectual property rights. DocuFy reserves the right to refuse service for any content deemed inappropriate.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">7. File Retention Policy</h3>
              <p>
                Documents uploaded to our system are stored securely and automatically deleted 30 days after order completion. We do not share your documents with third parties without your consent.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">8. Limitation of Liability</h3>
              <p>
                DocuFy PSMS shall not be liable for any damages arising from the use or inability to use the service, including but not limited to printing errors, delays, or data loss.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">9. Contact Information</h3>
              <p>
                For questions about these Terms and Conditions, please contact us at support@docufy.com or visit our office at Palawan State University - Main Campus, TBI Building, Room 4.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}