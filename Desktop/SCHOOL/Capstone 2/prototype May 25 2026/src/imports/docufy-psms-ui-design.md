Design a clean, modern, professional web-based system UI for DocuFy PSMS (Printing Shop Management System) used at a university printing shop. The prototype must include role-based login with three roles: Customer, Staff/Employee, and Admin.

Branding / Style

Use a DocuFy-inspired modern dashboard style:

Primary color: DocuFy Blue (use a strong blue similar to #2F6FD6)

Background: white and very light blue/gray panels

Cards: rounded corners, soft shadow, clean spacing

Typography: Inter or Poppins

Buttons: blue primary buttons, gray secondary buttons

Icons: simple line icons

The UI must be minimal and not messy, with clear section headers and consistent spacing.

Create desktop frames (1440px) and include a mobile version for key customer pages (login + order tracking).

1) AUTH FLOW (Required Screens)
A) Welcome / Landing Page (Public)

Create a public landing page with:

DocuFy logo header

tagline: “Your Printing Companion”

primary buttons:

Log In

Create Account (Customer)

Track Order

include a small “Services & Pricing” section

include shop hours + location card

Clean layout, hero section, and minimal text.

B) Log In Page (Shared, Role-Based)

Create a login page that works for all roles.

Layout:

Centered login card

DocuFy logo at top

fields: Email / Username, Password

button: Log In

link below: Create Account (Customer only)

small note text:
“Staff accounts are created by the administrator.”

After login, the system redirects based on role:

Admin → Admin Dashboard

Staff → Staff Queue Board

Customer → Customer Dashboard

Add a small “Role-based redirect” explanation box (for prototype clarity):
“Redirects automatically based on account role.”

C) Sign Up Page (Customer Only)

Create a sign-up page titled:
“Create Customer Account”

Fields:

Full Name

Email

Contact Number

Password

Confirm Password
Checkbox:
“I agree to the terms and file retention policy.”

Buttons:

Create Account

Back to Login

Add a note:
“Staff/Employee accounts cannot sign up. Please ask the administrator to create an account.”

2) CUSTOMER PORTAL (After login)
Customer Layout

Use a left sidebar + main content area.

Sidebar menu:
Dashboard
New Print Request
My Orders
Track Order
Job Board
Profile
Logout

Top bar: user name + notifications icon.

Customer Dashboard (Home)

Create:

Welcome header

3 quick-action cards:

New Print Request

Track My Order

Job Board

Recent Orders table (Order ID, Status, Total, Date)

New Print Request Page (Step Form)

Use a step-by-step wizard:

Step 1: Upload Document

upload dropzone

show detected page count

Step 2: Print Options

paper size dropdown:
Short (8.5 x 11)
A4 (8.27 x 11.69)
Long (8.5 x 13)

copies input

color mode radio:
All Black & White
All Colored

Step 3: Additional Notes

text area:
“Additional Notes / Printing Instructions (Optional)”
placeholder example text:
“Example: Please staple per set, front page colored only.”

Step 4: Summary + Total Amount
Show breakdown card:

Pages detected

Size

Copies

Mode

Total amount in bold

Show rule:
“If total ≥ ₱20, payment verification is required.”

Button: Place Order

Payment Verification Page (Shown only if Total ≥ ₱20)

Design a clean payment page:

Title: Payment Verification

show admin payment details:
Account Name, Account Number

instruction text:
“Pay the required partial amount and enter your reference number.”

input: Reference Number

optional upload: Proof of payment

button: Submit Reference

status label: “Waiting for Admin Verification”

Order Tracking Page

Create an order detail page with:

progress tracker timeline with 5 stages:
Received → In Queue → Printing → Completed → Released

order summary card

payment status badge:
Not Required / Pending / Verified / Rejected

pickup schedule info

Job Board Page (Customer)

Create a job board listing:

Cards with:
Service title
Description
Apply button

When Apply is clicked:
Create an “Apply Form” page:

Name

Contact

Service applying for

Skills/Message

Optional portfolio link

Submit Application

3) STAFF PORTAL (After login)
Staff Portal Layout

Sidebar menu:
Queue Board
Walk-in Transactions
Logout

Main page: Queue Board (Kanban)
Columns:
Received
In Queue
Printing
Completed
Released

Order cards show:
Order ID
Customer name
Pages
Print type

Include “Open Details” button on card.

Walk-in transactions page:

quick form for photocopy/supplies

auto total

save transaction

4) ADMIN PORTAL (After login)
Admin Portal Layout

Sidebar menu:
Dashboard
Payment Verification
Orders
Inventory
Employees
Reports
Accounts (Create Staff)
Job Board Management
Logout

Admin Dashboard:
KPI cards:

Orders Today

Pending Verifications

Sales Today

Low Stock Alerts
Add simple charts (sales trend, order volume).

Payment Verification page:

list/table of submitted references

buttons: Approve / Reject

Accounts page:

“Create Staff Account” form:
name, email, temporary password, role=staff

Inventory page:

stock list + low stock indicator

Reports page:

filter by date range + download buttons

Prototype Interactions (Linking)

Create clickable prototype links:

Landing → Login

Landing → Sign Up

Login → Customer Dashboard (for customer account)

Login → Staff Queue Board (for staff account)

Login → Admin Dashboard (for admin account)

Customer New Print Request → if total ≥ ₱20 → Payment Verification

Payment Verification → Order Tracking

Job Board → Apply Form

Make the UI consistent across all portals with the same brand style.