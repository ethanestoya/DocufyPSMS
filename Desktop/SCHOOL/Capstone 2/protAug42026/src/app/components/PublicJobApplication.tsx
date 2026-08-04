import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { ArrowLeft, Briefcase, Upload, CheckCircle2, AlertCircle } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from './ui/dialog';
import { toast } from 'sonner';
import logoImage from 'figma:asset/32cd46dac3d06839e0db69b6c6ad22c9a8ac17a6.png';

// Mock job data (shared with admin job board)
const mockJobs = [
  {
    id: 'JOB-001',
    title: 'Part-Time Print Shop Assistant',
    description: 'Assist customers with printing needs, operate printing equipment, and handle basic administrative tasks.',
    requirements: 'Good communication skills, basic computer knowledge, flexible schedule',
    salary: '₱150/hour',
    schedule: 'Mon-Fri, 3-4 hours/day',
    status: 'active' as const,
    postedDate: new Date('2026-04-10'),
  },
  {
    id: 'JOB-002',
    title: 'Student Printing Technician',
    description: 'Manage printing queue, troubleshoot printer issues, and ensure quality output.',
    requirements: 'Tech-savvy, detail-oriented, previous printing experience preferred',
    salary: '₱180/hour',
    schedule: 'Flexible weekday shifts',
    status: 'active' as const,
    postedDate: new Date('2026-04-08'),
  },
];

export default function PublicJobApplication() {
  const navigate = useNavigate();
  const { jobId } = useParams();
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    address: '',
    coverLetter: '',
    resume: null as File | null,
  });
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const job = mockJobs.find(j => j.id === jobId);

  if (!job) {
    return (
      <div className="min-h-screen bg-[#F2F7FF] flex items-center justify-center p-4">
        <Card className="p-8 text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-semibold mb-2">Job Not Found</h2>
          <p className="text-gray-600 mb-4">The job posting you're looking for doesn't exist or has been removed.</p>
          <Button onClick={() => navigate('/')} className="bg-[#1D73EC] hover:bg-[#10316B]">
            Back to Home
          </Button>
        </Card>
      </div>
    );
  }

  const handleSubmit = () => {
    // Validate form
    if (!formData.fullName || !formData.email || !formData.phone) {
      toast.error('Please fill in all required fields');
      return;
    }
    
    setShowConfirmDialog(true);
  };

  const confirmSubmit = () => {
    setShowConfirmDialog(false);
    // Simulate application submission
    setTimeout(() => {
      setShowSuccessDialog(true);
    }, 500);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFormData(prev => ({ ...prev, resume: e.target.files![0] }));
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F7FF]">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img src={logoImage} alt="DocuFy Logo" className="w-12 h-12 rounded-full" />
            <div>
              <h1 className="text-xl font-bold text-[#1c1f26]">DocuFy</h1>
              <p className="text-xs text-gray-500">Your Printing Companion</p>
            </div>
          </div>
          <Button variant="outline" onClick={() => navigate('/')} className="border-[#1D73EC] text-[#1D73EC] hover:bg-[#1D73EC] hover:text-white">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Home
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
        {/* Job Details */}
        <Card className="p-6 mb-6 bg-[#1D73EC] text-white">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-white/20 rounded-lg flex items-center justify-center flex-shrink-0">
              <Briefcase className="w-6 h-6" />
            </div>
            <div className="flex-1">
              <h2 className="text-2xl font-bold mb-2">{job.title}</h2>
              <p className="text-blue-100 mb-4">{job.description}</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-blue-200">Salary</p>
                  <p className="font-semibold">{job.salary}</p>
                </div>
                <div>
                  <p className="text-blue-200">Schedule</p>
                  <p className="font-semibold">{job.schedule}</p>
                </div>
                <div className="sm:col-span-2">
                  <p className="text-blue-200 mb-1">Requirements</p>
                  <p className="font-medium">{job.requirements}</p>
                </div>
              </div>
            </div>
          </div>
        </Card>

        {/* Application Form */}
        <Card className="p-6">
          <h3 className="text-xl font-semibold text-gray-900 mb-6">Application Form</h3>
          
          <div className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name <span className="text-red-500">*</span></Label>
                <Input
                  id="fullName"
                  placeholder="Juan Dela Cruz"
                  value={formData.fullName}
                  onChange={(e) => setFormData(prev => ({ ...prev, fullName: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email Address <span className="text-red-500">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="juan@email.com"
                  value={formData.email}
                  onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number <span className="text-red-500">*</span></Label>
                <Input
                  id="phone"
                  placeholder="+63 912 345 6789"
                  value={formData.phone}
                  onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input
                  id="address"
                  placeholder="City, Province"
                  value={formData.address}
                  onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverLetter">Cover Letter / Message</Label>
              <Textarea
                id="coverLetter"
                placeholder="Tell us why you're interested in this position..."
                rows={5}
                value={formData.coverLetter}
                onChange={(e) => setFormData(prev => ({ ...prev, coverLetter: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="resume">Resume / CV (Optional)</Label>
              <div className="flex items-center gap-3">
                <Input
                  id="resume"
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileChange}
                  className="flex-1"
                />
                {formData.resume && (
                  <span className="text-sm text-blue-600 flex items-center gap-1">
                    <CheckCircle2 className="w-4 h-4" />
                    {formData.resume.name}
                  </span>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                onClick={handleSubmit}
                className="flex-1 bg-[#1D73EC] hover:bg-[#10316B] text-white"
              >
                Submit Application
              </Button>
              <Button
                variant="outline"
                onClick={() => navigate('/')}
                className="border-gray-300"
              >
                Cancel
              </Button>
            </div>
          </div>
        </Card>
      </div>

      {/* Confirmation Dialog */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center">
                <AlertCircle className="w-6 h-6 text-blue-600" />
              </div>
              <DialogTitle className="text-xl">Confirm Submission?</DialogTitle>
            </div>
            <DialogDescription className="text-base">
              Are you sure you want to submit your application for <strong>{job.title}</strong>? Please review all information before submitting.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              Review Again
            </Button>
            <Button onClick={confirmSubmit} className="bg-[#1D73EC] hover:bg-[#10316B]">
              Yes, Submit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent>
          <DialogHeader>
            <div className="flex flex-col items-center text-center mb-2">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-blue-600" />
              </div>
              <DialogTitle className="text-2xl">Application Submitted!</DialogTitle>
            </div>
            <DialogDescription className="text-base text-center">
              Thank you for applying to <strong>{job.title}</strong>. We've received your application and will review it shortly. You'll hear from us soon!
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="sm:justify-center">
            <Button onClick={() => navigate('/')} className="bg-[#1D73EC] hover:bg-[#10316B]">
              Back to Home
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
