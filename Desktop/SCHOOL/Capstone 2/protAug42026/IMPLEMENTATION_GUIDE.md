# DocuFy PSMS - Implementation Guide

This guide contains all the changes requested for the system.

## Changes Required:

### 1. History (CustomerOrders) - Track Button Status Samples
- Update OrderTracking.tsx to dynamically show status based on order
- Create sample tracking data for each status: Received, In Queue, Printing, Completed, Released
- Remove "Download attached files" section

### 2. Job Board - Position Input
- Make "Position Applying For" text box highlighted/black text but not editable
- Use disabled or readonly input with better styling

### 3. Move Tab Titles to Header
- Update Layout.tsx to accept a `title` prop
- Display title alongside Profile button in header
- Remove titles from individual page components

### 4. Notification Icon Functionality
- Add notification state management
- Create sample notifications for all user types
- Notifications should reflect History/Orders data
- Add notification dropdown UI

### 5. Responsive Sizing
- Ensure all components scale appropriately
- Use responsive classes throughout

### 6. Job Board Management - Full Window Views
- Similar to Reports tab, open applicant views in full window
- Create separate view states for: viewing applicants, application details, resume
- Add sample resume data

### 7. Applicant Status Updates
- When status changes, update the list immediately
- Use state management to reflect changes

### 8. Reports Buttons Alignment
- Make View and Download buttons inline in Reports windows
- Ensure consistent spacing

### 9. Cancel Button Visibility (Customer History)
- Make cancel button more prominent
- Use brighter color scheme (red/orange)
- Add icon for better visibility

## Key Files to Modify:

1. `/src/app/components/Layout.tsx` - Add title prop and notification system
2. `/src/app/components/customer/OrderTracking.tsx` - Dynamic status tracking
3. `/src/app/components/customer/CustomerOrders.tsx` - Better cancel button
4. `/src/app/components/customer/JobBoard.tsx` - Readonly position field
5. `/src/app/components/customer/JobApplyForm.tsx` - Update form
6. `/src/app/components/admin/JobBoardManagement.tsx` - Full window views
7. `/src/app/components/admin/ReportsView.tsx` - Button alignment
8. All dashboard/main components - Remove title, add to Layout calls

## Implementation Priority:

1. HIGH: Cancel button visibility, Track status samples
2. MEDIUM: Notifications, Job Board updates, Title in header
3. MEDIUM: Full window views for Job Board Management
4. LOW: Reports button alignment, Responsive sizing refinements
