import React, { useState, useEffect } from "react";
import { adminMenuItems } from "../../utils/adminMenuItems";
import {
  LayoutDashboard,
  CreditCard,
  Package,
  Boxes,
  Users,
  FileText,
  UserPlus,
  Briefcase,
  Calendar,
  Download,
  BarChart3,
  X,
  Settings,
} from "lucide-react";
import { toast } from "sonner";
import Layout from "../Layout";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import ReportsView from "./ReportsView";
import { dataStore } from "../../utils/dataStore";

const menuItems = adminMenuItems;

// Helper function to check if a date falls within a range
const isDateInRange = (dateStr: string, fromDate: string, toDate: string): boolean => {
  const date = new Date(dateStr);
  const from = new Date(fromDate);
  const to = new Date(toDate);

  // Set time to start of day for accurate comparison
  date.setHours(0, 0, 0, 0);
  from.setHours(0, 0, 0, 0);
  to.setHours(23, 59, 59, 999);

  return date >= from && date <= to;
};

// Helper function to check if a date matches a specific date
const isSameDate = (dateStr: string, targetDate: string): boolean => {
  const date = new Date(dateStr);
  const target = new Date(targetDate);

  return date.getFullYear() === target.getFullYear() &&
         date.getMonth() === target.getMonth() &&
         date.getDate() === target.getDate();
};

// Data generators using dataStore with date filtering
const generateSalesData = (filterDate?: string) => {
  const orders = dataStore.getOrders();
  return orders
    .filter(order => {
      // Only completed/released orders count as sales
      if (!['Completed', 'Released'].includes(order.status)) return false;

      // Filter by specific date if provided
      if (filterDate) {
        return isSameDate(order.date, filterDate);
      }
      return true;
    })
    .map(order => ({
      id: order.id,
      date: order.date,
      customer: order.customerName,
      item: `Printing - ${order.printType} (${order.pages} pages)`,
      quantity: order.pages || 0,
      unitPrice: order.printType === 'Colored' ? 5 : 1,
      total: parseFloat(order.total.replace('₱', '').replace(',', '')),
      paymentMethod: order.paymentMethod || 'Cash',
    }));
};

const generateOrdersData = (fromDate?: string, toDate?: string) => {
  const orders = dataStore.getOrders();
  return orders
    .filter(order => {
      if (fromDate && toDate) {
        return isDateInRange(order.date, fromDate, toDate);
      }
      return true;
    })
    .map(order => ({
      id: order.id,
      customer: order.customerName,
      status: order.status,
      date: order.date,
      pages: order.pages || 0,
      total: parseFloat(order.total.replace('₱', '').replace(',', '')),
    }));
};

const generateInventoryData = () => {
  const inventory = dataStore.getInventory();
  return inventory.map(item => ({
    item: item.name,
    currentStock: `${item.quantity} ${item.unit}`,
    reams: (item.quantity / 500).toFixed(1),
    unit: item.unit,
    sold: "0 " + item.unit,
    status: item.quantity > item.reorderLevel ? "In Stock" : "Low Stock",
  }));
};

const generatePaymentData = (fromDate?: string, toDate?: string) => {
  const orders = dataStore.getOrders();
  return orders
    .filter(order => {
      if (!order.paymentMethod) return false;
      if (fromDate && toDate) {
        return isDateInRange(order.date, fromDate, toDate);
      }
      return true;
    })
    .map(order => ({
      id: `PAY-${order.id.split('-')[1]}`,
      orderId: order.id,
      customer: order.customerName,
      date: order.date,
      amount: parseFloat(order.total.replace('₱', '').replace(',', '')),
      method: order.paymentMethod,
      status: ['Completed', 'Released', 'Printing', 'In Queue'].includes(order.status) ? 'Verified' : 'Pending',
      verifiedBy: "Admin",
    }));
};

