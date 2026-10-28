import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import {
  LayoutDashboard,
  FileText,
  Briefcase,
  Clock,
  MapPin,
  Package,
  Calendar,
  Info,
  User,
  Mail,
  Phone,
  Link2,
  MessageSquare,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  CheckCircle,
  Eye,
  ArrowLeft,
} from 'lucide-react';
import Layout from '../Layout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '../ui/dialog';
import {
  applicationsStore,
  applicationDisplayId,
  openApplicationPortfolio,
  ApplicationType,
} from '../../utils/applicationsStore';
import { CardSkeleton } from '../ui/card-skeleton';
import { useHydrating } from '../../utils/useHydrating';
import { jobsStore } from '../../utils/jobsStore';
import { formatPHDate } from '../../utils/pht';

const menuItems = [
  { label: 'Dashboard', path: '/customer/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Print Request', path: '/customer/new-request', icon: <FileText className="w-5 h-5" /> },
  { label: 'My Orders', path: '/customer/orders', icon: <Package className="w-5 h-5" /> },
  { label: 'Job Board', path: '/customer/job-board', icon: <Briefcase className="w-5 h-5" /> },
];

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-700 border-gray-200',
  'Under Review': 'bg-white border-2 border-blue-200 text-blue-700 border-blue-200',
  'For Interview': 'bg-blue-50 text-blue-700 border-blue-200',
  Approved: 'bg-white border-2 border-blue-200 text-blue-700 border-blue-200',
  Rejected: 'bg-white border-2 border-blue-200 text-red-500 border-blue-200',
};

