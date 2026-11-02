import { Fragment } from "react";
import {
  ArrowRight,
  Boxes,
  ClipboardList,
  CreditCard,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Printer,
  Tag,
  User,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { useAuth } from "../../contexts/AuthContext";
import { landingContentStore } from "../../utils/landingContentStore";

interface HelpSupportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  // Navigation is passed in rather than read from the router: the mobile drawer
  // renders outside RouterProvider, so useNavigate() there would crash the app.
  onNavigate: (path: string) => void;
}

const ORDER_FLOW = [
  "Awaiting payment",
  "In queue",
  "Printing",
  "Completed",
  "Released",
];

/**
 * The sidebar used to hold a second copy of the account menu that the header
 * avatar already opens. That slot now answers "how does this work, and who do I
 * ask" instead, which is the one thing an operator could not find in the app.
 */
export default function HelpSupportDialog({
  open,
  onOpenChange,
  onNavigate,
}: HelpSupportDialogProps) {
  const { user } = useAuth();
  // Read on every render so an admin's latest contact details and hours are
  // what the person actually sees when they open this.
  const content = landingContentStore.getContent();
  const role = user?.role ?? "customer";

  const go = (path: string) => {
    onOpenChange(false);
    onNavigate(path);
  };

  const links =
    role === "customer"
      ? [
          {
            label: "Place a print request",
            description: "Upload your files and choose the print settings.",
            icon: Printer,
            path: "/customer/new-request",
          },
          {
            label: "Track your orders",
            description: "See where an order is right now and what is next.",
            icon: Package,
            path: "/customer/orders",
          },
          {
            label: "Update your profile",
            description: "Change your details, photo or password.",
            icon: User,
            path: "/customer/profile",
          },
        ]
      : [
          {
            label: "Verify a payment",
            description: "Confirm online payments and cash paid at the counter.",
            icon: CreditCard,
            path: `/${role}/payment-verification`,
          },
          {
            label: "Open the order queue",
            description: "Start printing, mark jobs completed and release orders.",
            icon: ClipboardList,
            path: role === "staff" ? "/staff/queue" : "/admin/orders",
          },
          {
            label: "Manage inventory",
            description: "Stock in and out, and see what is running low.",
            icon: Boxes,
            path: `/${role}/inventory`,
          },
          ...(role === "admin"
            ? [
                {
                  label: "Update prices",
                  description: "Change the rates customers see and pay.",
                  icon: Tag,
                  path: "/admin/pricing",
                },
              ]
            : []),
        ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Help &amp; Support</DialogTitle>
          <DialogDescription>
            How an order moves, the pages you will need, and how to reach the shop.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              How an order moves
            </h3>
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {ORDER_FLOW.map((step, index) => (
                <Fragment key={step}>
                  <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-[11.5px] font-medium text-slate-700">
                    {step}
                  </span>
                  {index < ORDER_FLOW.length - 1 && (
                    <ArrowRight className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  )}
                </Fragment>
              ))}
            </div>
            <p className="mt-2 text-[12.5px] leading-relaxed text-slate-500">
              An order joins the queue only after its payment is verified. Completed jobs wait for
              pickup, and releasing one closes it out.
            </p>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Common tasks
            </h3>
            <div className="mt-2 grid gap-2">
              {links.map((link) => (
                <button
                  key={link.path}
                  type="button"
                  onClick={() => go(link.path)}
                  className="group flex items-center gap-3 rounded-xl border border-slate-200/70 bg-white px-3.5 py-3 text-left transition-colors hover:border-[#1668D9]/40 hover:bg-slate-50"
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-[#1668D9]">
                    <link.icon className="h-4 w-4" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-slate-800">{link.label}</span>
                    <span className="block text-[12px] leading-snug text-slate-500">
                      {link.description}
                    </span>
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-slate-400 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>
          </section>

          <section>
            <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
              Contact the shop
            </h3>
            <div className="mt-2 space-y-3 rounded-xl border border-slate-200/70 bg-slate-50/70 p-3.5">
              {content.contactEmail && (
                <a
                  href={`mailto:${content.contactEmail}`}
                  className="flex items-center gap-2.5 text-[13px] font-medium text-[#1668D9] hover:underline"
                >
                  <Mail className="h-4 w-4 shrink-0" />
                  {content.contactEmail}
                </a>
              )}
              {content.facebookMessengerUrl && (
                <a
                  href={content.facebookMessengerUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2.5 text-[13px] font-medium text-[#1668D9] hover:underline"
                >
                  <MessageCircle className="h-4 w-4 shrink-0" />
                  Message us on Facebook
                </a>
              )}
              {content.locationLines.length > 0 && (
                <div className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-slate-600">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  <span>{content.locationLines.join(", ")}</span>
                </div>
              )}
              {content.shopHours.length > 0 && (
                <div className="space-y-1 border-t border-slate-200/70 pt-2.5">
                  {content.shopHours.map((row) => (
                    <div
                      key={row.label}
                      className="flex items-baseline justify-between gap-3 text-[12.5px]"
                    >
                      <span className="text-slate-500">{row.label}</span>
                      <span className="font-medium text-slate-700">{row.hours}</span>
                    </div>
                  ))}
                  {content.hoursNote && (
                    <p className="pt-0.5 text-[11.5px] text-slate-500">{content.hoursNote}</p>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="flex justify-end pt-1">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