const generateCustomerData = (fromDate?: string, toDate?: string) => {
  const orders = dataStore.getOrders();
  const customerMap = new Map<string, any>();

  // Filter orders by date range first
  const filteredOrders = orders.filter(order => {
    if (fromDate && toDate) {
      return isDateInRange(order.date, fromDate, toDate);
    }
    return true;
  });

  filteredOrders.forEach(order => {
    if (!customerMap.has(order.customerEmail)) {
      customerMap.set(order.customerEmail, {
        id: `CUST-${customerMap.size + 1}`,
        name: order.customerName,
        email: order.customerEmail,
        totalOrders: 0,
        totalSpent: 0,
        lastOrder: order.date,
        status: "Active",
      });
    }

    const customer = customerMap.get(order.customerEmail);
    customer.totalOrders++;
    customer.totalSpent += parseFloat(order.total.replace('₱', '').replace(',', ''));
    if (new Date(order.date) > new Date(customer.lastOrder)) {
      customer.lastOrder = order.date;
    }
  });

  return Array.from(customerMap.values());
};

const generateSummaryData = (fromDate?: string, toDate?: string) => {
  const orders = dataStore.getOrders();

  // Filter orders by date range
  const filteredOrders = orders.filter(order => {
    if (fromDate && toDate) {
      return isDateInRange(order.date, fromDate, toDate);
    }
    return true;
  });

  const completedOrders = filteredOrders.filter(o => ['Completed', 'Released'].includes(o.status));

  const totalSales = completedOrders.reduce((sum, order) =>
    sum + parseFloat(order.total.replace('₱', '').replace(',', '')), 0
  );

  const totalOrders = filteredOrders.length;
  const uniqueCustomers = new Set(filteredOrders.map(o => o.customerEmail)).size;
  const averageOrderValue = totalOrders > 0 ? totalSales / completedOrders.length : 0;

  const bwPages = filteredOrders.filter(o => o.printType === 'Black & White').reduce((sum, o) => sum + (o.pages || 0), 0);
  const coloredPages = filteredOrders.filter(o => o.printType === 'Colored').reduce((sum, o) => sum + (o.pages || 0), 0);

  const gcashTransactions = filteredOrders.filter(o => o.paymentMethod === 'GCash');
  const cashTransactions = filteredOrders.filter(o => o.paymentMethod === 'Cash');

  return {
    totalSales: Math.round(totalSales),
    totalOrders,
    totalCustomers: uniqueCustomers,
    averageOrderValue: Math.round(averageOrderValue * 10) / 10,
    topSellingItems: [
      { item: "Printing - B&W", quantity: bwPages, revenue: bwPages * 1 },
      { item: "Printing - Colored", quantity: coloredPages, revenue: coloredPages * 5 },
    ],
    paymentMethodBreakdown: [
      {
        method: "GCash",
        transactions: gcashTransactions.length,
        total: Math.round(gcashTransactions.reduce((sum, o) => sum + parseFloat(o.total.replace('₱', '').replace(',', '')), 0))
      },
      {
        method: "Cash",
        transactions: cashTransactions.length,
        total: Math.round(cashTransactions.reduce((sum, o) => sum + parseFloat(o.total.replace('₱', '').replace(',', '')), 0))
      },
    ],
  };
};

// Report type categories for different date filtering behavior
type ReportFilterType = 'single-day' | 'date-range' | 'snapshot';

