import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  LayoutGrid,
  ShoppingCart,
  User,
  Plus,
  Minus,
  CreditCard,
  Package,
  AlertCircle,
  Upload,
  Settings,
  FileCheck,
  CheckCircle,
  X,
  FileText,
  Eye,
  Boxes,
  Info,
  LayoutDashboard,
  Users,
  Briefcase,
} from 'lucide-react';
import { toast } from 'sonner';
import Layout from '../Layout';
import { Card } from '../ui/card';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { RadioGroup, RadioGroupItem } from '../ui/radio-group';
import { Textarea } from '../ui/textarea';
import { ordersStore } from '../../utils/ordersStore';
import { deductInventoryForWalkIn } from '../../utils/inventoryIntegration';
import { formatCurrency } from '../../utils/formatNumber';
import { AVAILABLE_ADDONS, type Addon } from '../../utils/constants';
import { PrintPreviewDialog } from '../ui/print-preview-dialog';
import { dataStore } from '../../utils/dataStore';
import { adminMenuItems } from '../../utils/adminMenuItems';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '../ui/dialog';

const ALLOWED_FILE_TYPES = {
  "application/pdf": ".pdf",
  "application/msword": ".doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
    ".docx",
  "application/vnd.ms-powerpoint": ".ppt",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    ".pptx",
  "application/vnd.ms-excel": ".xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet":
    ".xlsx",
  "text/plain": ".txt",
  "image/jpeg": ".jpg",
  "image/png": ".png",
};

const staffMenuItems = [
  { label: 'Dashboard', path: '/staff/dashboard', icon: <LayoutGrid className="w-5 h-5" /> },
  { label: 'Orders', path: '/staff/queue', icon: <Package className="w-5 h-5" /> },
  { label: 'Walk-in Transactions', path: '/staff/walk-in', icon: <ShoppingCart className="w-5 h-5" /> },
  { label: 'Payment Verification', path: '/staff/payment-verification', icon: <CreditCard className="w-5 h-5" /> },
  { label: 'Inventory', path: '/staff/inventory', icon: <Boxes className="w-5 h-5" /> },
];


type ColorAnalysis = {
  totalPages: number;
  colorPages: number[];
  bwPages: number[];
  colorPercentages: { [page: number]: number };
};

type FileData = {
  id: string;
  file: File;
  fileName: string;
  pageCount: number;
  colorAnalysis: ColorAnalysis | null;
  paperSize: string;
  copies: number;
  colorMode: string;
  pagesPerSheet: string;
  orientation: string;
  pageRange: string;
  specificPages: string;
  twoSided: string;
  notes: string;
};

type SupplyItem = {
  name: string;
  quantity: number;
  price: number;
};

interface UnifiedWalkInTransactionsProps {
  userRole: 'admin' | 'staff';
}

