# Docufy PSMS

**Docufy PSMS** (Print Shop Management System) is a web app for running a print shop. It gives customers, staff, and admins their own dashboard for everything from submitting a print job to managing stock, staff, and pay.

> Developed on the **`backend-core`** branch.

## What It Does

| Role | What they get |
|------|---------------|
| **Customer** | Submit print requests, track orders, pay online or on pickup, browse the job board, apply for open positions |
| **Staff** | Dashboard with KPIs, order queue, walk-in transactions, payment verification, inventory, time clock |
| **Admin** | Everything staff can do, plus staff management, the pricing matrix, and landing-page content editing |

Core features:

- **Orders** — move through Awaiting Payment → In Queue → Printing → Completed → Released, with live progress tracking for customers
- **Payments** — online payments with staff verification, down-payment tiers, and automatic expiry windows
- **Inventory** — stock tracked in pieces, automatically deducted as orders are fulfilled
- **Job board** — post openings, receive applications with uploaded portfolios
- **Attendance & salary** — staff clock in and out, salary is calculated from hours worked
- **Pricing** — an editable price matrix across service, content type, color, and paper size
- **Notifications** — role-specific alerts for orders, payments, inventory, and announcements

## Tech Stack

- React 18 + TypeScript, built with Vite
- Tailwind CSS v4, Radix UI / shadcn/ui
- React Router, Recharts, Lucide
- Supabase — Postgres, Auth, Storage, Realtime

## Getting Started

### Requirements

- [Node.js](https://nodejs.org/) 18 or newer
- npm

### Install

```bash
git clone https://github.com/pranswg/DocuFy-prot.git
cd DocuFy-prot
git checkout backend-core
npm install
```

### Configure

The app talks to Supabase, so it needs two environment variables in a `.env.local` file at the project root:

```bash
VITE_SUPABASE_URL=https://YOUR-PROJECT-REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-public-key
```

Get both from your Supabase project under **Project Settings → API**. Use the `anon` `public` key only.

### Run

```bash
npm run dev
```

Vite prints a local URL — open it in your browser (usually `http://localhost:5173`).

### Other Commands

| Command | What it does |
|---------|--------------|
| `npm run dev` | Start the development server |
| `npm run build` | Build for production into `dist/` |
| `npm run typecheck` | Type-check without emitting files |

The production build in `dist/` is a static bundle and can be hosted anywhere. Set the two environment variables in your host's build settings.

## Project Structure

```
src/
├── app/
│   ├── App.tsx        # Router setup (role-based routes)
│   ├── components/    # Pages and shared UI
│   ├── contexts/      # Auth, navigation state
│   └── utils/         # Data stores
├── lib/               # Supabase client, schema types, repositories
└── styles/            # Tailwind and global styles
```