const reportTypes = [
  {
    value: "sales",
    label: "Daily Sales Report",
    key: "Sales",
    description: "Sales transactions for a specific date",
    filterType: 'single-day' as ReportFilterType,
    helpText: "Shows all completed sales transactions for the selected date.",
  },
  {
    value: "orders",
    label: "Orders Report",
    key: "Orders",
    description: "Order history within a date range",
    filterType: 'date-range' as ReportFilterType,
    helpText: "Shows all orders (any status) within the selected period.",
  },
  {
    value: "inventory",
    label: "Inventory Status Report",
    key: "Inventory",
    description: "Current stock levels (snapshot)",
    filterType: 'snapshot' as ReportFilterType,
    helpText: "Shows current inventory levels at the time of report generation.",
  },
  {
    value: "payment",
    label: "Payment Verification Report",
    key: "Payment",
    description: "Payment records within a date range",
    filterType: 'date-range' as ReportFilterType,
    helpText: "Shows all payment transactions within the selected period.",
  },
  {
    value: "customer",
    label: "Customer Activity Report",
    key: "Customer",
    description: "Customer statistics within a date range",
    filterType: 'date-range' as ReportFilterType,
    helpText: "Shows customer activity and spending patterns for the selected period.",
  },
  {
    value: "summary",
    label: "Business Summary Report",
    key: "Summary",
    description: "Overall business metrics for a period",
    filterType: 'date-range' as ReportFilterType,
    helpText: "Shows aggregated business metrics and KPIs for the selected period.",
  },
];

