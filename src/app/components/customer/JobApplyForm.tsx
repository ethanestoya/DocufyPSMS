import React, { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Package,
  User,
  CheckCircle,
  Upload,
  Link2,
  ArrowLeft,
  AlertCircle,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { ZoomSafeDropdown } from "../ui/zoom-safe-dropdown";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { applicationsStore, applicationDisplayId } from "../../utils/applicationsStore";
import { notificationStore } from "../../utils/notificationStore";
import { jobsStore } from "../../utils/jobsStore";
import { useAuth } from "../../contexts/AuthContext";

const menuItems = [
  {
    label: "Dashboard",
    path: "/customer/dashboard",
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    label: "Print Request",
    path: "/customer/new-request",
    icon: <FileText className="w-5 h-5" />,
  },
  {
    label: "My Orders",
    path: "/customer/orders",
    icon: <Package className="w-5 h-5" />,
  },
  {
    label: "Job Board",
    path: "/customer/job-board",
    icon: <Briefcase className="w-5 h-5" />,
  },
];

type FormField = "firstName" | "lastName" | "email" | "contact" | "skills" | "portfolio" | "consentAgreed";

const fieldErrors: Record<FormField, string> = {
  firstName: "First name is required.",
  lastName: "Last name is required.",
  email: "Email is required.",
  contact: "Contact number is required.",
  skills: "Please describe your skills or experience.",
  portfolio: "This field is required.",
  consentAgreed: "You must agree to the terms to submit.",
};

export default function JobApplyForm() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { jobId } = useParams();
  const job = jobsStore.getJobById(jobId || "");
  const jobTitle = job?.title || "Open Position";

  const [submitted, setSubmitted] = useState(false);
  const [submittedAppId, setSubmittedAppId] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showTerms, setShowTerms] = useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    contact: "",
    email: "",
    position: jobTitle,
    skills: "",
    resumeType: "link" as "link" | "file",
    resumeLink: "",
    resumeFile: null as File | null,
    consentAgreed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [touched, setTouched] = useState<Set<string>>(new Set());

  // Auto-fill name/email from the logged-in user (still editable).
  useEffect(() => {
    if (!user) return;
    setFormData((prev) => {
      const next = { ...prev };
      if (!prev.firstName && !prev.lastName) {
        const parts = (user.name || "").trim().split(/\s+/);
        if (parts.length > 0 && parts[0]) next.firstName = parts[0];
        if (parts.length > 1) next.lastName = parts.slice(1).join(" ");
      }
      if (!prev.email && user.email) next.email = user.email;
      return next;
    });
  }, [user]);

  const markTouched = (field: string) => {
    setTouched((prev) => new Set(prev).add(field));
  };

  const validateField = (field: FormField): string => {
    switch (field) {
      case "firstName":
        return !formData.firstName.trim() ? fieldErrors.firstName : "";
      case "lastName":
        return !formData.lastName.trim() ? fieldErrors.lastName : "";
      case "email":
        if (!formData.email.trim()) return fieldErrors.email;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
          return "Enter a valid email address.";
        return "";
      case "contact":
        return !formData.contact.trim() ? fieldErrors.contact : "";
      case "skills":
        return !formData.skills.trim() ? fieldErrors.skills : "";
      case "portfolio":
        if (formData.resumeType === "link" && !formData.resumeLink.trim())
          return fieldErrors.portfolio;
        if (formData.resumeType === "file" && !formData.resumeFile)
          return "Please upload your resume file.";
        return "";
      case "consentAgreed":
        return !formData.consentAgreed ? fieldErrors.consentAgreed : "";
      default:
        return "";
    }
  };

  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = ["firstName", "lastName", "email", "contact", "skills", "portfolio", "consentAgreed"]
      .reduce((acc, field) => {
        const err = validateField(field as FormField);
        if (err) acc[field] = err;
        return acc;
      }, {} as Record<string, string>);
    return errs;
  };

  const handleBlur = (field: string) => {
    markTouched(field);
    const err = validateField(field as FormField);
    setErrors((prev) => {
      const next = { ...prev };
      if (err) next[field] = err;
      else delete next[field];
      return next;
    });
  };

  const handleResumeFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, portfolio: "File must be less than 10MB." }));
      return;
    }
    setFormData((prev) => ({ ...prev, resumeFile: file }));
    setErrors((prev) => { const n = { ...prev }; delete n.portfolio; return n; });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      setTouched(new Set(["firstName", "lastName", "email", "contact", "skills", "portfolio", "consentAgreed"]));
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await applicationsStore.addApplication({
        applicantProfileId: user?.id ?? null,
        jobId: jobId || "",
        jobTitle,
        firstName: formData.firstName,
        lastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`,
        email: formData.email,
        contact: formData.contact,
        position: formData.position,
        skills: formData.skills,
        portfolio: formData.resumeType === "link" ? formData.resumeLink : "",
        portfolioType: formData.resumeType,
        portfolioFile: formData.resumeFile,
        portfolioFileName: formData.resumeFile?.name,
      });

      const applicantLabel = `${formData.firstName} ${formData.lastName}`.trim();
      notificationStore.addNotification(
        "status_update",
        "New Job Application",
        `${applicantLabel} applied for "${jobTitle}". Review the application.`,
        {
          clickable: true,
          relatedRoute: "/admin/job-board",
          recipientRole: "admin",
        },
      );
      notificationStore.addNotification(
        "status_update",
        "New Job Application",
        `${applicantLabel} applied for "${jobTitle}". Review the application.`,
        {
          clickable: true,
          relatedRoute: "/staff/profile",
          recipientRole: "staff",
        },
      );

      setSubmittedAppId(applicationDisplayId(result.id));
      setSubmitted(true);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputClass = (field: string) =>
    `h-11 bg-[#FBFDFF] ${errors[field] && touched.has(field) ? "border-red-400 focus-visible:ring-red-400" : "border-blue-200 focus-visible:ring-[#1668D9]"}`;

  const fieldError = (field: string) =>
    errors[field] && touched.has(field) ? (
      <p className="text-xs text-red-500 mt-1">{errors[field]}</p>
    ) : null;

  const termsBody = (
    <>
      <p className="mb-3 font-semibold text-gray-900">
        Applicant Consent and Liability Waiver
      </p>
      <p className="mb-2">
        By submitting this job application to <strong>Docufy Printing Shop Management System</strong>,
        I acknowledge and agree to the following terms:
      </p>
      <ul className="list-disc list-inside space-y-2 mb-3">
        <li>
          I certify that all information provided in this application is true, accurate,
          and complete to the best of my knowledge.
        </li>
        <li>
          I understand that any false or misleading information may result in immediate
          disqualification or termination of employment.
        </li>
        <li>
          I authorize Docufy to verify the information provided and to contact references
          listed in my application.
        </li>
        <li>
          I understand that submitting this application does not guarantee employment or an interview.
        </li>
        <li>
          I acknowledge that Docufy reserves the right to modify, postpone, or cancel any
          job opening at any time without prior notice.
        </li>
      </ul>
      <p className="mb-2 font-semibold text-gray-900">Liability Waiver:</p>
      <p className="mb-2">
        I acknowledge that <strong>Docufy Printing Shop Management System</strong> and its
        representatives shall not be held liable for:
      </p>
      <ul className="list-disc list-inside space-y-2">
        <li>
          Any delays, errors, or technical issues in the application submission or review process.
        </li>
        <li>
          Any decisions made regarding my application, including rejection or non-response.
        </li>
        <li>
          Any personal, financial, or professional consequences resulting from the application
          process or employment relationship.
        </li>
        <li>
          Loss or unauthorized access to any documents or information submitted as part of this application.
        </li>
      </ul>
      <p className="mt-3 text-xs text-gray-500">
        This agreement is governed by applicable labor laws and regulations. By proceeding,
        you confirm that you have read, understood, and agree to these terms.
      </p>
    </>
  );

  if (submitted) {
    return (
      <Layout
        menuItems={menuItems}
        title="Job Application"
        showBackButton
        hideMobileBackButton
      >
        <div className="max-w-xl mx-auto space-y-5">
          <button
            type="button"
            onClick={() => navigate(-1)}
            aria-label="Go back"
            className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
          >
            <ArrowLeft className="h-5 w-5" />
            <span className="text-sm font-medium">Back</span>
          </button>

          <Card className="p-6 sm:p-8 bg-white shadow-sm border border-slate-200/70">
            <div className="text-center space-y-5">
              <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto">
                <CheckCircle className="w-7 h-7 text-emerald-500" />
              </div>

              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Application Submitted
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  Your application for <strong className="text-slate-700">{jobTitle}</strong> has
                  been successfully submitted.
                </p>
              </div>

              <div className="inline-block bg-slate-50 border border-slate-200 rounded-lg px-5 py-3">
                <p className="text-[11px] font-medium text-slate-400 uppercase tracking-wider">
                  Application ID
                </p>
                <p className="text-base font-bold text-slate-900 mt-0.5 tracking-wide">
                  {submittedAppId}
                </p>
              </div>

              <p className="text-sm text-slate-500 leading-relaxed max-w-xs mx-auto">
                Our team will review your application within 3–5 business days.
                We'll contact you using the information provided.
              </p>

              <div className="flex flex-col gap-2.5 pt-2">
                <Button
                  type="button"
                  onClick={() => navigate("/customer/job-board?tab=applications")}
                  className="w-full h-11 bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white transition-all hover:-translate-y-0.5 hover:shadow-md"
                >
                  View Application Status
                </Button>
                <Button
                  type="button"
                  onClick={() => navigate("/customer/dashboard")}
                  variant="ghost"
                  className="w-full h-11 text-slate-600 hover:text-slate-900 hover:bg-slate-100"
                >
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </Card>
        </div>
      </Layout>
    );
  }

  return (
    <Layout
      menuItems={menuItems}
      title="Job Application"
      showBackButton
      hideMobileBackButton
    >
      <div className="max-w-xl mx-auto space-y-5">
        {/* Back button */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Page header */}
        <div>
          <h2 className="text-xl font-semibold text-slate-900 tracking-tight">
            Job Application
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Submit your application for{" "}
            <strong className="text-[#10316B]">{jobTitle}</strong>
          </p>
        </div>

        {/* Form */}
        <Card className="p-5 sm:p-8 bg-white shadow-sm border border-slate-200/70">
          <form onSubmit={handleSubmit} className="space-y-6" noValidate>

            {/* Personal Information */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Personal Information
              </h3>
              <div className="space-y-3.5">
                <div>
                  <Label htmlFor="firstName" className="text-sm font-medium text-slate-700 mb-1.5">
                    First Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) => setFormData((p) => ({ ...p, firstName: e.target.value }))}
                    onBlur={() => handleBlur("firstName")}
                    placeholder="e.g. Maria"
                    className={inputClass("firstName")}
                  />
                  {fieldError("firstName")}
                </div>
                <div>
                  <Label htmlFor="lastName" className="text-sm font-medium text-slate-700 mb-1.5">
                    Last Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData((p) => ({ ...p, lastName: e.target.value }))}
                    onBlur={() => handleBlur("lastName")}
                    placeholder="e.g. Santos"
                    className={inputClass("lastName")}
                  />
                  {fieldError("lastName")}
                </div>
                <div>
                  <Label htmlFor="contact" className="text-sm font-medium text-slate-700 mb-1.5">
                    Contact Number <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact"
                    type="tel"
                    value={formData.contact}
                    onChange={(e) => setFormData((p) => ({ ...p, contact: e.target.value }))}
                    onBlur={() => handleBlur("contact")}
                    placeholder="09XX XXX XXXX"
                    className={inputClass("contact")}
                  />
                  {fieldError("contact")}
                </div>
                <div>
                  <Label htmlFor="email" className="text-sm font-medium text-slate-700 mb-1.5">
                    Email Address <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData((p) => ({ ...p, email: e.target.value }))}
                    onBlur={() => handleBlur("email")}
                    placeholder="your.email@psu.palawan.edu.ph"
                    className={inputClass("email")}
                  />
                  {fieldError("email")}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Position & Application */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Position & Application
              </h3>
              <div className="space-y-3.5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5">
                    Position Applying For <span className="text-red-500">*</span>
                  </Label>
                  <div className="h-11 flex items-center px-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <Briefcase className="w-4 h-4 text-slate-400 mr-2.5 flex-shrink-0" />
                    <span className="text-sm font-medium text-slate-700">{jobTitle}</span>
                  </div>
                </div>
                <div>
                  <Label htmlFor="skills" className="text-sm font-medium text-slate-700 mb-1.5">
                    Skills Description <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="skills"
                    value={formData.skills}
                    onChange={(e) => setFormData((p) => ({ ...p, skills: e.target.value }))}
                    onBlur={() => handleBlur("skills")}
                    placeholder="Tell us about your relevant skills, experience, and why you'd be a great fit..."
                    rows={4}
                    className={`bg-[#FBFDFF] resize-none ${errors.skills && touched.has("skills") ? "border-red-400 focus-visible:ring-red-400" : "border-blue-200 focus-visible:ring-[#1668D9]"}`}
                  />
                  {fieldError("skills")}
                </div>
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Resume */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Resume
              </h3>
              <div className="space-y-3.5">
                <div>
                  <Label className="text-sm font-medium text-slate-700 mb-1.5">
                    Resume <span className="text-red-500">*</span>
                  </Label>
                  <ZoomSafeDropdown
                    label="Resume type"
                    value={formData.resumeType}
                    onChange={(v) => {
                      setFormData((p) => ({ ...p, resumeType: v as "link" | "file", resumeLink: "", resumeFile: null }));
                      setErrors((prev) => { const n = { ...prev }; delete n.portfolio; return n; });
                    }}
                    placeholder="Select resume type"
                    triggerClassName="h-11"
                    options={[
                      { value: "link", label: "Paste Link", icon: <Link2 className="w-3.5 h-3.5" /> },
                      { value: "file", label: "Upload File", icon: <Upload className="w-3.5 h-3.5" /> },
                    ]}
                  />
                </div>

                {formData.resumeType === "link" ? (
                  <div>
                    <Input
                      type="url"
                      value={formData.resumeLink}
                      onChange={(e) => setFormData((p) => ({ ...p, resumeLink: e.target.value }))}
                      onBlur={() => handleBlur("portfolio")}
                      placeholder="https://drive.google.com/... or https://linkedin.com/..."
                      className={`bg-[#FBFDFF] ${errors.portfolio && touched.has("portfolio") ? "border-red-400 focus-visible:ring-red-400" : "border-blue-200 focus-visible:ring-[#1668D9]"}`}
                    />
                    <p className="text-xs text-slate-400 mt-1.5">
                      Link to your resume, LinkedIn, or Google Drive
                    </p>
                  </div>
                ) : (
                  <div>
                    {formData.resumeFile ? (
                      <div className="flex items-center gap-3 bg-slate-50 border border-slate-200 rounded-lg p-3">
                        <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                          <FileText className="w-5 h-5 text-[#2F6FD6]" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-800 truncate">{formData.resumeFile.name}</p>
                          <p className="text-xs text-slate-400">{(formData.resumeFile.size / 1024 / 1024).toFixed(2)} MB</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setFormData((p) => ({ ...p, resumeFile: null }))}
                          className="text-xs text-red-500 hover:text-red-700 font-medium px-2 py-1 rounded hover:bg-red-50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <label className="block cursor-pointer">
                        <div className={`border-2 border-dashed rounded-lg p-5 text-center transition-all hover:border-[#2F6FD6] hover:bg-blue-50 ${errors.portfolio && touched.has("portfolio") ? "border-red-400" : "border-slate-300"}`}>
                          <Upload className="w-7 h-7 text-slate-400 mx-auto mb-2" />
                          <p className="text-sm font-medium text-slate-600">Tap to upload resume</p>
                          <p className="text-xs text-slate-400 mt-1">PDF, PNG, or JPG — up to 10 MB</p>
                        </div>
                        <input
                          type="file"
                          accept=".pdf,.png,.jpg,.jpeg"
                          onChange={handleResumeFileChange}
                          className="hidden"
                        />
                      </label>
                    )}
                  </div>
                )}
                {fieldError("portfolio")}
              </div>
            </div>

            <div className="border-t border-slate-100" />

            {/* Terms & Conditions */}
            <div>
              <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">
                Terms & Conditions
              </h3>
              <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setShowTerms(true)}
                  className="w-full text-left text-sm font-medium text-[#2F6FD6] hover:text-[#10316B] transition-colors"
                >
                  View Terms and Conditions →
                </button>
                <div
                  className="flex items-start gap-3 cursor-pointer min-h-[44px] py-1"
                  onClick={() => {
                    setFormData((p) => ({ ...p, consentAgreed: !p.consentAgreed }));
                    if (!formData.consentAgreed) {
                      setErrors((prev) => { const n = { ...prev }; delete n.consentAgreed; return n; });
                    }
                  }}
                >
                  <div className={`mt-0.5 w-5 h-5 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                    formData.consentAgreed
                      ? "bg-[#1668D9] border-[#1668D9]"
                      : errors.consentAgreed && touched.has("consentAgreed")
                        ? "border-red-400 bg-white"
                        : "border-slate-300 bg-white"
                  }`}>
                    {formData.consentAgreed && <CheckCircle className="w-3 h-3 text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-slate-700">
                      I have read and agree to the Terms & Conditions. <span className="text-red-500">*</span>
                    </p>
                  </div>
                </div>
                {errors.consentAgreed && touched.has("consentAgreed") && (
                  <p className="text-xs text-red-500 flex items-center gap-1 pl-8">
                    <AlertCircle className="w-3 h-3" /> {errors.consentAgreed}
                  </p>
                )}
              </div>
            </div>

            {/* Actions */}
            <div className="border-t border-slate-100 pt-5 space-y-3">
              <Button
                type="submit"
                disabled={!formData.consentAgreed || isSubmitting}
                className="w-full h-11 bg-[#1668D9] text-white border-2 border-[#1668D9] hover:bg-[#10316B] hover:border-[#10316B] transition-all hover:-translate-y-0.5 hover:shadow-md disabled:bg-slate-200 disabled:text-slate-400 disabled:border-slate-200 disabled:cursor-not-allowed disabled:hover:translate-y-0 disabled:hover:shadow-none"
              >
                {isSubmitting ? (
                  <Spinner size="xs" label="Submitting..." />
                ) : (
                  "Submit Application"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/customer/job-board")}
                className="w-full h-11 bg-white text-slate-600 border-2 border-slate-300 hover:bg-slate-100 hover:text-slate-900"
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>

        {/* Info note */}
        <p className="text-xs text-slate-400 text-center px-4">
          Applications are reviewed within 3–5 business days.
          We'll contact you using the information provided.
        </p>
      </div>

      {/* Terms dialog */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#10316B] flex items-center gap-2">
              <AlertCircle className="w-5 h-5" /> Terms and Conditions
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-[65vh] overflow-y-auto text-sm text-gray-700 pr-1">
            {termsBody}
          </div>
          <div className="flex justify-end">
            <Button
              type="button"
              onClick={() => setShowTerms(false)}
              className="bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
            >
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
