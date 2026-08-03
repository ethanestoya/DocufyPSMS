# Quick Fixes - Most Important Changes

## 1. CustomerOrders.tsx - Make Cancel Button More Visible

Change line ~257-270 from:
```tsx
<Button
  variant="ghost"
  size="sm"
  className={`${
    order.status === 'In Queue'
      ? 'text-red-600 hover:text-red-700 hover:bg-red-50'
      : 'text-gray-300 cursor-not-allowed'
  }`}
  onClick={() => handleCancelClick(order.id, order.status)}
  disabled={order.status !== 'In Queue'}
>
  <XCircle className="w-4 h-4 mr-1" />
  Cancel
</Button>
```

To:
```tsx
<Button
  variant={order.status === 'In Queue' ? 'destructive' : 'ghost'}
  size="sm"
  className={`${
    order.status === 'In Queue'
      ? 'bg-red-600 hover:bg-red-700 text-white font-semibold'
      : 'text-gray-300 cursor-not-allowed'
  }`}
  onClick={() => handleCancelClick(order.id, order.status)}
  disabled={order.status !== 'In Queue'}
>
  <XCircle className="w-4 h-4 mr-2" />
  Cancel Order
</Button>
```

## 2. OrderTracking.tsx - Remove Download Section

Remove lines 133-184 (the entire "Attached Files" Card section)

## 3. OrderTracking.tsx - Dynamic Status Tracking

Replace the hardcoded `currentOrderStatus` (line 21) with:
```tsx
// Get order ID from params and determine status
const orderStatusMap: Record<string, string> = {
  'ORD-001': 'Completed',
  'ORD-002': 'Printing',
  'ORD-003': 'In Queue',
  'ORD-004': 'Received',
  'ORD-005': 'Released',
  'ORD-006': 'Completed',
  'ORD-007': 'In Queue',
  'ORD-008': 'Printing',
};

const currentOrderStatus = orderStatusMap[orderId || ''] || 'Received';
```

Update the orderStages calculation (after line 23) to:
```tsx
const getStageStatus = (stageName: string): 'completed' | 'current' | 'pending' => {
  const stages = ['Received', 'In Queue', 'Printing', 'Completed', 'Released'];
  const currentIndex = stages.indexOf(currentOrderStatus);
  const stageIndex = stages.indexOf(stageName);
  
  if (stageIndex < currentIndex) return 'completed';
  if (stageIndex === currentIndex) return 'current';
  return 'pending';
};

const orderStages = [
  { label: 'Received', icon: CheckCircle, status: getStageStatus('Received') },
  { label: 'In Queue', icon: Clock, status: getStageStatus('In Queue') },
  { label: 'Printing', icon: Printer, status: getStageStatus('Printing') },
  { label: 'Completed', icon: CheckCircle, status: getStageStatus('Completed') },
  { label: 'Released', icon: PackageIcon, status: getStageStatus('Released') },
];

// Calculate progress percentage
const stages = ['Received', 'In Queue', 'Printing', 'Completed', 'Released'];
const currentIndex = stages.indexOf(currentOrderStatus);
const progressPercentage = ((currentIndex + 1) / stages.length) * 100;
```

Update the progress bar (line 50) to:
```tsx
<div className="h-full bg-[#2F6FD6] transition-all" style={{ width: `${progressPercentage}%` }} />
```

## 4. Job Board - Make Position Field Not Editable

In JobApplyForm.tsx, find the "Position Applying For" Input and change to:
```tsx
<Input
  id="position"
  value={position}
  readOnly
  className="bg-gray-100 text-gray-900 font-semibold cursor-not-allowed border-gray-300"
/>
```

## 5. Layout.tsx - Add Title Support

Already done in previous update. Now update each page component to pass title:

Example for CustomerOrders.tsx:
```tsx
return (
  <Layout menuItems={menuItems} title="History">
    {/* Remove the <h1> header here */}
    <div className="space-y-6">
```

## 6. ReportsView.tsx - Align Buttons

In the Download button section of ReportsView, ensure buttons are in a flex container:
```tsx
<div className="flex items-center gap-3">
  <Button variant="outline" onClick={() => onDownload(currentReport)}>
    <Download className="w-4 h-4 mr-2" />
    Download PDF
  </Button>
</div>
```

These are the most critical user-facing changes. Implement these first for immediate improvement.
