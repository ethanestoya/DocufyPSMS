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
import { applicationsStore, ApplicationType } from '../../utils/applicationsStore';
import { jobsStore } from '../../utils/jobsStore';

const menuItems = [
  { label: 'Dashboard', path: '/customer/dashboard', icon: <LayoutDashboard className="w-5 h-5" /> },
  { label: 'Print Request', path: '/customer/new-request', icon: <FileText className="w-5 h-5" /> },
  { label: 'My Orders', path: '/customer/orders', icon: <Package className="w-5 h-5" /> },
  { label: 'Job Board', path: '/customer/job-board', icon: <Briefcase className="w-5 h-5" /> },
];

const STATUS_COLORS: Record<string, string> = {
  Pending: 'bg-gray-100 text-gray-700 border-gray-200',
  'Under Review': 'bg-white border-2 border-blue-200 text-blue-700 border-green-200',
  'For Interview': 'bg-purple-50 text-purple-700 border-purple-200',
  Approved: 'bg-white border-2 border-blue-200 text-blue-700 border-green-200',
  Rejected: 'bg-white border-2 border-blue-200 text-red-500 border-green-200',
};

export default function JobBoard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
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
    <Layout menuItems={menuItems} title="Job Board" showBackButton>
      <div className="space-y-8 max-w-5xl mx-auto">

        {/* Page Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-gray-500 mt-1">
              Browse opportunities at DocuFy PSMS · Room 4, TBI Building, Palawan State University
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => setTab('listings')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold border-2 transition-all ${
                tab === 'listings'
                  ? 'bg-[#1D73EC] text-white border-[#1D73EC] shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1D73EC] hover:text-[#1D73EC]'
              }`}
            >
              Job Listings
            </button>
            <button
              onClick={() => setTab('applications')}
              className={`px-5 py-2 rounded-xl text-sm font-semibold border-2 transition-all relative ${
                tab === 'applications'
                  ? 'bg-[#1D73EC] text-white border-[#1D73EC] shadow-md'
                  : 'bg-white text-gray-600 border-gray-200 hover:border-[#1D73EC] hover:text-[#1D73EC]'
              }`}
            >
              My Applications
              {applications.length > 0 && (
                <span className={`ml-2 px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
                  tab === 'applications' ? 'bg-white/20 text-white' : 'bg-[#1D73EC] text-white'
                }`}>
                  {applications.length}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* ── JOB LISTINGS ── */}
        {tab === 'listings' && (
          <div className="space-y-5">
            {jobs.map((job) => {
              const application = getApplicationForJob(job.id);
              const isExpanded = expandedJobId === job.id;

              return (
                <Card
                  key={job.id}
                  className="overflow-hidden bg-white shadow-sm hover:shadow-md transition-shadow border border-gray-100"
                >
                  {/* Main Row */}
                  <div className="p-6">
                    <div className="flex items-start gap-4">
                      {/* Icon */}
                      <div className="w-12 h-12 bg-[#F2F7FF] rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-100">
                        <Briefcase className="w-6 h-6 text-[#1D73EC]" />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <h3 className="text-lg font-bold text-[#1c1f26]">{job.title}</h3>
                            <div className="flex flex-wrap items-center gap-2 mt-1.5">
                              <Badge className="bg-white border-2 border-blue-200 text-blue-700 border border-green-200 text-xs">
                                {job.type}
                              </Badge>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">{job.department}</span>
                              <span className="text-xs text-gray-400">·</span>
                              <span className="text-xs text-gray-500">Posted {job.posted}</span>
                              {application && (
                                <Badge className={`text-xs border ${STATUS_COLORS[application.status]}`}>
                                  {application.status}
                                </Badge>
                              )}
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <button
                              onClick={() => setExpandedJobId(isExpanded ? null : job.id)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium text-gray-600 border border-gray-200 hover:bg-gray-50 transition-colors"
                            >
                              {isExpanded ? (
                                <><ChevronUp className="w-3.5 h-3.5" /> Less</>
                              ) : (
                                <><ChevronDown className="w-3.5 h-3.5" /> Details</>
                              )}
                            </button>
                            {application && (
                              <Button
                                variant="outline"
                                size="sm"
                                disabled
                                className="text-xs opacity-60"
                              >
                                Applied
                              </Button>
                            )}
                          </div>
                        </div>

                        {/* Meta */}
                        <div className="flex items-center gap-5 mt-3 text-xs text-gray-500">
                          <span className="flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5" /> {job.duration}
                          </span>
                          <span className="flex items-center gap-1.5">
                            <MapPin className="w-3.5 h-3.5" /> Room 4, PSU Main Campus, TBI Building
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expandable Details */}
                  {isExpanded && (
                    <div className="border-t border-gray-100 bg-gray-50/50 px-6 py-5">
                      <p className="text-sm text-gray-700 leading-relaxed">{job.description}</p>
                      {!application && (
                        <div className="mt-4">
                          <Button
                            className="bg-[#1D73EC] hover:bg-[#10316B] text-white text-sm"
                            onClick={() => navigate(`/customer/job-apply/${job.id}`)}
                          >
                            Apply for this Position
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}

        {/* ── MY APPLICATIONS ── */}
        {tab === 'applications' && (
          <div className="space-y-5">
            {applications.length === 0 ? (
              <Card className="p-16 bg-white shadow-sm text-center border border-gray-100">
                <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Briefcase className="w-8 h-8 text-gray-300" />
                </div>
                <p className="font-semibold text-gray-500 text-lg">No applications yet</p>
                <p className="text-sm text-gray-400 mt-1">Browse job listings and apply to get started.</p>
                <Button
                  className="mt-6 bg-[#1D73EC] hover:bg-[#10316B] text-white"
                  onClick={() => setTab('listings')}
                >
                  Browse Listings
                </Button>
              </Card>
            ) : (
              applications.map((app) => {
                const job = jobs.find((j) => j.id === app.jobId);

                return (
                  <Card key={app.id} className="overflow-hidden bg-white shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                    <div className="p-6">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-4">
                          <div className="w-12 h-12 bg-[#F2F7FF] rounded-xl flex items-center justify-center flex-shrink-0 border border-blue-100">
                            <Briefcase className="w-6 h-6 text-[#1D73EC]" />
                          </div>
                          <div>
                            <h3 className="text-lg font-bold text-[#1c1f26]">{app.jobTitle}</h3>
                            <p className="text-sm text-gray-500 mt-0.5">
                              Applied on {new Date(app.appliedDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
                            </p>
                            <div className="flex items-center gap-2 mt-2">
                              <Badge className={`text-xs border ${STATUS_COLORS[app.status]}`}>
                                {app.status}
                              </Badge>
                              <span className="text-xs text-gray-400">{app.id}</span>
                            </div>
                          </div>
                        </div>

                        {/* View Full Details Button */}
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-xs border-[#1D73EC] text-[#1D73EC] hover:bg-[#1D73EC] hover:text-white flex-shrink-0"
                          onClick={() => setSelectedApp(app)}
                        >
                          <Eye className="w-3.5 h-3.5 mr-1.5" />
                          View Details
                        </Button>
                      </div>

                      {/* Interview Banner */}
                      {app.status === 'For Interview' && app.interviewDate && (
                        <div className="mt-4 p-4 bg-purple-50 border border-purple-200 rounded-xl">
                          <div className="flex items-center gap-2 mb-2">
                            <Calendar className="w-4 h-4 text-purple-600" />
                            <span className="font-semibold text-purple-900 text-sm">Interview Scheduled</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm text-purple-800">
                            <div>
                              <span className="font-medium">Date: </span>
                              {new Date(app.interviewDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
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
                        <div className="mt-4 p-4 bg-white border-2 border-blue-200 border border-green-200 rounded-xl flex items-start gap-3">
                          <Info className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-900">
                            Your application is currently being reviewed by our team. We'll notify you of any updates soon.
                          </p>
                        </div>
                      )}

                      {app.status === 'Approved' && (
                        <div className="mt-4 p-4 bg-white border-2 border-blue-200 border border-green-200 rounded-xl flex items-start gap-3">
                          <CheckCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                          <p className="text-sm text-blue-900 font-medium">
                            Congratulations! Your application has been approved. We'll contact you soon with next steps.
                          </p>
                        </div>
                      )}

                      {app.status === 'Rejected' && (
                        <div className="mt-4 p-4 bg-white border-2 border-blue-200 border border-green-200 rounded-xl">
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
        )}

        {/* Info Card */}
        <Card className="p-6 bg-[#F2F7FF] border border-green-200">
          <div className="flex items-start gap-3">
            <Briefcase className="w-5 h-5 text-[#1D73EC] mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="font-semibold text-[#10316B] mb-2">Why Work With DocuFy?</h3>
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

      {/* ── FULL APPLICATION DETAILS MODAL ── */}
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
                  <p className="font-bold text-gray-900 font-mono">{selectedApp.id}</p>
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
                  <p className="font-bold text-[#1D73EC] text-base">{selectedApp.position}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Submitted on {new Date(selectedApp.appliedDate).toLocaleDateString('en-PH', { year: 'numeric', month: 'long', day: 'numeric' })}
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
                      <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                        <FileText className="w-5 h-5 text-blue-600" />
                        <div className="flex-1">
                          <p className="text-sm font-medium text-gray-900">
                            {selectedApp.portfolioFileName || 'Uploaded File'}
                          </p>
                          <p className="text-xs text-gray-500">PDF/Image Upload</p>
                        </div>
                      </div>
                    ) : (
                      <a
                        href={selectedApp.portfolio}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 text-sm font-medium text-[#1D73EC] hover:text-[#10316B] hover:underline transition-colors break-all"
                      >
                        <ExternalLink className="w-4 h-4 flex-shrink-0" />
                        {selectedApp.portfolio}
                      </a>
                    )}
                  </div>
                </div>
              ) : (
                <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
                  <p className="text-xs text-gray-400">No portfolio provided</p>
                </div>
              )}

              {/* Interview Details if applicable */}
              {selectedApp.status === 'For Interview' && selectedApp.interviewDate && (
                <div className="rounded-xl border border-purple-200 bg-purple-50 overflow-hidden">
                  <div className="px-4 py-3 border-b border-purple-200">
                    <p className="text-xs font-semibold text-purple-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" /> Interview Schedule
                    </p>
                  </div>
                  <div className="p-4 grid grid-cols-2 gap-4 text-sm text-purple-900">
                    <div>
                      <p className="text-xs text-purple-600 mb-0.5">Date</p>
                      <p className="font-semibold">
                        {new Date(selectedApp.interviewDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-purple-600 mb-0.5">Time</p>
                      <p className="font-semibold">{selectedApp.interviewTime}</p>
                    </div>
                    <div className="col-span-2">
                      <p className="text-xs text-purple-600 mb-0.5">Location</p>
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
              className="w-full bg-[#1D73EC] hover:bg-[#10316B]"
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