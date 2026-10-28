import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router";
import {
  Clock,
  MapPin,
  Printer,
  ArrowRight,
  CheckCircle2,
  Briefcase,
  Palette,
  Package,
  CloudUpload,
  ShieldCheck,
  LayoutDashboard,
  User,
  LogOut,
  Mail,
  Facebook,
  MessageCircle,
  ChevronDown,
  Menu,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Card } from "./ui/card";
import { jobsStore } from "../utils/jobsStore";
import { pricingStore, type PricingMatrix } from "../utils/pricingStore";
import { shopPhotosStore, type ShopPhoto } from "../utils/shopPhotosStore";
import { landingContentStore, DEFAULT_MAP_EMBED, type LandingPageContent } from "../utils/landingContentStore";
import { useAuth } from "../contexts/AuthContext";
import { usePageTitle } from "../hooks/usePageTitle";
import { usePresence } from "./ui/use-presence";
import { ConfirmationDialog } from "./ui/confirmation-dialog";
import ShopStatusBanner from "./shared/ShopStatusBanner";
import LegalPolicyDialog from "./shared/LegalPolicyDialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "./ui/dialog";
// System logo is centralized in the logo store so an admin-uploaded logo
// applies everywhere. `logo` below is the live value (default or override).
import { useLogo } from "../hooks/useLogo";

