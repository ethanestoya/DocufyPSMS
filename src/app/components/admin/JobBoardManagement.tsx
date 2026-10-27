import React, { useState, useEffect } from "react";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Boxes,
  Users,
  FileText,
  UserPlus,
  Briefcase,
  User,
  Plus,
  FileCheck,
  Calendar,
  MapPin,
  Clock,
  ArrowLeft,
  AlertCircle,
  Settings,
  Eye,
  ExternalLink,
  ChevronDown,
  Inbox,
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
import { jobsStore } from "../../utils/jobsStore";
import { applicationsStore, openApplicationPortfolio } from "../../utils/applicationsStore";
import { todayPHTKey } from "../../utils/pht";
import { notificationStore } from "../../utils/notificationStore";

const menuItems = adminMenuItems;

export default function JobBoardManagement() {
  const hydrating = useHydrating();
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<any[]>([]);
  const [showDialog, setShowDialog] = useState(false);
  const [showCreateConfirmDialog, setShowCreateConfirmDialog] = useState(false);
  const [showStatusUpdateConfirmDialog, setShowStatusUpdateConfirmDialog] = useState(false);
  const [showArchiveConfirmDialog, setShowArchiveConfirmDialog] = useState(false);
  const [jobToArchive, setJobToArchive] = useState<any>(null);
  const [jobToRestore, setJobToRestore] = useState<any>(null);
  const [viewState, setViewState] = useState<'list' | 'applicants' | 'application'>('list');
  const [jobFilter, setJobFilter] = useState<'active' | 'archived'>('active');
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [selectedApplicant, setSelectedApplicant] =
    useState<any>(null);
  const [resumeOpening, setResumeOpening] = useState(false);
  const [formData, setFormData] = useState({
    title: "",
    description: "",
    type: "Part-Time",
    duration: "",
  });
  const [statusUpdateData, setStatusUpdateData] = useState({
    status: "Pending",
    interviewDate: "",
    interviewTime: "",
    interviewLocation: "",
    rejectionReason: "",
  });

  // Load jobs and applications from centralized stores
  useEffect(() => {
    const loadData = () => {
      const jobsList = jobsStore.getJobs();
      const appsList = applicationsStore.getApplications();

      // Merge jobs with their applications
      const jobsWithApplicants = jobsList.map(job => ({
        id: job.id,
        title: job.title,
        description: job.description,
        type: job.type,
        duration: job.duration,
        status: job.status,
        applicants: appsList
          .filter(app => app.jobId === job.id)
          .map(app => ({
            id: app.id,
            name: app.name,
            firstName: app.firstName,
            lastName: app.lastName,
            email: app.email,
            phone: app.contact,
            dateApplied: app.appliedDate,
            dateTimeApplied: app.appliedDateTime,
            status: app.status,
            resumeUrl: app.portfolio || "",
            portfolioType: app.portfolioType,
            portfolioFile: app.portfolioFile,
            portfolioFileName: app.portfolioFileName,
            portfolioStoragePath: app.portfolioStoragePath || null,
            coverLetter: app.skills,
            skills: app.skills,
            interviewDate: app.interviewDate || "",
            interviewTime: app.interviewTime || "",
            interviewLocation: app.interviewLocation || "",
          }))
      }));

      setJobs(jobsWithApplicants);
      setApplications(appsList);
    };

    loadData();

    const unsubJobs = jobsStore.subscribe(loadData);
    const unsubApps = applicationsStore.subscribe(loadData);

    return () => {
      unsubJobs();
      unsubApps();
    };
  }, []);

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    setShowCreateConfirmDialog(true);
  };

  const confirmCreate = async () => {
    await jobsStore.addJob({
      title: formData.title,
      description: formData.description,
      type: formData.type as any,
      duration: formData.duration,
      status: "active",
      department: "General",
      postedDate: todayPHTKey(),
    });
    setFormData({
      title: "",
      description: "",
      type: "Part-Time",
      duration: "",
    });
    setShowCreateConfirmDialog(false);
    setShowDialog(false);
    toast.success("Job posting created successfully!");
  };


  const handleViewApplicants = (job: any) => {
    setSelectedJob(job);
    setViewState('applicants');
  };

  const handleViewResume = async (applicant: any) => {
    setSelectedApplicant(applicant);
    // Resolving the signed URL for a private bucket + fetching the object is a
    // real round-trip before the browser tab opens, so the button shows a
    // spinner instead of looking like it did nothing.
    setResumeOpening(true);
    try {
      const opened = await openApplicationPortfolio({
        portfolioType: applicant.portfolioType,
        portfolio: applicant.resumeUrl,
        portfolioUrl: applicant.resumeUrl,
        portfolioFile: applicant.portfolioFile,
        portfolioStoragePath: applicant.portfolioStoragePath || null,
      });
      if (!opened) {
        toast.error("No document available for this applicant");
      }
    } finally {
      setResumeOpening(false);
    }
  };

  const handleViewApplication = (job: any, applicant: any) => {
    setSelectedJob(job);
    setSelectedApplicant(applicant);
    setStatusUpdateData({
      status: applicant.status,
      interviewDate: applicant.interviewDate || "",
      interviewTime: applicant.interviewTime || "",
      interviewLocation: applicant.interviewLocation || "",
      rejectionReason: applicant.rejectionReason || "",
    });
    setViewState('application');
  };

  const handleStatusUpdate = () => {
    if (statusUpdateData.status === "For Interview") {
      if (
        !statusUpdateData.interviewDate ||
        !statusUpdateData.interviewTime ||
        !statusUpdateData.interviewLocation
      ) {
        toast.error("Please fill in all interview details");
        return;
      }
    }

    if (statusUpdateData.status === "Rejected") {
      if (!statusUpdateData.rejectionReason.trim()) {
        toast.error("Please provide a reason for rejection");
        return;
      }
    }

    setShowStatusUpdateConfirmDialog(true);
  };

  const confirmStatusUpdate = () => {
    // Update in applicationsStore for system-wide sync
    if (selectedApplicant?.id) {
      const updates: any = {
        status: statusUpdateData.status,
      };

      if (statusUpdateData.status === 'For Interview') {
        updates.interviewDate = statusUpdateData.interviewDate;
        updates.interviewTime = statusUpdateData.interviewTime;
        updates.interviewLocation = statusUpdateData.interviewLocation;
      }

      if (statusUpdateData.status === 'Rejected') {
        updates.rejectionReason = statusUpdateData.rejectionReason;
      }

      applicationsStore.updateApplication(selectedApplicant.id, updates);

      // Create notification for applicant
      let notificationMessage = '';
      if (statusUpdateData.status === 'Under Review') {
        notificationMessage = `Your application for "${selectedJob?.title}" is now under review.`;
      } else if (statusUpdateData.status === 'For Interview') {
        notificationMessage = `You've been invited for an interview for "${selectedJob?.title}" on ${statusUpdateData.interviewDate} at ${statusUpdateData.interviewTime}.`;
      } else if (statusUpdateData.status === 'Approved') {
        notificationMessage = `Congratulations! Your application for "${selectedJob?.title}" has been approved.`;
      } else if (statusUpdateData.status === 'Rejected') {
        notificationMessage = `Your application for "${selectedJob?.title}" has been rejected.`;
      }

      if (notificationMessage) {
        notificationStore.addNotification(
          'status_update',
          'Application Update',
          notificationMessage,
          {
            clickable: true,
            relatedRoute: `/customer/job-board?appId=${selectedApplicant.id}`,
            recipientRole: 'customer',
            recipientEmail: selectedApplicant.email,
          }
        );
      }
    }

    toast.success(
      `Application status updated to ${statusUpdateData.status}`,
    );
    setShowStatusUpdateConfirmDialog(false);
    setViewState('applicants');
  };

  const handleArchiveJob = (job: any) => {
    setJobToArchive(job);
    setShowArchiveConfirmDialog(true);
  };

  const confirmArchiveJob = () => {
    if (jobToArchive) {
      jobsStore.archiveJob(jobToArchive.id);
      toast.success(`Job "${jobToArchive.title}" has been archived`);
      setShowArchiveConfirmDialog(false);
      setJobToArchive(null);
    }
  };

  const handleUnarchiveJob = (job: any) => {
    jobsStore.unarchiveJob(job.id);
    toast.success(`Job "${job.title}" has been restored to active`);
  };

  const handleStatusChange = (
    jobId: string,
    applicantId: number,
    newStatus: string,
  ) => {
    setJobs((prevJobs) =>
      prevJobs.map((job) =>
        job.id === jobId
          ? {
              ...job,
              applicants: job.applicants.map((applicant: any) =>
                applicant.id === applicantId
                  ? { ...applicant, status: newStatus }
                  : applicant,
              ),
            }
          : job,
      ),
    );
    // Update the selected job in the dialog
    if (selectedJob?.id === jobId) {
      setSelectedJob((prev: any) => ({
        ...prev,
        applicants: prev.applicants.map((applicant: any) =>
          applicant.id === applicantId
            ? { ...applicant, status: newStatus }
            : applicant,
        ),
      }));
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "Pending":
        return "bg-blue-100 text-yellow-700";
      case "Under Review":
        return "bg-blue-100 text-blue-700";
      case "For Interview":
        return "bg-blue-100 text-blue-700";
      case "Approved":
        return "bg-blue-100 text-blue-700";
      case "Rejected":
        return "bg-red-100 text-red-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  return (
    <Layout menuItems={menuItems} title="Job Board Management" showBackButton>
      {viewState === 'list' && (
        <div className="space-y-8">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-500 mt-1">
                Manage job postings and applications
              </p>
            </div>
            <Button
              className="bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              onClick={() => setShowDialog(true)}
            >
              <Plus className="w-4 h-4 mr-2" />
              New Job Posting
            </Button>
          </div>

          {/* Filter Tabs */}
          <div className="flex items-center gap-2 border-b border-gray-200">
            <button
              onClick={() => setJobFilter('active')}
              className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${
                jobFilter === 'active'
                  ? 'border-[#2F6FD6] text-[#2F6FD6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Active Jobs ({jobs.filter(j => j.status === 'active').length})
            </button>
            <button
              onClick={() => setJobFilter('archived')}
              className={`px-4 py-2 font-semibold text-sm border-b-2 transition-colors ${
                jobFilter === 'archived'
                  ? 'border-[#2F6FD6] text-[#2F6FD6]'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              Archived Jobs ({jobs.filter(j => j.status === 'archived').length})
            </button>
          </div>

          {/* Job Listings */}
          {hydrating && <CardSkeleton cards={3} columns={1} label="Loading job postings" />}
          <div className={hydrating ? "hidden" : "grid grid-cols-1 gap-6"}>
            {jobs.filter(job => job.status === jobFilter).map((job) => {
              const isExpanded = expandedJobId === job.id;
              return (
              <Card
                key={job.id}
                className="overflow-hidden border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md gap-0"
              >
                <div className="p-4 sm:p-6">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-[#F2F7FF]">
                      <Briefcase className="h-6 w-6 text-[#1668D9]" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <h3 className="text-base font-bold text-[#1c1f26] sm:text-lg">{job.title}</h3>
                          <div className="mt-1.5 flex flex-wrap items-center gap-1">
                            <Badge className="text-xs bg-blue-100 text-blue-700">{job.type}</Badge>
                            {job.status === 'archived' && (
                              <Badge className="text-xs bg-gray-100 text-gray-700">{job.status}</Badge>
                            )}
                            {job.department && (
                              <>
                                <span className="text-xs text-gray-500">·</span>
                                <span className="text-xs text-gray-500">{job.department}</span>
                              </>
                            )}
                            <span className="text-xs text-gray-500">·</span>
                            <span className="text-xs text-gray-500">Posted {job.posted}</span>
                          </div>
                        </div>

                        <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                          <Button
                            variant="outline"
                            size="sm"
                            className="border-blue-200 text-[#1668D9] hover:bg-[#1668D9] hover:text-white text-xs px-3"
                            onClick={() => handleViewApplicants(job)}
                          >
                            <Eye className="w-3.5 h-3.5 mr-1" />
                            View Applicants
                          </Button>
                          {job.status === 'active' ? (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white border-2 border-gray-300 text-gray-600 hover:bg-gray-600 hover:text-white text-xs px-3 transition-all"
                              onClick={() => handleArchiveJob(job)}
                            >
                              Archive
                            </Button>
                          ) : (
                            <Button
                              variant="outline"
                              size="sm"
                              className="bg-white border-2 border-blue-300 text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white text-xs px-3 transition-all"
                              onClick={() => setJobToRestore(job)}
                            >
                              Restore
                            </Button>
                          )}
                        </div>
                      </div>

                      {/* Meta footer */}
                      <div className="mt-3 flex flex-col gap-2 text-xs text-gray-500 sm:flex-row sm:items-center sm:gap-5">
                        <span className="flex items-center gap-1.5">
                          <Users className="h-3.5 w-3.5" /> {job.applicants.length} applicants
                        </span>
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5" /> {job.duration}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Collapsible description accordion */}
                <div className="border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                    className="flex w-full items-center justify-between gap-2 px-4 sm:px-6 py-2.5 text-left text-sm font-semibold text-[#1668D9] hover:text-[#10316B] transition-colors"
                    aria-expanded={isExpanded}
                  >
                    <span>{isExpanded ? "Hide description" : "Show description"}</span>
                    <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isExpanded ? "rotate-180" : ""}`} />
                  </button>
                  <div className={`grid transition-[grid-template-rows] duration-200 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                    <div className="min-h-0 overflow-hidden">
                      <div className="bg-gray-50/50 px-4 pb-4 sm:px-6 sm:pb-5">
                        <p className="py-1 text-sm leading-relaxed text-gray-700">{job.description}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
              );
            })}
            {jobs.filter(job => job.status === jobFilter).length === 0 && (
              <div className="text-center py-12 text-gray-500">
                <p className="text-lg font-medium">No {jobFilter} jobs found</p>
                <p className="text-sm mt-2">
                  {jobFilter === 'active'
                    ? 'Create a new job posting to get started.'
                    : 'Archived jobs will appear here for future reference.'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewState === 'applicants' && (
        <div className="space-y-6">
          <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
            <Button
              variant="outline"
              size="default"
              onClick={() => setViewState('list')}
              className="flex items-center gap-2 shrink-0 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Job Postings
            </Button>
            <div className="text-left">
              <h2 className="text-lg font-bold text-gray-900 sm:text-2xl sm:font-semibold sm:text-[#10316B] leading-snug">
                Applicants for {selectedJob?.title}
              </h2>
              <p className="text-xs text-gray-500 mt-1 sm:text-base sm:text-gray-600">
                Review and manage student applications for this position.
              </p>
            </div>
          </div>

          {hydrating && <CardSkeleton cards={2} columns={1} label="Loading applicants" />}
          <div className={hydrating ? "hidden" : "space-y-4"}>
            {selectedJob?.applicants && selectedJob.applicants.length > 0 ? (
              <div className="border rounded-lg bg-white divide-y">
                {selectedJob.applicants.map((applicant: any) => (
                  <div
                    key={applicant.id}
                    className="p-5 hover:bg-gray-50"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <p className="font-semibold text-gray-900 text-lg">
                            {applicant.firstName}
                          </p>
                          <p className="font-semibold text-gray-900 text-lg">
                            {applicant.lastName}
                          </p>
                        </div>
                        <p className="text-sm text-gray-500 mt-1">
                          {applicant.email}
                        </p>
                        <p className="text-sm text-gray-500">
                          {applicant.phone}
                        </p>
                        <p className="text-xs text-gray-500 mt-1">
                          Applied: {applicant.dateTimeApplied || applicant.dateApplied}
                        </p>
                      </div>

                      <div className="space-y-2">
                        <Badge
                          className={getStatusBadgeClass(
                            applicant.status,
                          )}
                        >
                          {applicant.status}
                        </Badge>
                        {applicant.status === "For Interview" && applicant.interviewDate && (
                          <div className="text-xs text-gray-600 mt-2">
                            <p className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {applicant.interviewDate}
                            </p>
                            <p className="flex items-center gap-1">
                              <Clock className="w-3 h-3" />
                              {applicant.interviewTime}
                            </p>
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() =>
                          handleViewApplication(
                            selectedJob,
                            applicant,
                          )
                        }
                      >
                        <FileText className="w-4 h-4 mr-2" />
                        View Application
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="w-full p-8 text-center bg-gray-50/50 border border-dashed border-gray-200 rounded-xl mt-4">
                <Inbox className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-500">No applications received yet.</p>
                <p className="text-xs text-gray-500 mt-1">Applications will appear here once students apply.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {viewState === 'application' && (
        <div className="space-y-6">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="default"
              onClick={() => setViewState('applicants')}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 border-gray-300 hover:bg-gray-200 hover:text-gray-900"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Applicants
            </Button>
            <div>
              <h2 className="text-2xl font-semibold text-[#10316B]">
                Application Details
              </h2>
              <p className="text-gray-600 mt-1">
                Review application and update status
              </p>
            </div>
          </div>

          <div className="space-y-6">
            {/* Applicant Information */}
            <Card className="p-5 bg-white">
              <h3 className="font-semibold text-gray-900 mb-4">
                Applicant Information
              </h3>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-600">First Name</p>
                  <p className="font-medium text-gray-900">
                    {selectedApplicant?.firstName}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Last Name</p>
                  <p className="font-medium text-gray-900">
                    {selectedApplicant?.lastName}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Email</p>
                  <p className="font-medium text-gray-900">
                    {selectedApplicant?.email}
                  </p>
                </div>
                <div>
                  <p className="text-gray-600">Phone Number</p>
                  <p className="font-medium text-gray-900">
                    {selectedApplicant?.phone}
                  </p>
                </div>
                <div className="col-span-2">
                  <p className="text-gray-600">Date & Time Applied</p>
                  <p className="font-medium text-gray-900">
                    {selectedApplicant?.dateTimeApplied || selectedApplicant?.dateApplied}
                  </p>
                </div>
              </div>
            </Card>

            {/* Skills / Message */}
            <Card className="p-5 bg-white">
              <h3 className="font-semibold text-gray-900 mb-3">
                Skills / Message
              </h3>
              <p className="text-sm text-gray-700 leading-relaxed">
                {selectedApplicant?.skills || selectedApplicant?.coverLetter}
              </p>
            </Card>

            {/* Portfolio / Resume */}
            {(selectedApplicant?.resumeUrl || selectedApplicant?.portfolioFileName) && (
              <Card className="p-5 bg-white">
                <h3 className="font-semibold text-gray-900 mb-3">
                  Portfolio / Resume
                </h3>
                {selectedApplicant?.portfolioType === 'file' ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileCheck className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900">
                          {selectedApplicant?.portfolioFileName || 'Uploaded File'}
                        </p>
                        <p className="text-xs text-gray-500">PDF/Image Upload</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      loading={resumeOpening}
                      loadingText="Opening..."
                      onClick={() => handleViewResume(selectedApplicant)}
                      className="w-full"
                    >
                      {!resumeOpening ? <Eye className="w-4 h-4 mr-2" /> : null}
                      View Portfolio
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <FileCheck className="w-5 h-5 text-blue-600" />
                      <div className="flex-1">
                        <p className="text-sm font-medium text-gray-900 break-all">
                          {selectedApplicant?.resumeUrl}
                        </p>
                        <p className="text-xs text-gray-500">External Link</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => window.open(selectedApplicant?.resumeUrl, '_blank')}
                      className="w-full"
                    >
                      <ExternalLink className="w-4 h-4 mr-2" />
                      Open Link in New Tab
                    </Button>
                  </div>
                )}
              </Card>
            )}

            {/* Status Update */}
            <Card className="p-5 bg-white border-2 border-blue-200 border-2 border-blue-200">
              <h3 className="font-semibold text-gray-900 mb-4">
                Update Application Status
              </h3>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Application Status</Label>
                  <Select
                    value={statusUpdateData.status}
                    onValueChange={(value) =>
                      setStatusUpdateData((prev) => ({
                        ...prev,
                        status: value,
                      }))
                    }
                  >
                    <SelectTrigger className="bg-white border-gray-300 focus:border-[#2F6FD6] h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Pending">Pending</SelectItem>
                      <SelectItem value="Under Review">Under Review</SelectItem>
                      <SelectItem value="For Interview">For Interview</SelectItem>
                      <SelectItem value="Approved">Approved</SelectItem>
                      <SelectItem value="Rejected">Rejected</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {statusUpdateData.status === "For Interview" && (
                  <>
                    <div className="space-y-2">
                      <Label>Interview Date <span className="text-red-500">*</span></Label>
                      <Input
                        type="date"
                        className="bg-white"
                        value={statusUpdateData.interviewDate}
                        onChange={(e) =>
                          setStatusUpdateData((prev) => ({
                            ...prev,
                            interviewDate: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Interview Time <span className="text-red-500">*</span></Label>
                      <Input
                        type="time"
                        className="bg-white"
                        value={statusUpdateData.interviewTime}
                        onChange={(e) =>
                          setStatusUpdateData((prev) => ({
                            ...prev,
                            interviewTime: e.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Interview Location <span className="text-red-500">*</span></Label>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs mb-2 w-full"
                        onClick={() =>
                          setStatusUpdateData((prev) => ({
                            ...prev,
                            interviewLocation: "Docufy Print Shop, Main Office, 2nd Floor",
                          }))
                        }
                      >
                        Use Docufy Address
                      </Button>
                      <Input
                        placeholder="e.g., Main Office, 2nd Floor or enter custom address"
                        className="bg-white"
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
                    <Label>Reason for Rejection <span className="text-red-500">*</span></Label>
                    <Textarea
                      placeholder="Explain why this application was rejected..."
                      className="bg-white"
                      rows={4}
                      value={statusUpdateData.rejectionReason}
                      onChange={(e) =>
                        setStatusUpdateData((prev) => ({
                          ...prev,
                          rejectionReason: e.target.value,
                        }))
                      }
                    />
                    <p className="text-xs text-gray-500">
                      This reason will be shown to the applicant
                    </p>
                  </div>
                )}
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <Button
                  variant="outline"
                  onClick={() => setViewState('applicants')}
                >
                  Cancel
                </Button>
                <Button
                  className="bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
                  onClick={handleStatusUpdate}
                >
                  Update Status
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {/* Create Job Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Create New Job Posting</DialogTitle>
            <DialogDescription>
              Fill in the details to create a new job
              opportunity
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Job Title <span className="text-red-500">*</span></Label>
              <Input
                id="title"
                type="text"
                value={formData.title}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    title: e.target.value,
                  }))
                }
                placeholder="e.g., Part-Time Print Shop Assistant"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description <span className="text-red-500">*</span></Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    description: e.target.value,
                  }))
                }
                placeholder="Describe the role, responsibilities, and requirements..."
                rows={4}
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="type">Job Type <span className="text-red-500">*</span></Label>
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      type: value,
                    }))
                  }
                >
                  <SelectTrigger className="h-10 bg-white border-gray-300 focus:border-[#2F6FD6]">
                    <SelectValue placeholder="Select job type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Part-Time">Part-Time</SelectItem>
                    <SelectItem value="Full-Time">Full-Time</SelectItem>
                    <SelectItem value="Contract">Contract</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="duration">Duration <span className="text-red-500">*</span></Label>
                <Input
                  id="duration"
                  type="text"
                  value={formData.duration}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      duration: e.target.value,
                    }))
                  }
                  placeholder="e.g., 15-20 hours/week"
                  required
                />
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowDialog(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                className="flex-1 bg-white text-[#2F6FD6] border-2 border-blue-200 hover:bg-[#2F6FD6] hover:text-white"
              >
                Create Job Posting
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Create Job Confirmation Dialog */}
      <Dialog open={showCreateConfirmDialog} onOpenChange={setShowCreateConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-[#1668D9]" />
              </div>
              <div>
                <DialogTitle className="text-xl">Docufy</DialogTitle>
                <p className="text-sm text-gray-600 font-normal">Create Job Posting?</p>
              </div>
            </div>
            <DialogDescription className="text-base">
              Visible to all visitors immediately.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowCreateConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmCreate}
              className="bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
            >
              Create Posting
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Status Update Confirmation Dialog */}
      <Dialog open={showStatusUpdateConfirmDialog} onOpenChange={setShowStatusUpdateConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-[#1668D9]" />
              </div>
              <div>
                <DialogTitle className="text-xl">Docufy</DialogTitle>
                <p className="text-sm text-gray-600 font-normal">Update Application Status?</p>
              </div>
            </div>
            <DialogDescription className="text-base">
              Set this application to <span className="font-semibold">{statusUpdateData.status}</span>.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setShowStatusUpdateConfirmDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmStatusUpdate}
              className="bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
            >
              Update Status
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Archive Job Confirmation Dialog */}
      <Dialog open={showArchiveConfirmDialog} onOpenChange={setShowArchiveConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-amber-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <DialogTitle className="text-xl">Archive Job Posting?</DialogTitle>
              </div>
            </div>
            <DialogDescription className="text-base">
              <span className="font-semibold">{jobToArchive?.title}</span> leaves the job board. It can be restored later.
            </DialogDescription>
          </DialogHeader>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => {
                setShowArchiveConfirmDialog(false);
                setJobToArchive(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmArchiveJob}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              Archive Job
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Restore Job Confirmation Dialog */}
      {jobToRestore && (
        <ConfirmationDialog
          open
          onOpenChange={() => setJobToRestore(null)}
          onConfirm={() => { handleUnarchiveJob(jobToRestore); setJobToRestore(null); }}
          title="Restore Job Posting?"
          description={`Restore "${jobToRestore?.title}" to the job board? Visitors will see it immediately.`}
          confirmLabel="Restore"
          cancelLabel="Go Back"
          destructive={false}
        />
      )}
    </Layout>
  );
}

