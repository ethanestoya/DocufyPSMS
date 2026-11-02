import React, { useState, useEffect, useMemo } from "react";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  Briefcase,
  Plus,
  FileText,
  FileCheck,
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  Eye,
  ExternalLink,
  ChevronDown,
  Inbox,
  Pencil,
  Users,
  Banknote,
  CalendarClock,
  AlertCircle,
} from "lucide-react";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { CardSkeleton } from "../ui/card-skeleton";
import { useHydrating } from "../../utils/useHydrating";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { toast } from "sonner";
import { jobsStore, type JobType } from "../../utils/jobsStore";
import {
  applicationsStore,
  openApplicationPortfolio,
  type ApplicationType,
} from "../../utils/applicationsStore";
import { formatClockTime, formatPHDate, todayPHTKey } from "../../utils/pht";
import { notificationStore } from "../../utils/notificationStore";
import { landingContentStore } from "../../utils/landingContentStore";
import { PersonAvatar } from "../ui/person-avatar";
import {
  APPLICATION_STATUSES,
  applicationStatusStyle,
  type ApplicationStatus,
} from "../../utils/applicationStatus";

const menuItems = adminMenuItems;

type JobRow = JobType & { applicants: ApplicationType[] };

type FormState = {
  title: string;
  department: string;
  type: string;
  duration: string;
  salary: string;
  schedule: string;
  location: string;
  description: string;
  responsibilities: string;
  requirements: string;
};

const EMPTY_FORM: FormState = {
  title: "",
  department: "",
  type: "Part-Time",
  duration: "",
  salary: "",
  schedule: "",
  location: "",
  description: "",
  responsibilities: "",
  requirements: "",
};

// Duties and requirements are stored as lists but typed as free text, so a
// pasted bullet ("- Take print requests") becomes the same clean item as a
// hand-typed line instead of keeping the dash in the sentence.
function splitLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.replace(/^\s*(?:[-•*]|\d+[.)])\s*/, "").trim())
    .filter(Boolean);
}

function textOfLines(value?: string[]): string {
  return (value ?? []).join("\n");
}