export default function LandingPage({
  contentOverride,
}: {
  contentOverride?: LandingPageContent;
}) {
  const navigate = useNavigate();
  const logo = useLogo();
  const { user, logout } = useAuth();
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  // The section links were hidden below md with no replacement, so a phone
  // visitor could only scroll and hope (F29).
  const [isNavOpen, setIsNavOpen] = useState(false);
  usePageTitle("Docufy PSMS - Printing Shop Management System", false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profilePresence = usePresence(isProfileOpen, 200);
  const userInitials = user
    ? (user.name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? "").join("") || "U")
    : "U";
  const [showTerms, setShowTerms] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [matrix, setMatrix] = useState<PricingMatrix>(pricingStore.getMatrix());
  const [activeSection, setActiveSection] = useState("home");
  const servicesScrollerRef = useRef<HTMLDivElement>(null);
  const [activeServiceCard, setActiveServiceCard] = useState(0);
  const [shopLocationOpen, setShopLocationOpen] = useState(false);
  const [showShopPhotos, setShowShopPhotos] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<string | null>(null);
  const [shopPhotos, setShopPhotos] = useState<ShopPhoto[]>(shopPhotosStore.getPhotos());
  const [jobsDropdownOpen, setJobsDropdownOpen] = useState(false);
  const jobsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const load = () => setShopPhotos(shopPhotosStore.getPhotos());
    return shopPhotosStore.subscribe(load);
  }, []);

  useEffect(() => {
    const load = () => setMatrix(pricingStore.getMatrix());
    return pricingStore.subscribe(load);
  }, []);

  // Close the header profile dropdown when clicking outside of it.
  useEffect(() => {
    if (!isProfileOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isProfileOpen]);

  // Close the "Join Our Team" jobs dropdown when clicking outside of it.
  useEffect(() => {
    if (!jobsDropdownOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (jobsDropdownRef.current && !jobsDropdownRef.current.contains(event.target as Node)) {
        setJobsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [jobsDropdownOpen]);

  const [jobs, setJobs] = useState<any[]>(() => jobsStore.getActiveJobs());
  useEffect(() => {
    const load = () => setJobs(jobsStore.getActiveJobs());
    return jobsStore.subscribe(load);
  }, []);

  const [content, setContent] = useState<LandingPageContent>(() =>
    contentOverride ?? landingContentStore.getContent(),
  );
  useEffect(() => {
    if (contentOverride) {
      setContent(contentOverride);
      return;
    }
    const load = () => setContent(landingContentStore.getContent());
    return landingContentStore.subscribe(load);
  }, [contentOverride]);

  // Footer About Docufy blurb comes straight from the editable content body.
  const footerAboutShort = content.aboutBody;

  const scrollToSection = (id: string) => {
    const element = getSectionEl(id);
    if (!element) return;
    const scrollRoot = getScrollRoot();
    const headerOffset = 80;
    if (scrollRoot) {
      const top =
        element.getBoundingClientRect().top -
        scrollRoot.getBoundingClientRect().top +
        scrollRoot.scrollTop -
        headerOffset;
      scrollRoot.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    } else {
      const top = element.getBoundingClientRect().top + window.scrollY - headerOffset;
      window.scrollTo({ top: Math.max(0, top), behavior: "smooth" });
    }
  };

  // Resolve a section element scoped to THIS landing page instance. Scoping to
  // the root avoids duplicate-ID collisions when the landing page is previewed
  // inside the admin editor (the editor page has its own #services/#shop-info
  // anchors that would otherwise be returned by document.getElementById).
  const getSectionEl = (id: string): HTMLElement | null =>
    landingRootRef.current?.querySelector(`[id="${id}"]`) ?? null;

  // Find the element that actually scrolls the landing page: the window on the
  // live page, or the nested overflow-y-auto container when the landing page is
  // rendered inside the Landing Page editor's preview overlay.
  const getScrollRoot = (): HTMLElement | null => {
    let node = landingRootRef.current?.parentElement ?? null;
    while (node) {
      const style = getComputedStyle(node);
      const canScrollY =
        /(auto|scroll|overlay)/.test(style.overflowY) &&
        node.scrollHeight > node.clientHeight;
      if (canScrollY) return node;
      node = node.parentElement;
    }
    return null;
  };

  // Scroll-spy: highlight the header nav item for the section currently in view.
  // The listener attaches to the actual scroll container so it also works when
  // the landing page is rendered inside a scrollable preview overlay (the admin
  // Landing Page editor preview scrolls a nested div, not the window).
  const landingRootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const sectionIds = ["home", "services", "shop-info", "jobs", "footer"];

    const scrollRoot = getScrollRoot();

    const updateActive = () => {
      const containerTop = scrollRoot
        ? scrollRoot.getBoundingClientRect().top
        : 0;
      const containerHeight = scrollRoot
        ? scrollRoot.clientHeight
        : window.innerHeight;
      const line = containerTop + containerHeight * 0.35;
      let current = sectionIds[0];
      for (const id of sectionIds) {
        const el = getSectionEl(id);
        if (!el) continue;
        if (el.getBoundingClientRect().top <= line) current = id;
      }
      setActiveSection(current);
    };

    updateActive();
    const target: EventTarget = scrollRoot ?? window;
    target.addEventListener("scroll", updateActive, { passive: true });
    window.addEventListener("resize", updateActive);
    return () => {
      target.removeEventListener("scroll", updateActive);
      window.removeEventListener("resize", updateActive);
    };
  }, []);

  // Track the active card in the mobile services carousel from its scroll position.
  useEffect(() => {
    const el = servicesScrollerRef.current;
    if (!el) return;
    const update = () => {
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-services-card]"));
      if (cards.length === 0) return;
      const center = el.scrollLeft + el.clientWidth / 2;
      let closest = 0;
      let minDist = Infinity;
      cards.forEach((card, i) => {
        const box = card.getBoundingClientRect();
        const elBox = el.getBoundingClientRect();
        const dist = Math.abs(box.left - elBox.left + box.width / 2 - el.clientWidth / 2);
        if (dist < minDist) {
          minDist = dist;
          closest = i;
        }
      });
      setActiveServiceCard(closest);
    };
    update();
    el.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      el.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Auto-advance the mobile services carousel in an endless loop.
  // Desktop renders a static grid (no horizontal scroll), so it is skipped.
  useEffect(() => {
    const el = servicesScrollerRef.current;
    if (!el) return;
    const timer = window.setInterval(() => {
      if (el.scrollWidth <= el.clientWidth) return;
      const cards = Array.from(el.querySelectorAll<HTMLElement>("[data-services-card]"));
      if (cards.length === 0) return;
      const next = (activeServiceCard + 1) % cards.length;
      const card = cards[next];
      el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
    }, 4500);
    return () => window.clearInterval(timer);
  }, [activeServiceCard]);

  const navItems = [
    { id: "home", label: "Home" },
    { id: "services", label: "Services & Pricing" },
    { id: "shop-info", label: "Shop Info" },
    { id: "jobs", label: "Join Our Team" },
    { id: "footer", label: "Contact" },
  ];

  return (
    <div ref={landingRootRef} className="min-h-screen bg-[#F2F7FF] relative overflow-clip animate-in fade-in duration-200">
      {/* Decorative Background Elements */}
      <div className="absolute top-0 left-0 w-96 h-96 bg-[#1668D9] rounded-full opacity-5 blur-3xl -translate-x-48 -translate-y-48 pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-96 h-96 bg-[#10316B] rounded-full opacity-5 blur-3xl translate-x-48 translate-y-48 pointer-events-none" />
      <div className="absolute top-1/3 left-1/3 w-64 h-64 bg-[#1668D9] rounded-full opacity-5 blur-3xl pointer-events-none" />

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 border-b border-gray-200 bg-white backdrop-blur-md z-50 shadow-sm">
        <div className="mx-auto w-full max-w-7xl min-[1366px]:max-w-[93.7vw] px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between gap-3">
          <div className="flex min-w-0 items-center gap-2">
            <img
              src={logo}
              alt="Docufy Logo"
              className="h-[clamp(2.5rem,3.51vw,6rem)] w-[clamp(2.5rem,3.51vw,6rem)] rounded-full"
            />
            <div>
              <h1 className="truncate text-[clamp(1rem,1.46vw,2.25rem)] font-bold text-[#1c1f26]">
                Docufy PSMS
              </h1>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2 sm:gap-8">
            <nav aria-label="Landing sections" className="hidden md:flex items-center gap-6">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <a
                    key={item.id}
                    href={`#${item.id}`}
                    aria-current={isActive ? "location" : undefined}
                    onClick={(e) => {
                      e.preventDefault();
                      setActiveSection(item.id);
                      scrollToSection(item.id);
                    }}
                    className={`group relative pb-1 font-medium transition-colors duration-200 ${
                      isActive
                        ? "text-[#1668D9]"
                        : "text-[#1c1f26] hover:text-[#1668D9]"
                    }`}
                  >
                    {item.label}
                    <span
                      className={`absolute bottom-0 left-0 right-0 h-[2.5px] rounded-full bg-[#1668D9] transition-transform duration-300 ease-out ${
                        isActive
                          ? "scale-x-100"
                          : "scale-x-0 group-hover:scale-x-100"
                      }`}
                    />
                  </a>
                );
              })}
            </nav>

            <button
              type="button"
              onClick={() => setIsNavOpen((open) => !open)}
              aria-label={isNavOpen ? "Close section menu" : "Open section menu"}
              aria-expanded={isNavOpen}
              aria-controls="landing-mobile-nav"
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 text-[#1c1f26] transition-colors hover:bg-gray-50 md:hidden"
            >
              {isNavOpen ? (
                <X className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Menu className="h-5 w-5" aria-hidden="true" />
              )}
            </button>

            {user ? (
              <div className="relative shrink-0" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileOpen((prev) => !prev)}
                  aria-label="Open profile"
                  aria-expanded={isProfileOpen}
                  aria-haspopup="menu"
                  className="rounded-full transition-all duration-200 hover:scale-105 hover:ring-2 hover:ring-[#1668D9]/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9] focus-visible:ring-offset-2"
                >
                  <div className="h-10 w-10 overflow-hidden rounded-full bg-[#1668D9] text-white shadow-sm flex items-center justify-center font-bold text-xs">
                    {user.profileImage ? (
                      <img src={user.profileImage} alt={user.name} className="h-full w-full object-cover" />
                    ) : (
                      userInitials
                    )}
                  </div>
                </button>

                {profilePresence && (
                  <div className={`absolute right-0 top-full z-50 mt-2 w-52 rounded-xl border border-gray-100 bg-white py-1.5 shadow-2xl ${profilePresence.isClosing ? "animate-out fade-out-0 zoom-out-95 slide-out-to-top-2 duration-200 pointer-events-none" : "animate-in fade-in-0 zoom-in-95 slide-in-from-top-2 duration-200"}`}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate(`/${user.role}/dashboard`);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <LayoutDashboard className="h-4 w-4" /> Go to Dashboard
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        navigate(`/${user.role}/profile`);
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm font-medium text-gray-700 hover:bg-gray-50"
                    >
                      <User className="h-4 w-4" /> Edit Profile
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileOpen(false);
                        setShowLogoutConfirm(true);
                      }}
                      className="flex w-full items-center gap-3 border-t border-gray-100 px-4 py-2.5 text-left text-sm font-medium text-red-600 hover:bg-red-50"
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => navigate("/login")}
                className="h-9 rounded-lg border-[1.5px] border-[#1668D9] bg-white px-3 text-xs font-medium text-[#1668D9] transition-colors duration-200 hover:translate-y-0 hover:border-[#1668D9] hover:bg-[#1668D9]/5 hover:text-[#1668D9] hover:shadow-none active:translate-y-0 active:border-[#1668D9]/70 active:bg-[#1668D9]/10 sm:h-10 sm:px-4 sm:text-sm"
              >
                Log In
              </Button>
            )}
          </div>
        </div>

        {isNavOpen && (
          <nav
            id="landing-mobile-nav"
            aria-label="Landing sections"
            className="border-t border-gray-200 bg-white px-4 py-2 sm:px-6 md:hidden"
          >
            <ul className="flex flex-col">
              {navItems.map((item) => {
                const isActive = activeSection === item.id;
                return (
                  <li key={item.id}>
                    <a
                      href={`#${item.id}`}
                      aria-current={isActive ? "location" : undefined}
                      onClick={(e) => {
                        e.preventDefault();
                        setActiveSection(item.id);
                        scrollToSection(item.id);
                        setIsNavOpen(false);
                      }}
                      className={`flex min-h-11 items-center rounded-lg px-3 text-sm font-medium transition-colors ${
                        isActive
                          ? "bg-[#F2F7FF] text-[#1668D9]"
                          : "text-[#1c1f26] hover:bg-gray-50"
                      }`}
                    >
                      {item.label}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        )}
      </header>

      <div className="relative z-10 mx-auto w-full max-w-7xl min-[1366px]:max-w-[93.7vw] px-4 sm:px-6 pt-4">
        <ShopStatusBanner className="mt-24 sm:mt-28" />
      </div>

      {/* Hero Section */}
      <section
        id="home"
        className="relative z-10 w-full bg-white pb-10 pt-24 sm:pb-20 sm:pt-32 [background-image:radial-gradient(circle_at_top_right,rgba(29,115,236,0.07),transparent_42%),radial-gradient(circle_at_bottom_left,rgba(47,111,214,0.06),transparent_42%),linear-gradient(to_bottom,transparent_78%,#F2F7FF)]"
      >
        <div className="relative mx-auto w-full max-w-7xl min-[1366px]:max-w-[93.7vw] px-4 sm:px-6">
          <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:gap-[3.5vw]">
            <div className="min-w-0 text-center lg:text-left">
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-[#1668D9]/20 text-[#1668D9] rounded-full text-sm font-medium mb-6">
                <span className="w-2 h-2 bg-[#1668D9] rounded-full animate-pulse"></span>
                {content.heroSubtitle}
              </div>
<h2 className="mb-5 font-bold leading-tight text-[#1c1f26] text-[clamp(2.25rem,7vw,3rem)] lg:text-[clamp(3rem,4.4vw,5rem)]">
                {/* Mobile: "Print, Track" on one line, "Succeed" below */}
                <span className="lg:hidden">
                  {content.heroTitle
                    .split(",")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .slice(0, -1)
                    .map((line, i, arr) => (
                      <span
                        key={i}
                        className={line.includes("#b") ? "text-[#1668D9]" : ""}
                      >
                        {line.replace("#b", "").trim()}
                        {i < arr.length - 1 ? ", " : ""}
                      </span>
                    ))}
                </span>
                <span
                  className={`lg:hidden block ${
                    content.heroTitle
                      .split(",")
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .slice(-1)[0]
                      ?.includes("#b")
                      ? "text-[#1668D9]"
                      : ""
                  }`}
                >
                  {content.heroTitle
                    .split(",")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .slice(-1)[0]
                    ?.replace("#b", "")
                    .trim()}
                </span>
                {/* Desktop: each part on its own line */}
                <span className="hidden lg:contents">
                  {content.heroTitle
                    .split(",")
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((line, i) => (
                      <span
                        key={i}
                        className={`block ${
                          line.includes("#b") ? "text-[#1668D9]" : ""
                        }`}
                      >
                        {line.replace("#b", "").trim()}
                      </span>
                    ))}
                </span>
              </h2>
              <p className="mb-7 max-w-xl text-gray-600 text-[clamp(1rem,1.46vw,2rem)]">
                {content.heroDescription}
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
                <Button
                  size="lg"
                  className="bg-[#1668D9] text-white hover:bg-[#0f66d9] rounded-lg transition-all duration-200 active:scale-[0.98] active:shadow-sm shadow-md shadow-[#1668D9]/30 hover:shadow-lg hover:shadow-[#1668D9]/35 group"
                  onClick={() => navigate("/signup")}
                >
                  Get Started
                  <ArrowRight className="ml-2.5 w-5 h-5 transition-transform duration-200 group-hover:translate-x-0.5" />
                </Button>
              </div>

              {/* Features List */}
              <div className="mt-6 flex w-full min-w-0 items-center justify-center lg:justify-start">
                {[
                  {
                    title: content.feature1,
                    sub: content.feature1Sub,
                    icon: <CloudUpload />,
                  },
                  {
                    title: content.feature2,
                    sub: content.feature2Sub,
                    icon: <Clock />,
                  },
                  {
                    title: content.feature3,
                    sub: content.feature3Sub,
                    icon: <ShieldCheck />,
                  },
                ].map((feature, index) => (
                  <div key={index} className="flex min-w-0 flex-1 items-center">
                    <div className="flex w-full min-w-0 flex-col items-center gap-1 text-center text-[#1c1f26] sm:w-auto sm:flex-shrink sm:items-start sm:text-left">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-[1.5px] border-blue-300 bg-[#F2F7FF] sm:h-9 sm:w-9">
                        {React.cloneElement(feature.icon, {
                          className:
                            "w-[16px] h-[16px] text-[#1668D9] stroke-2 sm:w-[18px] sm:h-[18px]",
                        })}
                      </div>
                      <span className="flex flex-col leading-tight">
                        <span className="text-xs sm:text-sm sm:whitespace-nowrap">
                          {feature.title}
                        </span>
                        <span className="text-xs sm:text-sm sm:whitespace-nowrap">
                          {feature.sub}
                        </span>
                      </span>
                    </div>
                    {index < 2 && (
                      <span
                        aria-hidden
                        className="mx-auto h-12 w-px shrink-0 bg-blue-200 sm:h-14"
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="order-first flex w-full items-center justify-center lg:order-none">
              <div className="flex aspect-square w-[min(12rem,60vw)] items-center justify-center rounded-full bg-[#1668D9] shadow-2xl sm:w-[min(18rem,50vw)] lg:w-[clamp(24rem,28.1vw,48rem)]">
                <img
                  src={logo}
                  alt="Docufy"
                  className="h-[66.67%] w-[66.67%] rounded-full"
                />
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
        <div className="mx-auto w-full max-w-7xl min-[1366px]:max-w-[93.7vw] px-4 sm:px-6">
          <div className="mb-12 text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1668D9]">
              Services &amp; Pricing
            </p>
            <h2 className="mt-4 text-[clamp(1.875rem,2.64vw,5rem)] font-bold text-[#1c1f26]">
              What can we print?
            </h2>
            <p className="mt-4 text-[clamp(1rem,1.32vw,2.25rem)] text-gray-600">
              Quality printing services with clear, affordable pricing.
            </p>
          </div>
          <div
            ref={servicesScrollerRef}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2 md:grid md:grid-cols-3 md:gap-6 md:overflow-visible md:pb-0 lg:gap-8"
          >
            <Card data-services-card="0" className="flex w-[85%] shrink-0 snap-center flex-col rounded-2xl border-2 border-[#F2F7FF] bg-white p-8 shadow-lg transition-all duration-200 hover:scale-105 hover:border-[#1668D9] hover:shadow-2xl md:w-auto">
              <div className="flex items-start justify-between">
                <div className="flex w-16 h-16 bg-[#F2F7FF] rounded-2xl items-center justify-center">
                  <Printer className="w-8 h-8 text-[#1668D9]" />
                </div>
                {content.serviceCards[0].badge && (
                  <div className="inline-block px-3 py-1 bg-[#1668D9] text-white text-xs font-bold rounded-full">
                    {content.serviceCards[0].badge}
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-1 flex-col">
                <h4 className="text-[clamp(1.25rem,1.46vw,2.75rem)] font-bold text-[#1c1f26]">
                  {content.serviceCards[0].title}
                </h4>
                <p className="mt-2 text-gray-600">
                  {content.serviceCards[0].description}
                </p>
                <dl className="mt-5 space-y-2.5 text-sm">
                  {content.serviceCards[0].details.map((detail, di) => (
                    <div key={di} className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 font-semibold text-[#1c1f26]">{detail.label}</dt>
                      <dd className="text-right text-gray-600">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="pt-6 mt-7 border-t border-gray-100">
                <div className="text-[clamp(2.25rem,2.64vw,5rem)] font-bold text-[#1668D9]">
                  ?{matrix.document.text.bw.a4.toFixed(2)}{" "}
                  <span className="text-base font-normal text-gray-500">
                    per page
                  </span>
                </div>
              </div>
            </Card>

            <Card data-services-card="1" className="relative flex w-[85%] shrink-0 snap-center flex-col overflow-hidden rounded-2xl bg-[#1668D9] p-8 text-white shadow-xl transition-all duration-200 hover:scale-105 hover:shadow-2xl md:w-auto">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white opacity-10 rounded-full -translate-y-12 translate-x-12" />
              <div className="absolute bottom-0 left-0 w-16 h-16 bg-white opacity-10 rounded-full translate-y-8 -translate-x-8" />
              <div className="relative z-10 flex flex-col">
                <div className="flex items-start justify-between">
                  <div className="w-16 h-16 bg-white/20 rounded-2xl flex items-center justify-center">
                    <Palette className="w-8 h-8 text-white" />
                  </div>
                  {content.serviceCards[1].badge && (
                    <div className="inline-block px-3 py-1 bg-white text-[#1668D9] text-xs font-bold rounded-full">
                      {content.serviceCards[1].badge}
                    </div>
                  )}
                </div>
                <div className="mt-6 flex flex-1 flex-col">
                  <h4 className="text-[clamp(1.25rem,1.46vw,2.75rem)] font-bold">
                    {content.serviceCards[1].title}
                  </h4>
                  <p className="mt-2 text-white/90">
                    {content.serviceCards[1].description}
                  </p>
                  <dl className="mt-5 space-y-2.5 text-sm">
                    {content.serviceCards[1].details.map((detail, di) => (
                      <div key={di} className="flex items-baseline justify-between gap-4">
                        <dt className="shrink-0 font-semibold text-white/70">{detail.label}</dt>
                        <dd className="text-right text-white/90">{detail.value}</dd>
                      </div>
                    ))}
                  </dl>
                </div>
                <div className="pt-6 mt-7 border-t border-white/15">
                  <div className="text-[clamp(2.25rem,2.64vw,5rem)] font-bold">
                    ?{matrix.document.text.full.a4.toFixed(2)}{" "}
                    <span className="text-base font-normal text-white/80">
                      per page
                    </span>
                  </div>
                </div>
              </div>
            </Card>

            <Card data-services-card="2" className="flex w-[85%] shrink-0 snap-center flex-col rounded-2xl border-2 border-[#F2F7FF] bg-white p-8 shadow-lg transition-all duration-200 hover:scale-105 hover:border-[#1668D9] hover:shadow-2xl md:w-auto">
              <div className="flex items-start justify-between">
                <div className="flex w-16 h-16 bg-[#F2F7FF] rounded-2xl items-center justify-center">
                  <Package className="w-8 h-8 text-[#1668D9]" />
                </div>
                {content.serviceCards[2].badge && (
                  <div className="inline-block px-3 py-1 bg-[#1668D9] text-white text-xs font-bold rounded-full">
                    {content.serviceCards[2].badge}
                  </div>
                )}
              </div>
              <div className="mt-6 flex flex-1 flex-col">
                <h4 className="text-[clamp(1.25rem,1.46vw,2.75rem)] font-bold text-[#1c1f26]">
                  {content.serviceCards[2].title}
                </h4>
                <p className="mt-2 text-gray-600">
                  {content.serviceCards[2].description}
                </p>
                <dl className="mt-5 space-y-2.5 text-sm">
                  {content.serviceCards[2].details.map((detail, di) => (
                    <div key={di} className="flex items-baseline justify-between gap-4">
                      <dt className="shrink-0 font-semibold text-[#1c1f26]">{detail.label}</dt>
                      <dd className="text-right text-gray-600">{detail.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
              <div className="pt-6 mt-7 border-t border-gray-100">
                <div className="text-[clamp(2.25rem,2.64vw,5rem)] font-bold text-[#1668D9]">
                  ?{Math.min(matrix.vellum.bw.a4, matrix.sticker.bw, matrix.photo["2R"].price).toFixed(2)}{" "}
                  <span className="text-base font-normal text-gray-500">
                    from
                  </span>
                </div>
              </div>
            </Card>
          </div>
        </div>
      </section>

      {/* Shop Info */}
      <section
        id="shop-info"
        className="bg-white w-full py-16 sm:py-20 relative z-10"
      >
        <div className="relative mx-auto w-full max-w-7xl min-[1366px]:max-w-[93.7vw] px-4 sm:px-6">
          <div className="mx-auto mb-12 max-w-2xl text-center lg:mb-16">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1668D9]">
              Shop Information
            </p>
            <h2 className="mt-4 text-[clamp(1.875rem,2.64vw,5rem)] font-bold text-[#1c1f26]">
              Visit us on campus.
            </h2>
            <p className="mt-4 text-[clamp(1rem,1.32vw,2.25rem)] leading-relaxed text-gray-600 sm:text-lg">
              {content.locationLines?.[0]
                ? `Docufy is conveniently located at ${content.locationLines[0]}. Drop by during operating hours, or start your order online.`
                : "Docufy is conveniently located on campus. Drop by during operating hours, or start your order online."}
            </p>
          </div>

          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:gap-14">
            {/* Left: Shop Hours + Location */}
            <div className="flex flex-col gap-6">
              {/* Shop Hours */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <h3 className="flex items-center gap-3 text-xl font-bold text-[#1c1f26]">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-[#1668D9]">
                    <Clock className="h-4 w-4" />
                  </span>
                  Shop Hours
                </h3>
                <dl className="mt-4">
                  {content.shopHours.map((row: { label: string; hours: string }, index: number) => (
                    <div
                      key={index}
                      className="flex items-baseline justify-between gap-6 border-t border-gray-100 py-3.5 first:border-t-0 first:pt-0 last:pb-0"
                    >
                      <dt className="text-lg font-semibold text-[#1c1f26]">
                        {row.label || "Schedule"}
                      </dt>
                      <dd className="text-right text-lg text-gray-600">{row.hours}</dd>
                    </div>
                  ))}
                </dl>
                {content.hoursNote && (
                  <p className="mt-3 flex items-center gap-1.5 text-lg font-medium text-[#1668D9]">
                    <CheckCircle2 className="h-5 w-5 shrink-0" />
                    {content.hoursNote}
                  </p>
                )}
              </div>

              {/* Location */}
              <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm sm:p-7">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="flex items-center gap-3 text-xl font-bold text-[#1c1f26]">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-white text-[#1668D9]">
                      <MapPin className="h-4 w-4" />
                    </span>
                    Location
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShopLocationOpen(true)}
                    className="flex items-center gap-1.5 text-sm font-medium text-[#2F6FD6] hover:text-[#1e5bb8] transition-colors"
                  >
                    <MapPin className="h-4 w-4 shrink-0" />
                    Shop Photos
                  </button>
                </div>
                <address className="mt-4 space-y-1 not-italic">
                  {content.locationLines.map((line: string, index: number) => (
                    <p
                      key={index}
                      className={`text-lg leading-relaxed ${
                        index === 0 ? "font-semibold text-[#1c1f26]" : "text-gray-600"
                      }`}
                    >
                      {line}
                    </p>
                  ))}
                </address>
                <div className="relative mt-4 h-64 w-full overflow-hidden rounded-lg border-0 lg:hidden">
                  <iframe
                    title="Docufy Printing Services - Shop Location (mobile)"
                    src={content.mapEmbedUrl || DEFAULT_MAP_EMBED}
                    className="h-full w-full border-0"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>

            {/* Right: map fills the full height of the left column (desktop only) */}
            <div className="hidden flex-col lg:flex">
              <div className="relative h-80 w-full overflow-hidden rounded-xl border border-slate-200 bg-white p-2 shadow-sm lg:flex-1">
                <div className="h-full w-full overflow-hidden rounded-lg">
                  <iframe
                    title="Docufy Printing Services - Shop Location"
                    src={content.mapEmbedUrl || DEFAULT_MAP_EMBED}
                    className="h-full w-full border-0"
                    loading="lazy"
                    allowFullScreen
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Join Our Team */}
      <section
        id="jobs"
        className="bg-[#F2F7FF] w-full py-16 sm:py-20 relative z-10"
      >
        <div className="relative mx-auto w-full max-w-7xl min-[1366px]:max-w-[93.7vw] px-4 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-[#1668D9]">
              Join Our Team
            </p>
            <h2 className="mt-4 text-[clamp(1.875rem,2.64vw,5rem)] font-bold text-[#1c1f26]">
              Work with us.
            </h2>
            <p className="mt-4 text-[clamp(1rem,1.32vw,2.25rem)] text-gray-600">
              Explore current openings at Docufy and start your application today.
            </p>
<div className="relative mt-8" ref={jobsDropdownRef}>
              <Button
                type="button"
                onClick={() => setJobsDropdownOpen((prev) => !prev)}
                aria-expanded={jobsDropdownOpen}
                className="h-12 rounded-lg bg-[#1668D9] px-7 text-white shadow-md shadow-[#1668D9]/30 transition-all duration-200 hover:bg-[#0f66d9] hover:shadow-lg hover:shadow-[#1668D9]/35 active:scale-[0.98] active:shadow-sm"
              >
                {jobs.length > 0 ? "View Job Openings" : "Join Our Team"}
                <ChevronDown
                  className={`ml-2 h-4 w-4 transition-transform duration-200 ${
                    jobsDropdownOpen ? "rotate-180" : ""
                  }`}
                />
              </Button>

              <div
                className={`grid transition-[grid-template-rows] duration-300 ease-in-out ${
                  jobsDropdownOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"
                }`}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="mt-3 overflow-hidden rounded-xl border border-gray-100 bg-white text-left shadow-xl">
                  {jobs.length === 0 ? (
                    <div className="px-6 py-8 text-center">
                      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-[#F2F7FF]">
                        <Briefcase className="h-6 w-6 text-[#1668D9]" />
                      </div>
                      <p className="text-base font-semibold text-[#1c1f26]">
                        We're not hiring right now
                      </p>
                      <p className="mt-1.5 text-sm text-gray-500">
                        No job openings available at the moment. Please check back again soon.
                      </p>
                    </div>
                  ) : (
                    <ul className="max-h-80 overflow-y-auto py-1">
                      {jobs.map((job) => (
                        <li key={job.id}>
                          <button
                            type="button"
                            onClick={() => {
                              setJobsDropdownOpen(false);
                              navigate(`/signup?jobId=${job.id}`);
                            }}
                            className="group flex w-full items-center gap-3 px-4 py-3.5 text-left transition-colors hover:bg-[#F2F7FF]"
                          >
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F2F7FF] transition-colors group-hover:bg-[#1668D9]/10">
                              <Briefcase className="h-5 w-5 text-[#1668D9]" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-semibold text-[#1c1f26]">
                                {job.title}
                              </span>
                              <span className="mt-0.5 block truncate text-xs text-gray-500">
                                {[
                                  job.type,
                                  job.duration && `Schedule: ${job.duration}`,
                                  job.location,
                                ]
                                  .filter(Boolean)
                                  .join(" \u00b7 ")}
                              </span>
                            </span>
                            <ArrowRight className="h-4 w-4 shrink-0 text-[#1668D9] opacity-0 transition-opacity duration-200 group-hover:opacity-100" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>
            </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer id="footer" className="relative z-10 bg-[#1351AE]">
        <div className="mx-auto w-full max-w-7xl min-[1366px]:max-w-[93.7vw] px-4 sm:px-6">
          <div className="grid grid-cols-2 gap-x-8 gap-y-6 py-6 lg:grid-cols-12 lg:gap-x-8 lg:py-8">
            {/* Brand / About Docufy */}
            <div className="col-span-2 lg:col-span-6">
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt="Docufy Logo"
                  className="h-10 w-10 rounded-full sm:h-11 sm:w-11"
                />
                <h2 className="text-lg font-bold text-white sm:text-xl">Docufy PSMS</h2>
              </div>
              <h3 className="mt-3 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                About Docufy PSMS
              </h3>
              <p className="mt-2 max-w-md text-sm leading-normal text-blue-100/90">
                {footerAboutShort}
              </p>
            </div>

            {/* Shop Information */}
            <div className="lg:col-span-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                Shop Information
              </h3>
              <div className="mt-2.5 space-y-3">
                {content.locationLines[0] && (
                  <p className="text-sm leading-normal text-blue-50/90">
                    {content.locationLines[0]}
                  </p>
                )}
                {content.shopHours[0] && (
                  <div className="text-sm text-blue-50/90">
                    <p className="font-medium leading-normal text-white">{content.shopHours[0].label}</p>
                    <p className="leading-normal">{content.shopHours[0].hours}</p>
                  </div>
                )}
                {content.shopHours[1] && (
                  <p className="text-sm leading-normal text-blue-50/90">{content.shopHours[1].label} - {content.shopHours[1].hours}</p>
                )}
              </div>
            </div>

            {/* Contact Us */}
            <div className="lg:col-span-3">
              <h3 className="text-xs font-bold uppercase tracking-[0.18em] text-white/70">
                Contact Us
              </h3>
              <div className="mt-2.5 space-y-3">
                {content.contactEmail && (
                  <div className="text-sm text-blue-50/90">
                    <p className="flex items-center gap-2 font-medium text-white">
                      <Mail className="h-4 w-4 shrink-0" /> Email
                    </p>
                    <a
                      href={`mailto:${content.contactEmail}`}
                      className="block break-all leading-normal transition-colors hover:text-white"
                    >
                      {content.contactEmail}
                    </a>
                  </div>
                )}
                {content.facebookPage && (
                  <div className="text-sm text-blue-50/90">
                    <p className="flex items-center gap-2 font-medium text-white">
                      <Facebook className="h-4 w-4 shrink-0" /> Facebook Page
                    </p>
                    <a
                      href={content.facebookPageUrl || "https://www.facebook.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all leading-normal transition-colors hover:text-white"
                    >
                      {content.facebookPage}
                    </a>
                  </div>
                )}
                {content.facebookMessenger && (
                  <div className="text-sm text-blue-50/90">
                    <p className="flex items-center gap-2 font-medium text-white">
                      <MessageCircle className="h-4 w-4 shrink-0" /> Messenger
                    </p>
                    <a
                      href={content.facebookMessengerUrl || "https://www.facebook.com"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block break-all leading-normal transition-colors hover:text-white"
                    >
                      {content.facebookMessenger}
                    </a>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center gap-2 border-t border-white/10 py-2.5 text-xs text-blue-100/80 sm:flex-row sm:justify-between sm:py-3.5">
            <p>&copy; 2026 Docufy PSMS. All rights reserved.</p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setShowTerms(true)}
                className="transition-colors hover:text-white"
              >
                Terms &amp; Condition
              </button>
              <span aria-hidden className="text-blue-100/40">|</span>
              <button
                type="button"
                onClick={() => setShowPrivacy(true)}
                className="transition-colors hover:text-white"
              >
                Privacy Policy
              </button>
            </div>
          </div>
        </div>
      </footer>

      <LegalPolicyDialog
        open={showTerms}
        onOpenChange={setShowTerms}
        initialTab="terms"
      />
      <LegalPolicyDialog
        open={showPrivacy}
        onOpenChange={setShowPrivacy}
        initialTab="privacy"
      />

      {shopLocationOpen && (
        <Dialog open={shopLocationOpen} onOpenChange={setShopLocationOpen}>
          <DialogContent className="sm:max-w-lg" aria-describedby={undefined}>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MapPin className="w-5 h-5 text-[#2F6FD6]" /> Shop Location
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-gray-600">
              {content.locationLines[0]
                ? `Docufy is conveniently located at ${content.locationLines[0]}.`
                : "Palawan State University - Main Campus, Puerto Princesa City, Palawan"}
            </p>
            {shopPhotos.length > 0 ? (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={() => setShowShopPhotos(!showShopPhotos)}
                  className="flex items-center gap-2 text-sm font-medium text-[#2F6FD6] hover:text-[#1e5bb8] transition-colors"
                >
                  <ChevronDown
                    className={`w-4 h-4 transition-transform duration-200 ${
                      showShopPhotos ? "rotate-180" : ""
                    }`}
                  />
                  {showShopPhotos ? "Hide Shop Photos" : "View Shop Photos"}
                </button>
                {showShopPhotos && (
                  <div className="grid grid-cols-3 gap-2 mt-3">
                    {shopPhotos.map((photo) => (
                      <button
                        key={photo.id}
                        type="button"
                        onClick={() => setLightboxPhoto(photo.dataUrl)}
                        className="cursor-pointer"
                      >
                        <img
                          src={photo.dataUrl}
                          alt="Shop location"
                          className="w-full h-24 object-cover rounded-lg border border-gray-200 hover:ring-2 hover:ring-[#2F6FD6] transition-all"
                        />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                No shop photos uploaded yet.
              </p>
            )}
          </DialogContent>
        </Dialog>
      )}

      {lightboxPhoto && (
        <Dialog open onOpenChange={() => setLightboxPhoto(null)}>
          <DialogContent className="sm:max-w-2xl p-0 bg-black border-0 overflow-hidden">
            <button
              type="button"
              onClick={() => setLightboxPhoto(null)}
              className="absolute top-3 right-3 z-10 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            <img
              src={lightboxPhoto}
              alt="Shop location full view"
              className="w-full max-h-[80vh] object-contain"
            />
          </DialogContent>
        </Dialog>
      )}

      {showLogoutConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowLogoutConfirm}
          onConfirm={() => {
            logout();
            navigate("/");
          }}
          title="Sign out of Docufy?"
          description="You will be returned to the sign-in page. Your current session and app data will be preserved, but sign-in will be required to continue."
          confirmLabel="Sign Out"
          cancelLabel="Stay Signed In"
          destructive={false}
        />
      )}
    </div>
  );
}
