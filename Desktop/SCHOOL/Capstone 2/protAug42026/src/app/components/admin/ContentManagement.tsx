import React, { useState } from "react";
import { useNavigate } from "react-router";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Boxes,
  Users,
  FileText,
  UserPlus,
  Settings,
  Save,
  Briefcase,
  Eye,
  CheckCircle,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "../ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";

const menuItems = adminMenuItems;

interface LandingPageContent {
  heroTitle: string;
  heroSubtitle: string;
  heroDescription: string;
  feature1: string;
  feature2: string;
  feature3: string;
  bwPrice: string;
  colorPrice: string;
  bindingPrice: string;
  hoursMonFri: string;
  hoursSat: string;
  hoursSun: string;
  locationCampus: string;
  locationRoom: string;
  locationBuilding: string;
  aboutTitle: string;
  aboutSubtitle: string;
  aboutBody: string;
}

export default function ContentManagement() {
  const [landingContent, setLandingContent] =
    useState<LandingPageContent>(() => {
      const saved = localStorage.getItem("landing_content");
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Fall through to default
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
        locationCampus:
          "Palawan State University - Main Campus",
        locationRoom: "Ground Floor, Room 105",
        locationBuilding: "Near the Library Entrance",
        aboutTitle: "About DocuFy",
        aboutSubtitle: "Your printing companion",
        aboutBody:
          "DocuFy is a modern printing management system designed to make document printing and tracking easier for students, faculty, and staff. With our user-friendly platform, you can upload documents, place print orders, track your requests in real-time, and manage everything from a single dashboard. We're committed to providing fast, reliable, and affordable printing services to the academic community.",
      };
    });

  const [showPreview, setShowPreview] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);

  const saveLandingContent = () => {
    localStorage.setItem(
      "landing_content",
      JSON.stringify(landingContent),
    );
    setShowSuccessDialog(true);
  };

  return (
    <Layout
      menuItems={menuItems}
      title="Content Management"
      showBackButton
      backButtonPath="/admin/dashboard"
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Content Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage landing page content
          </p>
        </div>

        <Tabs defaultValue="landing" className="w-full">
          <TabsList className="grid w-full grid-cols-1">
            <TabsTrigger value="landing">
              Landing Page
            </TabsTrigger>
          </TabsList>

          <TabsContent value="landing" className="space-y-6">
            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6"> Header Section</h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="heroTitle">Main Title</Label>
                  <Input
                    id="heroTitle"
                    value={landingContent.heroTitle}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        heroTitle: e.target.value,
                      })
                    }
                    placeholder="Print, Track, Succeed"
                  />
                </div>

                <div>
                  <Label htmlFor="heroSubtitle">
                    Subtitle (Badge Text)
                  </Label>
                  <Input
                    id="heroSubtitle"
                    value={landingContent.heroSubtitle}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        heroSubtitle: e.target.value,
                      })
                    }
                    placeholder="Your Printing Companion"
                  />
                </div>

                <div>
                  <Label htmlFor="heroDescription">
                    Description
                  </Label>
                  <Textarea
                    id="heroDescription"
                    value={landingContent.heroDescription}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        heroDescription: e.target.value,
                      })
                    }
                    placeholder="Upload, print, and track your documents with ease..."
                    rows={2}
                  />
                </div>

                <div>
                  <Label>Features List (3 items)</Label>
                  <div className="space-y-2">
                    <Input
                      value={landingContent.feature1}
                      onChange={(e) =>
                        setLandingContent({
                          ...landingContent,
                          feature1: e.target.value,
                        })
                      }
                      placeholder="Feature 1"
                    />
                    <Input
                      value={landingContent.feature2}
                      onChange={(e) =>
                        setLandingContent({
                          ...landingContent,
                          feature2: e.target.value,
                        })
                      }
                      placeholder="Feature 2"
                    />
                    <Input
                      value={landingContent.feature3}
                      onChange={(e) =>
                        setLandingContent({
                          ...landingContent,
                          feature3: e.target.value,
                        })
                      }
                      placeholder="Feature 3"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Services & Pricing
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="bwPrice">
                    Black & White (₱ per page)
                  </Label>
                  <Input
                    id="bwPrice"
                    type="number"
                    step="1"
                    value={landingContent.bwPrice}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        bwPrice: e.target.value,
                      })
                    }
                    placeholder="1"
                  />
                </div>

                <div>
                  <Label htmlFor="colorPrice">
                    Color Printing (₱ per page)
                  </Label>
                  <Input
                    id="colorPrice"
                    type="number"
                    step="1"
                    value={landingContent.colorPrice}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        colorPrice: e.target.value,
                      })
                    }
                    placeholder="5"
                  />
                </div>

                <div>
                  <Label htmlFor="bindingPrice">
                    Binding & Finishing (₱ starting at)
                  </Label>
                  <Input
                    id="bindingPrice"
                    type="number"
                    step="1"
                    value={landingContent.bindingPrice}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        bindingPrice: e.target.value,
                      })
                    }
                    placeholder="20"
                  />
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                Shop Information
              </h2>
              <div className="space-y-4">
                <div>
                  <Label>Shop Hours</Label>
                  <div className="space-y-2 mt-2">
                    <div>
                      <Label
                        htmlFor="hoursMonFri"
                        className="text-sm text-gray-600"
                      >
                        Monday - Friday
                      </Label>
                      <Input
                        id="hoursMonFri"
                        value={landingContent.hoursMonFri}
                        onChange={(e) =>
                          setLandingContent({
                            ...landingContent,
                            hoursMonFri: e.target.value,
                          })
                        }
                        placeholder="8:00 AM - 6:00 PM"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="hoursSat"
                        className="text-sm text-gray-600"
                      >
                        Saturday
                      </Label>
                      <Input
                        id="hoursSat"
                        value={landingContent.hoursSat}
                        onChange={(e) =>
                          setLandingContent({
                            ...landingContent,
                            hoursSat: e.target.value,
                          })
                        }
                        placeholder="9:00 AM - 4:00 PM"
                      />
                    </div>
                    <div>
                      <Label
                        htmlFor="hoursSun"
                        className="text-sm text-gray-600"
                      >
                        Sunday
                      </Label>
                      <Input
                        id="hoursSun"
                        value={landingContent.hoursSun}
                        onChange={(e) =>
                          setLandingContent({
                            ...landingContent,
                            hoursSun: e.target.value,
                          })
                        }
                        placeholder="Closed"
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <Label>Location</Label>
                  <div className="space-y-2 mt-2">
                    <Input
                      value={landingContent.locationCampus}
                      onChange={(e) =>
                        setLandingContent({
                          ...landingContent,
                          locationCampus: e.target.value,
                        })
                      }
                      placeholder="Palawan State University - Main Campus"
                    />
                    <Input
                      value={landingContent.locationRoom}
                      onChange={(e) =>
                        setLandingContent({
                          ...landingContent,
                          locationRoom: e.target.value,
                        })
                      }
                      placeholder="Ground Floor, Room 105"
                    />
                    <Input
                      value={landingContent.locationBuilding}
                      onChange={(e) =>
                        setLandingContent({
                          ...landingContent,
                          locationBuilding: e.target.value,
                        })
                      }
                      placeholder="Near the Library Entrance"
                    />
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">
                About DocuFy Section
              </h2>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="aboutTitle">Section Title</Label>
                  <Input
                    id="aboutTitle"
                    value={landingContent.aboutTitle}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        aboutTitle: e.target.value,
                      })
                    }
                    placeholder="About DocuFy"
                  />
                </div>
                <div>
                  <Label htmlFor="aboutSubtitle">Section Subtitle</Label>
                  <Input
                    id="aboutSubtitle"
                    value={landingContent.aboutSubtitle}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        aboutSubtitle: e.target.value,
                      })
                    }
                    placeholder="Your printing companion"
                  />
                </div>
                <div>
                  <Label htmlFor="aboutBody">Section Body Text</Label>
                  <Textarea
                    id="aboutBody"
                    value={landingContent.aboutBody}
                    onChange={(e) =>
                      setLandingContent({
                        ...landingContent,
                        aboutBody: e.target.value,
                      })
                    }
                    placeholder="Describe what DocuFy is and what services it provides..."
                    rows={6}
                  />
                </div>
              </div>
            </Card>

            <div className="flex justify-end gap-3">
              <Button
                variant="outline"
                onClick={() => setShowPreview(true)}
                className="border-[#2F6FD6] text-[#2F6FD6] hover:bg-[#2F6FD6] hover:text-white"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview Changes
              </Button>
              <Button
                onClick={saveLandingContent}
                className="bg-[#2F6FD6] hover:bg-[#1e5bb8]"
              >
                <Save className="w-4 h-4 mr-2" />
                Save All Landing Page Changes
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold text-[#10316B]">
              Preview Landing Page Changes
            </DialogTitle>
            <DialogDescription>
              This is how your changes will appear on the landing page
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-6 py-4">
            {/* Hero Section Preview */}
            <div className="border rounded-lg p-6 bg-white">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Hero Section
              </h3>
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-50 border border-[#1D73EC]/20 text-[#1D73EC] rounded-full text-sm font-medium">
                  <span className="w-2 h-2 bg-[#1D73EC] rounded-full"></span>
                  {landingContent.heroSubtitle}
                </div>
                <h2 className="text-3xl font-bold text-[#1c1f26]">
                  {landingContent.heroTitle}
                </h2>
                <p className="text-gray-600">
                  {landingContent.heroDescription}
                </p>
                <div className="space-y-1 pt-2">
                  {[
                    landingContent.feature1,
                    landingContent.feature2,
                    landingContent.feature3,
                  ].map((feature, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm">
                      <CheckCircle className="w-4 h-4 text-[#1D73EC]" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Services Preview */}
            <div className="border rounded-lg p-6 bg-gray-50">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Services & Pricing
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1">
                    Black & White
                  </p>
                  <p className="text-2xl font-bold text-[#1D73EC]">
                    ₱{landingContent.bwPrice}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1">Color</p>
                  <p className="text-2xl font-bold text-[#1D73EC]">
                    ₱{landingContent.colorPrice}
                  </p>
                </div>
                <div className="bg-white p-4 rounded-lg border">
                  <p className="text-xs text-gray-500 mb-1">Binding</p>
                  <p className="text-2xl font-bold text-[#1D73EC]">
                    ₱{landingContent.bindingPrice}+
                  </p>
                </div>
              </div>
            </div>

            {/* Shop Info Preview */}
            <div className="border rounded-lg p-6 bg-white">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">
                Shop Information
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="font-semibold text-[#1D73EC] mb-2">
                    Shop Hours
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>
                      <strong>Mon-Fri:</strong>{" "}
                      {landingContent.hoursMonFri}
                    </p>
                    <p>
                      <strong>Saturday:</strong>{" "}
                      {landingContent.hoursSat}
                    </p>
                    <p>
                      <strong>Sunday:</strong> {landingContent.hoursSun}
                    </p>
                  </div>
                </div>
                <div>
                  <p className="font-semibold text-[#1D73EC] mb-2">
                    Location
                  </p>
                  <div className="space-y-1 text-sm">
                    <p>{landingContent.locationCampus}</p>
                    <p>{landingContent.locationRoom}</p>
                    <p>{landingContent.locationBuilding}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* About DocuFy Preview */}
            <div className="border rounded-lg p-6 bg-[#1D73EC] text-white">
              <h3 className="text-sm font-semibold text-blue-200 uppercase mb-3">
                About DocuFy Section
              </h3>
              <h2 className="text-2xl font-bold mb-2">
                {landingContent.aboutTitle}
              </h2>
              <p className="text-blue-100 mb-3">
                {landingContent.aboutSubtitle}
              </p>
              <p className="text-sm text-blue-50 leading-relaxed">
                {landingContent.aboutBody}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPreview(false)}
            >
              Close Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success Dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center justify-center mb-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-green-600" />
              </div>
            </div>
            <DialogTitle className="text-center text-2xl">
              Changes Saved Successfully!
            </DialogTitle>
            <DialogDescription className="text-center">
              Your landing page content has been updated and will be
              reflected on the live page.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowSuccessDialog(false)}
              className="flex-1"
            >
              Exit
            </Button>
            <Button
              onClick={() => setShowSuccessDialog(false)}
              className="flex-1 bg-[#2F6FD6] hover:bg-[#1e5bb8]"
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}