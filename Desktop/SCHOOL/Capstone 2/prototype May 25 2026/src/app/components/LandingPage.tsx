import React, { useState } from "react";
import { useNavigate } from "react-router";
import {
  FileText,
  Clock,
  MapPin,
  Printer,
  Package,
  Palette,
  ArrowRight,
  CheckCircle2,
  Briefcase,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { Badge } from "./ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "./ui/dialog";
import logoImage from "figma:asset/32cd46dac3d06839e0db69b6c6ad22c9a8ac17a6.png";

export default function LandingPage() {
  const navigate = useNavigate();
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);

  // Load landing page content from localStorage or use defaults
  const getContent = () => {
    const saved = localStorage.getItem("landing_content");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        // Fall through to defaults
      }
    }
    return {
      heroTitle: "Print, Track, Succeed",
      heroSubtitle: "Your Printing Companion",
      heroDescription:
        "Upload, print, and track your documents with ease. Professional printing services designed for students and faculty.",
      feature1: "Upload documents instantly",
      feature2: "Real-time order tracking",
      feature3: "Secure payment verification",
      bwPrice: "1",
      colorPrice: "5",
      bindingPrice: "20",
      hoursMonFri: "8:00 AM - 6:00 PM",
      hoursSat: "9:00 AM - 4:00 PM",
      hoursSun: "Closed",
      locationCampus: "Palawan State University - Main Campus",
      locationRoom: "Room 4, TBI Building",
      locationBuilding: "Puerto Princesa City, 5300 Palawan",
      aboutTitle: "About DocuFy",
      aboutSubtitle: "Your printing companion",
      aboutBody:
        "DocuFy is a modern printing management system designed to make document printing and tracking easier for students, faculty, and staff. With our user-friendly platform, you can upload documents, place print orders, track your requests in real-time, and manage everything from a single dashboard. We're committed to providing fast, reliable, and affordable printing services to the academic community.",
    };
  };

  const content = getContent();

  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };

  return (
    <div className="min-h-screen bg-[#F2F7FF] relative overflow-hidden">
      {/* Decorative Background Elements */}
      <div className="fixed top-0 left-0 w-96 h-96 bg-[#1D73EC] rounded-full opacity-5 blur-3xl -translate-x-48 -translate-y-48 pointer-events-none" />
      <div className="fixed bottom-0 right-0 w-96 h-96 bg-[#10316B] rounded-full opacity-5 blur-3xl translate-x-48 translate-y-48 pointer-events-none" />
      <div className="fixed top-1/3 left-1/3 w-64 h-64 bg-[#1D73EC] rounded-full opacity-5 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="border-b border-gray-200 bg-white backdrop-blur-md sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img
              src={logoImage}
              alt="DocuFy Logo"
              className="w-12 h-12 rounded-full"
            />
            <div>
              <h1 className="text-xl font-bold text-[#1c1f26]">
                DocuFy
              </h1>
              <p className="text-xs text-gray-500">
                Your Printing Companion
              </p>
            </div>
          </div>

          <div className="flex items-center gap-8">
            <nav className="hidden md:flex items-center gap-6">
              <button
                onClick={() => scrollToSection("home")}
                className="text-[#1c1f26] hover:text-[#1D73EC] transition-colors font-medium"
              >
                Home
              </button>
              <button
                onClick={() => scrollToSection("services")}
                className="text-[#1c1f26] hover:text-[#1D73EC] transition-colors font-medium"
              >
                Services & Pricing
              </button>
              <button
                onClick={() => scrollToSection("shop-info")}
                className="text-[#1c1f26] hover:text-[#1D73EC] transition-colors font-medium"
              >
                Shop Info
              </button>
              <button
                onClick={() => scrollToSection("about")}
                className="text-[#1c1f26] hover:text-[#1D73EC] transition-colors font-medium"
              >
                About Us
              </button>
            </nav>

            <Button
              variant="outline"
              onClick={() => navigate("/login")}
              className="border-[#1D73EC] text-[#1D73EC] hover:bg-[#1D73EC] hover:text-white"
            >
              Log In
            </Button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section
        id="home"
        className="bg-white w-full py-12 sm:py-20 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#1D73EC]/20 text-[#1D73EC] rounded-full text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-[#1D73EC] rounded-full animate-pulse"></span>
                {content.heroSubtitle}
              </div>
              <h2 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-[#1c1f26] mb-6 leading-tight">
                {content.heroTitle.split(",")[0]},
                <br />
                <span className="text-[#1D73EC]">
                  {content.heroTitle.split(",")[1]?.trim()}
                </span>
              </h2>
              <p className="text-lg sm:text-xl text-gray-600 mb-8 max-w-xl">
                {content.heroDescription}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="bg-[#1D73EC] hover:bg-[#10316B] text-white shadow-lg hover:shadow-xl transition-all"
                  onClick={() => navigate("/signup")}
                >
                  Get Started{" "}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </div>

              {/* Features List */}
              <div className="mt-10 space-y-3">
                {[
                  content.feature1,
                  content.feature2,
                  content.feature3,
                ].map((feature, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 text-[#1c1f26]"
                  >
                    <CheckCircle2 className="w-5 h-5 text-[#1D73EC]" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="hidden lg:flex items-center justify-center">
              <div className="relative">
                <div className="w-96 h-96 bg-[#1D73EC] rounded-full flex items-center justify-center shadow-2xl">
                  <img
                    src={logoImage}
                    alt="DocuFy"
                    className="w-64 h-64 rounded-full"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Services & Pricing */}
      <section
        id="services"
        className="bg-[#F2F7FF] w-full py-12 sm:py-16 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h3 className="text-3xl sm:text-4xl font-bold text-[#1c1f26] mb-4">
              Services & Pricing
            </h3>
            <p className="text-lg text-gray-600">
              Affordable printing solutions for all your needs
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8">
            <Card className="p-8 bg-white shadow-lg rounded-2xl hover:shadow-2xl transition-all hover:scale-105 duration-200 border-2 border-[#F2F7FF] hover:border-[#1D73EC]">
              <div className="w-16 h-16 bg-[#F2F7FF] rounded-2xl flex items-center justify-center mb-6">
                <Printer className="w-8 h-8 text-[#1D73EC]" />
              </div>
              <h4 className="text-xl font-bold text-[#1c1f26] mb-3">
                Black & White Printing
              </h4>
              <p className="text-gray-600 mb-6">
                Standard document printing on various paper
                sizes
              </p>
              <div className="text-4xl font-bold text-[#1D73EC]">
                ₱{content.bwPrice}{" "}
                <span className="text-base font-normal text-gray-500">
                  / page
                </span>
              </div>
            </Card>

            <Card className="p-8 bg-[#1D73EC] text-white shadow-xl rounded-2xl hover:shadow-2xl transition-all hover:scale-105 duration-200 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -translate-y-12 translate-x-12" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-10 rounded-full translate-y-8 -translate-x-8" />
              <div className="relative z-10">
                <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
                  <Palette className="w-8 h-8 text-white" />
                </div>
                <div className="inline-block px-3 py-1 bg-white text-[#1D73EC] text-xs font-bold rounded-full mb-4">
                  POPULAR
                </div>
                <h4 className="text-xl font-bold mb-3">
                  Color Printing
                </h4>
                <p className="text-white/90 mb-6">
                  High-quality color prints for presentations
                  and projects
                </p>
                <div className="text-4xl font-bold">
                  ₱{content.colorPrice}{" "}
                  <span className="text-base font-normal text-white/80">
                    / page
                  </span>
                </div>
              </div>
            </Card>

            <Card className="p-8 bg-white shadow-lg rounded-2xl hover:shadow-2xl transition-all hover:scale-105 duration-200 border-2 border-[#F2F7FF] hover:border-[#1D73EC]">
              <div className="w-16 h-16 bg-[#F2F7FF] rounded-2xl flex items-center justify-center mb-6">
                <Package className="w-8 h-8 text-[#1D73EC]" />
              </div>
              <h4 className="text-xl font-bold text-[#1c1f26] mb-3">
                Binding & Finishing
              </h4>
              <p className="text-gray-600 mb-6">
                Professional binding, stapling, and finishing
                services
              </p>
              <div className="text-4xl font-bold text-[#1D73EC]">
                ₱{content.bindingPrice}+{" "}
                <span className="text-base font-normal text-gray-500">
                  varies
                </span>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Shop Info */}
      <section
        id="shop-info"
        className="bg-white w-full py-12 sm:py-16 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h3 className="text-3xl sm:text-4xl font-bold text-[#1c1f26] mb-4">
              Shop Info
            </h3>
            <p className="text-lg text-gray-600">
              Visit us during our operating hours
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <Card className="p-8 bg-white border-2 border-[#1D73EC] shadow-xl rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#F2F7FF] rounded-full -translate-y-16 translate-x-16" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-[#F2F7FF] rounded-full translate-y-12 -translate-x-12" />
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-[#1D73EC] rounded-2xl flex items-center justify-center flex-shrink-0">
                    <Clock className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold mb-4 text-[#1c1f26]">
                      Shop Hours
                    </h4>
                    <div className="space-y-3 text-gray-700 text-lg">
                      <p>
                        <span className="font-semibold text-[#1D73EC]">
                          Monday - Friday:
                        </span>{" "}
                        {content.hoursMonFri}
                      </p>
                      <p>
                        <span className="font-semibold text-[#1D73EC]">
                          Saturday:
                        </span>{" "}
                        {content.hoursSat}
                      </p>
                      <p>
                        <span className="font-semibold text-[#1D73EC]">
                          Sunday:
                        </span>{" "}
                        {content.hoursSun}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-8 bg-white border-2 border-[#1D73EC] shadow-xl rounded-2xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-32 h-32 bg-[#F2F7FF] rounded-full -translate-y-16 -translate-x-16" />
              <div className="absolute bottom-0 right-0 w-24 h-24 bg-[#F2F7FF] rounded-full translate-y-12 translate-x-12" />
              <div className="relative z-10">
                <div className="flex items-start gap-4">
                  <div className="w-14 h-14 bg-[#1D73EC] rounded-2xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-7 h-7 text-white" />
                  </div>
                  <div>
                    <h4 className="text-2xl font-bold mb-4 text-[#1c1f26]">
                      Location
                    </h4>
                    <div className="space-y-3 text-gray-700 text-m">
                      <p className="font-semibold text-[#1D73EC]">
                        {content.locationCampus}
                      </p>
                      <p>{content.locationRoom}</p>
                      <p>{content.locationBuilding}</p>
                    </div>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Job Openings Section */}
      <section
        id="jobs"
        className="bg-white w-full py-12 sm:py-16 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-700 rounded-full text-sm font-medium mb-4">
              <span className="w-2 h-2 bg-white border-2 border-blue-200 rounded-full animate-pulse"></span>
              We're Hiring!
            </div>
            <h3 className="text-3xl sm:text-4xl font-bold text-[#1c1f26] mb-4">
              Job Openings
            </h3>
            <p className="text-lg text-gray-600">
              Join our team
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 lg:gap-8">
            <Card className="p-6 bg-white border border-gray-200 hover:border-[#1D73EC] shadow-sm rounded-xl hover:shadow-md transition-all">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-[#1D73EC] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-lg font-bold text-[#1c1f26]">
                      Part-Time Print Shop Assistant
                    </h4>
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Assist customers with printing needs,
                    operate printing equipment, and handle basic
                    administrative tasks.
                  </p>
                  <div className="space-y-1.5 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold text-[#1D73EC]">
                        Salary:
                      </span>{" "}
                      ₱150/hour
                    </p>
                    <p>
                      <span className="font-semibold text-[#1D73EC]">
                        Schedule:
                      </span>{" "}
                      Mon-Fri, 3-4 hours/day
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => navigate("/signup")}
                className="w-full bg-[#1D73EC] hover:bg-[#10316B] text-white"
              >
                Apply Now
              </Button>
            </Card>

            <Card className="p-6 bg-white border border-gray-200 hover:border-[#1D73EC] shadow-sm rounded-xl hover:shadow-md transition-all">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 bg-[#1D73EC] rounded-lg flex items-center justify-center flex-shrink-0">
                  <Briefcase className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h4 className="text-lg font-bold text-[#1c1f26]">
                      Student Printing Technician
                    </h4>
                    <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100 text-xs">
                      Active
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-600 mb-4 leading-relaxed">
                    Manage printing queue, troubleshoot printer
                    issues, and ensure quality output.
                  </p>
                  <div className="space-y-1.5 text-sm text-gray-700">
                    <p>
                      <span className="font-semibold text-[#1D73EC]">
                        Salary:
                      </span>{" "}
                      ₱180/hour
                    </p>
                    <p>
                      <span className="font-semibold text-[#1D73EC]">
                        Schedule:
                      </span>{" "}
                      Flexible weekday shifts
                    </p>
                  </div>
                </div>
              </div>
              <Button
                onClick={() => navigate("/signup")}
                className="w-full bg-[#1D73EC] hover:bg-[#10316B] text-white"
              >
                Apply Now
              </Button>
            </Card>
          </div>
        </div>
      </section>

      {/* About Us Section */}
      <section
        id="about"
        className="bg-[#F2F7FF] w-full py-12 sm:py-16 relative z-10"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-12">
            <h3 className="text-3xl sm:text-4xl font-bold text-[#1c1f26] mb-4">
              {content.aboutTitle || "About DocuFy"}
            </h3>
            <p className="text-lg text-gray-600">
              {content.aboutSubtitle ||
                "Your printing companion"}
            </p>
          </div>
          <Card className="p-12 bg-[#1D73EC] text-white shadow-2xl rounded-3xl relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -translate-y-12 translate-x-12" />
            <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-10 rounded-full translate-y-8 -translate-x-8" />
            <div className="relative z-10">
              <div className="max-w-3xl mx-auto">
                <p className="text-xl text-center leading-relaxed text-white">
                  {content.aboutBody ||
                    "DocuFy is a modern printing management system designed to make document printing and tracking easier for students, faculty, and staff. With our user-friendly platform, you can upload documents, place print orders, track your requests in real-time, and manage everything from a single dashboard. We're committed to providing fast, reliable, and affordable printing services to the academic community."}
                </p>
              </div>
            </div>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white/90 backdrop-blur-md relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
            <div className="flex items-center gap-3">
              <img
                src={logoImage}
                alt="DocuFy Logo"
                className="w-10 h-10 rounded-full"
              />
              <div>
                <h1 className="font-bold text-[#1c1f26]">
                  DocuFy
                </h1>
                <p className="text-xs text-gray-500">
                  Your Printing Companion
                </p>
              </div>
            </div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 md:gap-8">
              <div className="flex flex-col sm:flex-row gap-4 text-sm text-gray-600">
                <button
                  onClick={() => setShowTerms(true)}
                  className="hover:text-[#1D73EC] transition-colors text-left"
                >
                  Terms & Conditions
                </button>
                <button
                  onClick={() => setShowPrivacy(true)}
                  className="hover:text-[#1D73EC] transition-colors text-left"
                >
                  Privacy Policy
                </button>
                <button className="hover:text-[#1D73EC] transition-colors text-left">
                  Contact Us
                </button>
              </div>

              <p className="text-gray-600 text-sm">
                &copy; 2026 DocuFy PSMS. All rights reserved.
              </p>
            </div>
          </div>
        </div>
      </footer>

      {/* Terms and Conditions Modal */}
      <Dialog open={showTerms} onOpenChange={setShowTerms}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#10316B]">
              Terms and Conditions
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Last updated: April 27, 2026
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                1. Acceptance of Terms
              </h3>
              <p>
                By accessing and using DocuFy PSMS (Print Shop
                Management System), you accept and agree to be
                bound by the terms and provision of this
                agreement. If you do not agree to abide by the
                above, please do not use this service.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                2. Use License
              </h3>
              <p>
                Permission is granted to use DocuFy PSMS for
                personal and academic purposes within Palawan
                State University. This license shall
                automatically terminate if you violate any of
                these restrictions and may be terminated by
                DocuFy at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                3. Service Description
              </h3>
              <p>
                DocuFy PSMS provides printing services for
                students and faculty of Palawan State
                University. Services include document printing,
                color printing, binding, and related print shop
                services. We reserve the right to modify,
                suspend, or discontinue any aspect of the
                service at any time.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                4. User Accounts
              </h3>
              <p>
                You are responsible for maintaining the
                confidentiality of your account credentials. You
                agree to accept responsibility for all
                activities that occur under your account. You
                must notify us immediately of any unauthorized
                use of your account.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                5. Payment Terms
              </h3>
              <p>
                All payments must be made through the approved
                payment methods (GCash or Cash on Pickup).
                Prices are subject to change without notice.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                6. Content Restrictions
              </h3>
              <p>
                Users may not upload, print, or distribute
                content that is illegal, offensive, defamatory,
                or infringes on intellectual property rights.
                DocuFy reserves the right to refuse service for
                any content deemed inappropriate.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                7. Limitation of Liability
              </h3>
              <p>
                DocuFy PSMS shall not be liable for any damages
                arising from the use or inability to use the
                service, including but not limited to printing
                errors, delays, or data loss.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                8. Modifications to Terms
              </h3>
              <p>
                DocuFy reserves the right to revise these terms
                at any time. Continued use of the service
                following any changes constitutes acceptance of
                those changes.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                9. Contact Information
              </h3>
              <p>
                For questions about these Terms and Conditions,
                please contact us at support@docufy.com or visit
                our office at Room 4, Palawan State University -
                Main Campus, TBI Building, Puerto Princesa City,
                5300 Palawan.
              </p>
            </section>
          </div>
        </DialogContent>
      </Dialog>

      {/* Privacy Policy Modal */}
      <Dialog open={showPrivacy} onOpenChange={setShowPrivacy}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#10316B]">
              Privacy Policy
            </DialogTitle>
            <DialogDescription className="text-gray-600">
              Last updated: April 27, 2026
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm text-gray-700 leading-relaxed">
            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                1. Information We Collect
              </h3>
              <p>
                We collect information that you provide directly
                to us, including:
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>
                  Name, email address, and contact information
                </li>
                <li>University identification details</li>
                <li>
                  Payment information and transaction history
                </li>
                <li>Documents uploaded for printing</li>
                <li>Order history and preferences</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                2. How We Use Your Information
              </h3>
              <p>We use the information we collect to:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Process and fulfill your print orders</li>
                <li>Send order confirmations and updates</li>
                <li>Process payments and prevent fraud</li>
                <li>
                  Improve our services and user experience
                </li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                3. Data Security
              </h3>
              <p>
                We implement appropriate technical and
                organizational measures to protect your personal
                information against unauthorized access,
                alteration, disclosure, or destruction. However,
                no method of transmission over the internet is
                100% secure.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                4. Document Handling
              </h3>
              <p>Documents uploaded to our system are:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>
                  Stored securely and accessed only by
                  authorized staff
                </li>
                <li>
                  Automatically deleted 30 days after order
                  completion
                </li>
                <li>
                  Never shared with third parties without your
                  consent
                </li>
                <li>
                  Processed only for the purpose of fulfilling
                  your order
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                5. Cookies and Tracking
              </h3>
              <p>
                We use cookies and similar tracking technologies
                to track activity on our service and hold
                certain information. You can instruct your
                browser to refuse all cookies or to indicate
                when a cookie is being sent.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                6. Information Sharing
              </h3>
              <p>
                We do not sell, trade, or rent your personal
                information to third parties. We may share your
                information only in the following circumstances:
              </p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>With your explicit consent</li>
                <li>To comply with legal obligations</li>
                <li>To protect our rights and prevent fraud</li>
                <li>
                  With service providers who assist in our
                  operations
                </li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                7. Your Rights
              </h3>
              <p>You have the right to:</p>
              <ul className="list-disc ml-6 mt-2 space-y-1">
                <li>Access your personal information</li>
                <li>Correct inaccurate data</li>
                <li>Request deletion of your data</li>
                <li>
                  Object to processing of your information
                </li>
                <li>Export your data in a portable format</li>
              </ul>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                8. Data Retention
              </h3>
              <p>
                We retain your personal information only for as
                long as necessary to fulfill the purposes
                outlined in this privacy policy, unless a longer
                retention period is required by law.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                9. Children's Privacy
              </h3>
              <p>
                Our service is intended for university students
                and faculty. We do not knowingly collect
                personal information from individuals under 18
                years of age without parental consent.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                10. Changes to This Policy
              </h3>
              <p>
                We may update our Privacy Policy from time to
                time. We will notify you of any changes by
                posting the new Privacy Policy on this page and
                updating the "Last updated" date.
              </p>
            </section>

            <section>
              <h3 className="font-semibold text-[#10316B] mb-2">
                11. Contact Us
              </h3>
              <p>
                If you have any questions about this Privacy
                Policy, please contact us at:
              </p>
              <ul className="list-none ml-0 mt-2 space-y-1">
                <li>Email: support@docufy.com</li>
                <li>Phone: +63 123 456 7890</li>
                <li>
                  Address: Palawan State University - Main
                  Campus, TBI Building, Room 4, Puerto Princesa
                  City, 5300 Palawan
                </li>
              </ul>
            </section>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}