export default function Reports() {
  // Get today's date in YYYY-MM-DD format
  const getTodayDate = () => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  };

  const [singleDate, setSingleDate] = useState(getTodayDate());
  const [dateFrom, setDateFrom] = useState(getTodayDate());
  const [dateTo, setDateTo] = useState(getTodayDate());
  const [isViewingReport, setIsViewingReport] = useState(false);
  const [currentReport, setCurrentReport] = useState<string>("");
  const [selectedReportType, setSelectedReportType] = useState<string>("");
  const [generatedReportType, setGeneratedReportType] = useState<string>("");
  const [reportData, setReportData] = useState<any[]>([]);
  const [reportGeneratedAt, setReportGeneratedAt] = useState<string>("");
  const [reportPeriod, setReportPeriod] = useState<string>("");

  const handleGenerateReport = () => {
    if (!selectedReportType) {
      toast.error("Please select a report type");
      return;
    }

    const reportConfig = reportTypes.find(
      (r) => r.value === selectedReportType,
    );
    if (!reportConfig) return;

    // Validation based on filter type
    if (reportConfig.filterType === 'single-day' && !singleDate) {
      toast.error("Please select a date");
      return;
    }
    if (reportConfig.filterType === 'date-range' && (!dateFrom || !dateTo)) {
      toast.error("Please select both start and end dates");
      return;
    }
    if (reportConfig.filterType === 'date-range' && new Date(dateFrom) > new Date(dateTo)) {
      toast.error("Start date cannot be after end date");
      return;
    }

    // Set this to the 'key' (e.g. "Orders") so ReportsView recognizes it
    setCurrentReport(reportConfig.key);

    // Generate data based on report type and filter type
    let generatedData: any[] = [];
    let period = "";

    switch (selectedReportType) {
      case "sales":
        generatedData = generateSalesData(singleDate);
        period = new Date(singleDate).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
        break;
      case "orders":
        generatedData = generateOrdersData(dateFrom, dateTo);
        period = `${new Date(dateFrom).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })} - ${new Date(dateTo).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`;
        break;
      case "inventory":
        generatedData = generateInventoryData();
        period = "Current Stock Status";
        break;
      case "payment":
        generatedData = generatePaymentData(dateFrom, dateTo);
        period = `${new Date(dateFrom).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })} - ${new Date(dateTo).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`;
        break;
      case "customer":
        generatedData = generateCustomerData(dateFrom, dateTo);
        period = `${new Date(dateFrom).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })} - ${new Date(dateTo).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`;
        break;
      case "summary":
        generatedData = [generateSummaryData(dateFrom, dateTo)];
        period = `${new Date(dateFrom).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })} - ${new Date(dateTo).toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })}`;
        break;
      default:
        generatedData = [];
    }

    setReportData(generatedData);
    setReportPeriod(period);
    setReportGeneratedAt(new Date().toLocaleString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    }));
    setIsViewingReport(true);
    setGeneratedReportType(selectedReportType);

    // Show appropriate success message
    if (reportConfig.filterType === 'snapshot') {
      toast.success(`Generated ${reportConfig.label}`);
    } else {
      toast.success(`Generated ${reportConfig.label} for ${period}`);
    }
  };

  const handleBackToReports = () => {
    setIsViewingReport(false);
    setCurrentReport("");
    setReportData([]);
    setGeneratedReportType("");
    setReportPeriod("");
    setReportGeneratedAt("");
    // Don't clear selectedReportType - let user generate another report with same type if needed
  };

  // Reset dates to smart defaults when report type changes
  useEffect(() => {
    if (selectedReportType) {
      const reportConfig = reportTypes.find(r => r.value === selectedReportType);
      if (reportConfig?.filterType === 'single-day') {
        // Set to today for daily reports
        setSingleDate(getTodayDate());
      } else if (reportConfig?.filterType === 'date-range') {
        // Set to today for both dates (user can adjust as needed)
        const today = getTodayDate();
        setDateTo(today);
        // Set from date to 7 days ago as a helpful default
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        setDateFrom(weekAgo.toISOString().split('T')[0]);
      }
    }
  }, [selectedReportType]);

  const handleDownload = (reportType: string) => {
    // Get the report content
    const reportElement = document.querySelector('.bg-white.rounded-xl.shadow-sm');
    
    if (!reportElement) {
      toast.error('Report not found. Please generate a report first.');
      return;
    }

    // Create a printable version
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Unable to open print window. Please check your browser settings.');
      return;
    }

    // Get the HTML content with styles
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>${reportType} Report - DocuFy PSMS</title>
          <style>
            body { font-family: 'Poppins', sans-serif; margin: 0; padding: 20px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; }
            th, td { border: 1px solid #ddd; padding: 12px; text-align: left; }
            th { background-color: #f3f4f6; font-weight: 600; }
            .header { margin-bottom: 30px; }
            .header h1 { color: #1c1f26; margin: 0; }
            .header p { color: #6b7280; margin: 5px 0; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .bg-gray-50 { background-color: #f9fafb; }
            @media print {
              body { margin: 0; }
            }
          </style>
        </head>
        <body>
          ${reportElement.innerHTML}
        </body>
      </html>
    `);
    
    printWindow.document.close();
    
    // Wait for content to load then trigger print
    setTimeout(() => {
      printWindow.print();
      toast.success(`${reportType} report ready for download/print`);
    }, 500);
  };

  const calculateTotalSales = () =>
    currentReport === "Sales"
      ? reportData.reduce((sum, item) => sum + item.total, 0)
      : 0;
  const calculateTotalPayments = () =>
    currentReport === "Payment"
      ? reportData.reduce((sum, item) => sum + item.amount, 0)
      : 0;
  const calculateTotalCustomerSpent = () =>
    currentReport === "Customer"
      ? reportData.reduce(
          (sum, item) => sum + item.totalSpent,
          0,
        )
      : 0;

  return (
    <Layout menuItems={menuItems} title="Reports" showBackButton>
      <div className="space-y-6">
        <Card className="p-6 bg-white shadow-sm">
          <h2 className="text-lg font-semibold text-gray-900 mb-6 flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-[#2F6FD6]" />
            Generate Report
          </h2>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="reportType">
                Select Report Type
              </Label>
              <Select
                value={selectedReportType}
                onValueChange={setSelectedReportType}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Choose a report type..." />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((report) => (
                    <SelectItem
                      key={report.value}
                      value={report.value}
                    >
                      <div>
                        <div className="font-medium">
                          {report.label}
                        </div>
                        <div className="text-xs text-gray-500">
                          {report.description}
                        </div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dynamic Date Filter based on Report Type */}
            {selectedReportType && (() => {
              const reportConfig = reportTypes.find(r => r.value === selectedReportType);
              const filterType = reportConfig?.filterType;

              if (filterType === 'single-day') {
                return (
                  <div className="space-y-2">
                    <Label htmlFor="singleDate" className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      Select Date
                    </Label>
                    <Input
                      id="singleDate"
                      type="date"
                      value={singleDate}
                      onChange={(e) => setSingleDate(e.target.value)}
                      className="w-full"
                    />
                    <p className="text-xs text-gray-500">
                      Report will show data for this specific date only.
                    </p>
                  </div>
                );
              } else if (filterType === 'date-range') {
                return (
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-600" />
                      Select Period
                    </Label>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="dateFrom" className="text-sm text-gray-600">
                          From Date
                        </Label>
                        <Input
                          id="dateFrom"
                          type="date"
                          value={dateFrom}
                          onChange={(e) => setDateFrom(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="dateTo" className="text-sm text-gray-600">
                          To Date
                        </Label>
                        <Input
                          id="dateTo"
                          type="date"
                          value={dateTo}
                          onChange={(e) => setDateTo(e.target.value)}
                        />
                      </div>
                    </div>
                    <p className="text-xs text-gray-500">
                      Report will include all data within the selected date range.
                    </p>
                  </div>
                );
              } else if (filterType === 'snapshot') {
                return (
                  <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                    <div className="flex items-start gap-3">
                      <Settings className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-blue-900">
                          Snapshot Report
                        </p>
                        <p className="text-xs text-blue-700 mt-1">
                          This report shows current inventory status at the time of generation. No date filtering is required.
                        </p>
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {selectedReportType && (() => {
              const reportConfig = reportTypes.find(r => r.value === selectedReportType);
              return (
                <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <BarChart3 className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-blue-900">
                        {reportConfig?.label}
                      </p>
                      <p className="text-xs text-blue-700 mt-1">
                        {reportConfig?.helpText}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })()}

            <div className="flex gap-3">
              <Button
                className="w-full bg-[#2F6FD6] hover:bg-[#1e5bb8]"
                onClick={handleGenerateReport}
                disabled={!selectedReportType}
              >
                <BarChart3 className="w-4 h-4 mr-2" /> Generate
                Report
              </Button>
            </div>
          </div>
        </Card>

        {isViewingReport && (
          <Card className="p-6 bg-white shadow-sm">
            <div className="flex items-center justify-between mb-6 pb-4 border-b">
              <div className="flex-1">
                <h2 className="text-2xl font-bold text-[#10316B] flex items-center gap-2">
                  <FileText className="w-6 h-6" />
                  {
                    reportTypes.find(
                      (r) => r.value === generatedReportType,
                    )?.label
                  }
                </h2>
                <div className="mt-2 space-y-1">
                  <p className="text-sm font-semibold text-gray-700">
                    {reportTypes.find(r => r.value === generatedReportType)?.filterType === 'single-day'
                      ? 'Report Date:'
                      : reportTypes.find(r => r.value === generatedReportType)?.filterType === 'snapshot'
                      ? 'Report Type:'
                      : 'Period:'
                    } <span className="text-[#2F6FD6]">{reportPeriod}</span>
                  </p>
                  <p className="text-xs text-gray-500">
                    Generated On: {reportGeneratedAt}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleBackToReports}
                >
                  <X className="w-4 h-4 mr-2" /> Clear Report
                </Button>
                <Button
                  className="bg-[#2F6FD6] hover:bg-[#1e5bb8]"
                  onClick={() => handleDownload(currentReport)}
                >
                  <Download className="w-4 h-4 mr-2" /> Download
                  PDF
                </Button>
              </div>
            </div>

            <ReportsView
              currentReport={currentReport}
              reportData={reportData}
              dateFrom={
                reportTypes.find(r => r.value === generatedReportType)?.filterType === 'single-day'
                  ? singleDate
                  : dateFrom
              }
              dateTo={
                reportTypes.find(r => r.value === generatedReportType)?.filterType === 'single-day'
                  ? singleDate
                  : dateTo
              }
              onDownload={handleDownload}
              calculateTotalSales={calculateTotalSales}
              calculateTotalPayments={calculateTotalPayments}
              calculateTotalCustomerSpent={
                calculateTotalCustomerSpent
              }
            />
          </Card>
        )}
      </div>
    </Layout>
  );
}