export default function UnifiedWalkInTransactions({ userRole }: UnifiedWalkInTransactionsProps) {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(1);
  const [fileError, setFileError] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [showAllAnalysis, setShowAllAnalysis] = useState<{ [fileId: string]: boolean }>({});
  const [showDetectedPages, setShowDetectedPages] = useState<{ [fileId: string]: boolean }>({});
  const [analyzingFileId, setAnalyzingFileId] = useState<string | null>(null);
  const [showCancelConfirmDialog, setShowCancelConfirmDialog] = useState(false);

  // Customer type selection
  const [customerType, setCustomerType] = useState('walkin');
  const [customerName, setCustomerName] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');

  // Auto-fill customer name when email is entered for registered customers
  const handleEmailChange = (email: string) => {
    setCustomerEmail(email);
    if (customerType === 'registered' && email) {
      const orders = dataStore.getOrders();
      const customerOrder = orders.find(order => order.customerEmail === email);
      if (customerOrder) {
        setCustomerName(customerOrder.customerName);
      } else {
        setCustomerName('');
      }
    }
  };

  // Files and print jobs
  const [files, setFiles] = useState<FileData[]>([]);

  // Add-ons
  const [selectedAddons, setSelectedAddons] = useState<{ [key: string]: number }>({});

  // Document analysis functions (matching Customer Print Request)
  const detectPageCount = async (file: File): Promise<number> => {
    const fileExtension = file.name.toLowerCase().split('.').pop();

    if (fileExtension === 'pdf') {
      try {
        const arrayBuffer = await file.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        const text = new TextDecoder('latin1').decode(uint8Array);
        const pageMatches = text.match(/\/Type\s*\/Page[^s]/g);
        if (pageMatches && pageMatches.length > 0) {
          return pageMatches.length;
        }
        return Math.max(1, Math.ceil(file.size / 102400));
      } catch (error) {
        console.error('Error reading PDF:', error);
        return Math.max(1, Math.ceil(file.size / 102400));
      }
    } else if (fileExtension === 'doc' || fileExtension === 'docx') {
      return Math.max(1, Math.ceil(file.size / 51200));
    } else if (fileExtension === 'ppt' || fileExtension === 'pptx') {
      return Math.max(1, Math.ceil(file.size / 153600));
    } else if (fileExtension === 'xls' || fileExtension === 'xlsx') {
      return Math.max(1, Math.ceil(file.size / 50000));
    } else if (fileExtension === 'txt') {
      return Math.max(1, Math.ceil(file.size / 3000));
    } else if (fileExtension === 'jpg' || fileExtension === 'jpeg' || fileExtension === 'png') {
      return 1;
    }
    return 1;
  };

  const analyzeColorContent = async (pageCount: number): Promise<ColorAnalysis> => {
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const colorPages: number[] = [];
    const bwPages: number[] = [];
    const colorPercentages: { [page: number]: number } = {};

    for (let i = 1; i <= pageCount; i++) {
      const hasColor = Math.random() > 0.6;
      if (hasColor) {
        colorPages.push(i);
        colorPercentages[i] = Math.floor(Math.random() * 70) + 15;
      } else {
        bwPages.push(i);
        colorPercentages[i] = 0;
      }
    }

    return {
      totalPages: pageCount,
      colorPages,
      bwPages,
      colorPercentages,
    };
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    setFileError('');

    if (!selectedFiles || selectedFiles.length === 0) return;

    const filesToProcess = Array.from(selectedFiles);

    for (const file of filesToProcess) {
      const fileType = file.type;
      const fileExtension = '.' + file.name.toLowerCase().split('.').pop();

      const isValidType =
        Object.keys(ALLOWED_FILE_TYPES).includes(fileType) ||
        Object.values(ALLOWED_FILE_TYPES).includes(fileExtension);

      if (!isValidType) {
        setFileError(
          `Unsupported file format in "${file.name}". Please upload PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, JPG, or PNG files only.`
        );
        e.target.value = '';
        return;
      }
    }

    setIsProcessingFile(true);

    try {
      const processedFiles: FileData[] = [];

      for (const file of filesToProcess) {
        const pageCount = await detectPageCount(file);
        const fileId = Math.random().toString(36).substr(2, 9);

        const newFile: FileData = {
          id: fileId,
          file,
          fileName: file.name,
          pageCount,
          colorAnalysis: null,
          paperSize: 'a4',
          copies: 1,
          colorMode: 'bw',
          pagesPerSheet: '1',
          orientation: 'portrait',
          pageRange: 'all',
          specificPages: '',
          twoSided: 'no',
          notes: '',
        };

        processedFiles.push(newFile);
      }

      setFiles((prev) => [...prev, ...processedFiles]);
      setIsProcessingFile(false);

      for (const processedFile of processedFiles) {
        setAnalyzingFileId(processedFile.id);
        const colorAnalysis = await analyzeColorContent(processedFile.pageCount);

        setFiles((prev) =>
          prev.map((f) =>
            f.id === processedFile.id
              ? {
                  ...f,
                  colorAnalysis,
                  colorMode: colorAnalysis.colorPages.length > 0 ? 'colored' : 'bw',
                }
              : f
          )
        );
        setAnalyzingFileId(null);
      }
    } catch (error) {
      setFileError('Error processing files. Please try again.');
      console.error(error);
      setIsProcessingFile(false);
      setAnalyzingFileId(null);
    } finally {
      e.target.value = '';
    }
  };

  const removeFile = (fileId: string) => {
    setFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const updateFileOption = (
    fileId: string,
    field: keyof Omit<FileData, 'id' | 'file' | 'fileName' | 'pageCount'>,
    value: any
  ) => {
    setFiles((prev) =>
      prev.map((f) => (f.id === fileId ? { ...f, [field]: value } : f))
    );
  };

  // UPDATED: Pricing logic to match Customer Print Request exactly
  const calculateFileTotal = (fileData: FileData) => {
    const { pageCount, copies, colorMode, paperSize, twoSided, colorAnalysis, pagesPerSheet } = fileData;
    const validCopies = Math.max(1, copies);

    let baseTotal = 0;

    if (colorMode === 'colored' && colorAnalysis) {
      // Per-page pricing based on detected color percentage:
      // >50% color → ₱5/page | ≤50% color → ₱3/page | B&W → ₱1/page
      let total = 0;

      for (const page of colorAnalysis.colorPages) {
        const pct = colorAnalysis.colorPercentages[page] ?? 0;
        let pricePerPage = pct > 50 ? 5 : 3;
        if (paperSize === 'long' || paperSize === 'legal') pricePerPage += 11;
        if (paperSize === 'a3') pricePerPage += 1.5;
        if (twoSided === 'yes') pricePerPage -= 0.5;
        total += pricePerPage;
      }

      for (let i = 0; i < colorAnalysis.bwPages.length; i++) {
        let pricePerPage = 1;
        if (paperSize === 'long' || paperSize === 'legal') pricePerPage += 11;
        if (paperSize === 'a3') pricePerPage += 1.5;
        if (twoSided === 'yes') pricePerPage -= 0.5;
        total += pricePerPage;
      }

      baseTotal = total * validCopies;
    } else {
      // Standard pricing: Black & White = ₱1/page, Colored (no analysis) = ₱5/page
      let pricePerPage = colorMode === 'colored' ? 5 : 1;
      if (paperSize === 'long' || paperSize === 'legal') pricePerPage += 11;
      if (paperSize === 'a3') pricePerPage += 1.5;
      if (twoSided === 'yes') pricePerPage -= 0.5;
      baseTotal = pageCount * validCopies * pricePerPage;
    }

    // Pages per sheet discount
    const pagesPerSheetNum = parseInt(pagesPerSheet);
    if (pagesPerSheetNum > 1) {
      baseTotal = baseTotal / pagesPerSheetNum;
    }

    return Math.max(0, baseTotal);
  };

  const calculateTotal = () => {
    const filesTotal = files.reduce((sum, file) => sum + calculateFileTotal(file), 0);
    const addonsTotal = Object.entries(selectedAddons).reduce(
      (sum, [addonId, qty]) => {
        const addon = AVAILABLE_ADDONS.find((a) => a.id === addonId);
        return sum + (addon ? addon.price * qty : 0);
      },
      0
    );
    return filesTotal + addonsTotal;
  };

  const handleProceedToQueue = () => {
    const total = calculateTotal();
    const orderId = dataStore.getNextOrderId();
    const transactionId = orderId;

    // Add to queue if there are print jobs
    if (files.length > 0) {
      const totalPages = files.reduce((sum, f) => sum + (f.pageCount * f.copies), 0);
      const hasColor = files.some(f => f.colorMode === 'colored');

      const now = new Date();

      // No down payment required for walk-in transactions - immediate payment
      const newOrder = {
        id: orderId,
        customer: customerType === 'walkin' ? 'Walk-in Customer' : (customerName || 'Walk-in Customer'),
        pages: totalPages,
        type: hasColor ? 'Colored' : 'B&W',
        notes: `Walk-in transaction - ${files.length} file(s)`,
        status: 'received' as const,
        time: now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true }),
        paperSize: files[0]?.paperSize === 'a4' ? 'A4' : files[0]?.paperSize === 'legal' ? 'Legal' : 'A4',
        copies: 1,
        submittedAt: now,
        paymentVerified: true, // Walk-in payment is immediate
        orderSource: 'walkin' as const,
        downPaymentRequired: false,
        downPaymentVerified: false,
        attachedFiles: files.map(f => ({
          name: f.fileName,
          size: `${(f.file.size / 1024 / 1024).toFixed(2)} MB`,
          type: f.file.type.toUpperCase().includes('PDF') ? 'PDF' :
                f.file.type.toUpperCase().includes('WORD') || f.file.type.toUpperCase().includes('DOCUMENT') ? 'Document' :
                f.file.type.toUpperCase().includes('POWERPOINT') || f.file.type.toUpperCase().includes('PRESENTATION') ? 'PowerPoint' :
                f.file.type.toUpperCase().includes('EXCEL') || f.file.type.toUpperCase().includes('SPREADSHEET') ? 'Excel' :
                f.file.type.toUpperCase().includes('IMAGE') ? 'Image' : 'Document',
          uploadedAt: now.toISOString(),
        })),
      };

      ordersStore.addOrder(newOrder);

      // Deduct inventory for each file
      files.forEach(file => {
        deductInventoryForWalkIn(transactionId, [
          {
            service: `${file.colorMode === 'colored' ? 'Colored' : 'B&W'} Print - ${file.paperSize}`,
            quantity: file.pageCount * file.copies,
            itemType: 'service' as const,
          }
        ]);
      });
    }

    // Deduct inventory for addons
    const addonItems = Object.entries(selectedAddons)
      .filter(([_, qty]) => qty > 0)
      .map(([addonId, qty]) => {
        const addon = AVAILABLE_ADDONS.find(a => a.id === addonId);
        return {
          service: addon?.name || '',
          quantity: qty,
          itemType: 'supply' as const,
        };
      });

    if (addonItems.length > 0) {
      deductInventoryForWalkIn(transactionId, addonItems);
    }

    toast.success(
      <div className="flex flex-col gap-1">
        <span className="font-semibold">Walk-in order sent to queue!</span>
        <span className="text-sm">Order ID: {transactionId}</span>
        <span className="text-sm">Total: {formatCurrency(total)}</span>
      </div>,
      { duration: 5000 }
    );

    // Reset form
    setFiles([]);
    setSelectedAddons({});
    setCustomerName('');
    setCustomerEmail('');
    setCustomerType('walkin');
    setCurrentStep(1);
  };

  const handleCancelOrder = () => {
    // Show confirmation dialog
    setShowCancelConfirmDialog(true);
  };

  const confirmCancelOrder = () => {
    // Reset form
    setFiles([]);
    setSelectedAddons({});
    setCustomerName('');
    setCustomerEmail('');
    setCustomerType('walkin');
    setCurrentStep(1);
    setShowCancelConfirmDialog(false);

    toast.info('Walk-in transaction cancelled');
  };

  const steps = [
    { number: 1, title: 'Customer & Files', icon: Upload },
    { number: 2, title: 'Print Options', icon: Settings },
    { number: 3, title: 'Add-ons', icon: ShoppingCart },
    { number: 4, title: 'Review & Complete', icon: CheckCircle },
  ];

  const menuItems = userRole === 'admin' ? adminMenuItems : staffMenuItems;
  const dashboardPath = userRole === 'admin' ? '/admin/dashboard' : '/staff/dashboard';

  return (
    <Layout menuItems={menuItems} title="Walk-in Transactions" showBackButton>
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Step Indicator */}
        <Card className="p-6 bg-white shadow-sm">
          <div className="flex items-center justify-between">
            {steps.map((step, index) => (
              <React.Fragment key={step.number}>
                <div className="flex flex-col items-center">
                  <div
                    className={`w-12 h-12 rounded-full flex items-center justify-center ${
                      currentStep >= step.number
                        ? 'bg-[#2F6FD6] text-white'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    <step.icon className="w-6 h-6" />
                  </div>
                  <p
                    className={`mt-2 text-sm font-medium ${
                      currentStep >= step.number ? 'text-gray-900' : 'text-gray-500'
                    }`}
                  >
                    {step.title}
                  </p>
                </div>
                {index < steps.length - 1 && (
                  <div
                    className={`flex-1 h-1 mx-4 ${
                      currentStep > step.number ? 'bg-[#2F6FD6]' : 'bg-gray-200'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>
        </Card>

        {/* Step Content */}
        <Card className="p-8 bg-white shadow-sm">
          {/* STEP 1: Customer & Files */}
          {currentStep === 1 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Step 1: Customer Information & Upload Files
              </h2>

              {/* Customer Type Selection */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">Customer Type</Label>
                <Select value={customerType} onValueChange={setCustomerType}>
                  <SelectTrigger className="h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="walkin">Walk-in Customer (Anonymous)</SelectItem>
                    <SelectItem value="registered">Registered Customer</SelectItem>
                    <SelectItem value="new">New Customer</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Customer Details (only for registered/new) */}
              {(customerType === 'registered' || customerType === 'new') && (
                <div className="p-4 bg-blue-50 border-2 border-blue-300 rounded-lg space-y-4">
                  <h3 className="text-sm font-semibold text-blue-900">Customer Information</h3>
                  <div className="space-y-3">
                    {customerType === 'registered' ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="customerEmail" className="text-sm">
                            Email Address *
                          </Label>
                          <Input
                            id="customerEmail"
                            type="email"
                            placeholder="customer@email.com"
                            value={customerEmail}
                            onChange={(e) => handleEmailChange(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        {customerName && (
                          <div className="space-y-2">
                            <Label className="text-sm text-gray-600">
                              Customer Name (Auto-filled)
                            </Label>
                            <div className="p-2 bg-gray-100 border border-gray-300 rounded-md text-sm font-medium text-gray-700">
                              {customerName}
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="customerName" className="text-sm">
                            Full Name
                          </Label>
                          <Input
                            id="customerName"
                            placeholder="Enter customer name"
                            value={customerName}
                            onChange={(e) => setCustomerName(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="customerEmail" className="text-sm">
                            Email Address
                          </Label>
                          <Input
                            id="customerEmail"
                            type="email"
                            placeholder="customer@email.com"
                            value={customerEmail}
                            onChange={(e) => setCustomerEmail(e.target.value)}
                            className="bg-white"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {fileError && (
                <div className="p-4 bg-white border-2 border-blue-200 rounded-lg flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-900">{fileError}</p>
                  </div>
                  <button
                    onClick={() => setFileError('')}
                    className="text-red-400 hover:text-red-500"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              )}

              {/* Uploaded Files List */}
              {files.length > 0 && (
                <div className="space-y-3">
                  {files.map((fileData, index) => (
                    <div
                      key={fileData.id}
                      className={`p-4 rounded-lg border-2 ${
                        analyzingFileId === fileData.id
                          ? 'bg-white border-2 border-blue-200 border-blue-300'
                          : 'bg-white border-2 border-blue-200 border-green-200'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <FileCheck
                          className={`w-5 h-5 flex-shrink-0 mt-0.5 ${
                            analyzingFileId === fileData.id ? 'text-blue-600' : 'text-blue-600'
                          }`}
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900 truncate">
                                {index + 1}. {fileData.fileName}
                              </p>
                              <p className="text-sm text-gray-600 mt-1">
                                {fileData.pageCount} {fileData.pageCount === 1 ? 'page' : 'pages'} detected
                              </p>
                              {analyzingFileId === fileData.id && (
                                <div className="mt-2 flex items-center gap-2">
                                  <div className="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                                  <p className="text-sm text-blue-700 font-medium">
                                    Analyzing document...
                                  </p>
                                </div>
                              )}
                              {fileData.colorAnalysis && analyzingFileId !== fileData.id && (
                                <div className="mt-2 space-y-1">
                                  <p className="text-xs text-blue-700 font-medium">Analysis complete</p>
                                  {fileData.colorAnalysis.colorPages.length > 0 ? (
                                    <p className="text-xs text-gray-600">
                                      Color detected on {fileData.colorAnalysis.colorPages.length} page
                                      {fileData.colorAnalysis.colorPages.length !== 1 ? 's' : ''}
                                    </p>
                                  ) : (
                                    <p className="text-xs text-gray-600">
                                      No color detected (Black & White)
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => removeFile(fileData.id)}
                              className="text-red-400 hover:text-red-500 hover:bg-white border-2 border-blue-200"
                              disabled={analyzingFileId === fileData.id}
                            >
                              <X className="w-4 h-4 mr-1" />
                              Remove
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Upload Area */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-[#2F6FD6] transition-colors">
                <Upload className="w-10 h-10 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-700 mb-2 font-medium">
                  {files.length === 0 ? 'Upload Document' : 'Add More Files'}
                </p>
                <p className="text-sm text-gray-500 mb-2">
                  Supported formats: PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT, JPG, PNG
                </p>
                <div className="bg-white border-2 border-blue-200 border border-blue-300 rounded-lg p-3 mb-4 max-w-lg mx-auto">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                    <p className="text-xs text-blue-800 text-left">
                      <strong>Preferred Format: PDF</strong>
                      <br />
                      DocuFy will not take responsibility for any formatting errors or issues with
                      Word (.docx), PowerPoint (.pptx), or other non-PDF files.
                    </p>
                  </div>
                </div>

                <label className="inline-block cursor-pointer">
                  <span className="px-6 py-3 bg-[#2F6FD6] text-white rounded-lg hover:bg-[#2557b8] transition-colors font-medium inline-flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {files.length === 0 ? 'Choose File' : 'Add More Files'}
                  </span>
                  <Input
                    type="file"
                    onChange={handleFileUpload}
                    accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.jpg,.jpeg,.png,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/plain,image/jpeg,image/png"
                    className="hidden"
                    disabled={isProcessingFile}
                    multiple
                  />
                </label>

                {isProcessingFile && (
                  <p className="text-sm text-gray-600 mt-4">Processing file...</p>
                )}
              </div>
            </div>
          )}

          {/* STEP 2: Print Options (Copied from Customer Print Request) */}
          {currentStep === 2 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Step 2: Print Options for Each File
              </h2>

              {files.map((fileData, index) => (
                <Card
                  key={fileData.id}
                  className="p-6 bg-gray-50"
                >
                  <div className="mb-4 pb-4 border-b border-gray-300">
                    <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                      <FileText className="w-5 h-5 text-[#2F6FD6] shrink-0" />
                      <span className="truncate block">
                        File {index + 1}: {fileData.fileName}
                      </span>
                    </h3>
                    <p className="text-sm text-gray-600 mt-1">
                      {fileData.pageCount} pages detected
                    </p>
                  </div>

                  {/* Color Analysis Results */}
                  {fileData.colorAnalysis && (
                    <div className="mb-6 p-4 bg-white border-2 border-blue-200 rounded-lg">
                      <h4 className="text-sm font-semibold text-blue-900 mb-3 flex items-center gap-2">
                        <AlertCircle className="w-4 h-4" />
                        Document Analysis Results
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-blue-800">
                            Total Pages:
                          </span>
                          <span className="font-medium text-blue-900">
                            {fileData.colorAnalysis.totalPages}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-blue-800">
                            Color Pages:
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-blue-900">
                              {fileData.colorAnalysis.colorPages.length > 0
                                ? `${fileData.colorAnalysis.colorPages.length} pages`
                                : "None"}
                            </span>
                            {fileData.colorAnalysis.colorPages.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowDetectedPages({
                                    ...showDetectedPages,
                                    [fileData.id]: !showDetectedPages[fileData.id],
                                  })
                                }
                                className="text-xs text-[#2F6FD6] hover:text-[#1e5bb8] font-medium underline"
                              >
                                {showDetectedPages[fileData.id] ? "Hide Pages" : "See Detected Pages"}
                              </button>
                            )}
                          </div>
                        </div>
                        {showDetectedPages[fileData.id] && fileData.colorAnalysis.colorPages.length > 0 && (
                          <div className="mt-2 p-2 bg-blue-50 rounded border border-blue-100">
                            <p className="text-xs text-blue-700 font-medium mb-1">
                              Color Pages: {fileData.colorAnalysis.colorPages.join(", ")}
                            </p>
                          </div>
                        )}
                        <div className="flex justify-between items-center">
                          <span className="text-blue-800">
                            B&amp;W Pages:
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-blue-900">
                              {fileData.colorAnalysis.bwPages.length} pages
                            </span>
                            {fileData.colorAnalysis.bwPages.length > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowDetectedPages({
                                    ...showDetectedPages,
                                    [fileData.id + "-bw"]: !showDetectedPages[fileData.id + "-bw"],
                                  })
                                }
                                className="text-xs text-[#2F6FD6] hover:text-[#1e5bb8] font-medium underline"
                              >
                                {showDetectedPages[fileData.id + "-bw"] ? "Hide Pages" : "See Detected Pages"}
                              </button>
                            )}
                          </div>
                        </div>
                        {showDetectedPages[fileData.id + "-bw"] && fileData.colorAnalysis.bwPages.length > 0 && (
                          <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                            <p className="text-xs text-gray-700 font-medium mb-1">
                              B&amp;W Pages: {fileData.colorAnalysis.bwPages.join(", ")}
                            </p>
                          </div>
                        )}
                        {fileData.colorAnalysis.colorPages.length > 0 && showDetectedPages[fileData.id] && (
                          <div className="mt-3 pt-3 border-t border-green-200">
                            <p className="text-xs text-blue-700 font-medium mb-2">
                              Color Intensity by Page:
                            </p>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {(showAllAnalysis[fileData.id]
                                ? fileData.colorAnalysis.colorPages
                                : fileData.colorAnalysis.colorPages.slice(0, 6)
                              ).map((page) => (
                                <div
                                  key={page}
                                  className="flex justify-between"
                                >
                                  <span className="text-blue-700">
                                    Page {page}:
                                  </span>
                                  <span className="font-medium text-blue-900">
                                    {fileData.colorAnalysis!.colorPercentages[page]}% color
                                  </span>
                                </div>
                              ))}
                            </div>
                            {fileData.colorAnalysis.colorPages.length > 6 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowAllAnalysis({
                                    ...showAllAnalysis,
                                    [fileData.id]: !showAllAnalysis[fileData.id],
                                  })
                                }
                                className="text-xs text-[#2F6FD6] hover:text-[#1e5bb8] font-medium mt-2 underline"
                              >
                                {showAllAnalysis[fileData.id]
                                  ? "- Show Less"
                                  : `+ See More (${fileData.colorAnalysis.colorPages.length - 6} more pages)`}
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Paper Size
                        </Label>
                        <Select
                          value={fileData.paperSize}
                          onValueChange={(value) =>
                            updateFileOption(
                              fileData.id,
                              "paperSize",
                              value,
                            )
                          }
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="a4">A4 (210 × 297 mm)</SelectItem>
                            <SelectItem value="letter">Letter (8.5 × 11 in)</SelectItem>
                            <SelectItem value="legal">Legal (8.5 × 14 in)</SelectItem>
                            <SelectItem value="short">Short Bond (8.5 × 11 in)</SelectItem>
                            <SelectItem value="long">Long Bond (8.5 × 13 in)</SelectItem>
                            <SelectItem value="a5">A5 (148 × 210 mm)</SelectItem>
                            <SelectItem value="a3">A3 (297 × 420 mm) +₱1.50/page</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Orientation
                        </Label>
                        <Select
                          value={fileData.orientation}
                          onValueChange={(value) =>
                            updateFileOption(
                              fileData.id,
                              "orientation",
                              value,
                            )
                          }
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="portrait">
                              Portrait
                            </SelectItem>
                            <SelectItem value="landscape">
                              Landscape
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Number of Copies
                        </Label>
                        <Input
                          type="number"
                          min="1"
                          value={fileData.copies}
                          onChange={(e) => {
                            const value = parseInt(
                              e.target.value,
                            );
                            updateFileOption(
                              fileData.id,
                              "copies",
                              Math.max(1, value || 1),
                            );
                          }}
                          className="h-10"
                        />
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-medium">
                          Two-Sided Printing
                        </Label>
                        <Select
                          value={fileData.twoSided}
                          onValueChange={(value) =>
                            updateFileOption(
                              fileData.id,
                              "twoSided",
                              value,
                            )
                          }
                        >
                          <SelectTrigger className="h-10">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="no">
                              Single-Sided
                            </SelectItem>
                            <SelectItem value="yes">
                              Double-Sided (₱0.50 savings/page)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Pages per Sheet
                      </Label>
                      <Select
                        value={fileData.pagesPerSheet}
                        onValueChange={(value) =>
                          updateFileOption(
                            fileData.id,
                            "pagesPerSheet",
                            value,
                          )
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">
                            1 Page per Sheet
                          </SelectItem>
                          <SelectItem value="2">
                            2 Pages per Sheet
                          </SelectItem>
                          <SelectItem value="4">
                            4 Pages per Sheet
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-gray-500">
                        Print multiple pages on a single sheet
                        to save costs
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Color Mode
                      </Label>
                      {fileData.colorAnalysis && (
                        <div className="mb-2 px-3 py-2 bg-white border-2 border-blue-200 rounded-lg">
                          <p className="text-xs font-medium text-[#000000]">
                            Auto-pricing applied from document
                            analysis
                          </p>
                          <p className="text-xs mt-0.5 text-[#000000]">
                            Colored mode prices pages
                            individually: &gt;50% color =
                            ₱5/page · ≤50% color = ₱3/page · B&amp;W
                            = ₱1/page
                          </p>
                        </div>
                      )}
                      <RadioGroup
                        value={fileData.colorMode}
                        onValueChange={(value) =>
                          updateFileOption(
                            fileData.id,
                            "colorMode",
                            value,
                          )
                        }
                        className="gap-2"
                      >
                        <label
                          className={`flex items-center space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            fileData.colorMode === "bw"
                              ? "border-[#2F6FD6] bg-white border-2 border-blue-200"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <RadioGroupItem
                            value="bw"
                            id={`bw-${fileData.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">
                              Black and White
                            </p>
                            <p className="text-xs text-gray-600">
                              ₱1.00 per page — all pages printed
                              in grayscale
                            </p>
                          </div>
                        </label>
                        <label
                          className={`flex items-center space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                            fileData.colorMode === "colored"
                              ? "border-[#2F6FD6] bg-white border-2 border-blue-200"
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <RadioGroupItem
                            value="colored"
                            id={`colored-${fileData.id}`}
                          />
                          <div className="flex-1">
                            <p className="font-medium text-gray-900 text-sm">
                              Colored
                              {fileData.colorAnalysis && (
                                <span className="ml-2 text-xs font-normal bg-white border-2 border-blue-200 px-1.5 py-0.5 rounded text-[#000308]">
                                  Analysis-based pricing
                                </span>
                              )}
                            </p>
                            {fileData.colorAnalysis ? (
                              <div className="text-xs text-gray-600 mt-0.5 space-y-0.5">
                                {(() => {
                                  const highColor =
                                    fileData.colorAnalysis.colorPages.filter(
                                      (p) =>
                                        (fileData.colorAnalysis!
                                          .colorPercentages[
                                          p
                                        ] ?? 0) > 50,
                                    ).length;
                                  const lowColor =
                                    fileData.colorAnalysis.colorPages.filter(
                                      (p) =>
                                        (fileData.colorAnalysis!
                                          .colorPercentages[
                                          p
                                        ] ?? 0) <= 50,
                                    ).length;
                                  const bwCount =
                                    fileData.colorAnalysis
                                      .bwPages.length;
                                  return (
                                    <>
                                      {highColor > 0 && (
                                        <span className="block">
                                          ₱5/page × {highColor}{" "}
                                          page
                                          {highColor !== 1
                                            ? "s"
                                            : ""}{" "}
                                          (&gt;50% color)
                                        </span>
                                      )}
                                      {lowColor > 0 && (
                                        <span className="block">
                                          ₱3/page × {lowColor}{" "}
                                          page
                                          {lowColor !== 1
                                            ? "s"
                                            : ""}{" "}
                                          (≤50% color)
                                        </span>
                                      )}
                                      {bwCount > 0 && (
                                        <span className="block">
                                          ₱1/page × {bwCount}{" "}
                                          B&amp;W page
                                          {bwCount !== 1
                                            ? "s"
                                            : ""}
                                        </span>
                                      )}
                                    </>
                                  );
                                })()}
                              </div>
                            ) : (
                              <p className="text-xs text-gray-600">
                                ₱5.00 per page (analysis
                                pending)
                              </p>
                            )}
                          </div>
                        </label>
                      </RadioGroup>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-sm font-medium">
                        Page Range
                      </Label>
                      <Select
                        value={fileData.pageRange}
                        onValueChange={(value) =>
                          updateFileOption(
                            fileData.id,
                            "pageRange",
                            value,
                          )
                        }
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">
                            All Pages
                          </SelectItem>
                          <SelectItem value="specific">
                            Specific Pages
                          </SelectItem>
                        </SelectContent>
                      </Select>
                      {fileData.pageRange === "specific" && (
                        <Input
                          placeholder="e.g., 1-5, 8, 11-13"
                          value={fileData.specificPages}
                          onChange={(e) =>
                            updateFileOption(
                              fileData.id,
                              "specificPages",
                              e.target.value,
                            )
                          }
                          className="h-10 mt-2"
                        />
                      )}
                    </div>

                    {/* Per-File Notes */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm font-medium">
                          Additional Notes (Optional)
                        </Label>
                        <span className="text-xs text-gray-500">
                          {fileData.notes.length}/100
                        </span>
                      </div>
                      <Textarea
                        value={fileData.notes}
                        onChange={(e) =>
                          updateFileOption(
                            fileData.id,
                            "notes",
                            e.target.value,
                          )
                        }
                        placeholder="Add any special instructions for this specific file..."
                        rows={3}
                        className="text-sm"
                        maxLength={100}
                      />
                    </div>

                    {/* File Total */}
                    <div className="pt-3 mt-3 border-t border-gray-300">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">
                          Subtotal for this file:
                        </span>
                        <span className="text-lg font-semibold text-[#2F6FD6]">
                          {formatCurrency(
                            calculateFileTotal(fileData),
                          )}
                        </span>
                      </div>
                    </div>

                    {/* Preview Button */}
                    <div className="pt-3 mt-3 border-t border-gray-200">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setPreviewFileId(fileData.id);
                          setShowPreview(true);
                        }}
                        className="w-full border-[#2F6FD6] text-[#2F6FD6] hover:bg-white border-2 border-blue-200"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        Preview
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {files.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <p>
                    Please upload at least one file in Step 1 to
                    configure print options.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: Add-ons (Copied from Customer Print Request, without Supplies) */}
          {currentStep === 3 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
                <ShoppingCart className="w-6 h-6 text-[#2F6FD6]" />
                Step 3: Add-ons (Optional)
              </h2>

              <div className="p-4 bg-white border-2 border-blue-200 rounded-lg">
                <p className="text-sm text-blue-800">
                  Need additional supplies? Add clips, staplers,
                  folders, or binding services to your order.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {AVAILABLE_ADDONS.map((addon) => {
                  const quantity =
                    selectedAddons[addon.id] || 0;
                  return (
                    <Card
                      key={addon.id}
                      className="p-4 hover:shadow-md transition-shadow"
                    >
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900">
                            {addon.name}
                          </h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {addon.description}
                          </p>
                          <p className="text-sm font-bold text-[#2F6FD6] mt-2">
                            ₱{addon.price} / {addon.unit}
                          </p>
                        </div>
                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded capitalize">
                          {addon.category}
                        </span>
                      </div>

                      <div className="flex items-center gap-3 mt-4">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAddons((prev) => ({
                              ...prev,
                              [addon.id]: Math.max(
                                0,
                                (prev[addon.id] || 0) - 1,
                              ),
                            }));
                          }}
                          disabled={quantity === 0}
                        >
                          <Minus className="w-4 h-4" />
                        </Button>

                        <Input
                          type="number"
                          min="0"
                          value={quantity}
                          onChange={(e) => {
                            const value = parseInt(e.target.value) || 0;
                            setSelectedAddons((prev) => ({
                              ...prev,
                              [addon.id]: Math.max(0, value),
                            }));
                          }}
                          className="w-20 text-center text-lg font-bold"
                        />

                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedAddons((prev) => ({
                              ...prev,
                              [addon.id]:
                                (prev[addon.id] || 0) + 1,
                            }));
                          }}
                        >
                          <Plus className="w-4 h-4" />
                        </Button>

                        {quantity > 0 && (
                          <span className="ml-auto text-sm font-semibold text-blue-600">
                            ₱{Math.round(addon.price * quantity)}
                          </span>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>

              {Object.keys(selectedAddons).some(
                (key) => selectedAddons[key] > 0,
              ) && (
                <Card className="p-4 bg-white border-2 border-blue-200 border-2 border-blue-300">
                  <h3 className="font-bold text-gray-900 mb-3">
                    Selected Add-ons
                  </h3>
                  <div className="space-y-2">
                    {Object.entries(selectedAddons)
                      .filter(([_, qty]) => qty > 0)
                      .map(([addonId, qty]) => {
                        const addon = AVAILABLE_ADDONS.find(
                          (a) => a.id === addonId,
                        );
                        if (!addon) return null;
                        return (
                          <div
                            key={addonId}
                            className="flex justify-between text-sm"
                          >
                            <span className="text-gray-700">
                              {addon.name} × {qty}
                            </span>
                            <span className="font-semibold text-gray-900">
                              ₱{Math.round(addon.price * qty)}
                            </span>
                          </div>
                        );
                      })}
                    <div className="border-t border-blue-200 pt-2 mt-2 flex justify-between font-bold">
                      <span>Add-ons Total:</span>
                      <span className="text-blue-700">
                        {formatCurrency(
                          Object.entries(selectedAddons).reduce(
                            (sum, [addonId, qty]) => {
                              const addon = AVAILABLE_ADDONS.find(
                                (a) => a.id === addonId,
                              );
                              return (
                                sum + (addon ? addon.price * qty : 0)
                              );
                            },
                            0,
                          ),
                        )}
                      </span>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* STEP 4: Review & Complete */}
          {currentStep === 4 && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-gray-900">
                Step 4: Review & Complete Transaction
              </h2>

              {/* Customer Info Summary */}
              <Card className="p-5 bg-blue-50">
                <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <User className="w-5 h-5 text-blue-600" />
                  Customer Information
                </h3>
                <div className="text-sm text-gray-700">
                  {customerType === 'walkin' ? (
                    <p>Walk-in Customer (Anonymous)</p>
                  ) : (
                    <>
                      <p>
                        <strong>Type:</strong>{' '}
                        {customerType === 'registered' ? 'Registered Customer' : 'New Customer'}
                      </p>
                      {customerName && (
                        <p>
                          <strong>Name:</strong> {customerName}
                        </p>
                      )}
                      {customerEmail && (
                        <p>
                          <strong>Email:</strong> {customerEmail}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </Card>

              {/* Files Summary */}
              {files.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold text-gray-900">
                    Print Jobs ({files.length} file{files.length !== 1 ? 's' : ''})
                  </h3>
                  {files.map((fileData, index) => (
                    <Card key={fileData.id} className="p-5 bg-gray-50">
                      <div className="font-semibold text-gray-900 mb-3 pb-2 border-b border-gray-300 truncate">
                        File {index + 1}: {fileData.fileName}
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-gray-600">Pages</p>
                          <p className="font-medium text-gray-900">
                            {fileData.pageCount} pages
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Copies</p>
                          <p className="font-medium text-gray-900">{fileData.copies}</p>
                        </div>
                        <div>
                          <p className="text-gray-600">Paper Size</p>
                          <p className="font-medium text-gray-900 capitalize">
                            {fileData.paperSize}
                          </p>
                        </div>
                        <div>
                          <p className="text-gray-600">Color Mode</p>
                          <p className="font-medium text-gray-900">
                            {fileData.colorMode === 'bw' ? 'Black & White' : 'Colored'}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-300 flex justify-between items-center">
                        <span className="text-sm font-medium text-gray-700">Subtotal:</span>
                        <span className="font-semibold text-[#2F6FD6]">
                          {formatCurrency(calculateFileTotal(fileData))}
                        </span>
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Add-ons Summary */}
              {Object.keys(selectedAddons).some((key) => selectedAddons[key] > 0) && (
                <Card className="p-5 bg-white border-2 border-blue-200">
                  <h3 className="font-semibold text-gray-900 mb-3">Add-ons</h3>
                  <div className="space-y-2">
                    {Object.entries(selectedAddons)
                      .filter(([_, qty]) => qty > 0)
                      .map(([addonId, qty]) => {
                        const addon = AVAILABLE_ADDONS.find((a) => a.id === addonId);
                        if (!addon) return null;
                        return (
                          <div key={addonId} className="flex justify-between text-sm">
                            <span className="text-gray-700">
                              {addon.name} × {qty}
                            </span>
                            <span className="font-semibold text-gray-900">
                              ₱{(addon.price * qty).toFixed(2)}
                            </span>
                          </div>
                        );
                      })}
                  </div>
                </Card>
              )}

              {/* Total */}
              <div className="p-6 bg-[#2F6FD6] text-white rounded-lg">
                <div className="flex items-center justify-between">
                  <p className="text-lg">Total Amount</p>
                  <p className="text-3xl font-semibold">{formatCurrency(calculateTotal())}</p>
                </div>
              </div>

              {/* Walk-in Payment Notice */}
              <div className="p-5 bg-green-50 border-2 border-green-300 rounded-lg">
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-green-900 mb-1 flex items-center gap-2">
                      Walk-in Payment
                    </h4>
                    <p className="text-sm text-green-800">
                      Payment will be collected immediately upon transaction completion. The order will be processed right away and payment is verified automatically.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Navigation Buttons */}
          <div className="flex items-center justify-between mt-8 pt-6 border-t">
            <Button
              variant="outline"
              onClick={() =>
                currentStep > 1 ? setCurrentStep((prev) => prev - 1) : navigate(dashboardPath)
              }
            >
              {currentStep === 1 ? 'Cancel' : 'Back'}
            </Button>

            <div className="flex gap-3">
              {currentStep < 4 ? (
                <Button
                  className="bg-[#2F6FD6] hover:bg-[#2557b8] disabled:bg-gray-400 disabled:cursor-not-allowed"
                  onClick={() => setCurrentStep((prev) => prev + 1)}
                  disabled={currentStep === 1 && files.length === 0 || analyzingFileId !== null}
                >
                  {analyzingFileId ? 'Analyzing...' : 'Next Step'}
                </Button>
              ) : (
                <>
                  <Button
                    variant="outline"
                    className="border-red-500 text-red-500 hover:bg-red-50"
                    onClick={handleCancelOrder}
                  >
                    Cancel Order
                  </Button>
                  <Button
                    className="bg-[#2F6FD6] hover:bg-[#2557b8]"
                    onClick={handleProceedToQueue}
                    disabled={files.length === 0}
                  >
                    Proceed to In Queue
                  </Button>
                </>
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Print Preview Dialog */}
      {previewFileId && (
        <PrintPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          fileName={files.find((f) => f.id === previewFileId)?.fileName || ''}
          pageCount={files.find((f) => f.id === previewFileId)?.pageCount || 1}
          options={{
            paperType:
              files.find((f) => f.id === previewFileId)?.paperSize || 'Short',
            paperSize:
              files.find((f) => f.id === previewFileId)?.paperSize || 'Short',
            printType:
              files.find((f) => f.id === previewFileId)?.colorMode === 'colored'
                ? 'Colored'
                : 'Black & White',
            copies: files.find((f) => f.id === previewFileId)?.copies || 1,
            orientation:
              (files.find((f) => f.id === previewFileId)?.orientation as
                | 'portrait'
                | 'landscape') || 'portrait',
            pagesPerSheet:
              files.find((f) => f.id === previewFileId)?.pagesPerSheet || '1',
            twoSided: files.find((f) => f.id === previewFileId)?.twoSided || 'No',
            pageRange: files.find((f) => f.id === previewFileId)?.pageRange || 'All',
            specificPages:
              files.find((f) => f.id === previewFileId)?.specificPages || '',
          }}
        />
      )}

      {/* Cancel Confirmation Dialog */}
      <Dialog open={showCancelConfirmDialog} onOpenChange={setShowCancelConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-900">
              <AlertCircle className="w-5 h-5 text-amber-600" />
              Cancel Walk-in Transaction
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to cancel this walk-in transaction? All entered information will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg mt-2">
            <p className="text-sm text-amber-900">
              <strong>Warning:</strong> This action cannot be undone. Customer details, uploaded files, and all settings will be cleared.
            </p>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowCancelConfirmDialog(false)}
            >
              Keep Editing
            </Button>
            <Button
              variant="destructive"
              onClick={confirmCancelOrder}
              className="bg-red-600 hover:bg-red-700"
            >
              Yes, Cancel Transaction
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
