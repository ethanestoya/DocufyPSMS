# PUSH LOG Ã¢â‚¬â€ Docufy PSMS

This file logs every push done by any collaborator on this repo, with the date & time in **Philippine time (PHT, UTC+8)**, who pushed, and what the push update did.

New entries are added at the bottom, below the most recent one, so the log reads oldest Ã¢â€ â€™ newest.

---

## August 3, 2026 11:59 PM (PHT) Ã¢â‚¬â€ Francis William Garcia
**Initial commit / setup**
- First commit of the repo (project scaffolding).

---

## August 24, 2026 10:43 PM & 11:28 PM (PHT) Ã¢â‚¬â€ ethanestoya
- `improve: web responsiveness` Ã¢â‚¬â€ mobile/desktop responsiveness improvements across the app.
- Moved the user profile into the navigation bar.

---

## August 25, 2026 10:26 PM Ã¢â‚¬â€œ 11:32 PM (PHT) Ã¢â‚¬â€ ethanestoya
- `fix: dashboard layout`
- `fix: print request layout`
- `fix: job board layout`
- `remove: unecessary back button - header`
- `fix: dashboard layout` (follow-up)

---

## August 26, 2026 03:33 AM (PHT) Ã¢â‚¬â€ pranswg
- `Update README.md`

---

## August 26, 2026 10:09 PM Ã¢â‚¬â€œ 10:13 PM (PHT) Ã¢â‚¬â€ Francis William Garcia
- `improved mobile viewing`
- Merge remote changes into `testbranch2`
- `modified readme.md`

---

## August 27, 2026 03:26 AM (PHT) Ã¢â‚¬â€ Francis William Garcia
- `improved mobile viewing`

---

## August 28, 2026 05:20 AM (PHT) Ã¢â‚¬â€ Francis William Garcia
- Added **live PDF preview for the Job Board** and further mobile viewing improvements.

---

## August 28, 2026 09:26 PM (PHT) Ã¢â‚¬â€ Althea09-git
- `Improved Landing Page Cards`

---

## August 29, 2026 12:02 AM & 12:26 AM (PHT) Ã¢â‚¬â€ prans
- `removed attendance form and improved ui`
- `removed attendance and improved UI`

---

## August 29, 2026 12:52 AM (PHT) Ã¢â‚¬â€ Francis William Garcia
- `Remove node_modules and dist from tracking, add .gitignore`

---

## August 29, 2026 02:26 AM Ã¢â‚¬â€œ 03:01 AM (PHT) Ã¢â‚¬â€ Francis William Garcia
- `Remove Reports feature and unused docs; rework README`
- `Add collaboration guide for merging changes` (COLLABORATION_GUIDE.md)
- `Remove entire inventory system for rebuild from scratch`

---

## August 29, 2026 04:14 AM (PHT) Ã¢â‚¬â€ Francis William Garcia
- **Rebuilt the inventory system from scratch** + fixed down-payment queue gating:
  - Admin-only `/admin/inventory` page with localStorage `inventoryStore` (paper-piece tracking, Stock In/Out, Add/Edit/Archive).
  - Down-payment/GCash orders gated out of the admin/staff queue until verified (Payment Verification).

---

## August 29, 2026 10:52 AM (PHT) Ã¢â‚¬â€ Francis William Garcia
- `remove live pdf preview system-wide` (committed on `testbranch-pdf` branch):
  - Removed the `print-preview-dialog.tsx` (pdfjs-dist live preview) and the `pdfjs-dist` dependency.
  - Made all print/file preview buttons inert (no window opens) pending a later rebuild.

---

## August 30, 2026 07:54 AM Ã¢â‚¬â€œ 07:58 AM (PHT) Ã¢â‚¬â€ aeprnts (collaborator)
- `Add staff clock-in system, staff registration, and admin attendance monitoring`
- Merge remote `testbranch2` (reports removal, inventory rebuild) with local attendance features
- `Update AGENTS.md: staff inventory page deleted in merge; add merge integration note`
- Introduced a full **staff attendance/timekeeping system**:
  - `StaffTimesheet.tsx` (clock-in/out, timesheet, overtime/break metrics) at `/staff/timesheet`.
  - `StaffTimeInGate.tsx` Ã¢â‚¬â€ staff lockout until clocked-in on Orders / Payment Verification / Walk-in pages.
  - `AdminAttendance.tsx` Ã¢â‚¬â€ admin monitoring dashboard at `/admin/attendance`.
  - `attendanceStore.ts` + `staffRoster.ts` (storage + seeded roster).
  - Staff **registration** (admin "Register New Staff" dialog + `registerStaff` in AuthContext).
  - New routes, nav links (Clock-In & Timesheet, Attendance) and Quick Actions.

---

## August 30, 2026 10:21 PM (PHT) Ã¢â‚¬â€ Francis William Garcia
- **Created `PUSH_LOG.md`** (this log) and added the "PUSH LOG" tracking note to `AGENTS.md` (commit `59663e30`).
- Also pushed the previously-uncommitted `testbranch2` work to the remote (fast-forward `d89aa5fc..59663e30`): the PDF preview removal + the `testbranch-pdf` merge, combined with the collaborator's attendance update and the inventory system.

---

## August 31, 2026 03:53 AM (PHT) Ã¢â‚¬â€ aeprnts (collaborator)
- `feat: notifications & announcements system (priority tiers)`
- `feat: pricing management`
- `feat: payment methods + QR management`
- `feat: system-wide blue-white theme, pointer cursors, status-card redesign`
- `feat: staff management overhaul & Docufy rebrand`
- **Notifications/Announcements** Ã¢â‚¬â€ centralized `announcementsStore` + shared `NotificationsPage` (`/customer|/staff|/admin/notifications`): admin broadcasts announcements to All Users, per-user read tracking, **priority tiers (Regular / Important / Emergency)** with an **Important Announcements** section on top (red URGENT + amber IMPORTANT cards) and a clean **Notifications** section below; unread badge + amber attention dot in the sidebar (desktop + mobile). `type` field (announcement/pricing/maintenance/reminder/promo) is ready for future system-generated events.
- **Pricing Management** Ã¢â‚¬â€ `pricingStore` + `/admin/pricing`: shared pricing model (B&W / color tiers, paper-size surcharges, duplex savings, down-payment threshold) consumed live by print request, walk-in, invoice, landing, and order-tracking flows.
- **Payment Methods + QR** Ã¢â‚¬â€ `paymentMethodsStore` + `/admin/payment-methods` + shared `PaymentMethodQR`: admin-managed online payment methods used across verification and print requests (legacy hardcoded GCash pages left un-routed).

---

