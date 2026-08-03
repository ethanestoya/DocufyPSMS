import React, { useState } from "react";
import { useNavigate, useParams } from "react-router";
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Package,
  CheckCircle,
  User,
  Mail,
  Phone,
  Link2,
  MessageSquare,
  Upload,
  AlertCircle,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { applicationsStore } from "../../utils/applicationsStore";

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

const JOB_TITLES: Record<string, string> = {
  "JOB-001": "Part-Time Print Shop Assistant",
  "JOB-002": "Graphic Designer",
  "JOB-003": "Customer Service Representative",
};

export default function JobApplyForm() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const jobTitle = JOB_TITLES[jobId || ""] || "Open Position";

  const [showSuccessDialog, setShowSuccessDialog] =
    useState(false);
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    contact: "",
    email: "",
    position: jobTitle,
    skills: "",
    portfolio: "",
    portfolioType: "link" as "link" | "file",
    portfolioFile: null as File | null,
    consentAgreed: false,
  });
  const [errors, setErrors] = useState<Record<string, string>>(
    {},
  );

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!formData.firstName.trim())
      errs.firstName = "First name is required.";
    if (!formData.lastName.trim())
      errs.lastName = "Last name is required.";
    if (!formData.email.trim())
      errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      errs.email = "Enter a valid email address.";
    if (!formData.contact.trim())
      errs.contact = "Contact number is required.";
    if (!formData.skills.trim())
      errs.skills = "Please describe your skills / message.";

    // Portfolio is now required
    if (
      formData.portfolioType === "link" &&
      !formData.portfolio.trim()
    ) {
      errs.portfolio = "Portfolio link is required.";
    }
    if (
      formData.portfolioType === "file" &&
      !formData.portfolioFile
    ) {
      errs.portfolio =
        "Please upload your portfolio/resume file.";
    }

    // Consent is required
    if (!formData.consentAgreed) {
      errs.consentAgreed =
        "You must agree to the terms and conditions to submit your application.";
    }

    return errs;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});

    // Persist to applicationsStore so JobBoard can display it
    applicationsStore.addApplication({
      jobId: jobId || "",
      jobTitle,
      firstName: formData.firstName,
      lastName: formData.lastName,
      name: `${formData.firstName} ${formData.lastName}`,
      email: formData.email,
      contact: formData.contact,
      position: formData.position,
      skills: formData.skills,
      portfolio:
        formData.portfolioType === "link"
          ? formData.portfolio
          : "",
      portfolioType: formData.portfolioType,
      portfolioFile: formData.portfolioFile,
      portfolioFileName: formData.portfolioFile?.name,
    });

    // Navigate back to job board and show success dialog
    navigate(
      "/customer/job-board?tab=applications&success=true",
    );
  };

  const field = (
    id: keyof typeof formData,
    label: string,
    required = false,
  ) => (
    <div className="space-y-2">
      <Label htmlFor={id}>
        {label}{" "}
        {required && <span className="text-red-500">*</span>}
      </Label>
      <Input
        id={id}
        value={formData[id]}
        onChange={(e) =>
          setFormData((prev) => ({
            ...prev,
            [id]: e.target.value,
          }))
        }
        className={
          errors[id]
            ? "border-red-400 focus-visible:ring-red-400"
            : ""
        }
      />
      {errors[id] && (
        <p className="text-xs text-red-500">{errors[id]}</p>
      )}
    </div>
  );

  return (
    <Layout
      menuItems={menuItems}
      title="Job Application"
      showBackButton
    >
      <div className="max-w-3xl mx-auto space-y-8">
        {/* Header */}
        <div>
          <p className="text-gray-500">
            Submit your application for{" "}
            <strong className="text-[#10316B]">
              {jobTitle}
            </strong>
          </p>
        </div>

        {/* Form */}
        <Card className="p-8 bg-white shadow-sm">
          <form
            onSubmit={handleSubmit}
            className="space-y-6"
            noValidate
          >
            {/* Personal Info Grid */}
            <div>
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <User className="w-4 h-4" /> Personal
                Information
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <div className="space-y-2">
                  <Label htmlFor="firstName">
                    First Name{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="firstName"
                    type="text"
                    value={formData.firstName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        firstName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Maria"
                    className={
                      errors.firstName
                        ? "border-red-400 focus-visible:ring-red-400"
                        : ""
                    }
                  />
                  {errors.firstName && (
                    <p className="text-xs text-red-500">
                      {errors.firstName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">
                    Last Name{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="lastName"
                    type="text"
                    value={formData.lastName}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        lastName: e.target.value,
                      }))
                    }
                    placeholder="e.g. Santos"
                    className={
                      errors.lastName
                        ? "border-red-400 focus-visible:ring-red-400"
                        : ""
                    }
                  />
                  {errors.lastName && (
                    <p className="text-xs text-red-500">
                      {errors.lastName}
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="contact">
                    Contact Number{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="contact"
                    type="tel"
                    value={formData.contact}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        contact: e.target.value,
                      }))
                    }
                    placeholder="09XX XXX XXXX"
                    className={
                      errors.contact
                        ? "border-red-400 focus-visible:ring-red-400"
                        : ""
                    }
                  />
                  {errors.contact && (
                    <p className="text-xs text-red-500">
                      {errors.contact}
                    </p>
                  )}
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="email">
                    Email Address{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        email: e.target.value,
                      }))
                    }
                    placeholder="your.email@psu.edu.ph"
                    className={
                      errors.email
                        ? "border-red-400 focus-visible:ring-red-400"
                        : ""
                    }
                  />
                  {errors.email && (
                    <p className="text-xs text-red-500">
                      {errors.email}
                    </p>
                  )}
                </div>
              </div>
            </div>

            <div className="border-t border-gray-100 pt-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4 flex items-center gap-2">
                <Briefcase className="w-4 h-4" /> Position &
                Application
              </h3>
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="position">
                    Position Applying For{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="position"
                    type="text"
                    value={formData.position}
                    readOnly
                    className="bg-[#F2F7FF] border-green-200 text-[#10316B] font-semibold cursor-default pointer-events-none"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="skills">
                    Skills Description{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="skills"
                    value={formData.skills}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        skills: e.target.value,
                      }))
                    }
                    placeholder="Tell us about your relevant skills, experience, and why you'd be a great fit for this position..."
                    rows={6}
                    className={
                      errors.skills
                        ? "border-red-400 focus-visible:ring-red-400"
                        : ""
                    }
                  />
                  {errors.skills && (
                    <p className="text-xs text-red-500">
                      {errors.skills}
                    </p>
                  )}
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between mb-2">
                    <Label htmlFor="portfolio">
                      Resume{" "}
                      <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={formData.portfolioType}
                      onValueChange={(
                        value: "link" | "file",
                      ) => {
                        setFormData((prev) => ({
                          ...prev,
                          portfolioType: value,
                          portfolio: "",
                          portfolioFile: null,
                        }));
                        setErrors((prev) => ({
                          ...prev,
                          portfolio: "",
                        }));
                      }}
                    >
                      <SelectTrigger className="w-[180px] h-9">
                        <SelectValue placeholder="Select type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="link">
                          Link Upload
                        </SelectItem>
                        <SelectItem value="file">
                          Upload PDF/Image
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.portfolioType === "link" ? (
                    <>
                      <Input
                        id="portfolio"
                        type="url"
                        value={formData.portfolio}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            portfolio: e.target.value,
                          }))
                        }
                        placeholder="https://drive.google.com/... or https://linkedin.com/..."
                        className={
                          errors.portfolio
                            ? "border-red-400 focus-visible:ring-red-400"
                            : ""
                        }
                      />
                      <p className="text-xs text-gray-400">
                        Link to your portfolio, LinkedIn
                        profile, or online resume
                      </p>
                    </>
                  ) : (
                    <>
                      <div
                        className={`border-2 border-dashed rounded-lg p-4 text-center ${errors.portfolio ? "border-red-400" : "border-gray-300"}`}
                      >
                        {formData.portfolioFile ? (
                          <div className="space-y-2">
                            <div className="flex items-center justify-center gap-2 text-blue-600">
                              <FileText className="w-5 h-5" />
                              <span className="text-sm font-medium">
                                {formData.portfolioFile.name}
                              </span>
                            </div>
                            <p className="text-xs text-gray-500">
                              {(
                                formData.portfolioFile.size /
                                1024 /
                                1024
                              ).toFixed(2)}{" "}
                              MB
                            </p>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setFormData((prev) => ({
                                  ...prev,
                                  portfolioFile: null,
                                }))
                              }
                            >
                              Remove File
                            </Button>
                          </div>
                        ) : (
                          <label className="cursor-pointer">
                            <div className="space-y-2">
                              <Upload className="w-8 h-8 text-gray-400 mx-auto" />
                              <p className="text-sm text-gray-600">
                                Click to upload PDF or Image
                              </p>
                              <p className="text-xs text-gray-400">
                                PDF, PNG, JPG up to 10MB
                              </p>
                            </div>
                            <Input
                              id="portfolio-file"
                              type="file"
                              accept=".pdf,.png,.jpg,.jpeg"
                              onChange={(e) => {
                                const file =
                                  e.target.files?.[0];
                                if (file) {
                                  if (
                                    file.size >
                                    10 * 1024 * 1024
                                  ) {
                                    setErrors((prev) => ({
                                      ...prev,
                                      portfolio:
                                        "File size must be less than 10MB",
                                    }));
                                    return;
                                  }
                                  setFormData((prev) => ({
                                    ...prev,
                                    portfolioFile: file,
                                  }));
                                  setErrors((prev) => ({
                                    ...prev,
                                    portfolio: "",
                                  }));
                                }
                              }}
                              className="hidden"
                            />
                          </label>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">
                        Upload your portfolio or resume as PDF
                        or image file
                      </p>
                    </>
                  )}
                  {errors.portfolio && (
                    <p className="text-xs text-red-500">
                      {errors.portfolio}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Consent and Terms */}
            <div className="border-t border-gray-100 pt-6">
              <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-5">
                <h3 className="text-sm font-semibold text-blue-900 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" /> Terms and
                  Conditions
                </h3>

                <div className="bg-white border border-blue-200 rounded p-4 mb-4 max-h-48 overflow-y-auto text-sm text-gray-700">
                  <p className="mb-3 font-semibold text-gray-900">
                    Applicant Consent and Liability Waiver
                  </p>

                  <p className="mb-2">
                    By submitting this job application to{" "}
                    <strong>
                      DocuFy Printing Shop Management System
                    </strong>
                    , I acknowledge and agree to the following
                    terms:
                  </p>

                  <ul className="list-disc list-inside space-y-2 mb-3">
                    <li>
                      I certify that all information provided in
                      this application is true, accurate, and
                      complete to the best of my knowledge.
                    </li>
                    <li>
                      I understand that any false or misleading
                      information may result in immediate
                      disqualification or termination of
                      employment.
                    </li>
                    <li>
                      I authorize DocuFy to verify the
                      information provided and to contact
                      references listed in my application.
                    </li>
                    <li>
                      I understand that submitting this
                      application does not guarantee employment
                      or an interview.
                    </li>
                    <li>
                      I acknowledge that DocuFy reserves the
                      right to modify, postpone, or cancel any
                      job opening at any time without prior
                      notice.
                    </li>
                  </ul>

                  <p className="mb-2 font-semibold text-gray-900">
                    Liability Waiver:
                  </p>

                  <p className="mb-2">
                    I acknowledge that{" "}
                    <strong>
                      DocuFy Printing Shop Management System
                    </strong>{" "}
                    and its representatives shall not be held
                    liable for:
                  </p>

                  <ul className="list-disc list-inside space-y-2">
                    <li>
                      Any delays, errors, or technical issues in
                      the application submission or review
                      process.
                    </li>
                    <li>
                      Any decisions made regarding my
                      application, including rejection or
                      non-response.
                    </li>
                    <li>
                      Any personal, financial, or professional
                      consequences resulting from the
                      application process or employment
                      relationship.
                    </li>
                    <li>
                      Loss or unauthorized access to any
                      documents or information submitted as part
                      of this application.
                    </li>
                  </ul>

                  <p className="mt-3 text-xs text-gray-500">
                    This agreement is governed by applicable
                    labor laws and regulations. By proceeding,
                    you confirm that you have read, understood,
                    and agree to these terms.
                  </p>
                </div>

                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="consentAgreed"
                    checked={formData.consentAgreed}
                    onChange={(e) => {
                      setFormData((prev) => ({
                        ...prev,
                        consentAgreed: e.target.checked,
                      }));
                      if (e.target.checked) {
                        setErrors((prev) => ({
                          ...prev,
                          consentAgreed: "",
                        }));
                      }
                    }}
                    className={`mt-1 w-5 h-5 rounded border-2 text-[#1D73EC] focus:ring-2 focus:ring-[#1D73EC] cursor-pointer ${
                      errors.consentAgreed
                        ? "border-red-400"
                        : "border-blue-300"
                    }`}
                  />
                  <div className="flex-1">
                    <label
                      htmlFor="consentAgreed"
                      className="text-sm text-blue-900 cursor-pointer"
                    >
                      <strong className="font-semibold">
                        I have read and agree to the terms and
                        conditions stated above.
                      </strong>
                      <span className="text-red-500 ml-1">
                        *
                      </span>
                    </label>
                    <p className="text-xs text-blue-700 mt-1">
                      By checking this box, I confirm my
                      understanding and acceptance of the
                      applicant consent and liability waiver.
                    </p>
                    {errors.consentAgreed && (
                      <p className="text-xs text-red-500 mt-2 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3" />
                        {errors.consentAgreed}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-gray-100">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/customer/job-board")}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={!formData.consentAgreed}
                className="flex-1 bg-[#1D73EC] hover:bg-[#10316B] text-white disabled:bg-gray-300 disabled:cursor-not-allowed disabled:hover:bg-gray-300"
                title={
                  !formData.consentAgreed
                    ? "Please agree to the terms and conditions to submit"
                    : ""
                }
              >
                Submit Application
              </Button>
            </div>
          </form>
        </Card>

        {/* Info */}
        <Card className="p-5 bg-[#F2F7FF] border border-green-200">
          <p className="text-sm text-gray-700">
            <strong className="text-[#10316B]">Note:</strong>{" "}
            After submitting your application, our team will
            review it and contact you within 3–5 business days
            if you're selected for an interview.
          </p>
        </Card>
      </div>
    </Layout>
  );
}