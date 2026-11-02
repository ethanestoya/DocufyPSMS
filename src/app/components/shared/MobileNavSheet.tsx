import React, { useState, useEffect, useRef, useSyncExternalStore } from "react";
import {
  LogOut,
  User,
  ChevronDown,
  ChevronRight,
  PanelLeft,
  LayoutDashboard,
  FileText,
  Package,
  Briefcase,
  Home,
} from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useMobileNav } from "../../contexts/MobileNavContext";
import { useIsMobile } from "../ui/use-mobile";
import { usePresence } from "../ui/use-presence";
import { ConfirmationDialog } from "../ui/confirmation-dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "../ui/sheet";
import { useLogo } from "../../hooks/useLogo";
import {
  adminSections,
  staffSections,
  findActiveModule,
  flattenSections,
  resolveActiveChild,
  type NavModule,
  type NavSection,
} from "../../utils/navigationConfig";
import {
  snapshotExpandedParents,
  persistExpandedParents,
  ensureParentExpanded,
} from "../../utils/navExpandState";

interface MenuItem {
  label: string;
  path: string;
  icon: React.ReactNode;
}

const customerMenuItems: MenuItem[] = [
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

interface MobileNavSheetProps {
  router: ReturnType<typeof import("react-router").createBrowserRouter>;
}

export default function MobileNavSheet({ router }: MobileNavSheetProps) {
  const { open, setOpen } = useMobileNav();
  const { user, logout } = useAuth();
  const isMobile = useIsMobile();
  const logo = useLogo();

  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profilePresence = usePresence(isProfileOpen, 200);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Which parents have their inline submenu expanded. Kept as a Set so the
  // active module can be auto-expanded without clobbering manual toggles. It
  // reads from / writes to a module-level snapshot shared with the desktop
  // sidebar so parent state stays consistent across screens.
  const [expandedModules, setExpandedModules] = useState<Set<string>>(
    () => snapshotExpandedParents(),
  );

  // Preserve the nav scroll position across open/close (the Radix sheet
  // unmounts its content when closed, which would otherwise reset scrolling).
  const navRef = useRef<HTMLDivElement>(null);
  const savedNavScrollTop = useRef(0);

  useEffect(() => {
    if (open && navRef.current) {
      navRef.current.scrollTop = savedNavScrollTop.current;
    }
  }, [open]);

  // React to route changes so nav highlights stay in sync even though this
  // component lives outside the router tree (it must persist across pages so
  // the sheet can animate closed while the next page mounts).
  const pathname = useSyncExternalStore(
    router.subscribe,
    () => router.state.location.pathname,
    () => router.state.location.pathname,
  );
  const search = useSyncExternalStore(
    router.subscribe,
    () => router.state.location.search,
    () => router.state.location.search,
  );

  useEffect(() => {
    if (!isMobile && open) {
      setOpen(false);
    }
  }, [isMobile, open, setOpen]);

  const customerNavigation: NavModule[] = customerMenuItems.map((item) => ({
    label: item.label,
    path: item.path,
    icon: item.icon,
  }));
  const allModules: NavModule[] =
    user?.role === "admin"
      ? flattenSections(adminSections)
      : user?.role === "staff"
        ? flattenSections(staffSections)
        : customerNavigation;
  const activeModule = findActiveModule(allModules, pathname, search);

  // Sectioned groups for the admin/staff mobile nav (MAIN / OPERATIONS /
  // MANAGEMENT). Customers keep the legacy flat menu (no headings).
  const sections: NavSection[] =
    user?.role === "admin"
      ? adminSections
      : user?.role === "staff"
        ? staffSections
        : [];

  // Always keep the parent of the current route expanded so navigation state
  // matches the URL (auto-expands after navigating straight to a child).
  useEffect(() => {
    if (activeModule?.children?.length) {
      ensureParentExpanded(activeModule.path);
      setExpandedModules((prev) =>
        prev.has(activeModule.path)
          ? prev
          : new Set(prev).add(activeModule.path),
      );
    }
  }, [activeModule?.path, pathname, search]);

  const isModuleExpanded = (module: NavModule) =>
    !!module.children && expandedModules.has(module.path);

  const toggleModule = (module: NavModule) => {
    if (!module.children?.length) {
      navigateAndClose(module.path);
      return;
    }
    setExpandedModules((prev) => {
      const next = new Set(prev);
      if (next.has(module.path)) next.delete(module.path);
      else next.add(module.path);
      persistExpandedParents(next);
      return next;
    });
  };

  if (!user) {
    return null;
  }

  // Renders a single nav row (leaf or expandable parent with inline submenu).
  // Used inside collapsible sections (admin/staff) and the flat menu (customer).
  const renderModuleItem = (module: NavModule) => {
    const isActive = activeModule === module;
    const hasChildren = !!module.children && module.children.length > 0;
    const isExpanded = isModuleExpanded(module);
    return (
      <div key={module.path} className="w-full flex flex-col items-stretch px-3">
        <button
          type="button"
          onClick={() => toggleModule(module)}
          aria-current={isActive ? "page" : undefined}
          aria-expanded={hasChildren ? isExpanded : undefined}
          className={`flex items-center transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]/40 w-full px-4 py-3 gap-3.5 ${
            isActive && hasChildren
              ? "rounded-lg bg-[#F2F7FF] text-[#1668D9] shadow-[0_2px_8px_rgba(16,49,107,0.16)] ring-1 ring-inset ring-[#DCE8FB]"
              : isActive
                ? "rounded-xl bg-white text-[#1668D9] shadow-lg"
                : "rounded-xl text-white/90 hover:bg-white/10 hover:text-white"
          }`}
        >
          <div className="relative flex-shrink-0 flex items-center justify-center">
            {module.icon}
          </div>
          <span className="text-sm font-semibold whitespace-nowrap truncate">
            {module.label}
          </span>
          {hasChildren && (
            <span className="ml-auto flex-shrink-0 flex items-center justify-center">
              {isExpanded ? (
                <ChevronDown className="w-4 h-4 opacity-80" />
              ) : (
                <ChevronRight className="w-4 h-4 opacity-80" />
              )}
            </span>
          )}
          {isActive && !hasChildren && (
            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-[#1668D9]" />
          )}
        </button>
        {hasChildren && isExpanded && (
          <div className="relative flex flex-col items-stretch w-full mt-1.5 animate-in fade-in slide-in-from-top-1 duration-150">
            <span
              aria-hidden="true"
              className="absolute left-[30px] top-1 bottom-1 w-[2px] rounded-full bg-white/30 pointer-events-none"
            />
            <div className="flex flex-col items-stretch gap-1.5">
              {module.children!.map((childItem) => {
                const isChildActive =
                  resolveActiveChild(
                    module.children!,
                    pathname,
                    search,
                  )?.path === childItem.path;
                return (
                  <button
                    key={childItem.path}
                    type="button"
                    onClick={() => navigateAndClose(childItem.path)}
                    aria-current={isChildActive ? "page" : undefined}
                    className={`relative ml-[32px] flex items-center pl-5 pr-3 py-1.5 rounded-lg text-[13px] transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]/40 active:scale-[0.97] ${
                      isChildActive
                        ? "bg-white/15 text-white font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_2px_rgba(13,49,115,0.15)] ring-1 ring-inset ring-white/10 animate-in fade-in duration-200"
                        : "text-white/80 font-medium hover:bg-white/10 hover:text-white"
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`absolute top-1/2 -translate-y-1/2 left-[-5px] h-2 w-2 rounded-full transition-colors duration-200 ${
                        isChildActive
                          ? "bg-white shadow-[0_0_8px_rgba(255,255,255,0.55)] animate-in fade-in zoom-in-75 duration-200"
                          : "border border-white/45 bg-white/5"
                      }`}
                    />
                    <span className="truncate">{childItem.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  const getInitials = (value?: string) => {
    if (!value) return "U";
    const letters = value
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("");
    return letters || "U";
  };

  const profileImage = user?.profileImage;
  const profileInitial = getInitials(user?.name || user?.email || "User");

  const navigateAndClose = (path: string) => {
    setOpen(false);
    setIsProfileOpen(false);
    // Navigate immediately so the next page is already rendering while the
    // sheet plays its slide-out animation (no lag/delay).
    router.navigate(path);
  };

  const handleLogout = () => {
    setShowLogoutConfirm(true);
  };

  const confirmLogout = () => {
    setOpen(false);
    logout();
    router.navigate("/");
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetContent
        side="left"
        showClose={false}
        onPointerDownOutside={() => setOpen(false)}
        onInteractOutside={() => setOpen(false)}
        className="w-[min(16rem,57vw)] bg-[#1668D9] p-0 text-white"
      >
        <SheetHeader className="sr-only">
          <SheetTitle>Primary navigation</SheetTitle>
          <SheetDescription>Navigate through your Docufy account.</SheetDescription>
        </SheetHeader>

        <div className="flex h-full w-full flex-col">
          <div className="pt-5 pb-3 w-full">
            <div className="flex items-center justify-between px-4 gap-4">
              <div className="flex items-center gap-3">
                <img
                  src={logo}
                  alt=""
                  className="w-10 h-10 rounded-full bg-white/10 p-0.5 shadow-lg flex-shrink-0"
                />
                <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
                  Docufy
                </span>
              </div>

              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="flex items-center justify-center rounded-lg w-8 h-8 text-blue-100 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 transition-colors duration-200"
              >
                <PanelLeft className="w-[18px] h-[18px] flex-shrink-0" />
              </button>
            </div>
          </div>

          <div className="px-3 mb-2">
            <div className="h-[2px] bg-white/40 w-full" />
          </div>

          <nav
            ref={navRef}
            onScroll={(e) => {
              savedNavScrollTop.current = e.currentTarget.scrollTop;
            }}
            aria-label="Primary navigation"
            className="flex-1 py-5 space-y-2 overflow-y-auto custom-scrollbar flex flex-col items-center"
          >
            <div className="flex flex-col items-stretch w-full">
              {sections.length > 0 ? (
                sections.map((section) => (
                  <div key={section.key} className="flex flex-col items-stretch w-full">
                    <div
                      aria-hidden="true"
                      className="px-6 pt-4 pb-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-blue-100/70 select-none"
                    >
                      {section.label}
                    </div>
                    <div className="flex flex-col space-y-1.5">
                      {section.items.map(renderModuleItem)}
                    </div>
                  </div>
                ))
              ) : (
                allModules.map(renderModuleItem)
              )}
            </div>
          </nav>

          <div className="relative mt-auto w-full px-3 pb-5">
            <div className="h-[2px] bg-white/40 w-full mb-4" />
            <button
              type="button"
              onClick={() => setIsProfileOpen((isOpen) => !isOpen)}
              aria-label="Open account menu"
              aria-expanded={isProfileOpen}
              aria-haspopup="menu"
              className={`flex items-center gap-3 rounded-xl transition-all w-full px-3 py-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#1668D9]/40 ${
                isProfileOpen ? "bg-white/10" : "hover:bg-white/10"
              }`}
            >
              <div className="w-8 h-8 bg-white text-[#1668D9] rounded-lg flex items-center justify-center font-bold text-xs uppercase flex-shrink-0 overflow-hidden">
                {profileImage ? (
                  <img src={profileImage} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  profileInitial
                )}
              </div>
              <div className="min-w-0 flex-1 text-left">
                <p className="text-xs font-semibold text-white leading-none truncate">
                  {user?.name || user?.email?.split("@")[0]}
                </p>
                <p className="text-[10px] text-blue-100 capitalize leading-none mt-1">
                  {user?.role} account
                </p>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-blue-100 transition-transform ${
                  isProfileOpen ? "rotate-180" : ""
                }`}
              />
            </button>

            {profilePresence && (
              <div className={`absolute bottom-full mb-2 left-3 right-3 bg-white rounded-2xl shadow-2xl border border-gray-100 py-1.5 z-20 ${profilePresence.isClosing ? "animate-out fade-out-0 zoom-out-95 slide-out-to-bottom-2 duration-200 pointer-events-none" : "animate-in fade-in-0 zoom-in-95 slide-in-from-bottom-2 duration-200"}`}>
                <div className="px-4 py-3 border-b border-gray-100">
                  <p className="text-xs font-bold text-gray-900 truncate">{user?.name || user?.email?.split("@")[0]}</p>
                  <p className="text-[10px] text-gray-500 truncate mt-0.5">{user?.email}</p>
                  <p className="text-[10px] text-gray-500 capitalize mt-0.5">
                    {user?.role} Account
                  </p>
                </div>
                <div className="py-1">
                  <button
                    type="button"
                    onClick={() => navigateAndClose("/")}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    <Home className="w-4 h-4" /> Home
                  </button>
                  <button
                    type="button"
                    onClick={() => navigateAndClose(`/${user?.role}/profile`)}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors font-medium"
                  >
                    <User className="w-4 h-4" /> My Profile
                  </button>
                </div>
                <div className="border-t border-gray-100 py-1">
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 transition-colors font-medium"
                  >
                    <LogOut className="w-4 h-4" /> Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </SheetContent>

      {showLogoutConfirm && (
        <ConfirmationDialog
          open
          onOpenChange={setShowLogoutConfirm}
          onConfirm={confirmLogout}
          title="Sign out of Docufy?"
          description="You'll need to sign in again to continue."
          confirmLabel="Sign Out"
          cancelLabel="Stay Signed In"
          destructive={false}
        />
      )}
    </Sheet>
  );
}