export default function JobBoard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const hydrating = useHydrating();
  const [tab, setTab] = useState<'listings' | 'applications'>('listings');
  const [jobs, setJobs] = useState<any[]>([]);
  const [applications, setApplications] = useState<ApplicationType[]>([]);
  const [selectedApp, setSelectedApp] = useState<ApplicationType | null>(null);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  useEffect(() => {
    // Load active jobs from centralized store (exclude archived jobs)
    setJobs(jobsStore.getActiveJobs());
    const unsubJobs = jobsStore.subscribe(() => {
      setJobs(jobsStore.getActiveJobs());
    });

    // Load applications from centralized store
    setApplications(applicationsStore.getApplications());
    const unsubApps = applicationsStore.subscribe(() => {
      setApplications(applicationsStore.getApplications());
    });

    return () => {
      unsubJobs();
      unsubApps();
    };
  }, []);

  useEffect(() => {
    // Check for success parameter from navigation
    const success = searchParams.get('success');
    const tabParam = searchParams.get('tab');
    const appId = searchParams.get('appId');

    if (success === 'true') {
      setShowSuccessDialog(true);
      // Remove the success parameter from URL
      searchParams.delete('success');
      setSearchParams(searchParams);
    }

    if (tabParam === 'applications') {
      setTab('applications');
      // Remove the tab parameter from URL
      searchParams.delete('tab');
      setSearchParams(searchParams);
    }

    // Handle notification navigation to specific application
    if (appId) {
      const app = applications.find(a => a.id === appId);
      if (app) {
        setTab('applications');
        setSelectedApp(app);
      }
      // Remove the appId parameter from URL
      searchParams.delete('appId');
      setSearchParams(searchParams);
    }
  }, [searchParams, setSearchParams, applications]);

  const getApplicationForJob = (jobId: string) =>
    applications.find((a) => a.jobId === jobId);

  return (
    <Layout menuItems={menuItems} title="Job Board" showBackButton hideMobileBackButton>
      <div className="space-y-4 max-w-5xl mx-auto">

        {/* Mobile back button (under the header) */}
        <button
          type="button"
          onClick={() => navigate(-1)}
          aria-label="Go back"
          className="md:hidden inline-flex items-center gap-1 rounded-xl p-2 pl-0 text-gray-600 hover:bg-gray-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]"
        >
          <ArrowLeft className="h-5 w-5" />
          <span className="text-sm font-medium">Back</span>
        </button>

        {/* Page Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <p className="text-sm text-gray-500 sm:text-base">
              Browse opportunities at Docufy PSMS · Room 4, TBI Building, Palawan State University
            </p>
          </div>
          <div className="flex w-full flex-row gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-2">
            <button
              onClick={() => setTab('listings')}
              className={`w-full rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all sm:w-auto ${
                tab === 'listings'
                  ? 'bg-[#1668D9] text-white border-[#1668D9] shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1668D9] hover:text-[#1668D9]'
              }`}
            >
              Job Listings
            </button>
            <button
              onClick={() => setTab('applications')}
              className={`relative w-full rounded-xl border-2 px-4 py-2.5 text-sm font-semibold transition-all sm:w-auto ${
                tab === 'applications'
                  ? 'bg-[#1668D9] text-white border-[#1668D9] shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1668D9] hover:text-[#1668D9]'
              }`}
            >
              My Applications
              {applications.length > 0 && (
                <span className={`ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                  tab === 'applications' ? 'bg-white/20 text-white' : 'bg-[#1668D9] text-white'
                }`}>
                  {applications.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* -- JOB LISTINGS -- */}
        {tab === 'listings' && (
          <>
          {hydrating && <CardSkeleton cards={3} columns={1} label="Loading job listings" />}
          <div className={hydrating ? "hidden" : "space-y-3"}>
            {jobs.length === 0 ? (
              <Card className="border border-gray-100 bg-white p-16 text-center shadow-sm">
                <Briefcase className="mx-auto mb-4 h-10 w-10 text-[#1668D9]/35" />
                <p className="text-lg font-semibold text-gray-500">No job listings available</p>
                <p className="mt-1 text-sm text-gray-500">New opportunities will appear here when they are posted.</p>
              </Card>
            ) : jobs.map((job) => {
              const application = getApplicationForJob(job.id);
              const isExpanded = expandedJobId === job.id;

              return (
                <Card
                  key={job.id}
                  className={`overflow-hidden border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md gap-0`}
                >
                  <div className="p-4 sm:p-6">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-[#F2F7FF]">
                        <Briefcase className="h-6 w-6 text-[#1668D9]" />
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-[#1c1f26] sm:text-lg">{job.title}</h3>
                            <div className="mt-1.5 flex flex-wrap items-center gap-1">
                              <Badge className="text-xs bg-blue-100 text-blue-700">
                                {job.type}
                              </Badge>
                              {job.department && (
                                <>
                                  <span className="text-xs text-gray-500">·</span>
                                  <span className="text-xs text-gray-500">{job.department}</span>
                                </>
                              )}
                              <span className="text-xs text-gray-500">·</span>
                              <span className="text-xs text-gray-500">Posted {job.posted}</span>
                              {application && (
                                <Badge className={`text-xs border ${STATUS_COLORS[application.status]}`}>
                                  {application.status}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <div className="order-3 flex w-full flex-col gap-2 sm:order-2 sm:w-auto sm:flex-row sm:items-center">
                            <button
                              onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                              className="flex items-center justify-center gap-1 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50"
                            >
                              {isExpanded ? (
                                <><ChevronUp className="h-3.5 w-3.5" /> Less</>
                              ) : (
                                <><ChevronDown className="h-3.5 w-3.5" /> Details</>
                              )}
                            </button>
                            {application && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="w-full text-xs sm:w-auto"
                              >
                                Applied
                              </Button>
                            )}
                          </div>

                          <div className="order-2 flex flex-col gap-2 text-xs text-gray-500 sm:order-3 sm:basis-full sm:flex-row sm:items-center sm:gap-5">
                            <span className="flex items-center gap-1.5">
                              <Clock className="h-3.5 w-3.5" /> {job.duration}
                            </span>
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5" /> Room 4, PSU Main Campus, TBI Building
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div
                    className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${isExpanded ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}
                  >
                    <div className="min-h-0 overflow-hidden">
                      <div className="border-t border-gray-100 bg-gray-50/50 px-4 pt-2 pb-4 sm:px-6 sm:pt-2 sm:pb-5">
                        <p className="text-sm leading-relaxed text-gray-700">{job.description}</p>
                        {!application && (
                          <div className="mt-4">
                            <Button
                              className="w-full h-11 text-sm bg-[#1668D9] text-white border-2 border-[#1668D9] hover:bg-[#10316B] sm:w-auto"
                              onClick={() => navigate(`/customer/job-apply/${job.id}`)}
                            >
                              Apply for this Position
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
          </>
        )}

        {/* -- MY APPLICATIONS -- */}
        {tab === 'applications' && (
          <>
          {hydrating && <CardSkeleton cards={2} columns={1} label="Loading your applications" />}
          <div className={hydrating ? "hidden" : "space-y-3"}>
            {applications.length === 0 ? (
              <Card className="p-16 bg-white shadow-sm text-center border border-gray-100">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-semibold text-gray-500 text-lg">No applications yet</p>
                <p className="text-smm text-gray-500 mt-1">Browse job listings and apply to get started.</p>
                <Button
                  className="mt-6 w-fit mx-auto bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white px-3"
                  onClick={() => setTab('listings')}
                >
                  Browse Listings
                </Button>
              </Card>
            ) : (
              applications.map((app) => {
                const job = jobs.find((j) => j.id === app.jobId);

                return (
<Card key={app.id} className="overflow-hidden border border-gray-100 bg-white shadow-sm transition-shadow hover:shadow-md">
                    <div className="p-4 sm:p-6">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex items-start gap-3 sm:gap-4">
                          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-blue-100 bg-[#F2F7FF]">
                            <Briefcase className="h-6 w-6 text-[#1668D9]" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-base font-bold text-[#1c1f26] sm:text-lg">{app.jobTitle}</h3>
                            <p className="mt-0.5 text-sm text-gray-500">
                              Applied on {formatPHDate(app.appliedDate, "long")}
                            </p>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <Badge className={`text-xs border ${STATUS_COLORS[app.status]}`}>
                                {app.status}
                              </Badge>
                              <span className="text-xs text-gray-500">{applicationDisplayId(app.id)}</span>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full border-[#1668D9] text-xs text-[#1668D9] hover:bg-[#1668D9] hover:text-white sm:w-auto"
                          onClick={() => setSelectedApp(app)}
                        >
                          <Eye className="mr-1.5 h-3.5 w-3.5" />
                          View Details
                        </Button>
                      </div>

                      {/* Interview Banner */}
                      {app.status === 'For Interview' && app.interviewDate && (
                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-blue-600" />
                            <span className="font-semibold text-blue-900 text-sm">Interview Scheduled</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm text-blue-800">
                            <div>
                              <span className="font-medium">Date: </span>
                              {formatPHDate(app.interviewDate, "long")}
                            </div>
                            <div>
                              <span className="font-medium">Time: </span>
                              {app.interviewTime}
                            </div>
                            <div className="col-span-2">
                              <span className="font-medium">Location: </span>
                              {app.interviewLocation}
                            </div>
                          </div>
                        </div>
                      )}

                      {app.status === 'Under Review' && (
                        <div className="mt-4 p-4 bg-white border-2 border-blue-200 border border-blue-200 rounded-xl flex items-start gap-3">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-900">
                            Your application is currently being reviewed by our team. We'll notify you of any updates soon.
                          </p>
                        </div>
                      )}

                      {app.status === 'Approved' && (
                        <div className="mt-4 p-4 bg-white border-2 border-blue-200 border border-blue-200 rounded-xl flex items-start gap-3">
                          <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-900 font-medium">
                            Congratulations! Your application has been approved. We'll contact you soon with next steps.
                          </p>
                        </div>
                      )}

                      {app.status === 'Rejected' && (
                        <div className="mt-4 p-4 bg-white border-2 border-blue-200 border border-blue-200 rounded-xl">
                          <p className="text-sm text-red-900">
                            We appreciate your interest. Unfortunately, we've decided to move forward with other candidates at this time.
                          </p>
                        </div>
                      )}
                    </div>
                  </Card>
                );
              })
            )}
          </div>
          </>
        )}

        {/* Info Card */}
        <Card className="border border-gray-200 bg-gray-50 p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <Briefcase className="mt-0.5 h-5 w-5 shrink-0 text-gray-500" />
            <div>
              <h3 className="mb-2 font-semibold text-[#10316B]">Why Work With Docufy?</h3>
              <ul className="space-y-1 text-sm text-gray-700">
                <li>• Flexible schedules perfect for students</li>
                <li>• Gain valuable work experience in printing & admin</li>
                <li>• Competitive compensation</li>
                <li>• Supportive team environment at Palawan State University</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>

      {/* -- FULL APPLICATION DETAILS MODAL -- */}
      <Dialog open={!!selectedApp} onOpenChange={() => setSelectedApp(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader className="pb-2">
            <DialogTitle className="text-[#10316B] flex items-center gap-2">
              <Briefcase className="w-5 h-5" />
              Application Details
            </DialogTitle>
            <DialogDescription>
              Full submission for <strong>{selectedApp?.jobTitle}</strong>
            </DialogDescription>
          </DialogHeader>

          {selectedApp && (
            <div className="space-y-5 pt-2">

              {/* Status + ID Row */}
              <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100">
                <div>
                  <p className="text-xs text-gray-500 font-medium">Application ID</p>
                  <p className="font-bold text-gray-900 font-mono">{applicationDisplayId(selectedApp.id)}</p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-gray-500 font-medium mb-1">Status</p>
                  <Badge className={`text-sm border ${STATUS_COLORS[selectedApp.status]}`}>
                    {selectedApp.status}
                  </Badge>
                </div>
              </div>

              {/* Personal Info */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-[#F2F7FF] border-b border-gray-200">
                  <p className="text-xs font-semibold text-[#10316B] uppercase tracking-wider flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Personal Information
                  </p>
                </div>
                <div className="p-4 grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Full Name</p>
                    <p className="font-semibold text-gray-900">{selectedApp.name}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-0.5">Contact Number</p>
                    <p className="font-semibold text-gray-900">{selectedApp.contact}</p>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-gray-500 mb-0.5">Email Address</p>
                    <p className="font-semibold text-gray-900">{selectedApp.email}</p>
                  </div>
                </div>
              </div>

              {/* Application Info */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-[#F2F7FF] border-b border-gray-200">
                  <p className="text-xs font-semibold text-[#10316B] uppercase tracking-wider flex items-center gap-1.5">
                    <Briefcase className="w-3.5 h-3.5" /> Position Applied
                  </p>
                </div>
                <div className="p-4">
                  <p className="font-bold text-[#1668D9] text-base">{selectedApp.position}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Submitted on {formatPHDate(selectedApp.appliedDate, "long")}
                  </p>
                </div>
              </div>

              {/* Skill Description */}
              <div className="rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 bg-[#F2F7FF] border-b border-gray-200">
                  <p className="text-xs font-semibold text-[#10316B] uppercase tracking-wider flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5" /> Skill Description
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{selectedApp.skills}</p>
                </div>
              </div>

              {/* Resume */}
              {(selectedApp.portfolio || selectedApp.portfolioFileName) ? (
                <div className="rounded-xl border border-gray-200 overflow-hidden">
                  <div className="px-4 py-3 bg-[#F2F7FF] border-b border-gray-200">
                    <p className="text-xs font-semibold text-[#10316B] uppercase tracking-wider flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5" /> Resume
                    </p>
                  </div>
                  <div className="p-4">
                    {selectedApp.portfolioType === 'file' ? (
                      <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                          <FileText className="w-5 h-5 text-blue-600" />
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">
                              {selectedApp.portfolioFileName || 'Uploaded File'}
                            </p>
                            <p className="text-xs text-gray-500">PDF/Image Upload</p>
                          </div>
                        </div>
                        {selectedApp.portfolioStoragePath || selectedApp.portfolioFile ? (
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => void openApplicationPortfolio(selectedApp)}
                          >
                            <Eye className="mr-1.5 h-4 w-4" />
                            View
                          </Button>
                        ) : null}
                      </div>
                    ) : (
                      <a
                        href={selectedApp.portfolio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#1668D9] hover:text-[#10316B] hover:underline transition-colors break-all"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        {selectedApp.portfolio}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-500">No portfolio provided</p>
                </div>
              )}

              {/* Interview Details if applicable */}
              {selectedApp.status === 'For Interview' && selectedApp.interviewDate && (
                <div className="rounded-xl border border-blue-200 bg-blue-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-blue-200">
                    <p className="text-xs font-semibold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Interview Schedule
                    </p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4 text-sm text-blue-900">
                    <div>
                      <p className="text-xs text-blue-600 mb-0.5">Date</p>
                      <p className="font-semibold">
                        {formatPHDate(selectedApp.interviewDate, "long")}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-blue-600 mb-0.5">Time</p>
                      <p className="font-semibold">{selectedApp.interviewTime}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-blue-600 mb-0.5">Location</p>
                      <p className="font-semibold">{selectedApp.interviewLocation}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Rejection Reason if applicable */}
              {selectedApp.status === 'Rejected' && selectedApp.rejectionReason && (
                <div className="rounded-xl border border-red-200 bg-red-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-red-200">
                    <p className="text-xs font-semibold text-red-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Info className="w-3.5 h-3.5" /> Reason for Rejection
                    </p>
                  </div>
                  <div className="p-4">
                    <p className="text-sm text-red-900 leading-relaxed">
                      {selectedApp.rejectionReason}
                    </p>
                  </div>
                </div>
              )}

            </div>
          )}

          <div className="flex justify-end pt-4 border-t border-gray-100 mt-2">
            <Button variant="outline" onClick={() => setSelectedApp(null)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex flex-col items-center text-center space-y-4 py-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-blue-600" />
              </div>
              <DialogTitle className="text-2xl">Application Submitted!</DialogTitle>
              <DialogDescription className="text-base">
                Your application has been successfully submitted. Our team will review your application and contact you within 3–5 business days.
              </DialogDescription>
            </div>
          </DialogHeader>
          <div className="flex flex-col gap-2 mt-4">
            <Button
              onClick={() => {
                setShowSuccessDialog(false);
                setTab('applications');
              }}
              className="w-full bg-white text-[#1668D9] border-2 border-blue-200 hover:bg-[#1668D9] hover:text-white"
            >
              View My Applications
            </Button>
            <Button
              variant="outline"
              onClick={() => {
                setShowSuccessDialog(false);
                navigate("/customer/dashboard");
              }}
              className="w-full"
            >
              Go to Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