export default function JobBoardManagement() {
  const hydrating = useHydrating();
  const [jobs, setJobs] = useState<JobRow[]>([]);

  const [viewState, setViewState] = useState<"list" | "applicants" | "application">("list");
  const [jobFilter, setJobFilter] = useState<"active" | "archived">("active");
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedApplicantId, setSelectedApplicantId] = useState<string | null>(null);
  const [resumeOpening, setResumeOpening] = useState(false);

  const [jobDialogOpen, setJobDialogOpen] = useState(false);
  const [editingJobId, setEditingJobId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState("");
  const [jobSaving, setJobSaving] = useState(false);

  const [statusUpdateData, setStatusUpdateData] = useState({
    status: "Pending" as ApplicationStatus,
    interviewDate: "",
    interviewTime: "",
    interviewLocation: "",
    rejectionReason: "",
  });
  const [showStatusUpdateConfirmDialog, setShowStatusUpdateConfirmDialog] = useState(false);

  const [jobToArchiveId, setJobToArchiveId] = useState<string | null>(null);
  const [jobToRestoreId, setJobToRestoreId] = useState<string | null>(null);

  useEffect(() => {
    const loadData = () => {
      const allApplications = applicationsStore.getApplications();
      setJobs(
        jobsStore.getJobs().map((job) => ({
          ...job,
          applicants: allApplications.filter((app) => app.jobId === job.id),
        })),
      );
    };

    loadData();
    const unsubJobs = jobsStore.subscribe(loadData);
    const unsubApps = applicationsStore.subscribe(loadData);

    return () => {
      unsubJobs();
      unsubApps();
    };
  }, []);

  // Derived from the live lists rather than stored as snapshots: after a status
  // update the applicant list (and this detail view) re-read the store instead
  // of showing the copy captured when the row was clicked.
  const selectedJob = useMemo(
    () => jobs.find((job) => job.id === selectedJobId) ?? null,
    [jobs, selectedJobId],
  );
  const selectedApplicant = useMemo(
    () => selectedJob?.applicants.find((app) => app.id === selectedApplicantId) ?? null,
    [selectedJob, selectedApplicantId],
  );
  const jobToArchive = useMemo(
    () => jobs.find((job) => job.id === jobToArchiveId) ?? null,
    [jobs, jobToArchiveId],
  );
  const jobToRestore = useMemo(
    () => jobs.find((job) => job.id === jobToRestoreId) ?? null,
    [jobs, jobToRestoreId],
  );

  const shopAddress = landingContentStore
    .getContent()
    .locationLines.filter(Boolean)
    .join(", ");

  const openCreateDialog = () => {
    setEditingJobId(null);
    setForm(EMPTY_FORM);
    setFormError("");
    setJobDialogOpen(true);
  };

  const openEditDialog = (job: JobRow) => {
    setEditingJobId(job.id);
    setForm({
      title: job.title,
      department: job.department ?? "",
      type: job.type,
      duration: job.duration ?? "",
      salary: job.salary ?? "",
      schedule: job.schedule ?? "",
      location: job.location ?? "",
      description: job.description,
      responsibilities: textOfLines(job.responsibilities),
      requirements: textOfLines(job.requirements),
    });
    setFormError("");
    setJobDialogOpen(true);
  };

  // One write path for create and edit. The dialog closes and toasts only when
  // the server actually took the row; a failed write keeps everything typed on
  // screen so the shop can retry instead of losing the posting.
  const submitJob = async (e: React.FormEvent) => {
    e.preventDefault();
    if (jobSaving) return;

    const title = form.title.trim();
    const description = form.description.trim();
    if (!title) {
      setFormError("Give the posting a job title.");
      return;
    }
    if (!description) {
      setFormError("Add a short description of the role.");
      return;
    }

    setFormError("");
    setJobSaving(true);
    const payload = {
      title,
      description,
      type: form.type,
      duration: form.duration.trim(),
      department: form.department.trim() || undefined,
      salary: form.salary.trim() || undefined,
      schedule: form.schedule.trim() || undefined,
      location: form.location.trim() || undefined,
      responsibilities: splitLines(form.responsibilities),
      requirements: splitLines(form.requirements),
    };

    try {
      if (editingJobId) {
        const saved = await jobsStore.updateJob(editingJobId, payload);
        if (!saved) return;
        toast.success("Job posting updated.");
      } else {
        const result = await jobsStore.addJob({
          ...payload,
          status: "active",
          postedDate: todayPHTKey(),
        });
        if (!result.saved) return;
        toast.success("Job posting published.");
      }
      setJobDialogOpen(false);
      setForm(EMPTY_FORM);
      setEditingJobId(null);
    } finally {
      setJobSaving(false);
    }
  };

  const handleViewApplicants = (job: JobRow) => {
    setSelectedJobId(job.id);
    setSelectedApplicantId(null);
    setViewState("applicants");
  };

  const handleViewResume = async (applicant: ApplicationType) => {
    // Signed-URL resolution for the private bucket is a real round-trip, so the
    // button reports that it is working rather than looking inert.
    setResumeOpening(true);
    try {
      const opened = await openApplicationPortfolio({
        portfolioType: applicant.portfolioType,
        portfolio: applicant.portfolio,
        portfolioUrl: applicant.portfolio,
        portfolioFile: applicant.portfolioFile,
        portfolioStoragePath: applicant.portfolioStoragePath ?? null,
      });
      if (!opened) {
        toast.error("No document available for this applicant.");
      }
    } finally {
      setResumeOpening(false);
    }
  };

  const handleViewApplication = (applicant: ApplicationType) => {
    setSelectedApplicantId(applicant.id);
    setStatusUpdateData({
      status: applicant.status,
      interviewDate: applicant.interviewDate ?? "",
      interviewTime: applicant.interviewTime ?? "",
      interviewLocation: applicant.interviewLocation ?? "",
      rejectionReason: applicant.rejectionReason ?? "",
    });
    setViewState("application");
  };

  const statusUnchanged = selectedApplicant
    ? statusUpdateData.status === selectedApplicant.status &&
      (statusUpdateData.status !== "For Interview" ||
        (statusUpdateData.interviewDate === (selectedApplicant.interviewDate ?? "") &&
          statusUpdateData.interviewTime === (selectedApplicant.interviewTime ?? "") &&
          statusUpdateData.interviewLocation === (selectedApplicant.interviewLocation ?? ""))) &&
      (statusUpdateData.status !== "Rejected" ||
        statusUpdateData.rejectionReason.trim() === (selectedApplicant.rejectionReason ?? ""))
    : true;

  const handleStatusUpdate = () => {
    if (!selectedApplicant) return;

    if (statusUpdateData.status === "For Interview") {
      if (
        !statusUpdateData.interviewDate ||
        !statusUpdateData.interviewTime ||
        !statusUpdateData.interviewLocation.trim()
      ) {
        toast.error("Fill in the interview date, time and location.");
        return;
      }
    }

    if (statusUpdateData.status === "Rejected") {
      if (!statusUpdateData.rejectionReason.trim()) {
        toast.error("Give the applicant a reason for the rejection.");
        return;
      }
    }

    setShowStatusUpdateConfirmDialog(true);
  };

  // Resolves to whether the row landed. The confirmation dialog stays open on a
  // failure (closeOnConfirm={false}) so the reason is still on screen, and the
  // applicant is only told about a change that actually happened.
  const confirmStatusUpdate = async () => {
    if (!selectedApplicant) return;

    const updates: Partial<ApplicationType> = { status: statusUpdateData.status };
    if (statusUpdateData.status === "For Interview") {
      updates.interviewDate = statusUpdateData.interviewDate;
      updates.interviewTime = statusUpdateData.interviewTime;
      updates.interviewLocation = statusUpdateData.interviewLocation.trim();
    }
    if (statusUpdateData.status === "Rejected") {
      updates.rejectionReason = statusUpdateData.rejectionReason.trim();
    }
    if (statusUpdateData.status !== "For Interview") {
      updates.interviewDate = undefined;
      updates.interviewTime = undefined;
      updates.interviewLocation = undefined;
    }
    if (statusUpdateData.status !== "Rejected") {
      updates.rejectionReason = undefined;
    }

    const saved = await applicationsStore.updateApplication(selectedApplicant.id, updates);
    if (!saved) return;

    const jobTitle = selectedJob?.title ?? selectedApplicant.jobTitle;
    let notificationMessage = "";
    if (statusUpdateData.status === "Under Review") {
      notificationMessage = `Your application for "${jobTitle}" is now under review.`;
    } else if (statusUpdateData.status === "For Interview") {
      notificationMessage = `You've been invited for an interview for "${jobTitle}" on ${formatPHDate(statusUpdateData.interviewDate, "long")} at ${formatClockTime(statusUpdateData.interviewTime)}.`;
    } else if (statusUpdateData.status === "Approved") {
      notificationMessage = `Congratulations! Your application for "${jobTitle}" has been approved.`;
    } else if (statusUpdateData.status === "Rejected") {
      notificationMessage = `Your application for "${jobTitle}" was not accepted. Open the job board to read the reason.`;
    }

    if (notificationMessage) {
      notificationStore.addNotification("status_update", "Application Update", notificationMessage, {
        clickable: true,
        relatedRoute: `/customer/job-board?appId=${selectedApplicant.id}`,
        recipientRole: "customer",
        recipientEmail: selectedApplicant.email,
      });
    }

    toast.success(`Application status updated to ${statusUpdateData.status}.`);
    setShowStatusUpdateConfirmDialog(false);
    setViewState("applicants");
  };

  const confirmArchiveJob = async () => {
    if (!jobToArchive) return;
    const archived = await jobsStore.archiveJob(jobToArchive.id);
    if (!archived) return;
    toast.success(`"${jobToArchive.title}" archived.`);
    setJobToArchiveId(null);
  };

  const confirmRestoreJob = async () => {
    if (!jobToRestore) return;
    const restored = await jobsStore.unarchiveJob(jobToRestore.id);
    if (!restored) return;
    toast.success(`"${jobToRestore.title}" restored to the job board.`);
    setJobToRestoreId(null);
  };

  const statusBadge = (status: string) => {
    const style = applicationStatusStyle(status);
    return (
      <Badge className={`inline-flex items-center gap-1.5 border text-xs font-medium ${style.badge}`}>
        <span className={`h-1.5 w-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
        {status}
      </Badge>
    );
  };

  const visibleJobs = jobs.filter((job) => job.status === jobFilter);

  return (
    <Layout menuItems={menuItems} title="Job Board Management" showBackButton>
      {viewState === "list" && (
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-gray-500">
              Postings and applications for the customer job board.
            </p>
            <Button variant="primary" className="w-full sm:w-auto" onClick={openCreateDialog}>
              <Plus className="h-4 w-4" />
              New Job Posting
            </Button>
          </div>

          <div className="flex items-center gap-2 border-b border-gray-200">
            <button
              type="button"
              onClick={() => setJobFilter("active")}
              className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                jobFilter === "active"
                  ? "border-[#2F6FD6] text-[#2F6FD6]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Active Jobs ({jobs.filter((job) => job.status === "active").length})
            </button>
            <button
              type="button"
              onClick={() => setJobFilter("archived")}
              className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
                jobFilter === "archived"
                  ? "border-[#2F6FD6] text-[#2F6FD6]"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              Archived Jobs ({jobs.filter((job) => job.status === "archived").length})
            </button>
          </div>

          {hydrating && <CardSkeleton cards={3} columns={1} label="Loading job postings" />}
          <div className={hydrating ? "hidden" : "space-y-4"}>
            {visibleJobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              return (
                <Card
                  key={job.id}
                  className="gap-0 overflow-hidden border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md"
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-[#F2F7FF]">
                        <Briefcase className="h-6 w-6 text-[#1668D9]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-[#1c1f26] sm:text-lg">
                              {job.title}
                            </h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                              <Badge className="border-0 bg-blue-100 text-xs text-blue-700">
                                {job.type}
                              </Badge>
                              {job.status === "archived" && (
                                <Badge className="text-xs bg-gray-100 text-gray-700">Archived</Badge>
                              )}
                              {job.department && (
                                <span className="text-xs text-gray-500">{job.department}</span>
                              )}
                              <span className="text-xs text-gray-500">· Posted {job.posted}</span>
                            </div>
                          </div>

                          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => handleViewApplicants(job)}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View Applicants
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              className="text-xs"
                              onClick={() => openEditDialog(job)}
                            >
                              <Pencil className="h-3.5 w-3.5" />
                              Edit
                            </Button>
                            {job.status === "active" ? (
                              <Button
                                variant="destructive-outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => setJobToArchiveId(job.id)}
                              >
                                Archive
                              </Button>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="text-xs"
                                onClick={() => setJobToRestoreId(job.id)}
                              >
                                Restore
                              </Button>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-gray-500">
                          {job.salary && (
                            <span className="flex items-center gap-1.5">
                              <Banknote className="h-3.5 w-3.5" /> {job.salary}
                            </span>
                          )}
                          {job.schedule && (
                            <span className="flex items-center gap-1.5">
                              <CalendarClock className="h-3.5 w-3.5" /> {job.schedule}
                            </span>
                          )}
                          {job.location && (
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> {job.location}
                            </span>
                          )}
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5" /> {job.duration}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <Users className="h-3.5 w-3.5" /> {job.applicants.length} applicant
                            {job.applicants.length === 1 ? "" : "s"}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-gray-100">
                    <button
                      type="button"
                      onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                      className="flex w-full items-center justify-between gap-2 px-4 py-2.5 text-left text-sm font-semibold text-[#1668D9] transition-colors hover:text-[#10316B] sm:px-6"
                      aria-expanded={isExpanded}
                    >
                      <span>{isExpanded ? "Hide details" : "Show details"}</span>
                      <ChevronDown
                        className={`h-4 w-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`}
                      />
                    </button>
                    <div
                      className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${
                        isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                      }`}
                    >
                      <div className="min-h-0 overflow-hidden">
                        <div className="space-y-4 bg-gray-50/50 px-4 pb-5 pt-1 sm:px-6">
                          <p className="text-sm leading-relaxed text-gray-700">{job.description}</p>
                          {job.responsibilities && job.responsibilities.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                What they'll do
                              </p>
                              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-gray-700">
                                {job.responsibilities.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {job.requirements && job.requirements.length > 0 && (
                            <div>
                              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                                What we're looking for
                              </p>
                              <ul className="mt-1.5 list-disc space-y-1 pl-5 text-sm text-gray-700">
                                {job.requirements.map((item) => (
                                  <li key={item}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}

            {visibleJobs.length === 0 && (
              <Card className="border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
                <Briefcase className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-base font-semibold text-gray-600">
                  {jobFilter === "active" ? "No active postings" : "No archived postings"}
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  {jobFilter === "active"
                    ? "Create a posting and it appears on the job board right away."
                    : "Archived postings stay here so you can restore them later."}
                </p>
                {jobFilter === "active" && (
                  <Button variant="outline" className="mt-5" onClick={openCreateDialog}>
                    <Plus className="h-4 w-4" />
                    New Job Posting
                  </Button>
                )}
              </Card>
            )}
          </div>
        </div>
      )}

      {viewState === "applicants" && (
        <div className="mx-auto max-w-5xl space-y-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={() => {
                setViewState("list");
                setSelectedJobId(null);
              }}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Job Postings
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug text-[#10316B] sm:text-2xl">
                Applicants for {selectedJob?.title ?? "this position"}
              </h2>
              <p className="mt-1 text-sm text-gray-500">
                {selectedJob?.applicants.length ?? 0} application
                {selectedJob?.applicants.length === 1 ? "" : "s"}
                {selectedJob?.type ? ` · ${selectedJob.type}` : ""}
              </p>
            </div>
          </div>

          {hydrating && <CardSkeleton cards={2} columns={1} label="Loading applicants" />}
          <div className={hydrating ? "hidden" : "space-y-4"}>
            {selectedJob?.applicants.length ? (
              <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-200 bg-white">
                {selectedJob.applicants.map((applicant) => {
                  const style = applicationStatusStyle(applicant.status);
                  return (
                    <div key={applicant.id} className="p-4 transition-colors hover:bg-gray-50 sm:p-5">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <PersonAvatar
                            name={applicant.name}
                            src={applicant.applicantProfileImage}
                            className="h-11 w-11"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-base font-semibold text-gray-900">
                              {applicant.name}
                            </p>
                            <p className="mt-0.5 truncate text-sm text-gray-600">
                              {applicant.email}
                              {applicant.contact ? ` · ${applicant.contact}` : ""}
                            </p>
                            <p className="mt-0.5 text-xs text-gray-500">
                              Applied {applicant.appliedDateTime || applicant.appliedDate}
                            </p>

                            {applicant.status === "For Interview" && applicant.interviewDate && (
                              <div className={`mt-2 rounded-lg border px-3 py-2 text-xs ${style.badge}`}>
                                <span className="flex items-center gap-1.5">
                                  <Calendar className="h-3.5 w-3.5" />
                                  {applicant.interviewDate}
                                  {applicant.interviewTime ? ` · ${formatClockTime(applicant.interviewTime)}` : ""}
                                </span>
                                {applicant.interviewLocation && (
                                  <span className="mt-1 flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5" />
                                    {applicant.interviewLocation}
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end">
                          {statusBadge(applicant.status)}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewApplication(applicant)}
                          >
                            <FileText className="h-4 w-4" />
                            View Application
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <Card className="border border-dashed border-gray-200 bg-white p-12 text-center shadow-sm">
                <Inbox className="mx-auto mb-3 h-10 w-10 text-gray-300" />
                <p className="text-base font-semibold text-gray-600">No applications yet</p>
                <p className="mt-1 text-sm text-gray-500">
                  Applications for this posting will appear here.
                </p>
              </Card>
            )}
          </div>
        </div>
      )}

      {viewState === "application" && selectedApplicant && (
        <div className="mx-auto max-w-3xl space-y-5">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              onClick={() => setViewState("applicants")}
              className="shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to Applicants
            </Button>
            <div className="min-w-0">
              <h2 className="text-lg font-semibold leading-snug text-[#10316B] sm:text-2xl">
                Application Details
              </h2>
              <p className="mt-1 truncate text-sm text-gray-500">
                {selectedJob?.title ?? selectedApplicant.jobTitle}
              </p>
            </div>
          </div>

          <Card className="border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <PersonAvatar
                name={selectedApplicant.name}
                src={selectedApplicant.applicantProfileImage}
                className="h-14 w-14 text-sm"
              />
              <div className="min-w-0 flex-1">
                <p className="text-lg font-semibold text-gray-900">{selectedApplicant.name}</p>
                <p className="mt-0.5 truncate text-sm text-gray-600">{selectedApplicant.email}</p>
                <p className="mt-0.5 text-sm text-gray-600">{selectedApplicant.contact}</p>
              </div>
              {statusBadge(selectedApplicant.status)}
            </div>

            <dl className="mt-5 grid grid-cols-1 gap-3 border-t border-gray-100 pt-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs text-gray-500">Position</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {selectedApplicant.position || selectedJob?.title}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-gray-500">Applied</dt>
                <dd className="mt-0.5 font-medium text-gray-900">
                  {selectedApplicant.appliedDateTime || selectedApplicant.appliedDate}
                </dd>
              </div>
            </dl>
          </Card>

          <Card className="border border-gray-100 bg-white p-5 shadow-sm">
            <h3 className="mb-2 font-semibold text-gray-900">Skills / Message</h3>
            <p className="whitespace-pre-line text-sm leading-relaxed text-gray-700">
              {selectedApplicant.skills || "No message included."}
            </p>
          </Card>

          {(selectedApplicant.portfolio || selectedApplicant.portfolioFileName) && (
            <Card className="border border-gray-100 bg-white p-5 shadow-sm">
              <h3 className="mb-3 font-semibold text-gray-900">Portfolio / Resume</h3>
              {selectedApplicant.portfolioType === "file" ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <FileCheck className="h-5 w-5 text-[#1668D9]" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-gray-900">
                        {selectedApplicant.portfolioFileName || "Uploaded file"}
                      </p>
                      <p className="text-xs text-gray-500">PDF or image</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    loading={resumeOpening}
                    loadingText="Opening…"
                    onClick={() => handleViewResume(selectedApplicant)}
                  >
                    <Eye className="h-4 w-4" />
                    View Portfolio
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center gap-3 rounded-lg bg-gray-50 p-3">
                    <FileCheck className="h-5 w-5 text-[#1668D9]" />
                    <div className="min-w-0 flex-1">
                      <p className="break-all text-sm font-medium text-gray-900">
                        {selectedApplicant.portfolio}
                      </p>
                      <p className="text-xs text-gray-500">External link</p>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() => window.open(selectedApplicant.portfolio, "_blank", "noopener,noreferrer")}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Link in New Tab
                  </Button>
                </div>
              )}
            </Card>
          )}

          {selectedApplicant.status === "For Interview" && selectedApplicant.interviewDate && (
            <Card className="border border-blue-100 bg-[#F4F8FE] p-5">
              <h3 className="mb-2 font-semibold text-[#10316B]">Interview scheduled</h3>
              <div className="space-y-1 text-sm text-gray-700">
                <p className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-[#1668D9]" />
                  {selectedApplicant.interviewDate}
                  {selectedApplicant.interviewTime ? ` · ${formatClockTime(selectedApplicant.interviewTime)}` : ""}
                </p>
                {selectedApplicant.interviewLocation && (
                  <p className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-[#1668D9]" />
                    {selectedApplicant.interviewLocation}
                  </p>
                )}
              </div>
            </Card>
          )}

          {selectedApplicant.status === "Rejected" && selectedApplicant.rejectionReason && (
            <Card className="border border-red-100 bg-red-50/60 p-5">
              <h3 className="mb-2 font-semibold text-red-800">Rejection reason</h3>
              <p className="text-sm leading-relaxed text-red-900">
                {selectedApplicant.rejectionReason}
              </p>
            </Card>
          )}

          <Card className="border border-gray-200 bg-white p-5 shadow-sm">
            <h3 className="mb-4 font-semibold text-gray-900">Update Application Status</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Application Status</Label>
                <Select
                  value={statusUpdateData.status}
                  onValueChange={(value) =>
                    setStatusUpdateData((prev) => ({ ...prev, status: value as ApplicationStatus }))
                  }
                >
                  <SelectTrigger className="h-10 bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {APPLICATION_STATUSES.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {statusUpdateData.status === "For Interview" && (
                <>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="interview-date">
                        Interview Date <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="interview-date"
                        type="date"
                        value={statusUpdateData.interviewDate}
                        onChange={(e) =>
                          setStatusUpdateData((prev) => ({ ...prev, interviewDate: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="interview-time">
                        Interview Time <span className="text-red-500">*</span>
                      </Label>
                      <Input
                        id="interview-time"
                        type="time"
                        value={statusUpdateData.interviewTime}
                        onChange={(e) =>
                          setStatusUpdateData((prev) => ({ ...prev, interviewTime: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <Label htmlFor="interview-location">
                        Interview Location <span className="text-red-500">*</span>
                      </Label>
                      {shopAddress && (
                        <button
                          type="button"
                          className="text-xs font-medium text-[#1668D9] hover:underline"
                          onClick={() =>
                            setStatusUpdateData((prev) => ({
                              ...prev,
                              interviewLocation: shopAddress,
                            }))
                          }
                        >
                          Use shop address
                        </button>
                      )}
                    </div>
                    <Input
                      id="interview-location"
                      placeholder="Where the applicant should go"
                      value={statusUpdateData.interviewLocation}
                      onChange={(e) =>
                        setStatusUpdateData((prev) => ({
                          ...prev,
                          interviewLocation: e.target.value,
                        }))
                      }
                    />
                  </div>
                </>
              )}

              {statusUpdateData.status === "Rejected" && (
                <div className="space-y-2">
                  <Label htmlFor="rejection-reason">
                    Reason for Rejection <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="rejection-reason"
                    placeholder="Explain why this application was rejected…"
                    rows={4}
                    value={statusUpdateData.rejectionReason}
                    onChange={(e) =>
                      setStatusUpdateData((prev) => ({
                        ...prev,
                        rejectionReason: e.target.value,
                      }))
                    }
                  />
                  <p className="text-xs text-gray-500">The applicant can read this reason.</p>
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-col-reverse gap-2 border-t border-gray-100 pt-4 sm:flex-row sm:items-center sm:justify-end">
              {statusUnchanged && (
                <p className="text-xs text-gray-500 sm:mr-auto">
                  Nothing to update — this is already the current status.
                </p>
              )}
              <Button variant="outline" onClick={() => setViewState("applicants")}>
                Cancel
              </Button>
              <Button variant="primary" disabled={statusUnchanged} onClick={handleStatusUpdate}>
                Update Status
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Create / edit posting */}
      <Dialog
        open={jobDialogOpen}
        onOpenChange={(open) => {
          if (jobSaving) return;
          setJobDialogOpen(open);
          if (!open) setFormError("");
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="px-6 pb-3 pt-6 pr-12 text-left">
            <DialogTitle>{editingJobId ? "Edit job posting" : "New job posting"}</DialogTitle>
            <DialogDescription>
              {editingJobId
                ? "Changes appear on the job board as soon as you save."
                : "This appears on the job board as soon as you publish it."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={submitJob} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-2">
              <section className="space-y-4">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  The role
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="job-title">
                    Job title <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="job-title"
                    value={form.title}
                    onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
                    placeholder="e.g. Part-Time Print Shop Assistant"
                    maxLength={80}
                  />
                </div>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Job type</Label>
                    <Select
                      value={form.type}
                      onValueChange={(value) => setForm((prev) => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger className="h-10 bg-white">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Part-Time">Part-Time</SelectItem>
                        <SelectItem value="Full-Time">Full-Time</SelectItem>
                        <SelectItem value="Contract">Contract</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-duration">Hours</Label>
                    <Input
                      id="job-duration"
                      value={form.duration}
                      onChange={(e) => setForm((prev) => ({ ...prev, duration: e.target.value }))}
                      placeholder="e.g. 15–20 hours/week"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-department">Department</Label>
                  <Input
                    id="job-department"
                    value={form.department}
                    onChange={(e) => setForm((prev) => ({ ...prev, department: e.target.value }))}
                    placeholder="e.g. Print Operations"
                  />
                </div>
              </section>

              <section className="space-y-4 border-t border-gray-100 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  Pay & schedule
                </h3>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="job-salary">Pay rate</Label>
                    <Input
                      id="job-salary"
                      value={form.salary}
                      onChange={(e) => setForm((prev) => ({ ...prev, salary: e.target.value }))}
                      placeholder="e.g. ₱80–₱100 per hour"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="job-schedule">Work schedule</Label>
                    <Input
                      id="job-schedule"
                      value={form.schedule}
                      onChange={(e) => setForm((prev) => ({ ...prev, schedule: e.target.value }))}
                      placeholder="e.g. Mon–Fri · 3–4 hour shifts"
                    />
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-location">Work location</Label>
                  <Input
                    id="job-location"
                    value={form.location}
                    onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))}
                    placeholder="e.g. Room 4, TBI Building, PSU"
                  />
                </div>
              </section>

              <section className="space-y-4 border-t border-gray-100 pt-5">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  About the job
                </h3>
                <div className="space-y-2">
                  <Label htmlFor="job-description">
                    Description <span className="text-red-500">*</span>
                  </Label>
                  <Textarea
                    id="job-description"
                    value={form.description}
                    onChange={(e) => setForm((prev) => ({ ...prev, description: e.target.value }))}
                    placeholder="What the job is and who it suits."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-responsibilities">What they'll do</Label>
                  <Textarea
                    id="job-responsibilities"
                    value={form.responsibilities}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, responsibilities: e.target.value }))
                    }
                    placeholder={"One per line, e.g.\nTake print requests at the counter"}
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">One duty per line.</p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="job-requirements">What we're looking for</Label>
                  <Textarea
                    id="job-requirements"
                    value={form.requirements}
                    onChange={(e) => setForm((prev) => ({ ...prev, requirements: e.target.value }))}
                    placeholder={"One per line, e.g.\nCurrently enrolled at PSU"}
                    rows={4}
                  />
                  <p className="text-xs text-gray-500">One requirement per line.</p>
                </div>
              </section>
            </div>

            <div className="border-t border-gray-200 px-6 py-4">
              {formError && (
                <p className="mb-3 flex items-center gap-2 text-sm text-red-600" role="alert">
                  <AlertCircle className="h-4 w-4" />
                  {formError}
                </p>
              )}
              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setJobDialogOpen(false)}
                  disabled={jobSaving}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  loading={jobSaving}
                  loadingText={editingJobId ? "Saving…" : "Publishing…"}
                >
                  {editingJobId ? "Save Changes" : "Publish Posting"}
                </Button>
              </div>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {jobToArchive && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setJobToArchiveId(null);
          }}
          onConfirm={confirmArchiveJob}
          closeOnConfirm={false}
          title="Archive job posting?"
          description={`"${jobToArchive.title}" leaves the public job board. Applicants keep their application history, and you can restore it later.`}
          confirmLabel="Archive Job"
          cancelLabel="Keep It"
          destructive
        />
      )}

      {jobToRestore && (
        <ConfirmationDialog
          open
          onOpenChange={(open) => {
            if (!open) setJobToRestoreId(null);
          }}
          onConfirm={confirmRestoreJob}
          closeOnConfirm={false}
          title="Restore job posting?"
          description={`"${jobToRestore.title}" returns to the job board and is visible immediately.`}
          confirmLabel="Restore"
          cancelLabel="Go Back"
        />
      )}

      {selectedApplicant && (
        <ConfirmationDialog
          open={showStatusUpdateConfirmDialog}
          onOpenChange={setShowStatusUpdateConfirmDialog}
          onConfirm={confirmStatusUpdate}
          closeOnConfirm={false}
          title="Update application status?"
          description={
            <>
              Set <strong>{selectedApplicant.name}</strong>'s application to{" "}
              <strong>{statusUpdateData.status}</strong>.
              {statusUpdateData.status === "Rejected"
                ? " They will be told it was not accepted and can read this reason."
                : " They will be notified of the change."}
            </>
          }
          confirmLabel="Update Status"
          cancelLabel="Go Back"
          destructive={statusUpdateData.status === "Rejected"}
        />
      )}
    </Layout>
  );
}