## August 31, 2026 04:30 AM (PHT) Ã¢â‚¬â€ prans
- `UI polish + maps + shop location` (commit `934702f8`), then **merged collaborator (aeprnts) `7d7f3761`** into `testbranch2` (merge commit `bd5c6c62`).
- **UI polish**: applied the light-blue-outline buttons (`border-2 border-blue-200`) with blue-fill-on-hover system-wide to non-destructive buttons; fixed white-on-white hover on Preview/View/status-toggle buttons.
- **Login page**: filled-blue "Log In" button + redesigned MFA "Verify" pill with press animation; "Back to Login" as a clean text-link with arrow.
- **Google Maps**: embedded a no-API-key Maps iframe in the landing page *Location* card behind a "Shop Location" button + mini window, and added a "Shop Location" button + map dialog to the customer dashboard (right of the welcome back message).
- **Merge**: resolved 5 conflicting files by keeping both feature sets (`LandingPage`, `ContentManagement`, `CustomerDashboard`, `JobBoard` hand-merged; `Staff.tsx` adopted the collaborator's authoritative rewrite). Build passes (2386 modules).

---

## August 31, 2026 04:55 AM (PHT) Ã¢â‚¬â€ prans
- Post-merge UI/UX session pushed directly to `testbranch2` (4 requests).
- **Task 1 Ã¢â‚¬â€ Live clock & date in Orders header**: `shared/UnifiedOrders.tsx` now shows a live PHT clock (updates every second) + full date (`weekday, month day, year`) under the page subtitle on the shared admin/staff Orders page.
- **Task 2 Ã¢â‚¬â€ Sidebar scroll preservation**: the mobile nav sheet (`shared/MobileNavSheet.tsx`) preserves the nav scroll position across open/close (the Radix sheet unmounts its content when closed; a `navRef` + saved `scrollTop` restores it on reopen). Desktop sidebar already persisted naturally.
- **Task 3 Ã¢â‚¬â€ Uniform buttons (Choose File reference)**: converted the remaining filled-blue primary CTAs in collaborator-added files (not covered by the earlier system-wide restyle) to the uniform white + light-blue-outline (`border-2 border-blue-200`, blue-fill-on-hover) style: `shared/NotificationsPage.tsx` (Create/Send Notification), `admin/Staff.tsx` (Add Staff / Create Staff Account / Save Changes), `admin/PricingManagement.tsx` (Save Changes), `admin/PaymentMethodsManagement.tsx` (Add Payment Method / Save). Kept AGENTS.md exclusions (destructive/red, amber warnings, green positive, status chips, nav, stateful Clock-In, and the reverted Place Order/Next Step CTAs).
- **Task 4 Ã¢â‚¬â€ Unified notifications (show both in each)**: made the bell dropdown AND the `/notifications` page show the SAME combined feed of admin announcements (`announcementsStore`) + order/payment/status system notifications (`notificationStore`). Bell dropdown (`Layout.tsx`) merges both kinds into one chronological list (announcements get priority-colored icons Megaphone/amber/red), and its unread badge now sums announcements + system notifications. The Notifications page adds a system-notification subscription, merges them into the "Notifications" section sorted newest-first with matching cards, and its unread count/mark-all-read covers both stores.
- Build passes (2386 modules).

---

## August 31, 2026 05:06 AM (PHT) Ã¢â‚¬â€ prans
- Follow-up polish pushed to `testbranch2` (3 requests).
- **SIEM security alerts removed**: deleted the admin Shield "Security Alerts" icon + its dropdown entirely from `Layout.tsx` (header) Ã¢â‚¬â€ state, presence, subscription, handlers, helpers, and the unused `Shield/MapPin/XCircle/Clock/Upload` icon imports all removed. Also deleted the now-orphaned `src/app/utils/siemAlertStore.ts` (no remaining imports anywhere). Build module count 2385.
- **Desktop sidebar scroll persistence**: the desktop sidebar `<nav>` in `Layout.tsx` now keeps its scroll position across navigation. Root cause: each page renders its own `<Layout>`, so Layout remounts on every route change and the sidebar jumped back to top. Fixed with a module-level `savedSidebarScrollTop` (survives remounts) + a `navRef`/`onScroll` on the `<nav>` and a mount-time restore. The sidebar now stays where the user left it until they scroll again. (The mobile sheet already had this from the prior push.)
- **Pricing hover text fix**: in `admin/PricingManagement.tsx`, "Reset to Defaults" (and the same-pattern per-row "Edit") buttons use `variant="outline"` whose base adds `hover:text-white` Ã¢â‚¬â€ combined with the light-blue `hover:bg-[#F2F7FF]` override it made the label white-on-light-blue (invisible). Added `hover:text-[#2F6FD6]` so the font stays a readable blue on hover.
- Build passes (2385 modules).

---

## August 31, 2026 10:31 AM (PHT) Ã¢â‚¬â€ prans
- Push of accumulated uncommitted work to `testbranch2` (5 requests this session).
- **Task 1 Ã¢â‚¬â€ Mark all as read font**: `Layout.tsx` bell dropdown "Mark all as read" button restyled to the uniform full-width style.
- **Task 2 Ã¢â‚¬â€ Search bar visibility**: added `bg-[#FBFDFF] shadow-sm ring-1 ring-blue-300` to the search inputs on `shared/UnifiedOrders`, `shared/UnifiedPaymentVerification`, `admin/InventoryManagement`, `admin/Staff`, `admin/AdminAttendance`, `shared/NotificationsPage`.
- **Task 3 Ã¢â‚¬â€ Inventory Active/Archived buttons**: moved the Active/Archived toggle next to "Add Item" in `admin/InventoryManagement.tsx` (2-col summary grid, matching button styling).
- **Task 4 Ã¢â‚¬â€ Staff AM/PM time-in/out**: `attendanceStore.ts` `getNextAction`/`timeIn`/`timeOut` are now period-aware (AM Ã¢â€ â€™ morning, PM Ã¢â€ â€™ afternoon; Time Out maps to the current active period). `staff/StaffTimesheet.tsx` + `shared/StaffTimeInGate.tsx` derive everything from `getCurrentPeriod()` + logs instead of the removed `nextAction` state; PHT date keys via `toDateKey(nowPHT())`.
- **Task 5 Ã¢â‚¬â€ System-wide PHT (UTC+8) time**: new centralized `src/app/utils/pht.ts` (toPHT/nowPHT/todayPHTKey/toPHTKey/formatPHTime/formatPHDate/formatPHDateTime) applied across all active display sites: announcements, order tracking, customer orders, customer dashboard notifications, shared orders (header clock + invoice + table + order-placed-at via `createdAt`), walk-in transactions, payment verification, admin attendance (adjust-dialog PHT input + late cutoff), ordersStore date key, new print request date, file-attachments upload date, Staff joinDate, job postedDate (JobApplyForm/JobBoardManagement/StaffProfile), JobBoard applied/interview dates. Dead/unrouted legacy files (AdminOrders, StaffQueueBoard, PaymentVerificationAdmin, staff/PaymentVerification) intentionally untouched.
- Also included earlier uncommitted work: Google Maps embed (LandingPage + CustomerDashboard), View Applicants uniform style (JobBoardManagement), per-user customer notifications (UnifiedOrders + NotificationsPage + Layout), bell badge removal (desktop + mobile), notification deep-open-to-order routing.
- Build passes (2386 modules).

---

## August 31, 2026 10:10 PM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: fix Orders list time grouping to match the whole system.
- **Orders list time grouping fixed**: in `shared/UnifiedOrders.tsx`, the Orders table Time column already showed PHT (`formatPHTime`), but the Morning/Afternoon/Evening grouping headers used `date.getHours()` Ã¢â‚¬â€ the DEVICE-LOCAL hour, not PHT. On any browser outside the PH timezone, an order would show e.g. "09:00 AM" yet be grouped under the wrong time period. `getTimePeriod` now derives the hour in PHT via `toPHT(date).getHours()`, so the grouping matches the PHT time displayed system-wide.
- Note: the admin "Time In Limit" feature was implemented then removed (per user) before this push Ã¢â‚¬â€ no trace remains; `AdminAttendance.tsx` and `attendanceStore.ts` reverted to their committed state.
- Build passes (2386 modules).

---

## September 01, 2026 04:41 AM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: system-wide header clock (internet GMT+8/Manila time) + New Print Request scroll-to-top.
- **Time utilities made timezone-independent**: `src/app/utils/pht.ts` rewritten. The old "add +8h then read device-local" hack double-added the offset on a GMT+8 device (showed 7am when it was actually 11pm). All "now"/format helpers now resolve the Manila wall-clock through `Intl.DateTimeFormat` with `timeZone: "Asia/Manila"`, so they are correct on any device. `nowPHT()` returns a synthetic Date whose device-local getters equal Manila wall-clock; `formatPHTime`/`formatPHDate` use Intl Manila directly. Internet sync (`syncInternetTime()`, worldtimeapi.org) still corrects a wrong device clock; kicked off globally in `src/main.tsx`.
- **`attendanceStore.ts`**: `nowPHT`/`formatPHT` delegate to the Intl Manila helpers (removed the +8h double-add); `formatPHT` now wraps `formatPHTime(d, { hour12:false })`.
- **Live header clock for ALL users**: `Layout.tsx` added a live clock immediately LEFT of the bell/notification icon in the shared top header (present on every authenticated page for customer/staff/admin). Desktop shows time + full date incl. year; mobile shows compact time with Clock icon. Styling: time text black, date darker blue `#2F6FD6`, reduced font sizes, no uppercase, "GMT+8" label removed. Ticks every second and re-renders once internet time resolves.
- **`UnifiedOrders.tsx` / `StaffTimesheet.tsx` / `StaffTimeInGate.tsx`**: all live clocks/timers/toast timestamps now use internet-corrected Manila time via `nowPHT()`/`toPHT()`/`internetUtcMs()`.
- **New Print Request includes images step auto-scroll**: pressing "Next Step"/"Back" in the Print Request stepper now scrolls back to the top. Root cause: the page scrolls inside Layout's `<main>` (`overflow-y-auto`), not the window, so the old `window.scrollTo(0,0)` did nothing. Added `scrollPageToTop()` (`NewPrintRequest.tsx`) which scrolls `document.querySelector("main")` (smooth) in addition to the window.
- Build passes (2386 modules).

---

## September 01, 2026 08:26 AM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: multi-dimensional pricing matrix (store + admin + order-flow adoption) along with other accumulated updates.
- **Multi-dimensional pricing matrix (pricingStore)**: `src/app/utils/pricingStore.ts` gained a full pricing matrix on top of the legacy flat rates (legacy kept working, labelled "Legacy Per-Page Rates" on admin). New `ColorTier`/`ContentType`/`PaperSizeKey`/`PhotoSizeKey`/`ServiceType` types + `PricingMatrix` (document[content][color][size], vellum[color][size], sticker[color], photo[price/minQty]); `DEFAULT_MATRIX` with published prices (Photo 2R Ã¢â€šÂ±10 min 6 Ã¢â‚¬Â¦ A4 Ã¢â€šÂ±60); `STORAGE_VERSION` 1.0Ã¢â€ â€™2.0 (reseeds, matrix persisted). Store API: `getMatrix`/`updateMatrixCell`/`setMatrix`/`resetPricing` (+ matrix), `getPriceFromMatrix`, `resolveColorTier`, `mapPaperSizeKey`, label maps + `SERVICE_TAB_LABELS`. `admin/PricingManagement.tsx` rebuilt: tabs per service type (Document card-grids, Vellum colorÃƒâ€”size table, Sticker per-sheet, Photo price + min order) + Legacy rates section.
- **Order flow adopts matrix + Photo as per-file print type** (customer `NewPrintRequest.tsx` + shared `UnifiedWalkInTransactions.tsx`, both flows): Step-1 service-type selector (Document/Vellum/Sticker/Photo grid) and global Photo config panel REMOVED Ã¢â‚¬â€ every order uploads files in Step 1 and Photo is now a per-file **Print Type** in Step 2 with its own size/finish/qty (`FileData.printType` incl. `"photo"` + `photoSize/photoFinish/photoQty`, defaults `2R`/`matte`/`1`); per-file matrix pricing via `getPriceFromMatrix`, photo Ã¢â€ â€™ `matrix.photo[size].price * max(1, qty)` with per-file min-qty validation on submit; Step 2 print-type buttons styled like the Back button (`variant="outline"` grid, icons Layers/FileText/StickyNote/Camera); Step 1 headings fixed; Step 4 per-file cards + breakdown dialog show photo info; paper sizes capitalized. PRINT-TYPE HOVER/ACTIVE THEMING: `group` + `group-hover:text-white` on icons/labels (visible on the dark-blue outline hover fill Ã¢â‚¬â€ fixes the perceived "deselect"); selected button = filled blue `bg-[#2F6FD6] text-white`, `transition-all duration-150 active:scale-95` press animation.
- **Dead file-preview UI removed system-wide**: `file-attachments.tsx` dropped inert "View" button + `onView` prop (and unused `Eye`/`Button` imports); `OrderTracking.tsx` removed dead `handleViewFile`/`onView` (kept live "View Invoice"/"View Page Color Breakdown"); `UnifiedOrders.tsx` removed dead `onView`; removed now-unused `Eye` (both flows) + `SERVICE_TYPE_LABELS` (walk-in).
- Build passes.

---

## September 01, 2026 10:26 AM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: merged pranswg's update (9 commits, 7d7f3761..4fc8fe95) with local Reports/dashboard/inventory work.
- **Dashboard full rewrite** (`admin/AdminDashboard.tsx`): header + welcome + date-range dropdown (This Month/Last Month/This Quarter/This Year/All Time/Custom), 3 tabs **Overview | Sales | Services**, no Inventory tab. Overview with 4 summary cards, Sales Trend area chart, Sales Comparison, Best Selling Services, Top Used Paper Sizes donut, Recent Transactions, **Inventory Snapshot** (Total/Low/Out cards + urgent items + "All inventory levels are currently healthy" + View Inventory button Ã¢â€ â€™ `/admin/inventory`). All data computed from `dataStore`/`inventoryStore`, no hardcoding.
- **Inventory Reports added** (`admin/InventoryManagement.tsx`): module nav "Inventory Overview | Reports"; Reports section with header + date filter (Today/This Week/This Month/Last Month/Custom), summary cards (Total/Low/Out/Stock In/Stock Out), Most Used Materials, Stock Movement bar chart, Inventory Alerts, Stock-In/Stock-Out history tables, Current Inventory Report table, category + item filters.
- **`inventoryStore.ts` stock-movement tracking**: new `StockMovement`/`StockMovementType` types + `movements[]` persisted to `localStorage('inventoryMovements')`, version bumped to `3.0`, `recordMovement()` helper; `stockIn`/`stockOut`/`deductPaperPieces` now record movements (person + reason); `getMovements(type?)`. `NewPrintRequest.tsx` `deductPaperPieces` call unchanged/backward-compatible.
- **Merged with pranswg's remote update**: pranswg redesigned `InventoryManagement.tsx` overview (2-col summary cards, Active/Archived toggle moved into the toolbar, white-base KPI button styling). The merge kept BOTH his overview redesign AND my Reports section Ã¢â‚¬â€ only the React import line conflicted (resolved to keep `useEffect` + `useMemo`).
- Build passes.

---

## September 01, 2026 09:21 PM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: merged aeprnts's dashboard/inventory-reports work + expanded mock sales data for dashboard testing.
- **Merge commit** `100acb00` pulled in aeprnts's `96c41a6` ("Add dynamic admin dashboard (Overview/Sales/Services) & inventory reports; stock-movement tracking") Ã¢â‚¬â€ `AdminDashboard.tsx` 3-tab rewrite, `InventoryManagement.tsx` Inventory Overview | Reports toggle, `inventoryStore.ts` stock-movement tracking (v3.0, `inventoryMovements` localStorage). Only `PUSH_LOG.md` conflicted (kept both entries, oldestÃ¢â€ â€™newest).
- **Mock customers** `c52332b0`: two online GCash orders seeded in `dataStore` for Payment Verification + Orders-list UI checking (Maria Santos pending / John Dela Cruz in-queue).
- **`src/app/utils/dataStore.ts`**: added **10 more seed orders** (`ORD-2026-0003` Ã¢â€ â€™ `ORD-2026-0012`) spanning **JunÃ¢â‚¬â€œSep 2026** so the admin dashboard has a multi-month **Sales Trend**, varied **Best Selling Services** (Colored/B&W/Photocopy/School Supplies), a filled **paper-size donut** (A4/Short/Long), meaningful **Total Sales / Orders / walk-in / active-customer** KPIs, and populated **Recent Transactions**. Kept the two Payment-Verification orders. Old months are mostly `Completed`/`Released`; one Aug order is `Canceled` (excluded from revenue); Sep has three completed/released today. First time the local branch reflects BOTH prans + aeprnts work in one history for aeprnts to pull.

---

## September 01, 2026 09:37 PM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: fixed Admin Dashboard Sales tab Ã¢â‚¬â€ trend views now aggregate ALL orders regardless of the selected date range.
- **`src/app/components/admin/AdminDashboard.tsx`**: the Sales tab defaulted to a "This Month" range, so its Daily/Weekly/Monthly trend charts only surfaced September's few orders (looked flat/broken) while the Overview's Sales Trend (all-orders) looked fine. Fix: `dailySales`, `weeklySales`, AND `monthlySales` in `computeMetrics` now iterate over ALL orders (not the range-scoped `filtered`), so all three Sales-tab views show the full JunÃ¢â‚¬â€œSep history regardless of the dropdown. Added shared `MONTH_INDEX` constant + `sortByMonthDay()` helper so Daily/Weekly buckets sort chronologically (oldestÃ¢â€ â€™newest) like Monthly. Range-scoped values (Total Revenue KPI, Sales Comparison, Best Selling, paper donut, recent transactions) unchanged. Build passes.

---

## September 01, 2026 10:45 PM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: session persistence, legacy order pages deleted, and collapsed-sidebar fixes.
- **Session persistence (refresh no longer logs you out)**: the auth state now remembers the logged-in user across page reloads. Refreshing while signed in keeps you on the page instead of bouncing back to the login screen; signing out clears it, and the 15-minute inactivity auto-logout still works.
- **Deleted the dead legacy order pages**: `StaffQueueBoard` (staff) and `AdminOrders` (admin) were imported but never routed (live pages are `StaffOrdersUnified` under `/staff/queue` and `AdminOrdersUnified` under `/admin/orders`). Previewed them first via temporary routes, then removed the files, their dead imports, and the temporary routes, and cleaned up the leftover comments referencing them.
- **Fixed collapsed-sidebar hover labels**: in desktop collapsed mode, hovering an icon (like Payment Verification) showed the label floating at the bottom instead of beside the icon. Names are now positioned right next to the hovered icon, vertically centered on it, and clear when the sidebar scrolls.
- **Fixed the collapsed-sidebar Profile button**: clicking the profile avatar while collapsed used to open a floating dropdown over the rail. It now expands the whole sidebar first (showing the full profile button) and opens the profile menu, matching the intended behavior.

---

## September 2, 2026 12:47 AM (PHT) - prans
- Push to `testbranch2`: system-wide in-app confirmation dialogs for every significant data-changing action (no browser alerts).
- **Rebuilt the shared `ConfirmationDialog`** (`src/app/components/ui/confirmation-dialog.tsx`) so every module confirms with an EXACT action-name confirm button (e.g. `Place Order`, `Cancel Order`, `Stock Out`, `Save Changes`, `Approve Payment`, `Reject Payment`) and a SAFE cancel label (`Go Back`/`Keep Item`/`Keep It`). Older dialogs no longer force typing `Docufy` (`requirePhrase` is now opt-in and reserved for highly destructive/irreversible actions: Payment Method delete, Pricing reset, Order cancellation, Payment rejection, Attendance reset day, Notification delete). Optional `loading` prop shows a spinner and disables both buttons as a duplicate-submit guard. Destructive styling stays on deletes/rejects/cancels; positive/save/approve actions use the non-destructive state.
- **Confirmation added to customer flows**: New Print Request `Place Order` (confirms file count/pages/total + payment method before reserving paper and creating the order); Payment Verification `Submit Reference`/`Confirm Order` (queued for admin/staff approval); Job Board customer application `Submit Application` (portfolio file noted); Walk-in Transactions `Proceed to In Queue` (order summary + total before enqueueing).
- **Confirmation added to Notifications**: the old browser `confirm()` for deleting a notification was replaced with the shared dialog (type `Docufy` + `Delete Notification`/`Keep It`); broadcasting a new announcement now confirms `Send ... Notification` first. Removed the last remaining `window.confirm()`/`alert()` calls in the app.
- **Sign Out confirmation everywhere**: Layout desktop sidebar + top-right profile menu, the mobile nav sheet, and the Customer/Staff/Admin profile pages now confirm `Sign Out` (`Stay Signed In` to cancel).
- **Staff Timesheet**: Time In / Time Out actions now confirm (live timer context + session name shown).
- **Staff admin page**: the Activate/Deactivate staff dialogs now use exact buttons `Activate`/`Deactivate` (were generic `Confirm`).
- All of the above build cleanly (`npm run build` passes; only the pre-existing large-chunk warning remains).

## September 2, 2026 (PHT) - prans
- Inventory Low Stock / Out of Stock alerts: added an automatic inventory alert module that watches the inventory store and emits a system notification whenever an item drops to or below its minimum stock (`Low Stock`, amber, Important). If an item runs completely out of stock, it emits an emergency `Out of Stock` alert (red, Emergency) instead. Alerts only go to **Staff and Admin** (not customers), each alert fires once per item (a localStorage state prevents duplicates while the item stays at the same status), and a low-stock alert is promoted to emergency if the item later goes fully out of stock. New alerts show at the top of the notifications panel, and the bell icon shows a colored unread dot (red for emergency, amber for important).
- **Staff Inventory page**: added a new read-only **Inventory** page for staff at `/staff/inventory` in the sidebar (also reachable by clicking `View Inventory` on an alert). It shows summary cards, a papers-left (pieces) card, and a filterable table with `All` / `Low Stock` / `Out of Stock` filter chips, so staff can see low/out items at a glance without editing stock.
- **View Inventory action from notifications**: the `View Inventory` button on an inventory alert runs the correct page for the signed-in role Ã¢â‚¬â€ `/staff/inventory` for staff, `/admin/inventory` for admin.
- **Inventory-aware notifications**: the notifications page now renders inventory alerts with color-coded styling (red emergency border + icon / amber important border + icon). Because this is a system alert, it only shows a `View Inventory` button and cannot be marked read.
- **Dashboard inventory snapshot**: the admin dashboard's Inventory snapshot now uses the same shared status logic as the rest of the app to detect low/out items, so the snapshot and the alerts stay consistent with the inventory page.
- All of the above build cleanly (`npm run build` passes; only the pre-existing large-chunk warning remains).

---

## September 3, 2026 09:35 AM (PHT) Ã¢â‚¬â€ prans
- Push to `testbranch2`: merged aeprnts's inventory alerts / confirmation-dialog work into the local branch and landed the "Home" + order-list + nav-order changes.
- **Merged aeprnts's commits locally** (`0b5e2763` confirmation dialogs + `3b904ea7` inventory low/out alerts & staff inventory page), resolving import conflicts in `Layout.tsx` and `MobileNavSheet.tsx` by keeping both sides' icon imports (`Home` + `Boxes`). Build passes.
- **"Home" added to profile dropdowns**: the desktop sidebar, top-right profile menu, and mobile nav profile dropdowns now include a **Home** option that navigates back to the landing page (`/`) for all roles.
- **Order list columns + details dialog cleanup** (`unified/UnifiedOrders.tsx`): removed the Type/Pages/Copies columns (and their sort wiring) from the admin/staff orders table for a tidier list; collapsed the Print Job Details and Additional Information sections of the order-details dialog so each is one unified container with hairline-separated grid cells (Attached Files, status/payment, hold/cancel/notes, Verify Payment inside).
- **Admin & staff sidebar tab order** (`adminMenuItems.tsx` + all staff page menus + mobile nav): reordered in both sidebars to: Dashboard, Walk-in Transactions, Payment Verification, Orders, Inventory, Attendance (admin), Staff (admin), Job Board (admin), Pricing Management (admin), Content Management (admin), Notifications. Staff keeps its staff-only **Clock-In & Timesheet** right after Dashboard; both keep **Inventory** and **Notifications**; admin keeps **Payment Methods** after Payment Verification.
- Build passes.

---

## September 3, 2026 01:35 PM (PHT) Ã¢â‚¬â€ prans
- **Reverted the customer mobile responsive polish** (`98ed32a2`, reverts `140574d1`): the previous push added an Order Progress timeline to `OrderTracking`, turned the CustomerDashboard/CustomerOrders order lists into mobile card rows, added a "Start a New Order" CTA to the customer dashboard, and reworked the NewPrintRequest nav buttons. These were deemed incorrect and reverted wholesale Ã¢â‚¬â€ the customer files (CustomerDashboard, CustomerOrders, NewPrintRequest, OrderTracking) and the docs (AGENTS.md, PUSH_LOG.md) are back to their state before that commit. Build passes.



---

## September 3, 2026 02:15 PM (PHT) - prans
- **ENTER KEY = PRIMARY ACTION (system-wide)**: pressing Enter in any dialog, confirmation prompt, or form now triggers that context's primary action (submit/confirm) instead of nothing or a stray newline - while never hijacking multiline text areas (Enter still inserts a new line there) and never double-submitting. Centralized in the shared dialog so it applies everywhere with one change.
- **Shared DialogContent Enter handler** (`ui/dialog.tsx`): while a dialog is open, a document-level Enter listener (added per-open, removed on close) finds the dialog's primary action - a `button[type="submit"]` first, else an element marked `data-primary-action` - and clicks it exactly once after `preventDefault()` (blocks the native double-submit). It skips when focus is inside a `textarea` (newline preserved) or outside that dialog; `Shift+Enter` is never intercepted.
- **ConfirmationDialog now submits on Enter** (`ui/confirmation-dialog.tsx`): the header + phrase field + footer are wrapped in a `display:contents` form whose submit handler runs the confirm action, and the confirm button is now `type="submit"` (kept `disabled={!canConfirm || loading}` for the destructive/cancel/requirePhrase safety); the legacy `onKeyPress`/`handleKeyPress` dead logic was removed. Covers all 59 confirmation usages (Place Order, Cancel Order, Stock Out/In, Approve/Reject Payment, Delete Notification, Reset Pricing, Sign Out, Time In/Out, etc.).
- **Formless admin CRUD dialogs get `data-primary-action`** so Enter triggers their primary button (which previously did nothing because there was no `<form>`): Inventory Add/Edit + Stock In/Out, Staff Register/Edit, Payment Methods Add/Edit, Pricing Management matrix price + legacy rate editors, AdminAttendance Adjust Time, and AdminProfile Change Password. Form-based dialogs (Job Board, Staff/Job apply, Login/SignUp/ForgotPassword, customer Payment Verification) already submit natively via their `type="submit"` button + `<form onSubmit>`. Read-only detail/invoice dialogs (no meaningful primary action) are intentionally left alone. Build passes.



---

## September 3, 2026 03:00 PM (PHT) - prans
- **MOBILE HEADER - PROFILE ICON REMOVED, ACCOUNT VIA SIDEBAR ONLY**: the top-right circular avatar/profile button (and its dropdown) in the shared header (`Layout.tsx`) is now hidden at mobile widths for ALL roles (`{!isMobile && ...}` wraps it), so the mobile header stays clean and uncluttered at `hamburger | page title | notifications` with no empty gap. Desktop is unchanged - staff/admin/customer still open their profile from the top-right avatar and the desktop left sidebar. On mobile, account access is exclusively through the hamburger menu's sidebar (`MobileNavSheet`), which already has a clearly-tappable account section at its bottom (avatar + email/role + dropdown `Home` / `My Profile` / `Sign Out`); tapping `My Profile` closes the sidebar and lands on the full profile page (Account Settings / Personal Information / Change Password all live there), and the browser Back / profile back-arrow return to the previous page naturally via normal router history. No separate profile system created; existing account functionality untouched. Build passes.



---

## September 3, 2026 03:30 PM (PHT) - prans
- **LANDING PAGE "GET STARTED" CTA - ALWAYS SOLID FILLED**: the hero "Get Started" button (the Landing Page's primary CTA, navigates to `/signup`) is now always a filled primary-color button instead of the previous white/outline style. It uses `bg-[#1D73EC]` (Docufy customer primary blue) with white text for contrast, a desktop hover that darkens to `bg-[#10316B]` plus a subtle lift, and an `active:scale-95` pressed/active state for touch devices. It stays `size="lg"` (`h-10 px-6`) for a comfortable mobile tap target and gets a subtle blue shadow for extra prominence. The filled style is consistent on desktop, tablet, and mobile and never switches to an outline/transparent style at smaller widths. The button's functionality and destination (`/signup`) are unchanged. Build passes.



---

## September 3, 2026 04:00 PM (PHT) - prans
- **NOTIFICATIONS - SIDEBAR TAB REMOVED, ACCESS VIA HEADER BELL DROPDOWN**: removed the dedicated "Notifications" tab/item from EVERY sidebar (desktop left sidebar, admin menu, staff/customer mobile `MobileNavSheet`, and all per-page `menuItems` arrays passed to the shared Layout), so no empty space or broken nav item remains. The buried urgent-announcement dot on that sidebar item and its now-unused `urgentAnnouncements` state in Layout/MobileNavSheet were removed too. The original Notification page/routes (`/customer/notifications`, `/staff/notifications`, `/admin/notifications`) are UNCHANGED and still exist.
- **Header bell icon kept + "Show All Notifications" button**: the header bell stays fully functional on all screen sizes with its unread-count badge and dropdown (merged notifications + announcements feed). A new prominent solid-blue "Show All Notifications" button was added at the BOTTOM of that bell dropdown (below "Mark all as read") that closes the dropdown and navigates to the role's original Notifications page (`handleShowAllNotifications` -> `navigate('/{role}/notifications')`).
- **Navigation flow change**: access to the full Notifications page is now `Header Bell Icon -> Notification Preview/Dropdown -> Show All Notifications -> Original Notification Page` instead of `Sidebar -> Notifications -> Page`. No duplicate notification system, no second page, no bottom navigation bar, no broken routes or dead links. Build passes.



---

## September 3, 2026 06:30 PM (PHT) - prans
- **NOTIFICATION DROPDOWN - LARGER, READABLE PANEL**: the header bell dropdown is now a proper notification panel instead of a small compact popover. Width grew (20rem -> 24rem) and it got a max-height capped to the viewport (`max-h-[min(32rem,calc(100vh-6rem))]`) as a flex column so the header + footer buttons stay fixed while only the list scrolls. Each notification item is roomier and more legible: more horizontal/vertical padding, a bigger icon chip (40px, larger icon), larger title/message/time text, and a bigger unread dot. The header shows the title plus an "N unread" count, the empty state is larger, and the "Mark all as read" / "Show All Notifications" buttons are taller (h-11) with comfortable spacing. Responsive on mobile - it stays within the viewport width (`min(24rem, calc(100vw-1.5rem))`, right-anchored) and height so there is NO horizontal scrolling.
- **NOTIFICATION CLICK = VIEW FIRST, THEN MARK READ**: clicking a notification/announcement in the bell dropdown no longer just silently marks it read and closes. It now opens a DETAIL DIALOG that shows the type badge (Order / Payment / Status Update / Inventory Alert, or the announcement type), an Important/Emergency priority badge when applicable, the full title, the COMPLETE message, and the date/time (PHT). Mark-as-read now happens ONLY once the detail is opened/viewed, never before.
- **Action button + no accidental navigation**: if the notification has a destination, the detail dialog shows a primary action button - "View Order", "View Inventory", or "Go to Page" - that the user clicks to navigate to the relevant page (order tracking for customers, orders list for staff/admin, inventory for alerts). Notifications without a destination show a plain Close. Already-read notifications still open the same detail view. Notifications are never deleted or hidden when marked read and stay in the full Notifications page/history. "Mark all as read" remains its own separate action.



---

## September 3, 2026 08:15 PM (PHT) - prans
- **STAFF GAIN FULL INVENTORY ACCESS (same as admin)**: staff can now manage inventory exactly like the administrator instead of only viewing read-only stock levels. The read-only `StaffInventory.tsx` was replaced with a thin wrapper that reuses the shared admin `InventoryManagement` component (with the staff sidebar menu + "Inventory" title), and that admin component was made configurable (optional `menuItems`/`title` props, defaulting to the admin values) so the same full module serves both roles. Staff at `/staff/inventory` now have every capability admins do: Add/Edit items, Archive/Restore, Stock In / Stock Out, the Papers Left card, Low-Stock banner, summary cards, Active/Archived filters with search, and the Reports tab (material usage, stock-movement chart, inventory alerts, Stock-In/Out history, and Current Inventory report). Stocking actions record the acting staff member's name just like admin. This also means the inventory notification "View Inventory" action now lands staff on the full management page for both low-stock and out-of-stock alerts. Build passes.

---

## September 3, 2026 05:20 PM (PHT) - prans
- **SIGN OUT CONFIRMATION Ã¢â€ â€™ RED "LOG OUT" BUTTON (all roles)**: the Confirmation dialog's action button now reads "Log Out" instead of "Sign Out" and renders as a red (destructive) filled button with white text that darkens on hover - so the destructive intent is clear and the font color stays legible. Applied consistently across every sign-out confirmation (desktop sidebar, top-right profile dropdown, admin/staff/customer profile pages, and the mobile nav sheet).
- **ERROR USAGE CONFIRMATION ON ORDER COMPLETION**: staff/admin no longer auto-deduct paper when an order is placed. Instead, when marking an order **Completed**, a confirmation dialog opens showing the **Inventory items used** (each paper size with its expected sheet count). The dialog has a dropdown to select an **Error Usage reason** (Printing Error, Equipment Issue, Out of Ink, Paper Jam, Misalignment, Customer Request, Other) plus a **Wasted Sheets** counter. Two footer actions: **"No Errors"** confirms the order with no errors, and **"Confirm Error Usage"** (requires a reason) records the error. Only on completion does the expected paper get deducted from inventory (skipping legacy orders to avoid double-counting), and the error usage (reason + wasted sheets + no-errors flag) is stored on the order for audit.
- **ONE ORDER PER STATUS MOCK DATA**: the seeded orders were rebuilt so there is exactly one order for each status (Awaiting Payment, Received, In Queue, Printing, Completed, On Hold, Released, Canceled) instead of many duplicates - making each status card / filter demo cleanly.
- **TERMINAL STATUSES HIDDEN BY DEFAULT IN QUEUE**: Completed, Released, and Canceled orders no longer appear in the default orders list/view (alongside Awaiting Payment) - they only show when their specific status filter is selected, keeping the active queue focused on in-progress work.
- **STATUS BUTTON FONT COLOR FIXED (order details)**: the selected (active) status buttons in the order detail view - Received, In Queue, Printing, Completed, On Hold, Released - previously had solid blue/gray fills with dark default text (low contrast). They now use white text on the colored fill so the label is always readable. Build passes.

---

## September 4, 2026 11:31 AM (PHT) - Althea09-git
- **SERVICES & PRICING MOBILE REDESIGN** (LandingPage.tsx): the Services & Pricing section on mobile is now a compact, interactive 3-card carousel instead of large stacked vertical cards.
- **3 COMPRESSED CARDS**: redesigned the cards as (1) Standard Document Printing, (2) Binding & Finishing, and (3) Document Encoding & Layout, with a compact primary "Order Now" CTA at the bottom of each.
- **INTERACTIVE B&W / COLOR TOGGLE**: the Standard Document Printing card now has an inline pill toggle that switches between the B&W per-page rate and the Color per-page rate (and swaps the description), wired to the live pricing store.
- **CAROUSEL INTERACTION**: the cards form a horizontally swipeable/snapping slider with left/right navigation arrows and pagination dots at the bottom; the centered/active card gets a blue border + soft glow highlight that follows swipe, arrow, dot, or hover.
- **COMPACT + SQUARE LAYOUT**: reduced internal padding, icons placed inline next to the card headers, and mobile cards are square (aspect-square) instead of tall rectangles; hover uses a smooth elevation lift hover:-translate-y-1 hover:shadow-lg with the same 	ransition-all duration-300.

---

## September 4, 2026 (PHT) - prans
- **CUSTOMER SIDEBAR - NOTIFICATIONS TAB REMOVED (re-applied after PrintTransaction merge)**: the customer print-request page (`shared/PrintTransaction.tsx`, which now powers customer New Print Request after the print-flow unification) had re-introduced a "Notifications" tab in the customer sidebar menu. Removed it so the customer sidebar again shows only Dashboard, Print Request, My Orders, and Job Board - notifications are accessed only via the header bell dropdown (Bell -> "Show All Notifications" -> `/customer/notifications`), the same as before the unify. The staff menu in the same file is unchanged. Build passes.

---

## September 4, 2026 2:57 PM (PHT) - Althea09-git
- **SERVICES & PRICING MOBILE CARDS COMPACTED**: reduced card width to 200px, padding to p-4, icons/text/price all smaller for a more compact carousel on mobile; cards use a square (aspect-square) layout on mobile.
- **SERVICES & PRICING BLUE HIGHLIGHT FIXED**: removed the isManualNav guard that was blocking the scroll-based active-card detection; cards now highlight reliably on click/tap/swipe with a clear blue background tint (bg-[#F0F7FF]), thick blue border, blue ring, and strong shadow; added onTouchStart for reliable mobile tap detection.
- **CAROUSEL AUTO-CENTERS ACTIVE CARD**: added IntersectionObserver so the active card auto-scrolls to center when the Services & Pricing section enters the viewport; on initial page load the first card centers after a short delay; arrows/dots also scroll to center.
- **SHOP INFO CARDS SIDE-BY-SIDE ON MOBILE**: changed the grid from grid-cols-1 to grid-cols-2 so Shop Hours and Location sit in one row on mobile; cards made compact with smaller padding, icons, text, and a responsive stacked layout.
- **JOB OPENINGS COMPACT ACCORDION ON MOBILE**: replaced the large vertical job cards with a compact collapsible accordion list; collapsed row shows title, schedule, Active badge, and a rotating chevron; tap expands to reveal description and Apply Now button with smooth height animation; title wraps instead of truncating, 44px touch target, flexible header layout.
- **ABOUT DOCUFY INTERACTIVE ON MOBILE**: made the about card compact (p-5 instead of p-12) with a short one-line preview and a Show more/Show less toggle; expands with a smooth height animation; added hover lift effect; desktop keeps the full body.
- **FOOTER MINIMALIST ON MOBILE**: centered stack layout with smaller logo, shorter link labels (Terms/Privacy/Contact), subtle copyright, and clean spacing.

---

## September 4, 2026 3:09 PM (PHT) - Althea09-git
- **HEADER LOGO/TITLE ALIGNMENT**: grouped the logo icon and "Docufy PSMS" text with a fixed 8px (gap-2) flexbox gap at all screen sizes so they align cleanly on the left of the header (removed the larger desktop gap).
- **HERO TITLE SPACING FIX**: the hero title now trims the first segment of the stored heroTitle before rendering, so a saved "Print , Track" value displays cleanly as "Print, Track" (no stray space before the comma/output line break).
- **JOB OPENING ACCORDION HEADER CONSISTENCY**: moved the "Active" badge out of the job-title row and positioned it inline next to the "Schedule" text on its own line, so the job title (left) and the right-aligned chevron button stay perfectly vertically aligned regardless of title length; headers now share a uniform minimum height (min-h 52px).
- **SERVICES & PRICING PRICE ELEMENTS NORMALIZED**: normalized the pricing typography across all three cards into one consistent structure - currency symbol (Ã¢â€šÂ±) at small semibold, the price digit at a uniform 2xl bold, and the unit/qualifier (/ page, starting, / document) at a small medium-weight gray, all baseline-aligned so the currency, digit, and unit line up identically on every card.

---

## September 4, 2026 3:40 PM (PHT) - Althea09-git
- **ADMIN DASHBOARD MOBILE - METRIC CARDS (Overview)**: the four metric cards (Total Sales, Total Orders, Walk-in Transactions, Active Customers) now sit in a 2-column grid on mobile (grid-cols-2 gap-3) instead of full-width stacked cards. Card interiors compacted to p-3 rounded-xl with the icon left and label+value beside it (flex gap-3); labels are small gray (text-xs text-gray-500, uppercase on mobile), values are text-lg font-bold; the percentage trend stays but the "vs previous period" subtext is hidden on small screens to keep card height tight.
- **ADMIN DASHBOARD - SALES TREND CHART**: chart container height capped to h-48 on mobile (about 192px) so it stops causing excessive vertical scrolling, expanding back to 280px on desktop (lg).
- **ADMIN DASHBOARD - SALES COMPARISON CARD**: This Period and Previous Period changed from stacked blocks into a side-by-side 2-column grid on mobile (flex justify-between on desktop); the percentage badge was moved up onto the same line as the currency amount (e.g. Ã¢â€šÂ±625.00 + green/red trend pill); the "You earned Ã¢â€šÂ±X more/less..." summary note compacted to text-xs text-gray-500 with a reduced top margin and a slimmer progress bar (h-2 on mobile).
- **ADMIN DASHBOARD - RECENT TRANSACTIONS**: on mobile the transaction list now shows only the first 4 by default with a "See all N transactions / Show less" toggle button to reveal the full list (the header "View All" still links to the orders page). Rows compacted to py-2.5 vertical padding, keeping Order ID + type badge on top, customer name below, and price + Paid/Pending status badge on the far right.
- **ADMIN DASHBOARD - INVENTORY SNAPSHOT**: the three metric counts (Total Items, Low Stock, Out of Stock) were converted from a stacked list into a 3-column centered grid (grid-cols-3 gap-2 text-center) with compact gray boxes (p-2.5 bg-gray-50 rounded-lg) instead of large colored tiles. The "All inventory levels are currently healthy" message is now a compact single-line text-xs banner (flex gap-2 p-2 bg-green-50 text-green-700 rounded-md).

---

## September 4, 2026 3:50 PM (PHT) - Althea09-git
- **ADMIN DASHBOARD - SALES TAB METRIC CARDS (mobile)**: the four sales metric cards (Total Revenue, Highest Sales, Lowest Sales, Sales Periods) were converted from a vertical stack into a 2-column grid on mobile (grid-cols-2 gap-3). Cards compacted to p-3.5 rounded-xl; section titles are uppercase text-[10px] font-bold tracking-wider gray; key numbers are text-base font-bold gray-900. Highest/Lowest Sales now show the month as a compact green/red badge with the price underneath (tight grouping); Sales Periods keeps the count and "months with data" inline on the same row.
- **ADMIN DASHBOARD - SERVICES TAB TOP METRIC CARDS (mobile)**: the three cards (Most-Used Service, Best-Selling Revenue, Total Orders) were converted to a compact grid (grid-cols-2 on mobile, grid-cols-3 on desktop) with p-3 padding; section titles are uppercase text-[10px] font-bold gray; primary text is text-xs font-semibold gray-900 with the count/revenue shown as a small pill badge underneath. On mobile the third card (Total Orders) centers beneath the top two via col-span-2 + max-w-[50%] + centered flex column so the number and "all services" badge are balanced.
- **ADMIN DASHBOARD - SERVICES TAB BREAKDOWN TABLE (mobile)**: table padding compacted to py-2 px-2.5 with text-xs; the "% of Total" column is hidden on mobile and replaced by a mini inline blue progress bar under each service name; the table wrapper is w-full overflow-x-auto.
- **ADMIN DASHBOARD - SERVICES TAB REVENUE CHART (mobile)**: the Revenue by Service bar chart container was capped to h-44 on mobile (restoring to 300px on desktop) to prevent excessive vertical scrolling.

---

## September 4, 2026 5:02 PM (PHT) - Althea09-git
- **HEADER CLOCK / TITLE COLLISION FIX (all dashboard views)**: in the shared Layout header (src/app/components/Layout.tsx), the page-title container gained min-w-0 flex-1 and the h1 gained min-w-0 truncate, while the hamburger/back buttons got shrink-0 and the live clock + notification bell container got flex-shrink-0. Long page titles now truncate cleanly instead of pushing the live timestamp/bell off-screen on narrow mobile viewports. Because this is the single shared header, it applies globally to Attendance, Orders, Job Board, Inventory, and every other dashboard page.
- **ADMIN JOB BOARD - COMPACT CARDS WITH ACCORDION (mobile)**: job cards are now compact by default showing only the Title, Job Type tag, Applications count chip, and action buttons; the full description is hidden behind a collapsible accordion ("Show description"/"Hide description" with animated height + rotating chevron) via a new expandedJobId state. Action buttons are grouped in a flex items-center justify-between row with compact text-xs styles so they no longer overflow the right edge. Duration, Applications, and Posted ID were condensed into a single horizontal stats bar (flex gap-4 text-xs text-gray-500 py-2 border-t border-gray-100).
- **ADMIN JOB BOARD - APPLICANTS VIEW (mobile)**: the applicants header is now left-aligned and stacks vertically on mobile with the "Back to Job Postings" button above the title; the title is compact (text-lg font-bold text-gray-900 on mobile, restoring to text-2xl on desktop) and the subtitle is smaller (text-xs text-gray-500). The empty state is a full-width centered card (p-8 text-center bg-gray-50/50 border-dashed rounded-xl) with an Inbox icon and helper text for a balanced look.
- **ORDERS - STATUS METRIC CARDS COMPACT GRID (mobile)**: the 8 status cards on the Orders management page (shared UnifiedOrders) now sit in a 2-column grid on mobile (grid-cols-2, expanding to 4 on desktop) with compact p-2.5 cards, smaller icon chips, text-lg bold counts, and the descriptive subtext hidden on mobile (hidden sm:block). Filter-on-click, hover, and active blue highlight behavior preserved.
- **WALK-IN REVIEW SCREEN - 2-ROW ACTION BUTTONS (mobile)**: on the walk-in review step (PrintTransaction step 4), the bottom buttons are re-laid out in two rows - a top grid-cols-2 row with Back (secondary) and Cancel Order (red), and a full-width "Proceed to In Queue" blue primary CTA below (touch-friendly py-2.5/py-3 text-xs/sm) instead of a crowding single row.
- **NUMBER OF COPIES + QUANTITY UNIFIED STEPPER (both flows)**: replaced the plain numeric inputs for "Number of Copies" and (photo) "Quantity" with a single reusable NumberStepper control - a minus (-) button, a centered editable number field, and a plus (+) button in a bordered rounded container with touch-friendly padding. The input keeps a temporary string draft state so users can backspace/erase cleanly, with the value clamped back to the minimum on blur. The minus button is disabled at the minimum threshold, and clicking +/- immediately recalculates and updates the file's subtotal. For photo Quantity, the minimum is the size's minimum-batch requirement from the pricing matrix (e.g. 2R min 6); for copies it is 1.
---

## September 4, 2026 9:20 PM (PHT) - prans
- REAL GCASH REFERENCE-NUMBER OCR DETECTION (customer PaymentVerification): replaced the fake/mock auto-detect with real OCR via Tesseract.js (client-side, worker cached). The uploaded payment screenshot is preprocessed (upscaled, grayscale, contrast boost) so light-gray ""Ref No."" / ""Reference Number"" / ""Ref. No."" labels become readable, and the digits right after the label are extracted even when the number wraps across two rows; falls back to a standalone digit run only when no label is found, preferring a ~13-digit GCash-style length to avoid grabbing random numbers/phone numbers. The detected number auto-fills into the still-editable reference field (the user keeps the image preview to review/correct); a scanning spinner shows while OCR runs.
- AUTO-DETECT IS GCASH-ONLY + INFO NOTES: the OCR auto-scan only runs when the selected payment method is GCash. Informational notes added in two places only: (1) admin ''Add/Edit Payment Method'' dialog says automatic reference-number detection only works for GCash; (2) the customer print-request payment method section shows a note when a non-GCash online method (e.g. Maya) is chosen, explaining the reference is entered manually for that method.
- PROOF-OF-PAYMENT ACTION BUTTONS (PaymentVerification): the ''View'' button was restyled to match the ''Change'' button (same white/bordered/hover look), and a red X remove button was added beside Change to clear the uploaded file, preview, and any auto-detected reference.
- DARKER BUTTON OUTLINES (system-wide ui/button.tsx): the default/outline/secondary button variants changed their light blue border (border-blue-200) to a darker more visible border-blue-400 so outline buttons like ''Back'' are clearly visible.
- PRINT OPTION SELECTED LEFT-BORDER INDICATORS (PrintTransaction): the selected Color Mode option and Photo Finish option now keep their full selected style plus a soft rounded blue left-edge indicator bar; the Photo Finish (Matte/Glossy) options were re-stacked vertically (Glossy top, Matte below) and the photo panel re-arranged so Photo Size + Quantity stack on the left and Finish on the right.
- TIGHTER ORDERS & PAYMENT-VERIFICATION TABLES: reduced column horizontal padding (px-6 to px-4), narrowed the # column (w-16 to w-12), tightened the avatar-to-customer-name gap (gap-3 to gap-2), and matched the Orders period group-row padding, so the numbers, customer names, and categories sit closer together.

---

## September 5, 2026 8:17 AM (PHT) - agopr
- **Customer Dashboard complete redesign**: order-focused layout with welcome greeting first, 3 summary cards (Total Orders, In Progress, Ready for Pickup), prominent Current Order section with 4-step progress timeline, Recent Orders list with search, and blue Shop Hours + Quick Tips cards.
- **Shared AnnouncementDetailsModal**: new reusable component (`src/app/components/shared/AnnouncementDetailsModal.tsx`) used by both the dashboard announcement banner and the Layout notification dropdown for a consistent announcement viewing experience.
- **Dashboard announcement banner**: clickable cards (no arrow/CTA) for important/emergency announcements that open the shared modal; all urgent banners shown (emergency first).
- **Layout header improvements**: added `headerSearch` prop for optional search field, enlarged notification bell for better touch interaction.
- **TypeScript fixes across 7 stores**: fixed `Set.delete()` returning boolean in subscribe cleanup functions (dataStore, notificationStore, attendanceStore, applicationsStore, ordersStore, jobsStore, paymentMethodsStore) causing `useEffect` type errors; fixed CustomerProfile null/undefined mismatch and implicit `any` on setFormData callbacks.

---

## September 5, 2026 8:50 AM (PHT) - agopr
- **Staff Dashboard complete redesign**: removed Quick Actions, Shop Hours, and Staff Reminders. Replaced with operational-first layout: 4 summary cards (Total Orders, On Hold, In Progress, Ready for Pickup), Orders Requiring Attention section (on-hold and unverified-payment orders with issue details), Active Orders queue table (desktop table + mobile stacked list with position, customer, service, status, source, and time ago), Inventory Status panel (total/low/out-of-stock counts with problem item list), and Recent Activity feed.
- **Staff Dashboard data sources**: now subscribes to both ordersStore and inventoryStore for live reactive data across all operational sections.

---

## September 5, 2026 9:09 AM (PHT) - agopr
- **Notifications page redesigned as a compact unified inbox**: removed the separate "Important Announcements" section and oversized notification cards. Announcements and order/payment/status/inventory system notifications now live in ONE list, grouped by Philippines date (TODAY / YESTERDAY / MONTH DAY). Each item is a compact row â€” small tinted icon, single-line title (bold when unread), one-line message, PHT timestamp, and a small unread dot. Priority is shown through subtle indicators only: small red Emergency / amber Important badges, a thin colored left border, and a faint background tint â€” no loud full-card backgrounds. Clicking any item opens the SAME shared AnnouncementDetailsModal (mark-as-read happens only once viewed; read items stay visible and clickable). Compact pill filters added: All / Unread / Announcements / Orders / Inventory. Top area is now just the header, an unread-count pill, and "Mark all as read". Inline action links ("View Inventory" / "View Order") appear only on notifications that genuinely need one. Admin's Create Notification button/dialog and hover delete actions preserved. Content centered at a comfortable width with clean responsive mobile stacking.
- **Inventory removed from the customer-facing Notifications page (role separation)**: inventory is an internal operational module, so customers no longer see the Inventory filter chip â€” the filter row is now role-aware (customers see All / Unread / Announcements / Orders only; the Inventory filter appears exclusively for Staff and Admin). Customer notification feeds also skip inventory-type notifications defensively, so no internal stock/low-stock/out-of-stock information can surface to customers. Admin and Staff inventory functionality (pages, menus, dashboards, stock alerts, paper tracking) is unchanged.


---

## September 5, 2026 1:57 AM (PHT) - prans
- MERGED COLLABORATOR DASHBOARD/INBOX REDESIGN WITH LOCAL UI BATCH: merged origin/testbranch2 (agopr's Customer Dashboard redesign, Staff Dashboard as operational control center, unified Notifications inbox w/ shared AnnouncementDetailsModal, Layout headerSearch, and TS fixes across 7 stores) into the local testbranch2 alongside the uncommitted UI-polish + shop-photos + online-payment-draft batch. Conflicts were limited to the two dashboard files (auto-merge kept everything else, incl. OrderTracking). Resolutions: StaffDashboard kept the collaborator's operational redesign wholesale (the local activeOrders crash-fix was already inherent); CustomerDashboard kept the collaborator's new layout and RE-ADDED the local Shop Photos gallery into the blue Shop Hours card (toggle + 3-col thumbnail grid + full-screen lightbox dialog) since the collaborator's redesign had removed the old Shop Location map dialog the gallery lived in. Both works now coexist; build passes.
- SHOP PHOTOS RE-SETTLED INTO SHOP HOURS CARD (customer dashboard): the shop-photos gallery ("View Shop Photos"/"Hide Shop Photos" toggle + thumbnail grid + lightbox, backed by shopPhotosStore) now lives inside the blue Shop Hours card of the redesigned customer dashboard instead of the removed Shop Location map dialog - the thumbnails use white/20 borders and a white/80 toggle label to sit on the blue card, and the lightbox is unchanged.
- CUSTOMER DASHBOARD SEARCH FIELD IN HEADER (collaborator, kept): the redesigned dashboard passes a search field into the shared Layout header (new headerSearch prop) that filters Recent Orders live by order id/service/file/status; the announcement banner renders all important/emergency announcements (emergency first) as clickable cards opening the shared AnnouncementDetailsModal.

---

## September 5, 2026 3:03 PM (PHT) - agopr
- **TypeScript installed + strict typecheck added (repo-wide)**: the project previously had no `typescript` package or tsconfig.json, so `npm run build` (vite/esbuild) stripped types without ever checking them â€” errors only showed up in the VS Code TS server and two genuine runtime bugs (an undefined `showLabels` reference in Layout, and hooks placed after an early return in MobileNavSheet) went unnoticed. Added `typescript@7.0.2`, `@types/react-dom`, `@types/node` as devDependencies, a `tsconfig.json` (strict mode, unused-locals/params disabled to tolerate dead legacy files, `moduleResolution: bundler`, `@/*` path alias), and a new `"typecheck": "tsc --noEmit"` npm script. Fixed all ~140 reported errors across ~20 files so `npm run typecheck` now exits clean.
- **UnifiedOrders runtime crash fixed**: added the missing `const navigate = useNavigate()` (the hook was imported but never assigned, so clicking "Verify Payment" in an order detail would throw at runtime) and aligned the page's local `OrderType` with the orders store (added the `awaitingPayment` status, `paymentMethod`, `paymentProofUrl`, `customerEmail`, `specificPages`, `cancellationReason`, and loosened the string-union fields) so the store's orders typecheck against it.
- **Store type widenings to satisfy strict TS**: `ordersStore.ts` OrderType gained `customerEmail`/`specificPages`; `jobsStore.ts` JobType gained `salary?`/`schedule?`; removed stray `id`/`description` fields from mock literals in `dataStore.ts`/`inventoryStore.ts`; typed the reduce in `invoiceUtils.ts`; fixed the `NodeJS.Timeout` reference in `sessionManager.ts` (now `ReturnType<typeof setTimeout>`); made the candidates args in the Staff/JobBoard/JobApply proposal maps typed; non-null-asserted `orderId` in customer PaymentVerification. No feature behavior changed â€” purely type/compile correctness.
- **Docufy sidebar restructured to 7 core items under section headings (IA redesign)**: the single sidebar is now organized under three non-clickable section headings â€” MAIN (Dashboard, Orders, Payment Verification, Walk-in Transactions, Inventory), OPERATIONS (parent Operations -> Attendance, Job Board), and MANAGEMENT (parent Management -> Staff, Payment Methods, Pricing Management, Content Management). Orders and Payment Verification stay directly accessible first-level items (no longer nested under Transactions); the old "Transactions" parent (which grouped Walk-in, Payment Verification, Payment Methods) is gone. Only Operations and Management act as expandable/collapsible parent rows whose children (Attendance/Job Board and Staff/Payment Methods/Pricing/Content) render indented inline in the SAME sidebar â€” no second sidebar, flyout, or secondary panel. Staff nav mirrors the same MAIN/OPERATIONS structure (Operations -> Clock-In & Timesheet) with admin-only items hidden. Rebuilt in `navigationConfig.tsx` (single source of truth) and applied to both the desktop sidebar (`Layout.tsx`) and the mobile drawer (`MobileNavSheet.tsx`).
- **Parent expansion persists across pages**: new `navExpandState.ts` holds a module-level snapshot of which parent rows are expanded, so a manually-opened Operations/Management group stays expanded while navigating between pages (Layout remounts every route). Active child routes still auto-expand their parent (e.g. /staff or /admin/staff opens Management with Staff highlighted). Collapsed (icon-only) sidebar still auto-expands on parent click so children never spawn a separate panel.

---

## September 6, 2026 9:41 AM (PHT) - aeprnts
- UNIFIED SUMMARY CARD COMPONENT (standardized KPI/stat cards, styling only): new shared `src/app/components/ui/summary-card.tsx` â€” a single `SummaryCard` built EXACTLY on the Admin Dashboard Overview master design (the old `StatCard`): `w-11 h-11 rounded-xl` blue icon chip + `w-5 h-5` icon on the LEFT, label `text-xs font-medium text-slate-500` truncate, value `text-xl sm:text-2xl font-semibold text-slate-900 leading-tight`, optional `subtitle` row (`text-[11px] text-slate-400`), card shell `p-4 rounded-xl border border-slate-200/70 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)] flex items-center gap-4`. Props keep status/color variation legal (`iconBg`/`iconColor`/`labelColor`/`valueColor`, clickable hover border, `active` filter state = accent border + tinted bg, `highlight` filled-blue variant for the Payment Verification "Total Verified" card). The AdminDashboard Overview `StatCard` was DELETED and its 4 KPI cards (Total Sales/Total Orders/Walk-in/Active Customers) now render through `SummaryCard` (trend row preserved via a new local `TrendText` helper). Every standalone summary/KPI/stat card was converted to the SAME component so the icon-left / label-above-value / identical size+typography+padding structure is consistent everywhere: Staff Dashboard 4 KPI cards, InventoryManagement main Items/Low-Stock cards + Reports-tab 5 stat cards (keep their green/amber/red status value colors), AdminAttendance 4 KPI cards (corner-icon + hover-fill-to-blue layout removed), PaymentMethodsManagement 3 cards, UnifiedPaymentVerification 4 filter cards + highlighted Total Verified (local `SummaryCard` removed), StaffTimesheet 3 metric cards (Today value + "Today Â· This week: X" subtitle), and UnifiedOrders 8 order-status filter cards (kept pastel meaning via status icon chip/label colors + active border/bg, click-to-filter preserved). Grid widths/columns stay per-module/responsive; only the card structure is unified. NOT touched (deliberately): Dashboard Sales/Services tab icon-less summary cards (already master-consistent), the Dashboard InventorySnapshot mini-tiles, and the Inventory "Papers Left" content card â€” table cards, form containers, content/detail/modal cards are unchanged. Typecheck + build pass.
- COMPACT RESPONSIVE LAYOUT (styling only, layout preserved): tightened the app-wide spacing so the dashboard and management pages feel consistently dense on small-scale laptops (100% display scaling, 1366Ã—768) without changing card placement, data, functionality, or colors. Root font stays 16px (no zoom/transform workaround). Shared `Layout.tsx`: page content wrapper padding went `p-3 sm:p-6 lg:p-8` â†’ `p-4 sm:p-5 lg:p-6` (desktop margins 32pxâ†’24px, standard 4px rhythm throughout all pages) and the top header horizontal padding aligned to match (`px-4 sm:px-5 lg:px-6`); header height, sidebar width (`w-64` / collapsed `w-[72px]`), and the blue sidebar styling are unchanged. Admin Dashboard: outer container and each tab (`Overview`/`Sales`/`Services`) spacing `space-y-6`â†’`space-y-5`, section-grid gaps `gap-6`â†’`gap-4 sm:gap-5`, `SectionCard` header `px-6 pt-5 pb-3`â†’`px-5 pt-4 pb-2.5` with body `px-6 pb-5`â†’`px-5 pb-4` and title weight `font-bold`â†’`font-semibold`, KPI card padding `p-4 sm:p-5`â†’`p-4`, Chart heights trimmed (Sales Trend `lg:h-[280px]`â†’`[260px]`, Sales tab chart 320â†’300, Revenue by Service `lg:h-[300px]`â†’`[280px]`), Recent Transactions rows `py-2.5`â†’`py-2`, and the tab bar `py-3`â†’`py-2.5`. Staff and Customer dashboards mirrored the same vertical rhythm (`space-y-6 pb-10`â†’`space-y-5 pb-8`). Typecheck + build pass.
- ADMIN DASHBOARD REDESIGN (visual polish, layout preserved, blue sidebar KEPT): restyled the shared `Layout.tsx` sidebar, header, and canvas plus the Admin Dashboard cards/charts/tables as a clean, modern SaaS aesthetic WITHOUT moving any card (Overview stays 4 KPI cards â†’ Sales Trend (2/3) + Sales Comparison â†’ Inventory Snapshot (2/3) + Recent Transactions; Sales/Services tabs unchanged). The sidebar REMAINS Docufy blue (`bg-[#1D73EC]`) with its established identity â€” white/light text and icons, section labels as blue-100/70 uppercase, white active pills (`bg-white text-[#1D73EC]`), 2px white/40 dividers, white profile avatar with blue initials â€” only its spacing/alignment/typography were refined (focus ring softened to `#1D73EC`/40, divider/avatar shadows removed). The canvas went `#f0f4f8` â†’ neutral `#f6f7f9`, and the top header dropped its drop shadow (white, slate bottom border). The mobile nav sheet (`MobileNavSheet.tsx`) mirrors the same blue sidebar. Dashboard cards use `bg-white` + `border-slate-200/70` + a barely-there shadow (`0 1px 2px rgba(15,23,42,0.04)`) with `rounded-xl`; KPI StatCards got a unified blue icon chip (`bg-blue-50 text-[#2F6FD6]` â€” the old green/purple/orange tints are gone), a small muted label, a large semibold value, and a green/red trend arrow with a muted caption; Sales/Services summary cards and the Services breakdown table got the same label/value hierarchy; Recent Transactions' "Walk-in" chip went purple â†’ slate; all three chart tooltips are now rounded with a soft border/shadow and the area lines are thinner with smaller dots. Header page title uses semibold tracking-tight. NO functionality, data, routes, or card positions changed â€” this is styling only. Typecheck + build pass.

---

## September 6, 2026 1:43 PM (PHT) - prans
- MERGED LATEST UPSTREAM + PUSHED WORKING-TREE BATCH: pulled origin/testbranch2 (aeprnts' SummaryCard standardization + sidebar polish commit 915b5bcc, fast-forward) then re-applied this session's uncommitted changes via stash pop. Two conflicts resolved: CustomerDashboard kept the collaborator's compact spacing while keeping this session's gap-0 card styling + status-label work and the deliberate header-search removal (the merged Layout call had kept `headerSearch={searchField}` from upstream but the search feature was intentionally removed in-session, so the prop was dropped to match); UnifiedPaymentVerification kept the collaborator's new `SummaryCard highlight` Total Verified card with the malformed `?` currency prefix corrected to `â‚±`.
- ORDER TRACKING CURRENCY/AMOUNT CLEANUP (`UnifiedPaymentVerification.tsx`): fixed `?NaN` totals by parsing amounts with `parseFloat(String(total).replace(/[â‚±?,\s]/g, "")) || 0` and standardized every peso display (stats card, Amount column, detail dialog, verify/reject descriptions, invoice totals in `UnifiedOrders`/`PrintTransaction`) away from a literal `?` prefix to `â‚±`.
- ORDER DETAILS VIEW/PRINT (admin/staff `file-attachments.tsx`): added `showView`/`showPrint` props with Eye/Printer icon buttons beside Download plus a hidden print iframe (`handleView`/`handlePrint`), enabled in `UnifiedOrders` (OrderTracking unaffected). Print/View work when `attachedFiles[].url` exists (same-session blob URL); real multi-device needs a backend URL.
- REMOVED MOJIBake `?` GLYPHS: stripped stray `? ` prefixes (corrupted charset glyphs) that appeared in rendered text â€” Order Source badge (`?? Online`â†’`Online`/`?? Walk-in`â†’`Walk-in`) and Payment Status badges (`? Verified`â†’`Verified`, `? Not Verified`â†’`Not Verified`, `? Pending`â†’`Pending`) in `UnifiedOrders.tsx`; verified no `'? X'`/"? X" strings remain.
- ORDER TRACKING PAGE POLISH (customer): page container `space-y-8`â†’`space-y-4`; merged the separate On-Hold and Awaiting-Payment alert cards INTO the single Current Status card (label + inline Action Required/Payment Pending badge, with Reason/What-to-do rendered below a divider, no duplicated terms); eliminated internal Card gaps (`gap-0` on Order Details and Payment Method) and tightened title margins; added a `formatPaperSize` helper so displayed paper size is capitalized (`short`â†’`Short`, `a4`â†’`A4`, etc.); tightened the merged status-card divider spacing (mt-2â†’mt-0) so there's no big gap under Current Status.
- MOBILE BACK BUTTON MOVED BELOW HEADER (all customer pages): adopted the CustomerOrders Top Action Bar pattern â€” `hideMobileBackButton` on the shared Layout (removes the in-header arrow) plus a mobile-only back arrow at the top of the page content. Applied to OrderTracking, JobBoard, JobApplyForm, CustomerProfile, PaymentVerification, and PrintTransaction (customer New Print Request). Desktop back button unchanged.
- CUSTOMER PRINT REQUEST "SEE COLORED PRICING BREAKDOWN" BUTTON (`PrintTransaction.tsx`): outline now gray (`border-gray-300`, `text-gray-600`) at rest and fills blue on hover (`hover:bg-[#2F6FD6] hover:border-[#2F6FD6] hover:text-white`) instead of the static blue outline.

---

## September 6, 2026 2:10 PM (PHT) â€” agopr
- **MERGED ORDER LIFECYCLE OVERHAUL WITH COLLABORATOR'S LATEST (universal payment gate + configurable deadlines + auto-expiry, then merged into testbranch2)**: pushed the complete order-lifecycle overhaul (committed locally as `2bdbb0f8`) merged with Francis's remote commit `1da05b1f` (Order Tracking polish, mobile back buttons, mojibake removal, pricing button restyle, file-attachments tweaks). Pull merged cleanly except for 3 files: `OrderTracking.tsx` (kept the customer banner with the new payment-deadline + live countdown merged with the collaborator's status-banner polish and its `getCustomerStatusLabel`), `UnifiedPaymentVerification.tsx` (kept our payment-kind-aware amount grid â€” Cash: Amount to Pay + Payment Deadline + Awaiting Payment at Shop; Online: Order Total/Amount Paid/Remaining Balance â€” over the collaborator's simpler "Amount to Verify" card), and `orderStatusPalette.ts` (kept our trimmed status key while adopting the collaborator's `"Awaiting Verification"` â†’ `awaitingPayment` mapping and the new `getCustomerStatusLabel` export). Typecheck + build pass.
- **Universal payment gate â€” every order starts Awaiting Payment (cash AND online)**: customer orders are always created `Awaiting Payment` with a `paymentDeadline` computed from two admin-configurable hours in the pricing store's `Order Rules` (`cashPickupPaymentHours` default 48, `onlinePaymentVerificationHours` default 24; `0` = no auto-expiry â€” flagged PLACEHOLDERS pending client confirmation) and a cash `holdReason` is always set; online orders have no holdReason. The new UNIVERSAL flow: **Awaiting Payment â†’ In Queue â†’ Printing â†’ Completed â†’ Released (+ Canceled)**. Walk-in orders go straight to `inQueue` (paid at the shop, `paymentVerified: true`) with no deadline. The old `Received` and `On Hold` statuses are REMOVED everywhere.
- **Payment deadlines auto-expire (new `src/app/utils/paymentExpiry.ts`, 30s interval)**: any `Awaiting Payment` order whose deadline passed AND nothing is verified is auto-canceled â†’ `Canceled`, `cancellationReason: "Payment Deadline Expired"`, deadline cleared, staff/admin + customer notifications fire; verified orders never expire and orders without a deadline are never touched. Legacy seeds carry far-future `2026-09-30` deadlines so they stay pending instead of being canceled on load.
- **Customer Payment Verification reworked**: the order is loaded from the store; the old cash "Confirm Order" button was replaced with a guidance/track card (cash: "nothing to submit online; pay at the shop") plus an Amount Paid input (preset to the required amount) persisted to the order (`paymentAmountPaid`) for online/down submissions. The new `Shared PaymentDeadlineCountdown` (live PHT countdown) shows on the customer tracking/verification pages.
- **Staff/Admin Payment Verification is payment-kind-aware**: `PaymentType` gained `kind: cash | online | online-down`, `totalAmount`, `amountPaid`, `remainingBalance`, `deadline?`; the detail dialog now distinguishes Cash on Pickup (Amount to Pay + Payment Deadline + live countdown + "confirm only once paid in cash") from Online Full vs Online Down (Total/Paid/Remaining Balance due on pickup); approving a payment now sets the status to **In Queue** (was Received) so the order enters the queue AUTOMATICALLY.
- **Queue page updated to the new lifecycle**: 8 summary cards trimmed to 6 (All Orders/In Queue/Printing/Completed/Released/Canceled; Received/On Hold cards removed), detail actions are CONTEXTUAL (In Queue â†’ Start Printing/Cancel, Printing â†’ Mark Completed, Completed â†’ Release, Awaiting Payment â†’ auto-queue note + Cancel, Released/Canceled â†’ no actions), the "Start Here" next-to-process tag targets the earliest in-queue order, and cancelling now persists `cancellationReason` (shown in the detail dialog alongside the auto-expiry reason). A guard blocks moving an unverified awaiting-payment order into the queue. On Hold KPI â†’ Awaiting Payment on the Staff dashboard; `invoiceUtils` fallback default â†’ `Completed`; `dataStore`/`ordersStore` round-trip `paymentDeadline`/`paymentAmountPaid`/`cancellationReason`/payment fields and migrate legacy `Received`/`On Hold` entries to `inQueue` on load; `getOrderStats` dropped received/onHold keys.

---

## September 6, 2026 11:59 PM (PHT) - aeprnts
- OVERALL UI TEXT VISIBILITY IMPROVED (system-wide readability pass): darkened the global `--muted-foreground` design token in theme.css (#717182 -> #5C5D6E) and bumped secondary/supporting text one step darker (slate-400->500, gray-400->500) across the admin/staff UI - subtitles, table secondary info, timestamps, order IDs, card descriptions, empty states, filters, labels, and icon grays all read more legibly. Shared components got stronger headers (SummaryCard label slate-600 + medium subtitle, TableHead semibold), and sidebar nav links went text-white/90 semibold so they read cleanly against the Docufy blue. Customer-facing/public pages were deliberately left with their lighter text.
- PAYMENT VERIFICATION PAGE REDESIGN (admin + staff, presentation only): rebuilt UnifiedPaymentVerification into a compact professional workspace - tightened container (max-w-[1600px]), title + subtitle + search header, 5 SummaryCards (Pending Verification / Verified Today / In Queue / Cancelled+Expired / Total Verified Today), a compact 3-dropdown filter bar (Status / Type / Method), and a single rounded 7-column table with # priority circle badges (blue+halo for the first pending, small green/red checks for verified/rejected), kind-aware Amount cells, compact status pills, and a View action that opens a details dialog (customer header, order/payment/amount cards with live deadline countdown, QR panel, reference + proof, then real Verify / Reject actions). Row order is always automatic priority FIFO (pending first, oldest first); priority is never a manual sort. No workflow logic changed.
- SALES TAB REDESIGN (admin): rebuilt the Admin Dashboard Sales tab as a clean analytics workspace - header + subtitle, 4 KPI SummaryCards (Total Revenue / Total Orders / Average Order Value / Sales Growth with trends), a primary Sales Trend card with a Daily/Weekly/Monthly segmented pill switcher and improved chart, a Sales by Service breakdown with progress bars (View Services -> Services tab), and a Recent Sales compact table (View All -> /admin/orders). Removed the old Highest/Lowest Sales and Sales Periods cards. `SectionCard` gained a `headerRight` prop (non-breaking).
- STAFF DASHBOARD = ADMIN OVERVIEW: StaffDashboard is now pixel-identical to the Admin Dashboard Overview (with the two sales cards removed). AdminDashboard became role-aware via props; for staff it renders the same Overview layout - date-range selector, 4 KPI SummaryCards with trends, Recent Transactions (1/3, View All -> /staff/queue), and Inventory Snapshot (2/3, View Inventory -> /staff/inventory) - with no Sales Trend, no Sales Comparison, and no Sales/Services tabs. Staff greeting uses the staff user's first name.
- PRIORITY COLUMN = "#" + DUPLICATE-NUMBER FIX: the Payment Verification and Orders table headers now read "#" instead of "Priority". Fixed a bug where every seed order collapsed to the same `PAY-2026` payment id, causing both pending rows to show the same number ("2") and "Next to Verify" to match every pending row; each payment now uses its unique order id, so pending rows number 1, 2, 3... in submission order.
- SALES TREND MOCK HISTORY: added 12 historical mock orders (Oct 2025 - Sep 2026) to the dataSeed so the admin Overview Sales Trend chart renders a real multi-month line instead of a single September point; all are paymentVerified so they only feed the sales charts/KPIs, never the payment queue.
- QUEUE MOCK SEEDS RESTAGED FOR FIFO: re-staged seed order statuses so the printer is on the earliest job (ORD-0002 at 8:30 AM is Printing), while later ones (9:00, 10:00 AM) are In Queue - the "Start Here" tag now lands on the next-to-print order and the Time column reads oldest-first; normalized ORD-0004 timestamps to match when it queued.
- ORDERS HEADER CLEANED: removed the "Monitor and manage all print jobs" subtitle and the live clock/date row (and its dead timer state/imports) from the Orders page; the search/filter toolbar stays.
- SIDEBAR POLISH - BRANDED HEADER + FLAT NAV: the sidebar header (desktop + mobile drawer) now shows the Docufy logo + bold "Docufy" wordmark on the left with a PANEL-LEFT collapse toggle pinned to the right; collapsed (icon-only) shows just the centered logo (click to expand). The MAIN/OPERATIONS/MANAGEMENT gray section headings were removed, so the admin/staff navs render as one flat list; the expandable Operations/Management parents and inline children are unchanged.

---

## September 7, 2026 7:09 PM (PHT) - prans
- SIDEBAR COLLAPSE/EXPAND POLISH + CHECKOUT & PAYMENT REFINEMENTS (one commit): sidebar collapse/expand pass (desktop + mobile), simplified down-payment tier at checkout, customer cancellation, and landing/admin page readability updates.
- SIDEBAR COLLAPSE/EXPAND POLISH (desktop Layout + mobile nav sheet): the collapsed sidebar's Docufy logo now stays perfectly centered at the 72px width and no longer shifts during the collapse animation; hovering the collapsed logo swaps it for an expand icon, and the collapse toggle is now a PanelLeftClose arrow to match. Option labels fade/shrink when collapsing but appear instantly on expand. Press effect on nav items; the active-item select animation now replays ONLY when switching to a different main category - picking another sub-option under the SAME category no longer re-animates the parent pill. Collapsed nav-icon tooltips appear only after a 600ms deliberate hold and anchor to the sidebar's right edge so they don't drift mid-transition. The mobile nav sheet mirrors the desktop selection style (light-blue active parent pill, submenu spine, white active-child highlight bar + dot).
- CUSTOMER DOWN-PAYMENT TIER SIMPLIFIED (checkout): removed the "Pay at the Shop / Pay Online" venue chooser and the "Amount to pay today" selector for â‚±50-99 orders - they now keep every payment method at checkout, and the Partial Payment (50%) vs Full Payment decision moved to the payment verification page after ordering (block replaced with a concise 50%-minimum note showing the down payment and balance on pickup). Cash on Pickup stays disabled only for the full-payment tier (â‚±100+).
- CUSTOMER PAYMENT VERIFICATION PAGE: added a Cancel Order action (with confirmation dialog) so customers can cancel an awaiting order directly there, plus the new Partial/Full payment amount choice for down-payment tier orders.
- LANDING PAGE: header nav now highlights the active section with a blue underline indicator; hero buttons restyled - Get Started is a solid filled-blue CTA (shadow + press effect) and the secondary button is a white/blue-outline style.
- ADMIN CONTENT MANAGEMENT: feature tiles are now editable as Title + Subtitle pairs (older saved titles auto-migrate to the new split).
- ADMIN PRICING MANAGEMENT (readability): matrix tables got darker semibold uppercase headers, tinted header rows, stronger borders, and card shadows.

---

## September 7, 2026 (PHT) - prans
- ORDER DETAILS MODAL OVERHAUL (staff/admin queue, presentation only): rebuilt the Order Details dialog in UnifiedOrders into a compact SaaS layout with a sticky header (title + subtitle), scrollable body, and sticky workflow-action footer (Start Printing / Mark as Completed / Release Order / Cancel Order with Enter-to-confirm). Cards reorganized as Print Job Details, Payment Summary, Additional Information, and Invoice, each with strong outer outlines (border-2 gray-300) and internal bg-gray-100 dividing lines; the Payment Summary was kept subtle (thin gray border + divider lines) with `OrderPaymentSummary` reordered (Order Total / Remaining Balance left, Amount Paid / Payment Status right) and medium-size values. Invoice action relabeled to "Download Invoice", and FileAttachments action buttons (View / Print / Download) got visible gray outlines. ConfirmationDialog texts updated for Start Printing / Completed / Released. Padding compressed throughout for a tighter read. Typecheck + build pass.
- PAYMENT DETAILS MODAL OVERHAUL (staff/admin verification, presentation only): rebuilt the Payment Details dialog in UnifiedPaymentVerification into a compact `sm:max-w-2xl` layout with a sticky header (title + subtitle + gray order badge), scrollable body, and sticky Verify/Reject footer. Customer row is a compact gray card with a circular initials avatar + submitted date/time + status badge. A lined Payment Summary block shows Order ID, Payment Type, Payment Method, and Order Total (Remaining Balance removed). A status-tinted Verification Status banner (amber/green/red) shows the badge + "Payment submitted" date/time. Payment Information (online methods only) shows the QR image (or a dashed placeholder) on the left and Account Name / Payment Number / Payment Method on the right, with no download button. The Reference Number block carries the "{method} Reference Number" header plus a compact outline "View Proof" button; all receipt / upload / notes sections were removed. Verify Payment (filled blue, left, data-primary-action) and Reject Payment (red outline, right) are the only actions in the sticky footer. ConfirmationDialogs relabeled to "Verify Payment?" / "Reject Payment?" with concise spec descriptions and "Go Back" labels.
- EARLIER-SESSION QUEUE & LOGIC REFINEMENTS (rolled in this push): below-â‚±50 Cash-on-Pickup orders auto-queue on placement (details dialog reads "Pending Payment -- In Queue"); the queue page gained clickable blue "Start Here" tags that open the status form for the next-to-print order; order statuses now change independently (Start Printing -> Completed -> Released, no rigid sequence-lock); payment verification keeps FIFO priority with sequence badges and "Next to Verify"; and the Inventory page got a restyled summary-card/table toolbar with pagination.

---

## September 8, 2026 2:04 PM (PHT) - prans
- SESSION ORDER LOCKS + LIVE CROSS-TAB ORDER SYNC (staff/admin demo for the two-PC "who's managing this order" flow): commit of the order-session-lock mechanism across both the Orders queue and Payment Verification pages, plus the shared orders snapshot that makes every staff/admin window update live without refresh.
- SESSION LOCKS (new `src/app/utils/orderLocks.ts`, wired into `UnifiedOrders.tsx` + `UnifiedPaymentVerification.tsx`): opening a details modal for an actionable order (payments: Pending/Rejected; queue: Awaiting Payment/In Queue/Printing/Completed) auto-claims a lock for that order. The holder sees a green "You are managing this order" banner and working Verify/Reject or Start Printing/Mark Completed/Release/Cancel actions; anyone else opening the same order sees an amber "{name} is managing this order" banner with those actions disabled, plus a small "X is managing" eye badge under the order id in BOTH page tables. A lock guard re-checks ownership at the FINAL confirm (in `handleVerifyPayment` and `confirmStatusUpdate`), so a second reviewer who opened the order earlier can never act once someone else holds it â€” they get a toast and the order's live status is re-read to avoid double-approvals.
- LOCK LIFETIME (heartbeat + owned release): the lock is RENEWED every 30s while the holder's details window stays open (heartbeat that only renews if we still hold it), so "X is managing this order" persists for exactly as long as the holder is viewing â€” it never vanishes mid-review. A dead tab stops beating and the lock auto-expires after 5 minutes. Releasing is OWNED: closing a modal only ever frees YOUR OWN lock (release now takes the caller's name and skips any lock held by someone else), fixing the bug where the non-holder closing their window killed the actual holder's lock. The "Start Here -> Start Printing" click-through claim also claims the lock for that order so it can't bypass the guard. Unlock-on-close and release-on-success both pass the lock-holder name.
- LIVE CROSS-TAB ORDER SYNC (`src/app/utils/dataStore.ts`): orders previously lived only in each tab's memory, so a status change in staff1's window never reached staff2/admin. Every order write (status update, verify, add, delete) now saves a shared snapshot to localStorage (`docufy_orders_sync_v1`) and every other tab adopts it via the browser `storage` event and re-notifies its subscribers â€” so changing "In Queue -> Printing" (or verifying a payment) in one tab updates the Orders queue, Payment Verification list, priority badges, status cards, and dashboard KPIs in OTHER open tabs INSTANTLY with no refresh. Writes first re-base on the LATEST snapshot (merge-on-write), so tabs updating different orders at the same time can't silently revert each other. Only the localStorage channel is new; the app still re-seeds the mock orders on a full page reload (existing behavior). Typecheck + build pass.

---

## September 8, 2026 9:17 PM (PHT) - prans
- Walk-in customer type overhaul: the walk-in form now records each transaction as Walk-in Printing or Photocopy (name/email input replaced by a simple dropdown), and the queue shows a type badge on every walk-in order.
- Removed Multi-Factor Authentication (MFA) system-wide: stripped MFA from login, AuthContext, and all profile pages, and deleted the OTP input package.
- Implemented Walk-in Photocopy flow: selecting Photocopy skips file upload and immediately shows paper size, copies, and color mode; staff enter the price manually on review, which feeds the sales report and tracks paper stock.
- Photocopy manual price: whole-peso only (arrow keys step by 1), minimum â‚±1 â€” still erasable and auto-defaults to â‚±1 when left blank.
- Photocopy orders are never session-locked: staff/admin can manually take a photocopy anytime (locking stays for regular printing orders).
- Small mobile fixes: pages scroll to top on change and the header goes sticky with improved overflow handling.

---

## September 8, 2026 11:28 PM (PHT) - prans
- Walk-in Photocopy steps simplified to 1 & 2, attendance simplified to a single daily shift with exceeded extra clock-ins, and landing header profile chip for logged-in users (one commit).
- Implemented Photocopy walk-in flow as Steps 1 & 2 only: the walk-in Photocopy order now flows Photocopy Options (Step 1) straight to Review & Complete (Step 2) instead of jumping to the old step 4, so the step indicator reads 1-2 and the review/proceed bar renders on step 2; walk-in Printing and the customer flow still use Steps 1-4.
- Simplified staff attendance to one Time In and one Time Out per day: dropped the Morning/Afternoon session split across the timesheet, the time-in lockout gate, and the admin Attendance & Staff Monitoring view, so one continuous shift covers both AM and PM (legacy records auto-migrate).
- Implemented exceeded extra clock-ins: staff can still clock in after their day is complete - a confirmation prompt explains the day is already done and the new clock-in is logged with an amber 'Exceeded' badge in the staff Personal Time Logs, the timesheet status, and the admin attendance table (extra hours count toward total and overtime).
- Landing page header shows the profile when logged in: the header swaps its Log In button for a compact profile chip (avatar, name, and role caption) that opens the user's profile page; visitors still see Log In.

---

## September 9, 2026 4:35 PM (PHT) - prans
- Implemented Shop Status / Outage Toggle (manual, Phase A): staff/admin can mark Docufy as Paused, Open, or Closed (Scheduled) from the Dashboard, with customer-facing notice, queue hold, and payment-deadline freeze â€” no automated ping for now (deferred).
- Added Shop Status card to the Admin and Staff Dashboard: Mark Open / Mark Paused (reason required, optional ETA) / Mark Closed (Scheduled), with a current-status badge, reason/ETA, and who-updated-when; state persists in localStorage (docufy_shop_status_v1).
- Added a customer-facing status banner under the header on the Landing Page, Customer Dashboard, My Orders, and Order Tracking â€” amber "paused" with reason + ETA, gray on scheduled close.
- Gated new orders while paused: checkout disables the customer Place Order / Go to Payment Verification and the walk-in Proceed to In Queue buttons with an inline amber notice.
- Paused the queue flow: the Orders page shows a "Docufy is currently paused" banner; starting a new print (Start Printing button or the Start Here tag) is blocked unless staff overrides with a "Start Printing While Paused?" confirmation; finishing and releasing already-running jobs stays available.
- Froze payment deadlines while paused: awaiting-payment orders are no longer auto-canceled as expired during an outage and resume normally when the shop reopens.
- Added shop-status notifications: pausing alerts staff/admin and, individually, every customer with an active order (order is safe and on hold); reopening sends "Docufy is Open Again".
- Fixed Shop Status button hover legibility: Paused and Closed buttons now fill solid on hover (amber/slate with white text) instead of leaving white text on a light tint.
- Restyled Admin Job Board cards to match the customer Job Board: blue icon tile, larger bold titles, inline type/department/posted meta, applicant-count + duration footer, and a roomier gray description area.
- Updated shop operating hours to 9 AM - 6 PM (Mon-Sat, closed Sunday) across the customer-facing content defaults and the admin Content Management (saved records auto-migrate).

---

## September 9, 2026 9:27 PM (PHT) â€” prans
- Implemented Services Tab redesign: rebuilt the Dashboard Services tab into a compact SaaS workspace with SummaryCards, a donut revenue chart, a service performance table, and a service catalog built from the pricing store.
- Merged collaborator's Shop Status toggle (manual Phase A), Walk-in Photocopy simplified steps 1 & 2, Attendance single daily shift with exceeded extra clock-ins, and Landing Page header profile chip for logged-in users.
- Installed pdf-lib dependency added by collaborator in PrintTransaction.tsx.

---

## September 9, 2026 10:34 PM (PHT) - prans
- Pushed accumulated testbranch2 work to remote: services tab redesign merge + collaborator's shop status toggle, photocopy steps, attendance, and landing header profile.
- Services Tab redesign: rebuilt the Dashboard Services tab into a compact SaaS workspace with SummaryCards, a donut revenue chart, a service performance table, and a service catalog built from the pricing store.
- Merged collaborator's Shop Status toggle (manual Phase A), Walk-in Photocopy simplified steps 1 & 2, Attendance single daily shift with exceeded extra clock-ins, and Landing Page header profile chip for logged-in users.

---

## September 10, 2026 1:46 AM (PHT) â€” prans
- Fixed the upload bug at checkout so a file right after a previous upload no longer silently fails; the input is cleared only after processing.
- Restricted allowed file formats: uploads are now PDF/DOC/DOCX/XLS/XLSX and images (JPG/JPEG/PNG/GIF/WEBP/BMP); PPT, PPTX and TXT removed, and any non-PDF selection requires a "Preferred Format: PDF" confirmation before being accepted.
- Added a per-file "Editing file" dropdown in Step 2 (replaces the small prev/next arrows), showing only the active file's print options.
- Fixed the Apply Settings to All Files hover so the text stays readable (fills dark blue, white text).
- Shortened the Step 3 add-ons note to just "Need additional supplies?".
- Landing header profile is now a dropdown menu (Go to Dashboard, Edit Profile, Sign Out with confirmation) instead of jumping straight to the profile page.
- Removed the "Your Printing Companion" subtitle from the landing header.
- Made "No noon break" more visible as a blue pill with a check icon on the landing page and Content Management preview.
- Made shop hours and location dynamic: Content Management can add/remove schedule rows and location lines plus an Hours Note, all reflected live on the landing page.
- Balanced the landing features-row spacing so the three hero blocks are evenly centered.
- Fixed the Forgot Password crash by wiring up the /forgot-password route.
- Completed the Forgot Password flow: the 6-digit code leads to the change-password screen and the new password is set via a new resetForgottenPassword (no current-password asked).
- Updated shop hours across the app to Monday-Friday 9:00 AM - 5:00 PM, Saturday and Sunday closed (constants, customer dashboard, landing defaults; saved values auto-migrate).

---

## September 10, 2026 5:14 PM (PHT) â€” prans
- Fixed the customer payment flow: an online order awaiting payment verification (held only in sessionStorage until the reference is submitted) no longer renders as an empty/unfinished Print Request â€” the payment page now falls back to the held order so the total, deadline, and down-payment/full-payment choice display immediately, and the amount required is derived correctly per tier so Submit Reference completes.
- Removed the duplicate "Details" line from the Order Tracking status card (it already shows in the amber Awaiting Payment banner).
- Admin UI text visibility pass: placeholders, helper text, and aria-labels across login, signup, forgot-password, notifications, orders, payment verification, inventory, staff, and attendance pages read one step darker/more legible. Public job application phone field formatted as a number.

---

## September 10, 2026 6:10 PM (PHT) â€” prans
- Landing hero logo now sits above the "printing companion" heading on mobile only (desktop layout untouched).
- Services & Pricing cards now reflect the real system catalog: Black & White and Color priced from the live pricing matrix, Binding card replaced with Photo, Vellum & Sticker (photo 2R-A4, vellum, A4 sticker sheets).
- Mobile services carousel auto-advances every 4.5s in an infinite loop and the dot indicators were removed.
- About Docufy overhauled: removed the mobile short-preview + "Show more" toggle that duplicated the same paragraph; single clean body on all screens.
- Removed the inert footer Contact link.

## September 11, 2026 12:10 AM (PHT) â€” aeprnts
- Unified filter toolbar UI system-wide: every admin/staff data-table page (Orders, Payment Verification, Staff) now uses the same labeled Card filter pattern as AdminAttendance â€” labeled fields with `text-xs font-semibold text-gray-500 uppercase tracking-wide`, blue-tinted search input with Search icon, consistent `mt-1.5` wrapper spacing, and `X` icon Clear buttons.
- Removed redundant calendar icons from native date inputs and replaced with a consistent custom CalendarDays icon (hidden native picker via CSS, added custom `absolute right-3 top-1/2 -translate-y-1/2` icon) so From/To icons sit at the exact same vertical position across AdminAttendance, Orders, and Payment Verification.
- Removed the redundant "Print Request" button from the customer My Orders top action bar (sidebar nav already provides access).
- Renamed all filter "Reset" buttons to "Clear" (Payment Verification, Staff, AdminAttendance) to match the customer-side standard; switched icon from RefreshCw to X.
- Removed the redundant Orders page Reset/Clear button entirely (status resets via clickable summary cards).
- Shop Status card description text is now status-aware: Open shows accepting-orders line, Paused/Closed show reason+ETA or default status text.
- Notification dropdown: "Mark all as read" moved from footer to header row as a small blue text link; footer now only has the solid-blue "Show All Notifications" button.

## September 11, 2026 12:30 AM (PHT) â€” prans
- Customer payment flow fixes + no phantom canceled orders: fixed the checkout/payment experience so an order is never duplicated and never shows as Canceled before it is actually placed.
- Order Tracking single awaiting-payment card: the two "Awaiting Payment" cards were merged into one â€” the generic Current Status card is hidden while awaiting payment and the amber awaiting-payment card now carries a "Current Status" eyebrow with a "Payment Pending" badge.
- Duplicate-order prevention in checkout: once an order is placed, re-using the Print Request is blocked (toast "order has already been placed"), and dismissing the success dialog now fully resets the form instead of leaving a second submit path that could create a duplicate order.
- Leave-guard only when abandoning data: the "Leave print request?" prompt never fires when clicking Go to Payment Verification or re-opening a submitted order (the guard re-reads state at navigation time), and a new guard on the Payment Verification page prompts only when leaving an unsubmitted online payment (never for Cash on Pickup, after submitting, or while canceling).
- Cancel before submit reference = discard, not Canceled: canceling an online order that was never submitted now just discards the unsent request â€” no Canceled record is created, it never appears in My Orders/staff lists, and staff get no notification. Canceling an already-placed order still cancels normally with staff notification.
- Submitted orders are exempt from auto-expiry: submitting the payment reference clears the checkout deadline (and the expiry check skips any order with a reference), so an order awaiting staff verification is never auto-canceled as "Payment Deadline Expired" â€” it waits indefinitely for Verify or Reject. Cash on Pickup keeps its deadline and still auto-cancels if unpaid.

## September 11, 2026 12:55 AM (PHT) â€” prans
- Down payment applies only to Cash on Pickup: the 50% down payment is available only when the customer selects Cash on Pickup; choosing an online method on the same order automatically switches it to full payment (paid online), so the Partial/Full choice never appears for online payments.
- Step-4 payment messages cleaned: at checkout Step 4 the ONLY payment-requirement notice is the "Down Payment Required" card, shown only when Cash on Pickup is selected on a down-payment-tier order â€” the "Full Payment Required" panel and the "No down payment required" box were removed, so online and low-value orders no longer show any requirement message.

## September 11, 2026 2:13 AM (PHT) â€” prans
- NEW Down Payment Method page for down-payment-tier orders (â‚±51â€“99): orders in this range are no longer placed outright â€” checkout now holds them as pending and routes the customer to a new `/customer/payment-method/:orderId` page where they choose how to pay: **Pay at the Shop** (cash, staff verifies at the shop) or **Pay Online** (wallet), and **how much** â€” 50% Down Payment now (balance on pickup) or Full Amount now. Paying online also lets the customer pick the wallet there. After confirming, the choice is applied to the held order and the customer lands on Payment Verification (cash orders are materialized into the system there; online orders wait for the reference submission as before).
- "Place Order" button for down-tier customers is now "Proceed to Down Payment Method" (skips straight to the new page, no confirmation dialog); online down-tier orders route there instead of straight to payment verification, and the Step-4 online note + confirm-dialog copy were updated to mention the new confirm-payment page.
- Order Tracking while an order is awaiting staff verification now reads "Awaiting Verification" instead of always "Awaiting Payment": the heading uses the customer status label, so the am/aw card shows "Awaiting Verification" once a payment reference has been submitted and "Awaiting Payment" only when nothing has been submitted yet.
- Reverted the earlier "online = full payment only" rule: down-payment-tier orders can now pay online with the 50% down AND can still choose Full Amount, giving all four combinations (Shop+Down, Shop+Full, Online+Down, Online+Full).

---

## September 11, 2026 12:45 PM (PHT) â€” prans
- AUTO-SCALES TO ANY SCREEN/OS ZOOM: the app now automatically adapts the layout to the viewer's actual screen and Windows display scaling, so the tuned 1366px design (built and compacted for 1366Ã—768 laptops at 100% zoom) looks identical and properly proportioned on machines that report a different CSS-pixel viewport â€” e.g. a PC at 125% Windows scaling renders narrower, the user's earlier complaint. Implemented via `src/app/utils/screenScale.ts`: on desktop-width viewports (â‰¥1024px) it applies a CSS `zoom` factor on the `<html>` element equal to `realViewportWidth / 1366`, clamped between 0.6 and 1.25. Because the zoom sits on the root element it behaves like the browser's own page zoom â€” every Tailwind breakpoint and viewport unit re-evaluates against the virtual 1366px layout so the lg/xl layouts, full-height sidebars, and fixed-position dialogs all keep their tuned proportions on every screen. The real width is read from the Visual Viewport API (`window.visualViewport.width`), which is NOT affected by our own CSS zoom, so there is no feedback loop and the scale stays stable. Scaling is skipped below 1024px so phones/tablets keep their fully responsive mobile treatment. Wired at startup in `src/main.tsx` (calls `initScreenScale()` before render, alongside the existing internet-clock sync); resize + visualViewport listeners re-apply it live with a requestAnimationFrame debounce. No pixel values, media queries, or page code changed â€” this is a global runtime adapter only. Typecheck + build pass.
- WHITE BOX AT THE BOTTOM ON PAGE LOAD â€” FIXED: opening the site could show a blank white strip at the bottom of the screen when auto-scaling was active (the reported "white rectangle box" that only disappeared after manually zooming in/out). Root cause: a CSS `zoom` on `<html>` does NOT rescale `100vh`/`100vw` viewport units in Chromium â€” they keep reporting the un-zoomed window size, while percentage heights DO scale. So every full-height shell (`min-h-screen` on the page wrappers, `h-screen` on the sidebar/main column, `min-h-[100dvh]` on the Login/SignUp panels) was laid out at the *un-zoomed* viewport height and rendered visually shorter than the true window, letting the white `body` background show through at the bottom. Fix: `screenScale.ts` now publishes the correct layout-space viewport size as `--docufy-vh` / `--docufy-vw` custom properties (real viewport height/width Ã· zoom, removed when zoom = 1) on the `<html>` element, and `src/styles/index.css` adds UN-layered rules that remap `.min-h-screen`, `.min-h-[100dvh]`, `.h-screen`, `.h-svh` to `min-height/height: var(--docufy-vh, 100vh)` (the notification dropdown's `max-h-[min(32rem,calc(100vh-6rem))]` / width cap now use `var(--docufy-vh/vw, â€¦)` too). Un-layered rules beat Tailwind's layered utilities, so the override always wins; when zoom is inactive the variables are unset and behavior falls back to plain `100vh` (identical to before). Verified: measured in headless Chromium that `100vh` = un-zoomed innerHeight while `100%` = innerHeight/zoom, duplicated the shells in a replica to confirm the remap makes them fill exactly one window (e.g. zoom 0.781 â†’ 667px layout = 521px visual), and pixel-checked the real built app â€” landing/login/signup bottom rows are page-colored at both zoom-out (1024px) and zoom-in (1536px) sizes, no white strip. Typecheck + build pass.
- NOTIFICATIONS NOW LIVE WITHOUT RELOADING (same-tab + cross-tab): new notifications and announcements appear instantly on the "See all notifications" page and drive the header bell badge without a page refresh â€” including when the notification is created in ANOTHER browser tab/window. `notificationStore` and `announcementsStore` gained a `storage` event listener that watches the shared localStorage key and reloads the store from storage whenever another tab writes to it (then notifies all in-memory subscribers, which is what re-renders the Notifications page and the bell). Both stores were refactored to a clean read/reload/save split (`parseNotifications`, guarded `loadFromStorage`, unconditional `reloadFromStorage`/`reload`, `saveToStorage`) so the storage-handler path bypasses the one-time `initialized` guard and always refreshes. Same-tab already worked via the existing in-memory `subscribe`; this commit closes the cross-tab gap so staff/admin notifications sent from another window (order placed, paused shop, low stock, etc.) show up immediately with no refresh. Typecheck + build pass.
---

## September 11, 2026 1:19 PM (PHT) â€” prans
- My Orders statuses now match staff/admin: the customer My Orders list and status badges now display the exact same active status set as the staff/admin Orders page (Awaiting Payment / In Queue / Printing / Completed / Released / Canceled). The customer-only "Awaiting Verification" special label was removed from the My Orders badges â€” a payment with a submitted reference now simply reads "Awaiting Payment" in My Orders, identical to the staff view â€” while Order Tracking and the customer Dashboard keep their friendlier "Awaiting Verification" / "Ready for Pickup" / "Picked Up" wording. The My Orders filter dropdown already used the shared status set, so only the badge text changed. Typecheck + build pass.
- Auto-scale no longer fights the browser's own zoom (fixes the zoom-out-then-zoom-in blur): the auto-scale factor was previously computed from the Visual Viewport width, which CHANGES when the user zooms the browser (Ctrl +/- / trackpad pinch). Measuring that meant our CSS zoom also re-ran on every browser-zoom step â€” so zooming out made the app re-zoom itself (the page visibly zoomed in/out) and every compensation step re-rasterized text at a different fractional scale, leaving it blurry. `screenScale.ts` now reads the screen's CSS-pixel width (`screen.availWidth`/`screen.width`), which always reflects the OS display scaling (e.g. 125% Windows = 1536) but NEVER changes with the browser's page zoom â€” so our CSS zoom stays fixed at the OS-scaling factor and the user's own browser zoom simply works on top, crisply, with no oscillation. The 1024px desktop gate, the 0.6â€“1.25 clamp, and the --docufy-vh/--docufy-vw remap are unchanged; the viewport-height variables still track the live window so full-height shells keep filling the screen at any browser zoom. Typecheck + build pass.

---

## September 11, 2026 3:48 PM (PHT) â€” prans
- Locked the customer Print Request while the shop is paused/closed: previously only the final Place Order button was disabled with a tiny inline note, so customers could still walk through upload/options and hit the dead button at Step 4. Now, when the shop is marked Paused or on Scheduled Close (the admin Shop Status toggle), the whole customer print-request form is replaced by a lock screen â€” an amber (paused) or gray (scheduled close) icon with "Docufy is currently paused" / "Docufy is on scheduled close", the admin-stored reason + estimated return when provided, a "New print requests can't be placed right now â€” existing orders are safe and will resume once we reopen." note (mirrors the shared ShopStatusBanner), and a Back to Dashboard button. It reacts live when the toggle flips. Walk-in mode was already gated at the submit button and is unchanged.
- Down payment now applies ONLY to Cash on Pickup: the 50%-down function (the "Down Payment Method" page) appears only when the customer selects Cash on Pickup. Choosing an online method on a down-payment-tier order (â‚±50â€“99) now routes straight to payment verification and must be paid in FULL online â€” the order is created as a normal online full payment (`fullPaymentRequired`, no down step). Checkout flags, the "Proceed to Down Payment Method" button, the Step-4 online note, the place-order confirm dialog, and the success modal were all cleaned to the plain online wording for online payments. The Down Payment Method page itself is now cash-only (a static "Pay at the Shop" card instead of the Pay Online venue choice and wallet picker) while keeping the 50%-down vs full-amount choice; online down-tier orders carry the full-payment flags so staff/admin verification and the customer payment page treat them like any online full payment. Cash down-tier keeps exactly the same Partial (50%) / Full flow as before. Typecheck + build pass.

---

## September 11, 2026 5:58 PM (PHT) â€” prans
- Fixed staff/admin order total mismatch: the amount shown on the staff/admin Orders list was sometimes lower than what the customer actually submitted (e.g. a â‚±6 order displaying as â‚±3). Customer and walk-in orders were being created WITHOUT a cost breakdown, so the Orders list fell back to a flat per-page estimate instead of the pricing the customer was charged. New orders now save their exact cost breakdown (per-file printing cost + add-ons + total) so the staff/admin list, order details, and invoices always match the customer's submitted total.
- Per-tab login sessions (prototype): the logged-in user is now remembered in that tab's own browser session instead of shared browser storage, so one tab can stay logged in as a customer while a different tab is logged in as staff/admin. Refreshing a tab no longer replaces its user with whoever is logged in on another tab.

---

## September 11, 2026 6:50 PM (PHT) â€” prans
- Re-enabled online down payments for down-payment-tier orders (â‚±50â€“99): customers on these orders can again pay the 50% down payment with an online method (GCash/Maya) instead of being forced to pay the full amount online. The Partial (50%) / Full choice now happens on the customer Payment Verification page â€” the customer picks whether to pay just the 50% down now or the full total, and the order is saved with the matching down/full-payment flags. The balance from a down payment is still collected in cash at pickup.
- Down-payment status shown on customer Order Tracking: orders with a down payment now show a dedicated "Down Payment Verified / Awaiting Down Payment" status with the amount paid and the balance due on pickup, instead of falling into the generic verified/pending wording.
- Staff/admin views reflect online down payments automatically: the Payment Verification list shows them as "Down Payment" (Total / Paid / Balance), verifying one puts the order in the queue with the balance still due, and the order details show Partially Paid with the balance collected at pickup.
- Down Payment Method page threshold fix: the cash down-payment page used hardcoded â‚±51â€“99 bounds for its own tier check while the rest of the app used the admin-configurable pricing store â€” it now reads the real down/full-payment thresholds, so changed thresholds stay consistent across the whole flow. Typecheck + build pass.

---

## September 11, 2026 8:10 PM (PHT) â€” prans
- Down Payment Method page redesigned around a "Pay at the Shop / Pay Online" choice: EVERY down-payment-tier order (â‚±50â€“99), cash AND online, now lands on the Down Payment Method page after checkout (previously online down-tier went straight to Payment Verification). "Pay at the Shop" materializes the held order and sends the customer straight to order tracking (NO customer Payment Verification step) â€” the order stays On Hold until staff/admin verifies at the counter. "Pay Online" shows the wallet picker (live payment-methods store, defaulting to the method chosen at checkout), keeps the 50%/Full amount choice, then proceeds to Payment Verification for the usual receipt upload. The venue defaults from the checkout method (Cash â†’ shop, online wallet â†’ Pay Online).
- At-shop verification with a 50%/Full choice for staff/admin: a cash order in the down-payment range paid at the shop is now detected in Payment Verification (new cash "down-tier" state) and shown with a "â‚±X down Â· â‚±Y on pickup" amount line. The details dialog asks "how much was paid at the shop?" with Paid 50% Down / Paid Full Amount buttons (defaulting to the customer's plan). Verifying as 50% keeps the down-payment flags and partial-payment balance (collected on pickup) while queuing the order; verifying as Full rewrites it to a fully-paid order (full-payment flags, no balance due).
- Order Tracking down-payment wording is now payment-method-aware: cash at-shop down payments read "paid in cash at the shop" / "pay in cash at the shop before your order can be printed", online ones keep the "paid via {method}" wording.
- Customer checkout buttons/labels updated so ALL down-tier orders say "Proceed to Down Payment Method" and the Step-4 online note explains the two-step flow (choose how to pay on the Down Payment Method page, then upload the receipt on Payment Verification). Typecheck + build pass.

---

## September 11, 2026 8:50 PM (PHT) â€” prans
- Fixed "Awaiting Verification" displaying as "Awaiting Payment" in the customer My Orders list: the status badge now uses `getCustomerStatusLabel(order)` so orders with a submitted payment reference correctly show "Awaiting Verification" (amber) instead of the raw status "Awaiting Payment". Order Tracking status pill removed as it was a redundant duplicate of the already-shown Current Status heading text (both the amber awaiting banner and the generic banner). Current Status card fonts bumped up one step across both banners for better visibility â€” status headings now `text-2xl`, body text `text-base`, and box text `text-sm`. Typecheck + build pass.

---

## September 11, 2026 9:36 PM (PHT) â€” prans
- Added pagination to the staff/admin Payment Verification and Orders lists: both tables now show 10 rows per page with Previous/Next and page-number buttons plus a "Showing Xâ€“Y of N" count, and the list resets to page 1 whenever a filter/search/date change. Added 20 new mock orders to the seed data (mixed-status demo rows and batches of pending and In-Queue/Printing orders) so both pages actually have more than one page to flip through.
- Kept all five Payment Verification summary cards always visible (Pending Verification, Verified Today, In Queue, Cancelled / Expired, Total Verified Today) â€” the earlier "only show when filtered" hiding was reverted at the user's request.
- Fixed the Status / Type / Method filter dropdowns on Payment Verification opening at the far right edge of the screen instead of under their buttons: the app's auto-scale applies a CSS `zoom` on `<html>`, which broke Radix Select's portal positioning math. Those three selects were replaced with a lightweight custom dropdown rendered with plain CSS absolute positioning (same technique as the header notification/profile menus), so the list always opens directly under its own button at any zoom level. Also wrapped the toolbar's Clear button so it can no longer overlap the Method dropdown when the sidebar is open. Typecheck + build pass.

---

## September 11, 2026 10:13 PM (PHT) â€” prans
- Landing page Job Openings now live from the jobs store: the openings list subscribes to the jobsStore so postings added/archived by the admin appear immediately without reloading, and each opening card was aligned with the Job Board treatment (type badge, Posted date, Department).
- Removed the seeded "Customer Service Representative (Walk-in)" job: the opening was only demo data, so it was taken out of the seed jobs and the seed version was bumped to re-seed existing browsers (the admin can still add it back on the Job Board management page).
- Job Application page redesigned for mobile: the apply form was rebuilt as a clean, mobile-first flow with clear sections (Personal Information â†’ Position & Application â†’ Resume â†’ Terms & Conditions), larger touch-target inputs, inline per-field validation on blur (so the customer can see what's missing before submitting), a clearer Resume field (a "Paste Link / Upload File" choice with helper text and a compact file card after upload), a full-width filled-blue Submit Application button with a submitting/spinner state, and a compact info note instead of the bulky card.
- Job Application success state: after the application is saved, the form is replaced by a dedicated confirmation screen â€” a check icon, "Application Submitted", the real Application ID returned by the store, the review timeframe, a "View Application Status" button (to the Job Board applications tab), and "Back to Dashboard". The Submit button never reappears after a successful submission.
- Customer Profile Settings redesigned for mobile: the profile page now opens in a clean read-only view (identity card with avatar/name, Personal Information && Account Security list cards) and switches to an edit form only when Edit Profile is tapped â€” fields show as tidy labels/values instead of disabled inputs, the avatar camera upload lives in edit mode, and Save keeps the confirmation dialog then returns to the view.
- Mobile back buttons made consistent across customer pages: the Notifications page back button was reworked from a full-width bar to the same compact "â† Back" control every other customer page uses, and the mobile back button was added to the Print Transaction page (customer mode).
- Dashboard Overview heading hidden for the staff role: the Overview title/subtitle no longer renders on the staff dashboard since staff get no tab bar â€” the greeting and date-range selector stay. My Orders page mobile back button aligned to the same compact "â† Back" pattern. Typecheck + build pass.

---

## September 11, 2026 10:20 PM (PHT) â€” prans
- Made the Order Details / Payment Details popups fit the screen at the app's auto-scale: under the CSS `zoom` the app applies on `<html>`, Chromium keeps `vh` at the un-zoomed window size, so the `max-h-[92vh]` cap let the staff/admin Order Details (and Payment Details) dialogs overflow the visible area. Both dialogs now use the same `--docufy-vh` viewport-height remap as the full-height shells (`max-h-[calc(var(--docufy-vh,100vh)*0.92)]`), so the popup always stays inside the window at any zoom/display scale.
- Verifying a low-value cash payment no longer resets the order back to In Queue: cash-on-pickup orders under the down-payment threshold (auto-queued at checkout) could already be printing by the time staff verified the payment, but verification always forced the status back to "In Queue". Verifying these orders now leaves the current status untouched (retains In Queue / Printing), while every other order still moves to the queue on verification.
- Fixed new Order IDs not matching the seed format: the order counter's parse regex was extracting the YEAR from IDs like ORD-2026-0046, so the next order became "ORD-2027" and new orders never matched the `ORD-2026-XXXX` numbering shown in the staff/admin list. The counter now properly separates the year and the sequence number, generates IDs in the exact `ORD-YYYY-NNNN` format (so ORD-2026-0047 comes after ORD-2026-0046), and is re-initialized from the existing orders on load. Typecheck + build pass.

---

## September 11, 2026 11:02 PM (PHT) â€” prans
- Mobile button hierarchy enforced across customer UI: every primary action is now a solid filled-blue button (`bg-[#1D73EC]` or `bg-[#2F6FD6]`) so the dominant action is always visually prominent, and secondary/destructive actions sit clearly below or beside it. Payment Verification online footer stacks Submit Reference (solid blue) above Cancel Order (red outline); cash footer stacks Track Order (solid blue) above Dashboard; success dialog "See My Order" is solid blue. Job Board "Apply for this Position" changed from outline to solid filled blue. Walk-in photocopy review moved "Proceed to In Queue" above the Back/Cancel row, and the walk-in action group container uses `flex-col-reverse` so the primary sits on top on mobile while desktop side-by-side (Cancel left, Proceed right) is preserved.
- Mobile back button consistency: customer Payment Verification mobile back arrow now uses the standard compact "â† Back" pattern; AdminProfile and StaffProfile desktop "Back" buttons hidden `md:inline-flex` so mobile uses the Layout header back arrow exclusively.
- Red asterisks on all required form labels: asterisks switched from gray to `text-red-500` across OrderTracking (Reason for Cancellation), ShopStatusControl (Reason), PaymentMethodsManagement (3 fields), Staff add/edit dialogs (9 fields), JobBoardManagement (8 fields), and PaymentVerification (Reference Number, Proof of Payment upload).
- Proof-of-payment upload now required on the customer Payment Verification page: handleSubmit validates `proofFile` is present before allowing submission, and the upload label shows a red asterisk. Typecheck + build pass.

---

## September 12, 2026 12:34 AM (PHT) â€” prans
- Fixed staff sidebar hierarchy: "Clock-In & Timesheet" is now a direct top-level staff nav item (right after Inventory) instead of living under a "Operations" parent menu â€” the OPERATIONS group was removed from the staff sidebar and from the walk-in/staff page menus, so the staff nav is flat and shorter.

---

## September 12, 2026 2:42 AM (PHT) â€” prans
- Mobile-first Sign Up page redesign: the account form now stacks in a single clean column on phones (name/email/phone and password fields go full-width), with a full-width filled-blue "Create Account" button and a centered Docufy logo + "Back to Home" link on top; desktop keeps the two-column layout with the white outline button. Added a 600ms submitting state (spinner + "Creating Account...", double-submit guard), larger touch targets, red `text-red-500` asterisks, autocomplete/enterKeyHint hints, and accessible show/hide password buttons.
- Consistent search box sizing across filter toolbars: the search input on the Orders page, Payment Verification, Staff, AdminAttendance, and customer My Orders now use the same `w-full sm:max-w-xs` responsive width (full-width on mobile, fixed-width on desktop) instead of stretching/overlapping.
- Staff dashboard Overview header alignment: the date-range selector now right-aligns under the staff greeting (`sm:ml-auto`) so the header row reads correctly now that the Overview title is hidden for staff.
- Orders summary cards moved above the filter bar: on the staff/admin Orders page the six status summary cards now render directly under the page heading with the search/filter toolbar below them, so the cards stay visible without scrolling.
- Invalid-date guards added: `toPHT` and the Orders time-period helper now return gracefully instead of crashing (RangeError) if fed a bad/invalid stored date, so the Order Details page can never blow up on corrupted persisted data. Typecheck + build pass.
- Streamlined the staff Clock-In page: the big timer widget is now a compact "Current Shift" card with a single filled-blue Time In/Time Out button and simplified Clocked In / Clocked Out status (the Shift Complete/Exceeded header pills, the amber "Time In Again (Extra)" state, and the Back to Dashboard link were removed â€” extra clock-ins after the day is done are still recorded and still marked Exceeded on the log rows). The three metrics cards now read Today / This Week / Overtime this week, and the collapsed history lists recent entries as compact Today/Yesterday rows instead of a one-line today summary. Typecheck + build pass.

---

## September 12, 2026 2:37 AM (PHT) â€” prans
- Zoom-broken dropdowns now open under their button everywhere: the app's auto-scale applies a CSS `zoom` on `<html>`, which makes Radix Select's portaled list mis-position (it flies away from its trigger instead of opening below it). Every remaining Radix Select was replaced with the anchored, zoom-safe dropdown â€” Customer Type + all print-flow option selects (photocopy Paper Size / Color Mode, photo size, doc Paper Size, Page Range, Color Mode, Editing-file picker, mobile Quick Templates) in the walk-in/customer print request, the Inventory Reports All Categories / All Items filters, the Job Application Resume "Paste Link / Upload File" choice, and the Staff / Admin Attendance / Orders / Notifications filter selects. The shared `ZoomSafeDropdown` renders a plain absolutely-positioned list directly under the button (outside-click + Escape close) with no portal, so it stays put at any zoom/display scale. Out-of-stock paper sizes are now greased out and unselectable in the dropdown instead of being clickable.
- Completed the half-converted print-request file (was left non-compiling): added the missing ZoomSafeDropdown import, removed a stray JS comment that had broken the photocopy Color Mode JSX, and replaced a mis-bound Paper Size dropdown that pointed at the wrong field with dangling Select children left behind. Typecheck + build pass.

---

## September 12, 2026 3:30 AM (PHT) â€” prans
- Removed the empty white space below the landing-page footer: a decorative blurred circle reached 192px past the page wrapper and, because the wrapper only clipped horizontal overflow, that blank area became scrollable under the Terms/Privacy/logo/copyright row. The wrapper now clips vertically too, so the page ends exactly at the footer. Typecheck + build pass.

---

## September 12, 2026 4:44 AM (PHT) - prans
- Shop Status / Announcements broadcasts are now sent to customers only: the admin "Create Announcement" (renamed from "Create Notification") and shop-status change notifications (Paused / Open Again / Scheduled Close) no longer notify staff/admin - they target only customer accounts. Customers are a ll notified individually per signed-in email, while notifications pushed to staff/admin by their own actions were dropped from the broadcast path.
- Admin Dashboard Overview no longer carries the sales cards: the Sales Trend and Sales Comparison cards were removed from the Overview tab, so the merged Sales tab (/admin overview tab) owns all sales analytics - the Overview now shows just the KPI row plus the Inventory Snapshot and Recent Transactions cards.
- Sales tab reorganized: Sales Trend (wide, 2/3) and a new Today's Sales card (compact, 1/3) now sit on the same row via a 3-column grid instead of Sales Trend stretching full width.
- Inventory Snapshot card bottom space filled without growing the card: a compact "Current Stock Levels" per-item list now fills whichever leftover vertical space remains under the three stock tiles (aligned by the same row height as Recent Transactions), while the card itself keeps its original height. Papers-left and stock-value figures were kept out of the healthy-warehouse notice; the total stock value stays in the low-stock state as before.
- Recent Transactions now shows the most recent 6 orders (was 4) and stretches its rows to fill the card with a footer showing "Showing N recent" plus the total â‚± of those orders.
- Payment Verification summary cards are informational again: only the Pending Verification card keeps its click behavior (Pending/All toggle), while Verified Today, In Queue, Cancelled / Expired, and Total Verified Today revert to plain read-only stats - filtering stays with the Status/Type/Method dropdowns to avoid clicking one card clearing another.
- Payment Verification "#" priority badge unified with the Orders page: both tables now use the same shared PriorityBadge component (solid blue circle, ring on the "Next to Verify" row) instead of Payment Verification's older lighter inline badge. Typecheck + build pass.

---

## September 12, 2026 5:02 AM (PHT) - prans
- Admin and staff sidebars are grouped back under the MAIN / OPERATIONS / MANAGEMENT section headings so the navigation structure is scannable at a glance: each uppercase heading labels its group of items (Dashboard/Orders/Payment Verification/Walk-in/Inventory under MAIN, Operations and Management as expandable parents) in both the desktop sidebar and the mobile drawer. The heading is non-interactive and only shows when labels are visible, so the collapsed icon-only sidebar and the flat customer menu stay unchanged.
- Negative confirmation modals now clearly signal risk in red and grey across the system. The shared confirmation dialog (used for Cancel Order, Reject Payment, Remove Payment Method, Delete, Reset, Sign Out) shows a red accent border, a red warning icon, a red "cannot be undone" warning box and a solid red confirm button, while the safe cancel button stays neutral grey - so users pause before triggering irreversible actions. Positive confirmations (Place Order, Time In, Restore, Save) keep their normal blue look. The walk-in Cancel Transaction prompt was also switched from amber to the same red/grey risk styling. Typecheck + build pass.

---

## September 12, 2026 5:17 AM (PHT) - prans
- Refined the Payment Details modal action footer: Reject Payment (white/red outline, secondary) sits in the bottom-left corner and Verify Payment (solid Docufy blue, primary) in the bottom-right of a dedicated compact footer, separated from the scrollable payment info by a thin top divider. Buttons were slimmed to standard modal size with a quieter hover (no more large lift/shadow), and on mobile the two actions stack full width with Verify Payment first then Reject Payment. Payment summary, reference, View Proof, session lock, and confirm dialogs are unchanged. Typecheck + build pass.

---

## September 12, 2026 3:20 PM (PHT) - prans
- Multi-tab / multi-user testing support: a freshly-opened tab now adopts the shared order snapshot on load (instead of starting from seed rows until the next write), inventory syncs live across tabs (paper deducted by the customer tab shows up instantly on staff/admin Inventory, paper-size options, and the low/out-of-stock alerts), and the order ID counter re-syncs from the persisted sequence AND the shared orders on load and on every cross-tab write, so a tab that has been open a while can never mint a duplicate ORD-YYYY-NNNN. Demo roles for tabbed testing: customer / staff / admin (@test.com accounts), each tab keeps its own signed-in session.
- Fixed the dead "Start Printing" / status-update action on the staff/admin Orders page: a malformed seed timestamp (queue-demo day 10 was generated as "2026-09-010", which `new Date()` cannot parse) gave ORD-2026-0046 invalid dates, so the status sync threw mid-loop and the staff UI froze (dialog stuck open, no toast) right after the customer tab showed the update. The seed now pads the day correctly ("2026-09-10"), and the order <-> snapshot conversions are hardened with safe date guards so a single malformed timestamp can never take down the whole queue sync again.
- Status updates are now instant: a status change previously rewrote the ENTIRE order list into localStorage one order at a time (~47 full snapshot reads/writes plus a storage event to every other tab per step), which caused a visible delay. The status form now updates only the affected order through a single snapshot write.
- Status form is now single-click: the Confirm Update button applies the new status directly - the extra "Start Printing Order?" / "Cancel Order?" second confirmation dialog was removed (the Completed flow still records error usage first). Confirm Update restyled to the standard Docufy primary blue and the form's Cancel button to the neutral grey-with-red-hover style. Typecheck + build pass.

---

## September 12, 2026 3:44 PM (PHT) - prans
- Merged inventory "School supplies" into "Add-ons" so school-supply stock (e.g. Ballpen, now priced at â‚±10) appears in the customer's checkout add-ons list; existing items with the old category auto-migrate on load. Also added Vellum, Sticker, and Photo paper as inventory categories - items in those categories get the Paper/Material Size field (sizes now include 2R-6R and A4 photo) and their in-stock stock shows up live in the customer's Paper Size options, labeled "Item Name (Size)" and disabled when out of stock.
- Paper-stock-aware checkout: the hardcoded "A4" option that still appeared after all papers were archived or out of stock is gone - the Paper Size dropdowns (per-file and photocopy) show a disabled "No paper stock available" entry instead, and the customer Place Order / walk-in Proceed to In Queue flows block submission with a clear toast when non-photo files have no in-stock paper.
- Cleaned up the Photo print request: removed the Glossy/Matte Finish option (no longer shown or stored anywhere); photo quantity now starts at the system pricing matrix's minimum for the selected size (2R = 6 pcs) and auto-raises when a size with a higher minimum is picked; the Quantity control now sits right beside the Photo Size dropdown in the same row (no extra empty space below); and when no in-stock photo paper exists, a small red "No photo paper in stock" pill appears above the Photo Size control. Typecheck + build pass.

---

## September 12, 2026 10:02 PM (PHT) - prans
- Container-width responsive layout: the admin/staff/customer dashboards, inventory, payment verification, attendance, profile, content, and payment-method page grids now adapt to the actual CONTENT width instead of the browser viewport - card grids use container queries tied to the Layout root @container (e.g. @min-[900px]:grid-cols-3 instead of lg:grid-cols-3) so they collapse correctly when the content area is narrowed by the sidebar or a smaller window.
- Responsive action-bar hierarchy (print-request/checkout bars): the customer "Back + Continue / Place Order" bar and the walk-in "Proceed to In Queue" bar now switch between side-by-side (secondary left / primary right) and stacked-primary-first using the content width instead of the viewport sm: breakpoint - previously a narrow-but-desktop window (e.g. half-screen with the sidebar open) kept the side-by-side row but it wrapped, pushing the secondary Back button ABOVE the primary action. Wide content keeps the row; narrow content stacks the Primary action on top; mobile is unchanged.
- Payment proof upload row wraps on narrow widths: the uploaded-file name and its buttons on the customer Payment Verification page no longer truncate/overflow - the row flex-wraps so long file names stay fully visible. Typecheck + build pass.

---

## September 13, 2026 1:18 AM (PHT) - prans
- Landing page design-consistency pass: the lower sections (Shop Information, Join Our Team, Services & Pricing, and the footer) now use the same Docufy design language as the upper landing (brand blue, white/very-light-blue backgrounds, rounded cards, soft shadows), so the page reads as one site top to bottom. Only the landing page was touched.
- Shop Information is now two-column: a centered intro (label + "Visit us on campus." + supporting text) above Shop Hours and Location cards on the left, with an embedded Google Maps panel on the right that fills the full height of the left column. The "View Location" button and its modal were removed - they re-opened the same embedded map, which was redundant now that the map sits directly on the page.
- Join Our Team: centered header with a filled-blue "View Job Openings" button, and the job postings are now a lightweight divider-separated list (title, employment-type/schedule detail, right-aligned Apply Now) instead of floating cards - quicker to scan and more compact.
- Services & Pricing: stronger centered header ("What can we print?"), and each service card now shows useful real information from the pricing system - paper sizes, content/color tiers, and photo size options - with the price (per page / from) aligned at the bottom of each card so the three cards line up. Prices unchanged.
- Footer redesigned to be compact and professional: three balanced columns (Docufy PSMS brand + a short one-line "About Docufy" blurb, Quick Links, and concise Contact / Shop Information) with tighter spacing, and a slim bottom legal row reading "Â© 2026 Docufy PSMS. All rights reserved. Terms & Condition | Privacy Policy". The footer background went from the dark navy to a deeper shade of the Docufy brand blue, so it reads as part of the brand instead of a different color. Typecheck + build pass.

---

## September 13, 2026 1:52 AM (PHT) - prans
- Order Rules payment windows are now admin-editable durations: the two "Order Rules" windows in Pricing management (Cash on Pickup, Online Payment Verification) are editable as a duration with a Hours / Minutes / Seconds unit picker (single value input, live "Total window" preview, "Set 0 so orders never auto-expire" hint). Windows are stored in seconds (existing saved 48h/24h settings auto-migrate x3600), the Order Rules list shows friendly labels ("2 days", "1 hr 30 min", "45 sec", "Never"), and customer countdowns now reflect the finer granularity down to seconds.
- Admin Attendance & Staff Monitoring dashboard: the Admin -> Attendance page was rebuilt into a focused monitoring dashboard - tabs removed, 4 KPI cards (Total Staff / On Time Today / Late Today / Absent Today), Role + Shift filters, a live "Currently Working" strip with ticking on-clock cards, and a Staff Attendance Records table (staff member, role badge, schedule, clock in/out, hours worked, status). Card spacing tightened so the page reads dense on small laptops.
- Auto-scaling removed / browser zoom decoupled: the CSS-zoom auto-scaling hack was removed entirely (no `zoom` on <html>, no --docufy-vh/vw viewport remap) - the layout is fixed at the tuned width on every desktop and browser zoom now just works crisply on top; the leftover "zoom-safe" naming and stale comments were cleaned up (the dropdowns/menus are now plain anchored dropdowns with no zoom math).
- Sidebar sub-options restyled as a nested tree (desktop + mobile): sub-options under expandable parents now render as a tree - a vertical connector line with a node dot per child (filled for active, hollow for inactive), the selected child shown as a compact rounded chip attached flush beside the line with its dot centered on the rail (no longer a full-width pill that could pass for a main nav item), and clear spacing between the parent category and its children. Typecheck + build pass.

---

## September 13, 2026 2:15 AM (PHT) - prans
- Added a Shop Photos link to the Landing Page Location card: a clickable "Shop Photos" text (small map-pin icon, Docufy blue) now sits on the same row as the Location heading and opens a shop-photos dialog. The dialog shows the shop address and the photos the admin uploaded on the Content page (up to 3, in a show/hide 3-column thumbnail grid with a full-screen lightbox), and it updates live as the admin adds or removes photos; an empty state appears when none are uploaded yet.
- Merged the map into the Location card on mobile: on phones the embedded Google Map now renders inside the Location card directly under the address text instead of as a separate panel below it, so the location reads as one card. Desktop keeps the side-by-side layout (Shop Hours + Location cards left, full-height map on the right). Typecheck + build pass.

---

## September 13, 2026 9:52 AM (PHT) - Althea09-git
- **PULLED COLLABORATOR MERGE + DEPENDENCY SYNC**: fast-forwarded local testbranch2 from 68ebcd2a to 61d5176b (64 collaborator commits, ~16,365 insertions across 90 files) and verified the production build passes. Work merged includes: the Down Payment Method page (both flows - Pay At Shop / Pay Online with verify options), duration-based order rules + payment expiry countdown + pending-order/hold locks, multi-tab sync + order-ID collision hardening + order locks, zoom-safe anchored dropdowns for print flow/inventory reports/job application/staff filters, container-width responsive layout + responsive action-bar hierarchy, landing-page consistency pass (Shop Photos link + mobile map in shop info, compact footer, alignment fixes), nested-tree sidebar sub-options + auto-scale removal, customer-only announcements, unified filter toolbar UI, mobile-first signup redesign + job application + customer profile, job order-status badge/flow fixes, and a custom tesseract.js payment-reference OCR reader in customer PaymentVerification. NEW DEPENDENCIES INSTALLED: ran npm install (added 23 packages incl. tesseract.js) so the tesseract.js OCR import in PaymentVerification.tsx resolves and the build stays green. Local and remote fully in sync (0 ahead / 0 behind).

---

## September 13, 2026 10:43 AM (PHT) - Althea09-git
- Fixed mobile hero feature badges below "Get Started": the three circular feature items (Upload documents / Real-time order tracking / Secure payment) no longer overflow on phones. Text was locked to single-line (whitespace-nowrap) inside narrow flex columns, so on small screens the labels spilled out of place. The badges now fill their cell and center the icon + wrapped text on mobile (w-full items-center), keeping the original left-aligned single-line look on desktop (sm: items-start + nowrap), and the whole row centers itself on mobile (justify-center) while staying left-aligned on large screens.

---

## September 13, 2026 2:00 PM (PHT) - prans
- Landing page hero responsiveness: made the Docufy hero scale and reposition fluidly under browser zoom / different screens instead of staying pinned. Removed all fixed positioning from hero elements â€” the absolute-positioned decorative glow blobs are gone, their soft tint now reproduced as layered gradients on the section background (radial glows top-right/bottom-left + bottom fade to the services color) that scale naturally. The logo circle is no longer fixed-pixel locked: it is now aspect-square with fluid `min(<rem>,<vw>)` width per breakpoint (192/288/384px at 100% zoom) and the inner image sized as a percentage, so it grows/shrinks and shifts relative to the text when zooming. Hero stays a responsive grid (mobile: 1 col, logo first; desktop: left text / right logo) with desktop columns now `minmax(0,1fr)` + `min-w-0` so both tracks wrap instead of overflowing. Typography is fluid via `clamp()` â€” headline 36/48/60px and description 16/20px at the original breakpoints when at 100% zoom, easing between them. Container `max-w-7xl` + relative gap spacing. 100% zoom appearance unchanged.
- Picked up collaborator fix ecaef2cf (mobile hero feature-badge overflow/centering) into testbranch2 via live cherry-pick: the three circular feature badges below "Get Started" now center their icon + wrapped text on mobile and keep the left-aligned single-line desktop look; the cherry-pick's PUSH_LOG conflict was resolved by keeping the badge commit's own 10:43 AM entry (the dragged-in 9:52 AM entry belongs to a different commit and was dropped).
- Capstone reference cleanup: removed all three stale "capstone" mentions from AGENTS.md (the REBRAND note and two "(same as capstone copy)" parentheticals). No files deleted from any folder â€” the old Capstone 2 folder on the PC is untouched.
---

## September 13, 2026 2:59 PM (PHT) - prans
- Landing page auto-scales as a whole (header included): the hero's fluid scaling now applies across the entire landing page â€” header bar, shop-status banner, hero, Services & Pricing, Shop Info, Join Our Team, and footer containers are all `max-w-7xl` below 1366px then stretch to ~93.7% of the viewport width (`min-[1366px]:max-w-[93.7vw]`), and every headline/paragraph uses viewport-based `clamp()` sizes reproducing the previous fixed pixels EXACTLY at 100% zoom on a 1366px screen (hero title 60px, section titles 36px, descriptions 18px, card/job titles 20px, prices 36px, brand text 16px, logos 40px). Zooming out now fills the window edge-to-edge with proportional spacing instead of leaving the content centered with empty gutters. Buttons, pills, badges, dialogs, and the feature dots stay fixed-size. The earlier min-[1400px] logo-shift hack was removed in favor of this consistent layout-wide scale. Typecheck + build pass.
## September 13, 2026 9:12 PM (PHT) - prans
- Landing page content editor: added a new Landing Page management page (/admin/landing) so the admin can edit the public landing page text directly - hero title/subtitle/description, the three feature highlights, the three Services & Pricing card labels/descriptions/detail rows (prices stay in Pricing Management), shop opening-hours rows + note, location address lines, and the About Docufy footer text. Includes Preview (opens the live page), Reset to defaults (with confirm), and Save Changes. The content model moved to a shared landingContentStore (same localStorage key as before), and the landing page now subscribes to it so admin edits show up in real time.
- Content management module removed + Shop Photos moved to the admin dashboard: the admin Content Management page was deleted; its Shop Photos upload function was relocated to a Shop Photos card on the admin Dashboard Overview (admin-only, up to 3 location photos) and the Content Management item was removed from the admin sidebar/navigation.

---

## September 13, 2026 11:10 PM (PHT) - prans
- Brand logo upload + reset: the admin can now replace the Docufy logo from a new **Brand Logo** card at the top of the Landing Page editor (/admin/landing). Upload Logo validates an image file (PNG/JPG/WebP/SVG/GIF, <3MB) and applies it instantly system-wide, and Reset Logo (with a confirmation) clears the override and restores the bundled default logo. The override persists through a new logoStore (localStorage `docufy_logo_v1`), shared via a `useLogo()` hook, and every consumer that used to hardcode the asset now renders the same system logo - admin/staff/customer sidebar, mobile nav sheet, landing page (header, hero, footer), Login, Sign Up, Forgot Password, and the public job-application pages.
- Landing page editor save reliability: Save Changes and Reset now surface browser-storage write failures (quota, private mode, storage disabled) with a clear error toast instead of a change silently not applying; the landingContentStore only updates its in-memory cache after the localStorage write succeeds, so what's shown always matches what's persisted. Typecheck + build pass.
---

## September 14, 2026 1:28 AM (PHT) - prans
- Added Join Our Team to the landing page nav + footer: the header toolbar and footer Quick Links now show Join Our Team (scrolls to the hiring section) instead of the old About link, and the Join Our Team section's job list was replaced by an improved dropdown button that shows the available openings (click a job to apply with it preselected) or a friendly We're not hiring right now message when there are no openings.
- Footer About updated to online wording: the footer heading now reads About Docufy PSMS and the paragraph says Docufy is an online printing management system - the landing content default was updated and any previously stored copy that still said modern is auto-rewritten on load.
- Landing page footer made compact: the logo and brand text now use fixed moderate sizes instead of the large viewport-scaled sizes, and padding, column gaps, list spacing and the copyright row were tightened so the footer fits its content with far less empty space.
- Landing page editor terminology simplified: the admin Landing Page editor uses plain everyday labels now - Top Section / Features / Services & Prices / Shop Information / About Docufy PSMS - with simple field names (Main Title, Description, Feature Name, Feature Description, Service Name, Tag, Option Name, Option Details, Title, Subtitle) plus short helpful hints, so a non-technical staff member can edit the page without web jargon. Typecheck + build pass.

---

## September 14, 2026 1:37 AM (PHT) - prans
- Customer dashboard KPI counts capped at 99+: the Total Orders / In Progress / Ready for Pickup summary cards now display up to 99 and show 99+ once the count exceeds it, so a long order history no longer pushes the card numbers out of place. Typecheck + build pass.

---

## September 14, 2026 2:02 AM (PHT) - prans
- Landing page editor preview nav fixed: clicking the header nav inside the admin Landing Page editor's Preview used to land on the wrong section (Services & Pricing jumped to Shop Info) because the preview shared the page with the editor, whose own Services/Shop Info anchors have the same IDs - document-wide lookups grabbed the editor's anchors instead of the previewed page's sections. The landing page now resolves nav targets scoped to its own root, so Preview nav (Home / Services & Pricing / Shop Info / Join Our Team) scrolls and highlights the correct sections.
- Shop Photos card removed from the admin dashboard: the Shop Photos upload card (temporarily added to the Dashboard Overview earlier) was removed from the admin dashboard at the user's request, along with its upload/preview/remove UI. The Shop Photos store is untouched, so photos already uploaded and the customer-facing Shop Photos viewer on the landing page/shop location dialogs keep working.
- Landing editor Close Preview button repositioned: it now sits centered at the very top of the preview (was bottom-right) above other page content, so it's always visible and no longer overlaps the Docufy logo in the landing header. Typecheck + build pass.

---

## September 14, 2026 2:13 AM (PHT) - prans
- Customer job board details drop-down: in the customer Job Listings (Job Board), the Details button now expands the job description with a smooth dropping-down accordion animation (300ms grid-template-rows height animation, both open and close) instead of snapping in - matching the My Orders "See More/Show Less" drawer pattern. On mobile the Details button also now sits below the location/contact-hours row (title + badges -> hours/location -> Details), while desktop keeps the button top-right and the meta row underneath.
- Mobile header stays visible while scrolling: the mobile header used to scroll away because the page wrapper used overflow-x-hidden, which per CSS rules turns the element into a non-scrolling scroll container and disables the sticky header against it. The wrapper now uses overflow-x-clip (clips paint without creating a scroll container), so the sticky top-0 header remains pinned while the page scrolls on phones. Typecheck + build pass.
- Merged collaborator's Landing editor fix (315f1aa5): pulled and merged the latest upstream - the Landing Page editor's Preview header nav now scrolls to the correct preview sections (scoped to the landing root instead of the whole document), the Shop Photos card was removed from the admin Dashboard Overview (the store and customer-facing viewers are untouched), and the editor's Close Preview button now sits centered at the top of the preview. No conflicts.

---

## September 14, 2026 2:17 AM (PHT) - prans
- Sidebar nav spacing tightened: the desktop sidebar had a large empty gap between the sidebar header (logo + collapse toggle) and the first nav heading - caused by the header bottom padding, a wide nav top padding and the section label's big top padding stacking up (~56px in total). The header padding, nav top padding and section label top padding were all reduced so the nav headings (MAIN, etc.) now sit close to the sidebar header with only the thin divider line between them. Typecheck + build pass.

---

## September 14, 2026 4:10 PM (PHT) - prans
- Staff Management merged with Attendance (admin): the separate Attendance page (/admin/attendance) was combined into the Staff Management page (/admin/staff), which now has a Staff List / Attendance tab switcher at the top. The full attendance monitoring view (Total Staff / On Time / Late / Absent KPI cards, filters, the live Currently Working strip, and the staff records table with its Adjust Clock-In/Out, On Leave, Absent, and Reset Day actions) renders inside the Attendance tab, so an admin can manage a staff member's account and their attendance from one place. The old /admin/attendance URL now redirects to /admin/staff?tab=attendance, so any saved/old links land directly on the attendance tab.
- Sidebar reorganized (admin): the OPERATIONS dropdown was removed entirely and the Job Board moved up to a main-level option right after Inventory. The Management group's Staff item was renamed to "Staff Management" (the page that now contains both staff accounts and attendance). Typecheck + build pass.

---

## September 14, 2026 4:37 PM (PHT) - prans
- Staff dashboard date range pill moved to the header row (staff): the All Time / This Month date-range selector, which used to sit alone in a row of its own between the greeting and the KPI cards, now sits on the same line as the "Dashboard" heading and welcome text, right-aligned on the right side of the header. The separate row inside the staff overview is gone, so the page reads as title + date pill on one line, then the metric cards. The admin dashboard is unchanged (its Overview tab still keeps its own date selector next to the Create Notification button).
- View Job Openings reverted to an inline list with drop-down animation (landing page): the "View Job Openings" button on the Join Our Team section no longer opens a floating pop-up list. It now drops down a real list immediately below the button in the normal page flow (same styling as the old inline list), so the bottom footer is pushed down along with the page instead of the list being obstructed by it. The list opens and closes with a smooth 300ms height animation (grid-template-rows accordion, matching the customer job-board Details pattern). Typecheck + build pass.

---

## September 14, 2026 4:55 PM (PHT) - prans
- No paper stock blocks the customer print request (printing flow): when there is no in-stock paper, the paper-size dropdown shows the disabled "No paper stock available" entry and the Continue button (Step 2) is now grayed out and unclickable. The per-file pricing indicators (the color-mode "Price per page" caption, the See Pricing Breakdown button, and the file's Subtotal) are hidden in that state, so no prices are shown for a print job that can't be fulfilled. Photo-only orders are not blocked by missing document paper (they have their own photo-paper warning), and the walk-in photocopy "Review & Complete" step is blocked too when no paper is in stock. Typecheck + build pass.
- Photo quantity always respects a minimum order of 1 or more: the 6R and A4 photo sizes had a 0 minimum, so the quantity stepper let users drop to 0 photos with no "minimum order" hint. Every photo size now carries a floor of at least 1 piece (defaults updated, and stored/admin-edited minimums are normalized up to 1), switching photo size still auto-raises the quantity to that size's minimum when it's lower and lets the user increase it, and the hint now reads "Minimum order: N pc(s). Price: â‚±X each." for every size. Typecheck + build pass.

---

## September 14, 2026 9:35 PM (PHT) - prans
- Staff role badge text centered on the pill (Staff Management > Attendance): the Staff role badge used to include an invisible square placeholder the same size as the Admin badge's shield icon, which pushed the "Staff" text off-center inside the pill. The placeholder was removed, so the text now sits centered. Typecheck + build pass.
- Job Board "Show description" no longer has a big empty gap, and the page no longer jumps when clicked (admin): the job cards kept a 24px flex gap between the card content and the description toggle, and toggling the description swapped the card's gap/padding classes on every click, which shifted the layout and made the page jump up. The gap is removed for good and the toggle no longer changes those classes, so only the description expands/collapses (matching the customer Job Board). Typecheck + build pass.
- Landing page service tags show on all three cards: the admin editor's Tag field (Services & Prices) was saved correctly but only rendered on the middle blue card. Cards 1 and 3 now render their tag too as a blue pill in the card header. Typecheck + build pass.
- Editable Google Maps embed (landing page + customer Shop Location): the address maps on the landing page and in the customer dashboard's Shop Location window were hardcoded. Admins can now change the embed link from the Landing Page editor (Shop Information > "Google Maps embed link"), which includes step-by-step instructions (Google Maps > Share > Embed a map > copy > paste > Save). The map and address now update everywhere at once, and they keep the original Docufy embed until changed. Typecheck + build pass.

---

## September 14, 2026 9:53 PM (PHT) - prans
- Landing page main title shows every comma line + a #b marker for the blue line: the hero title previously kept only the first two comma-separated parts and always highlighted the second one blue, so any extra parts were dropped. Now every comma-separated part renders as its own line, and the admin highlights a line blue by appending "#b" to it (the marker itself is hidden) - so the blue line is a choice, e.g. "Print, Track #b, Succeed". The editor's Main Title hint explains the syntax. Typecheck + build pass.
- Preview Map button added to the Landing editor (Shop Information): next to the Google Maps embed field there's now a "Preview Map" button that opens a dialog rendering the currently-entered embed link live (or the default Docufy map when empty) without saving - so the admin can check the link works before applying it. Typecheck + build pass.
- Editable Terms & Conditions and Privacy Policy (new Terms & Privacy admin page): the landing page footer, Sign Up, and checkout windows showed a fixed, hardcoded legal text. A new "Terms & Privacy" page under Management (/admin/legal, in the admin sidebar) lets the admin edit each policy's title, "Last updated" date, and sections (add/remove sections; a plain-text format - blank line = new paragraph, lines starting with "- " = bullet list). A Preview button shows the unsaved draft, plus Reset (restore defaults, with confirmation) and Save. All three places (footer, Sign Up, checkout) now render this stored content from one source, and the checkout window also gained a Terms/Privacy tab switcher. The customer job-application consent is a separate waiver and was left as-is. Typecheck + build pass.
- Contact details editable and shown in the landing footer (Landing editor > Shop Information): the footer's email and phone were hardcoded. Admins can now set Contact Email and Contact Phone in the editor, and the footer renders them as clickable mailto/tap-to-call links (defaults kept until changed). Typecheck + build pass.

---

## September 14, 2026 10:15 PM (PHT) - prans
- Landing editor containers now use a visible boxed outline: each editable section card (Logo, Top Section, Features, Services & Prices, Shop Information, About) switched from a heavy shadowed card to a clean `rounded-lg` bordered box with even padding, matching the Brand Logo card look, so the outlines of the section containers are clearly visible in the editor. Typecheck + build pass.
- Terms & Privacy sections are numbered automatically (admin): the section titles previously needed the number typed in by hand (e.g. "9. Contact Information"), which duplicated the badge number and broke when sections were added or removed. The editor now strips any typed leading number from the title, so the number comes only from the section's position - it shows as the badge in the editor and is added in front of the heading automatically on the reader pages (landing footer, sign up, checkout) and in the Preview. The old stored "N. " prefixes are cleaned out on load. Typecheck + build pass.
- Terms & Privacy sections can now be reordered (up/down arrows) and new sections auto-scroll into view: each section card in the Terms & Privacy editor gained up/down arrow buttons to move the section in the list (numbers follow automatically), and clicking "Add Section" smooth-scrolls to the new empty section so the admin lands right on it. Typecheck + build pass.
- "Last updated" sets itself automatically on save: the Terms & Privacy editor's "Last updated" date is now overwritten with today's date (Philippine time) whenever Save Changes is clicked, so the policies always show when they were last changed instead of a stale manual date. Typecheck + build pass.
- "Add Section" button text now visible on hover (Terms & Privacy): the button used a light-blue hover background with a white hover label, so the text became invisible on hover. It now fills Docufy blue on hover so the white label stays readable, matching the rest of the app's buttons. Typecheck + build pass.
- Login & Registration photo background (new Landing editor section): the Log in and Create account pages had a fixed stock photo background. A new "Login & Registration" section in the Landing editor (right below Logo) lets the admin upload a photo (PNG/JPG/WebP, under 3 MB) that replaces the stock photo on both pages, with a Preview button that shows the chosen photo on the darker side of a Log in and Create account mock, and a Reset to Default option. A dark shade is added over custom photos so the page text stays readable. The pages read the photo live from the landing store, so after saving the background applies everywhere instantly. Typecheck + build pass.

---

## September 14, 2026 10:50 PM (PHT) - prans
- Implemented hourly-based Staff Salary Tracking: staff salaries are now computed from attendance records (Total Approved Working Hours x Hourly Rate), shown in a new per-staff View Attendance & Salary dialog from the Staff List (summary, attendance records, current salary, Release Salary + confirmation, and Salary History) that stays in sync with attendance automatically.
- Implemented Salary Settings for admins: a Salary Settings card at the top of the Staff List shows the current Hourly Rate (default P50/hour) with an Edit Rate dialog, stored persistently via a new salaryStore so changes survive refresh.
- Implemented Release Salary flow: releasing pays the current period, records a history entry (staff, period, hours, rate, amount, release date, released by admin), and starts a fresh tracking period without deleting attendance history.
- Fixed staff role change reverting after refresh: the roster was kept in page state while the real role lived in in-memory auth accounts, so a Staff-to-Admin change looked like it reverted even though the account was already admin. The roster now persists (staffStore) alongside the sign-in accounts (AuthContext persists staff/admin accounts and exposes getStaffAccounts); the displayed role always matches the actual login permission now.

---

## September 14, 2026 11:30 PM (PHT) - prans
- Removed the Quick Links column from the landing footer: the footer links (Home, Services & Pricing, Shop Info, Join Our Team, Contact) just repeated the page's own navigation, so the column was removed and the footer's three remaining sections were rebalanced into Brand/About, Shop Information, and Contact Us.
- Reworked the landing footer contact section into Facebook Page + Messenger: the old Contact Phone row was replaced with a Facebook Page link and a Messenger link, both admin-editable in the Landing editor (Facebook Page Name + Link, and Facebook Account/Messenger Name + Link fields). Each contact row shows an icon label with its link underneath, and on mobile the links no longer take an extra indent.
- Made the landing footer compact on mobile: the footer previously stacked all sections full-width, taking a lot of vertical space on phones. Now on mobile the Brand/About block spans full width while Shop Information and Contact Us sit side-by-side in two columns with tighter spacing, so the footer is much shorter while staying readable; desktop layout is unchanged.
- Updated the support email from support@docufy.com to printwithdocufy@gmail.com everywhere: replaced in the landing footer defaults, the order-tracking and admin-order receipts, and the Terms & Privacy default contact text.

---

## September 15, 2026 (PHT) - prans
- Fixed attendance records missing after a Release Salary: releasing salary started the next tracking period on the day AFTER the release, so on the release day itself the "current period" window became inverted (tomorrow to today) and hid the staff's same-day clock-ins (the Attendance Records card showed "0 days / No attendance records in the current period"). The period start is now clamped so it never lands in the future, meaning a clock-in on the release day always shows in the current period; salary history and released amounts are untouched.
- Fixed never-closed clock-in sessions inflating hours across days: a session that was never clocked out counted up to "now" every time amounts were computed, so a days-old demo clock-in could grow to 70+ hours. Session totals are now capped at the end of that record's Manila day, so an open session can only tick within its own day.
- Saved attendance now syncs live across open tabs: the attendance records store now listens for storage changes from other tabs and reloads/notifies (matching the orders/inventory pattern), so a staff clock-in in one tab shows on the admin attendance view in another without a refresh. Staff/record matching is also case-insensitive (emails matched exactly used to miss records when the admin roster and the clock-in email differed in case).
- Photo files now blocked when there is no photo paper in stock (print request): the existing no-paper block only covered document/vellum/sticker files, so photo files could still be submitted with no photo-paper stock. Photo files now block both the customer Place Order and walk-in Proceed buttons with a clear "No photo paper in stock" toast, and the Step 2 Next button is disabled while in that state (the red no-photo-paper pill was already shown).
- Staff Attendance monitoring moved into the staff detail page: the standalone Admin Attendance page was replaced by the attendance summary/records cards in the Staff Management detail pane, using new shared views (attendanceView + day/history modal components); /admin/attendance now redirects to /admin/staff, and the PHT input helpers (Manila wall-clock to/from datetime-local) were added for attendance adjustments.
- Removed dead/unrouted legacy pages: the old top-level JobApplyForm, LogoutPage, AdminPaymentVerification, staff PaymentVerification, and the old PostCSS/logos/vercel config files were deleted; comment notes referencing "Supabase later" were generalized to "backend later" throughout the order/inventory modules.

---

## September 15, 2026 12:50 PM (PHT) - prans
- Redesigned the staff Clock-In & Timesheet page (staff side): rebuilt into a clean modern workspace with a page header, a Current Staff / Session card (staff info + today/role + live session timer), a state-driven primary clock action (Time In / Time Out / Clock In Again, disabled when On Leave or Marked Absent), Today / This Week / Overtime summary cards, a Personal Time Logs table (Date | Clock-In | Clock-Out | Total | Overtime | Status with On Leave, Absent, On Clock, Exceeded, Ongoing, Completed, Not Started states), and an information note - all in the blue (#1976F3)/navy (#102A5C)/light-gray (#F5F7FA) palette.
- Removed the page's own notification bell / clock / avatar header cluster: the app layout header already provides those, so the page no longer duplicates them.
- Timesheet rows now highlight the date instead of the weekday: the row's bold text is the date (e.g. "Sep 15, 2026") with the weekday in muted small text below.
- Session timer shows --:--:-- until the staff clocks in: the big live clock only starts counting once on the clock (previously it hid the timer entirely).

---

## September 15, 2026 ~8:57 PM (PHT) - prans
- Implemented persistent admin-editable attendance status on Staff Management: the Edit Staff dialog gained an Attendance Status control (Active - normal shift / On Leave) that stays on the staff record until an admin changes it again, so the status badge (e.g. On Leave) no longer resets each day or gets overridden by the demo seed. Only On Leave is settable now - anyone who does not clock in for the day is shown as Absent automatically (the manual Absent option and the separate No Clock-In badge, KPI chip, and filter were removed).
- On Leave requires a reason: choosing On Leave reveals a Reason for leave box, and the Save Changes button stays disabled (grayed out) until a reason is typed.
- On Leave pill opens the reason: clicking the On Leave badge in the staff list or the staff detail pane opens a small dialog showing why that staff member is on leave.
- Pencil shortcut on the detail pane status: a pencil icon beside the status badge in the staff detail pane header opens that staff's Edit dialog for quick status changes.
- Staff Time-In lockout panel redesigned: the staff lockout modal now uses a compact layout (icon + title side-by-side, two-column locked-actions grid, 12-hour live clock), shows a disabled "On Leave" / "Marked Absent" state when the staff member has an on-leave or absent mark so they can't clock in, and adds a Return to Dashboard action alongside Open Clock-In & Timesheet.

---

## September 19, 2026 11:21 PM (PHT) - ethanestoya
- `fix: customer-auth` â€” ported the Supabase customer-auth integration from testbranch2 (commits 6f8820e6 + 37428a80) onto backend-latest and fixed two auth bugs. Customer/staff/admin logins now run against Supabase (`signInWithPassword`, session restore, `profiles`-table role/active/suspended gating) instead of mock users.
- Signup contact number is now stored in Supabase: the phone the customer types at signup was dropped entirely (only `full_name` was sent, so `profiles.phone` stayed NULL). The phone is now sent in the signup user_metadata (so it is never lost), written straight to `profiles.phone` when the signup returns a session, and backfilled on first login if the profile row still has no phone (covers the email-confirmation path).
- Password reset no longer bounces to the dashboard: after resetting a forgotten password on the recovery-link page, the lingering password-recovery session made the login page instantly redirect the user to /customer/dashboard. The reset now signs the user out after a successful update so the login form actually renders and they can sign back in with the new password.

---

## September 24, 2026 (PHT) - ethanestoya
- Notifications & announcements synced to Supabase: the system notification store (order/payment/status/inventory alerts behind the header bell + Notifications page) and the admin announcement broadcast store (Create Notification / pricing & maintenance notices) now read/write the backend with the localStorage mirror kept as the offline fallback. Notifications use the `notifications` table (`read_at` = unread when null), announcements use `announcements` + the `announcement_reads` per-profile read-join, and both react to realtime changes across tabs/devices.
- Notifications keep their exact API and targeting: every store call-site (bell dropdown, Notifications page, order/payment/status events, inventory low-stock alerts, shop-status notices) is unchanged - rows are written local-first, then pushed best-effort; DB rows are adopted on load and merge by server id so realtime echoes never duplicate. Recipient fallback stays: 'all' broadcasts reach every role, 'staff_admin' collapses to the staff/admin security role, customer-targeted rows resolve the email to a profile so only that customer sees them (unresolvable emails stay invisible server-side instead of leaking).
- Announcement read state is per-person: the `readBy` email list now maps to `announcement_reads` rows for the signed-in viewer across devices (sender always auto-read), so "Mark all read" and the urgent badge behave the same on any device.
- Unread notification RLS added in SQL: notifications are INSERT-able by any signed-in user, but a row is visible/updatable/deletable only to its owner profile, every-role broadcasts, or the staff/admin scope; announcements are readable by all signed-in users and writable only by staff/admin. Tables were added to the `supabase_realtime` publication (drop-then-add) so live bell updates work.
- Fixed the silent order-cancel notification: the customer's Cancel Order in Order Tracking updated the order status but never emitted a notification, so neither the Bell/Notifications UI nor the `notifications` table got a row - it now notifies admin + staff ("Order Canceled by Customer"), matching the pre-payment cancel flow.
- Verification outcome now reaches the customer: staff/admin verifying a payment tells the customer via notification ("Payment Verified" - order entered the queue; "Payment Rejected" - with the reason, routed back to the payment page to resubmit). Walk-ins / no-email orders are skipped.
- New job applications no longer go unnoticed: submitting an application alerts admin + staff ("New Job Application") with a click-through to review it.
- Push diagnostics added: every notification/announcement insert now logs `[db:notification-push]`/`[db:announcement-push]` (ok with target recipients, or `RLS denied`), so a failed push is visible in the console instead of failing silently.

---

## September 26, 2026 (PHT) - ethanestoya
- Pricing synced to Supabase (Batch B): the admin-editable pricing module now reads/writes the backend instead of living only in localStorage. `pricing_settings` (single-row: legacy per-page rates + down-payment/full-payment thresholds + the cash-pickup & online payment-window durations) and `pricing_matrix_cells` (one row per Document/Vellum/Sticker/Photo matrix cell) are read on load, written on admin saves, and propagated everywhere via realtime.
- Admin edits are local-first with a quiet backend push: changing one price edits the UI instantly, then a best-effort upsert reaches the DB (settings row upserted whole, a matrix cell updated by its row id, full matrix save/reset replaces the cell table); a blocked write keeps the local value and never fails silently (RLS denials log, other errors toast). Customers with a partially-seeded/empty table keep the localStorage mirror as a fallback.
- Pricing shows up the moment a user logs in: pricing joined the auth-settle re-hydrate that was added for the anonymous-first-fetch race, so a fresh/incognito browser that booted anonymous now gets the DB rates as soon as the session restores - no manual reload.

---

## September 26, 2026 (PHT) - ethanestoya
- Shop content synced to Supabase (Batch C): the shop-status toggle, the admin-edited landing page text, the Terms & Privacy policies, the custom brand logo, and the shop-location photo gallery now read/write the backend, with the localStorage copies kept as the offline fallback. All five stayed 100% localStorage before - the tables existed but no code ever read them. The stores are now thin facades over Supabase (local edits apply instantly, then a best-effort push reaches the DB), realtime updates propagate every change across tabs/devices, and the written content replaces the local copy the moment a user logs in. New bootstrap seeds guarantee the shop-status (Open), landing content (defaults), policies, and brand settings rows exist. This is the first customer/anon-visible data, so the RLS opens these rows to everyone for reading while only staff/admin can write.
- Staff roster + salary tracking synced to Supabase (Batch D): the Staff Management directory and the salary module (hourly rate x attended hours, salary releases) now read/write the backend instead of per-browser localStorage. The roster rows are updated by id (a second device can never duplicate a seeded account), the nested demo details (performance notes, allowances, tasks) re-attach from their sub-tables on load, and salary releases are cross-device history rows joined back to the roster email/name. Releasing a salary stays synchronous for the confirmation flow, then inserts the history row and adopts the server id. All staff/salary reads and writes are staff/admin only - customers never see them.

---

## October 5, 2026 (5:34 PM PHT) - Francis William Garcia
- Backdrop click now returns staff to where they were: on the staff time-in lockout popup, clicking the blurred background (instead of the Time In / Timesheet / Dashboard buttons) sends the staff back to the page they were on before the locked page opened - so someone in Inventory who taps Orders lands back on Inventory instead of being dropped on the dashboard. A refresh or deep link straight onto a locked page still falls back to the dashboard.
- Split the public README from internal setup notes: the public `README.md` is now a short project intro + basic setup commands, and the detailed Supabase setup guide moved to a git-ignored `dev_readme.md` so internal setup steps stay out of the public repo.


---

## October 5, 2026 (10:53 PM PHT) — Francis William Garcia
- Added the Audit Trail admin page: a new Admin-only page (Admin -> Management -> Audit Trail) that shows a permanent record of every change in Docufy - who acted, what they changed, which module, and when - so any edit can be traced back to the exact person and time.
- Audit Trail table made scannable: the table shows only Date & Time, User, Role, Action, Module, Reference and a View Details button. The Description column was deliberately removed from the table because it repeated what those columns already said, made every row twice as tall, and pushed the useful information off-screen on a smaller laptop.
- View Details drawer now carries the full story: clicking a row opens a side panel with the activity title and timestamp, who performed it and their role, the module/action/reference, the exact previous -> new values that changed (e.g. Pending to Verified), the full written description, plus optional request details like IP address, device/browser and transaction ID - which are hidden entirely instead of shown as empty rows when unknown.
- Added filters and summary counts: four cards at the top (Total Activities, Activities Today, Admin Actions, Flagged for Review) and a filter row for Search, Role, Action, Module and a date range, with page numbers showing "Showing X-Y of N" so a long history stays easy to navigate.
- UI only - no backend changes: the `audit_logs` table exists in the database but the system never wrote to it, so this release deliberately includes no Supabase changes (no tables, triggers, or access rules). The page reads from a local log store seeded with sample entries; capturing real activity in the database is a separate future step.

---

## October 6, 2026 (1:42 AM PHT) - Francis William Garcia
- Added one shared loading system across the whole app: before this the app had no loading vocabulary at all - buttons had no loading state, confirmation dialogs could not await an action, and the 16 background store refreshes were completely silent, so slow work just looked frozen. Buttons now show a spinner and block double-submits, confirmation dialogs stay open until the action actually finishes (closing on rejection instead of vanishing mid-write), a thin progress bar shows while the app rehydrates, list pages show placeholder rows instead of an ambiguous blank table, and logging in / verifying payments / saving profiles / adding inventory all confirm progress in words.
- Standardized every date filter into one component: the eight different from/to date inputs across the app were replaced by a single shared control with a proper calendar that opens as you click or focus either box, formats as MM/DD/YYYY while still storing sortable YYYY-MM-DD, and accepts pasted spreadsheet dates - and it rejects impossible dates such as February 31 instead of silently turning them into March.
- Audit Trail View Details is now a centered pop-up instead of a side drawer: the details were previously sliding in from the right edge, which covered the table you were reading; it now floats in the middle with the header pinned and only the body scrolling, and the date-range column was widened and the search box resized so the filter row no longer feels cramped.
- Removed the order-file print button: the Print button on a staff/admin order's attached files could never work, because it tried to print a Supabase-signed document from inside a hidden iframe, and reaching into a cross-origin frame is blocked by the browser - the app then wrongly told the user their own browser had blocked printing. The button is gone rather than left broken; View and Download are unaffected and staff can still print ad hoc from the browser's own print dialog.
- Order files now respect the session lock: the View and Download buttons on an order's attachments stayed clickable even while another staff/admin was reviewing that same order, which defeated the whole point of the lock. They now show as unavailable and explain why when clicked, and the status actions plus the attached files follow one consistent lock.
- Fixed the order lock disappearing seconds after opening: opening an order used to lock it and then lose the lock a moment later while you were still looking at it, letting a colleague grab an order that was visibly open on your screen. The renewal stopped renewing as soon as the lock went missing, a lagging database update could wipe the lock outright, and any other browser tab (including a customer tab) silently cleared the shared lock record - so the order stayed unlocked for the rest of the session. The lock now holds for as long as the order window is open, survives those echoes, and still frees itself automatically if a tab is closed or a computer dies.

---

## October 7, 2026 11:11 PM (PHT) - Francis William Garcia
- Profile text now actually saves to Supabase: before this, editing your name or phone on the profile page only updated the on-screen copy (and an old localStorage copy) - the `profiles` table was never written, so a different device or a fresh login showed the old details. Saving now pushes name/phone (and the customer's student ID) to `profiles` via the backend, and the email address is read-only everywhere because it must stay locked to the registered login. If the save to the server fails, the edit form stays open and explains what failed so the change can be retried instead of silently taking effect locally only.
- Nav bar now shows the user's name: the sidebar and header identity areas used to display the email username (e.g. "staff" from staff@test.com) instead of the person's actual name, so a renamed profile never showed up anywhere in the navigation. The desktop sidebar profile button, its dropdown, the top-right profile dropdown, and the mobile drawer now display the user's full name (falling back to the email username when no name is set), so after saving a profile change the new name appears in the navigation immediately and persists across reloads.
- Profile pictures are Supabase-only: the leftover avatar habits from the old localStorage prototype were removed from all three profile pages - no avatar is read from or written to localStorage anymore, so two people sharing one browser can never see each other's picture. The picture now lives only in the `profile-images` storage bucket; if the picture upload fails, the text fields still save but the picture is not saved anywhere and the page clearly notes that, so a stale picture is never left behind.
- Two customers on one browser no longer share a profile page: the customer profile edits used a single shared browser-storage key, so switching accounts on the same computer could show one customer's edits on another customer's profile. The customer's saved data is now keyed to their own account, and any old shared copy is adopted only by the account it belongs to (the phone field also prefills from the saved data).
- Order reads now warn loudly if access rules are wrong: the staff/admin order list silently returned nothing if the database access rules for the `orders` table were misconfigured. Reading orders now logs a clear console warning in that case so a missing-RLS problem is visible instead of looking like an empty queue. The planned access-rule bundle also got a final check - inventory is readable by signed-in users only, and profile rows are updatable only by their own user - and no further SQL is required for this release.

---

## October 8, 2026 (PHT) — ethanestoya
- Audit Trail now records real activity to Supabase: every admin/staff change across Orders, Payments, Walk-in, Inventory, Pricing, Staff, Attendance, Shop Content, and Payment Methods writes an `audit_logs` row capturing who acted, their role, the module, the exact previous → new values, and when - so the log is a permanent database record instead of a browser-only list. The table starts empty by design (the sample entries stay as the browser fallback); real actions populate it from now on. This push also carries the already-logged October 7 profile/nav sync commit.
- Viewing the audit log is now admin-only in the database, not just in the UI: the page and sidebar were already restricted to admins, and a new access rule lets only admins read `audit_logs` while staff actions are still recorded (staff/admin can write, only admin can read).
- Fixed a false error toast on staff actions: a staff write saved to the database correctly but the app tried to read its new ID back under the stricter admin-only read rule and reported a failure that never happened - the write now confirms silently, and the device/browser field no longer stores a UI display label it was never meant to hold.
- Added CSV export to the Audit Trail page: a Download button exports whatever is currently shown after search/role/action/module/date filters, formatted so Excel opens it correctly and named with the export date.

---

## October 8, 2026 (6:12 PM PHT) - Francis William Garcia
- Blank white screen on startup replaced by a Supabase setup screen: starting the app with no environment keys used to show an empty white page with nothing to explain it, which is exactly what a fresh clone of the repo hits (the `.env.local` file is ignored, so nobody receives one). The app now checks its configuration before mounting and, when the keys are absent, shows a proper page instead - an amber warning that Supabase is not configured yet, the exact variable names that have no value, three plain steps (create `.env.local` in the project root, paste the values from Supabase Project Settings -> API, restart the dev server), a copyable template of the file, and a browser tab title that reads "Setup required". The same screen appears on a production build shipped without keys, and a configured-but-unreachable address gets a connection-error variant instead of a blank page.
- Fixed the crash that caused the blank screen: the Supabase client used to be built at the top of its module with the environment values passed straight in, and an empty value threw while the app's files were still loading - before React had mounted anything, so there was nothing to render and the failure was only visible in DevTools. The client now validates both keys first, falls back to a clearly labelled placeholder connection when they are missing or unusable, records the reason, and logs one clear console message naming the missing variables instead of an uncaught error.
- Environment knowledge split into its own module: the list of required Supabase keys and the copyable `.env.local` template now live apart from the client, so the startup screen can report the problem without importing (and therefore building) the client, and each value is read through a fixed property name so the bundler always substitutes it correctly at build time.

---

## October 10, 2026 (9:39 PM PHT) - aeprnts
- Built a full preview of the proposed unpaid/unclaimed-order penalty workflow: an in-memory (never persisted) store tracks a per-order incident status plus per-customer payment restrictions, and the UI shows it in the order-details dialog (Admin decides, Staff only flag/add private notes), on the customer profile as a clearly-labelled session preview state, as a calm customer-facing notice, and on Order Tracking for flagged orders. Nothing is enforced, saved, notified, or written to a real customer record - it is a design preview while the policy is still pending client approval.
- Added a dedicated Pickup Monitoring page for admin and staff: the Orders sidebar parent now has three children (All Orders / Pickup Monitoring / Unclaimed Orders), and the new page joins live orders to the preview incidents to show the pickup phase - ready for pickup, awaiting release, or flagged for review - with summary cards, search, a pickup-status filter, a date range, and a table whose rows can be flagged and opened for the role-gated review. Overdue is never auto-derived and deadlines are never invented; the page says a pickup deadline is not configured yet.
- Added an Unclaimed Orders review workspace for admin and staff: four tabs (Pending Review / Excuse Requests / Confirmed Unclaimed / Customer Restrictions), summary cards, search and date range, and a customer-restrictions list that admins can remove (with a reason, keeping history) while staff can view only. Opening an order reuses the same role-gated decision panel so the confirm/excuse/restriction rules live in one place.
- Removed the duplicated pickup workflow from the All Orders queue now that pickup has its own page: the preview Pickup Workflow tab strip, the Pickup column, the per-row incident chip, and the pickup filter logic are gone, and the empty state was simplified back. The Total/Balance column and the order-details review section were kept as required, and the loading placeholder was re-aligned to the narrower table.
- Simplified the Pickup Deadline column to one short scannable value instead of explanatory sentences: it shows the actual configured date and time, or "Pending approval" for cash/unpaid orders whose window still needs approval, or "Not configured" for fully-paid orders. The repeated "within pickup window" sub-line was dropped from the Pickup Status cell, and no date, hour, or deadline is ever invented.

---

## October 11, 2026 (6:19 AM PHT) - Francis William Garcia
- Redesigned the pickup order-review modal into a clean, sectioned layout: a compact header (customer name, order ID, submitted date & time, and the order status badge) sits above four at-a-glance overview cards - Payment & Balance, Pickup Readiness, Pickup Deadline, and Pickup Reminders - and the old separate order-summary strip was removed.
- Reworked the review body so the incident workflow reads in one place: an "Unclaimed-order Review" section shows the incident status badge and confirmed-incident count with the customer explanation and the private staff note side by side, followed by a slim blue "Preview mode" note that states decisions only update temporary preview state.
- Turned the Admin decision into three compact action cards - Keep under review, Confirm unclaimed order, and Excuse incident - each with an icon, short description, and chevron; the old separate "Review Incident" action was dropped so the modal itself is the review space.
- Moved the second-offence advance-payment options (50% deposit / full advance / remove restriction) into a secondary dialog that appears only when a repeat offence is relevant, instead of showing them inline on every order.
- Updated the Pickup Monitoring and Unclaimed Orders modals to the same compact header and wider layout. All preview-only rules, role gating (Staff flag/note, Admin decides), incident statuses, and note flows were preserved and nothing is saved, enforced, or written to a real customer record.

---

## October 13, 2026 (12:00 PM PHT) - Francis William Garcia
- Redesigned the customer Order Tracking pickup information card: pickup date and time are now derived from the order's own timeline (when it last changed status) instead of a hardcoded date, and the row shows a separate pickup-status badge (Ready for Pickup / Picked Up / Unclaimed) so the collection state is never confused with the printing status. The card moved above the Order Details section, reads compactly, and uses a highlighted blue background on both desktop and mobile.
- On mobile, the pickup location row now shows a "View Shop Location" button that opens the shop map and photos dialog instead of the full address text; desktop still shows the full address. The location itself always comes from the admin-managed shop content rather than a fixed string.
- Made the Order Tracking "Payment Method and Status" and "Invoice" cards collapsible on mobile to match the Order Details card, and removed the redundant "Basic Information" heading from the Order Details section.
- Added a customer-facing unclaimed-order warning card (preview only) on the Dashboard, My Orders, and print-request pages: it appears when the customer has a confirmed-unclaimed order and links straight to that order's tracking page.
- Merged demo orders into the Pickup Monitoring and Unclaimed Orders pages and seed their preview incidents once per load, so the pickup workflow can be shown with data without touching any real order.
- Added a demo-customer SQL seed (auth users, profiles, and orders) plus a login diagnostic script, and an `isDemo` flag on the order type so preview-only demo orders are never written to the database.

---

## October 13, 2026 (1:16 PM PHT) - Francis William Garcia
- Showed the Unclaimed badge beside "Current Status": a confirmed-unclaimed order now displays a small amber "Unclaimed" badge on the right side of the Current Status label row, so the customer sees the incident at a glance without opening the pickup card.

---

## October 13, 2026 (11:08 PM PHT) - Francis William Garcia
- Finalized the second-offense penalty rule: a customer with a second confirmed unclaimed-order offense can no longer choose Cash on Pickup. The rule is enforced at the single order-submission chokepoint (so a manipulated selection is rejected before anything is saved) and mirrored in the checkout UI, with walk-in sales exempt.
- Added confirmed-offense counting and a Cash-on-Pickup restriction helper to the pickup-review preview store, matching the customer by email case-insensitively.
- Updated the Cash on Pickup option on the print request so it now reads "Unavailable — second confirmed offense" with the full explanation, and refreshes live when the offense ledger changes; removed the old "restriction duration pending policy approval" preview notice from checkout.
- Updated the customer account violation preview and the payment restriction notice to the finalized wording, dropping the placeholder "duration pending approval" line.
- Stopped seeding the demo 50%-deposit restriction so the demo customer now demonstrates the Cash on Pickup restriction instead.
- Order Tracking: replaced the plain Unclaimed badge with a clearer amber warning — a compact clickable warning on mobile that opens a details dialog, and an inline amber note on desktop — each showing the offense label (First/Second/...) derived from the customer's real confirmed incidents.
- Merged the Pickup Date, Pickup Time, and Pickup Location rows into one pickup-information container on Order Tracking.

---

## October 14, 2026 (1:53 AM PHT) - Francis William Garcia
- Replaced the manual unpaid/unclaimed-order review workflow with an automatic, data-driven system: an order's unclaimed status and a customer's offense count are now worked out from the real order data and its order status timeline, so nothing has to be flagged, excused, or confirmed by hand and no separate offense ledger is stored.
- Added a Shop Closing Time setting on the Landing Page editor: the daily pickup deadline is now calculated from it, and the admin pickup/unclaimed pages show a clear "configure shop hours" warning until it is set (nothing is ever marked unclaimed before then).
- Rebuilt the Pickup Monitoring page around plain, honest states - ready, collected, or overdue - with a read-only details view, replacing the manual review panel.
- Rebuilt the Unclaimed Orders page into two clear lists: the unclaimed-order history and the customers who currently have a restriction, with search and a date range.
- Made payment restrictions fully automatic based on a customer's unclaimed-order count: the 1st offense is a warning only, the 2nd disables Cash on Pickup and requires a 50% deposit or full advance, and the 3rd and beyond requires full advance. Outstanding balance and account suspension stay separate from this.
- Updated the customer-facing unclaimed-order warning and Order Tracking so the warning and offense label reflect the real count, and removed the old "tell us why" excuse/explanation card.
- Removed the old manual preview pieces entirely: the order-review modal, the customer violations section, the payment-restriction notice, the in-memory pickup-review store, and its demo seed.
- Added a read-only order status-history timeline to order loading (degrading safely to empty when unavailable) and extended the demo SQL seed with demo accounts, orders, and status timelines that cover every unclaimed-order scenario.

---

## October 14, 2026 (2:20 PM PHT) - Francis William Garcia
- Rebuilt the Unclaimed Orders page (admin + staff) into a card hub: three summary cards (Unclaimed Orders, Late Pick-up History, Customers Restricted) over a table of the orders that are still uncollected. The cards are the only way into the two new detail pages - they stay out of the sidebar on purpose.
- Added two new Unclaimed Orders detail pages with their own admin and staff routes: Late Pick-up History (lists only orders that were collected after their pickup deadline, with a "Late By" column and figures in the details popup) and Customer Restrictions (the customers whose unclaimed count has restricted their payment options).
- Added a "Back to Unclaimed Orders" button on both detail pages so they return to the Unclaimed Orders hub, and pointed the mobile back arrow at the same page.
- Fixed the sidebar so card-only pages keep their parent highlighted: the Unclaimed Orders item now stays selected while viewing the History or Restrictions sub-pages instead of falling back to All Orders.
- Pickup Monitoring: the "Unclaimed Orders" card now opens the sidebar Unclaimed Orders page instead of filtering the table, and the separate "Unclaimed" filter chip was removed.
- Renamed the "Unclaimed Order History" card to "Late Pick-up History" and dropped its "View full history" hint.
- Added a demo-data reset SQL that clears every seeded @docufy.demo account and its dependent rows (child-first, re-runnable) and refreshed the demo seed to match.
- Show a "Logged in successfully" toast after a successful login.

---

## October 19, 2026 (1:55 AM PHT) - Francis William Garcia
- Unified every filter and search control across the system into one field design: a white field with a single light outline at rest and a darker outline on hover, so blue is now reserved for focus and for filters that are actually narrowing the list instead of being used on every resting field.
- Made an applied filter visible: a filter that is set now shows a pale-blue fill, a blue outline and a bolder blue value with a blue label, so you can tell at a glance which filters are on (automatic for date ranges, opt-in for status/type/method dropdowns).
- Gave the Shop Status "Mark Paused" button a real presence: it is now a filled amber action at rest that darkens to solid amber on hover, and the "already open" / "already paused" states became quiet grey and dashed chips instead of faded, unreadable buttons.
- Restyled Pickup Monitoring into the awaiting-collection workspace: three KPI cards (Ready for pickup / Overdue / Unclaimed), one search box plus a compact From-To date range over a status chip row, and a five-column table that reads the pickup outcome and Paid / amount due instead of raw order fields.
- Restyled the Orders table row action button: quiet white with a light outline at rest, filling solid blue with white text on hover, so row actions no longer compete with the page's status colours.
