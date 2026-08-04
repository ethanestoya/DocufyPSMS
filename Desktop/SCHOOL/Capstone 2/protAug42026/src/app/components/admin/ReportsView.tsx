import React from "react";
import {
  FileText,
  Download,
  PhilippinePeso,
  CreditCard,
  Calendar,
  Users,
  User,
  Package,
} from "lucide-react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";

interface ReportsViewProps {
  currentReport: string;
  reportData: any[];
  dateFrom: string;
  dateTo: string;
  onDownload: (reportType: string) => void;
  calculateTotalSales: () => number;
  calculateTotalPayments: () => number;
  calculateTotalCustomerSpent: () => number;
}

export default function ReportsView({
  currentReport,
  reportData,
  dateFrom,
  dateTo,
  onDownload,
  calculateTotalSales,
  calculateTotalPayments,
  calculateTotalCustomerSpent,
}: ReportsViewProps) {
  return (
    <div className="space-y-6">
      {/* Summary Stats Bar */}
      {(currentReport === 'Sales' || currentReport === 'Daily Sales') && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-[#1D73EC] text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80 mb-1">Total Transactions</p>
                <p className="text-3xl font-bold">{reportData.length}</p>
              </div>
              <FileText className="w-10 h-10 text-white/40" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-[#1D73EC]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-[#1D73EC]">₱{calculateTotalSales().toFixed(2)}</p>
              </div>
              <PhilippinePeso className="w-10 h-10 text-[#1D73EC]/20" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Average Sale</p>
                <p className="text-3xl font-bold text-gray-800">₱{(calculateTotalSales() / reportData.length).toFixed(2)}</p>
              </div>
              <CreditCard className="w-10 h-10 text-gray-300" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Period</p>
                <p className="text-lg font-semibold text-gray-800">{new Date(dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <Calendar className="w-10 h-10 text-gray-300" />
            </div>
          </Card>
        </div>
      )}

      {currentReport === 'Payment' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-[#1D73EC] text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80 mb-1">Total Payments</p>
                <p className="text-3xl font-bold">{reportData.length}</p>
              </div>
              <CreditCard className="w-10 h-10 text-white/40" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-[#1D73EC]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Amount</p>
                <p className="text-3xl font-bold text-[#1D73EC]">₱{calculateTotalPayments().toFixed(2)}</p>
              </div>
              <PhilippinePeso className="w-10 h-10 text-[#1D73EC]/20" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Verified</p>
                <p className="text-3xl font-bold text-blue-600">{reportData.filter((p: any) => p.status === 'Verified').length}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-700">100%</Badge>
            </div>
          </Card>
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Period</p>
                <p className="text-lg font-semibold text-gray-800">{new Date(dateFrom).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(dateTo).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</p>
              </div>
              <Calendar className="w-10 h-10 text-gray-300" />
            </div>
          </Card>
        </div>
      )}

      {currentReport === 'Customer' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-[#1D73EC] text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80 mb-1">Total Customers</p>
                <p className="text-3xl font-bold">{reportData.length}</p>
              </div>
              <Users className="w-10 h-10 text-white/40" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-[#1D73EC]">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
                <p className="text-3xl font-bold text-[#1D73EC]">₱{calculateTotalCustomerSpent().toFixed(2)}</p>
              </div>
              <PhilippinePeso className="w-10 h-10 text-[#1D73EC]/20" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Avg per Customer</p>
                <p className="text-3xl font-bold text-gray-800">₱{(calculateTotalCustomerSpent() / reportData.length).toFixed(2)}</p>
              </div>
              <User className="w-10 h-10 text-gray-300" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Active Status</p>
                <p className="text-3xl font-bold text-blue-600">{reportData.filter((c: any) => c.status === 'Active').length}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-700">Active</Badge>
            </div>
          </Card>
        </div>
      )}

      {currentReport === 'Orders' && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="p-6 bg-[#1D73EC] text-white border-0">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-white/80 mb-1">Total Orders</p>
                <p className="text-3xl font-bold">{reportData.length}</p>
              </div>
              <Package className="w-10 h-10 text-white/40" />
            </div>
          </Card>
          <Card className="p-6 bg-white border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Completed</p>
                <p className="text-3xl font-bold text-blue-600">{reportData.filter((o: any) => o.status === 'Completed').length}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-700">Done</Badge>
            </div>
          </Card>
          <Card className="p-6 bg-white border-blue-500">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">In Progress</p>
                <p className="text-3xl font-bold text-blue-600">{reportData.filter((o: any) => o.status === 'Printing' || o.status === 'In Queue').length}</p>
              </div>
              <Badge className="bg-blue-100 text-blue-700">Active</Badge>
            </div>
          </Card>
          <Card className="p-6 bg-white border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600 mb-1">Released</p>
                <p className="text-3xl font-bold text-gray-600">{reportData.filter((o: any) => o.status === 'Released').length}</p>
              </div>
              <Badge className="bg-gray-100 text-gray-700">Released</Badge>
            </div>
          </Card>
        </div>
      )}

      {/* Report Content */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        {/* Header inside report */}
        <div className="px-10 py-8 border-b border-gray-100 flex justify-between items-center bg-white">
          <div>
            <h2 className="text-2xl font-bold text-gray-800">DocuFy PSMS</h2>
            <p className="text-base text-gray-500 mt-1">Official {currentReport} Report</p>
          </div>
          <div className="text-right">
            <p className="text-base font-medium text-gray-800">Generated: {new Date().toLocaleDateString()}</p>
            <p className="text-sm text-gray-500">Time: {new Date().toLocaleTimeString()}</p>
          </div>
        </div>

        <div className="p-0">
          {/* Sales/Daily Sales Table */}
          {(currentReport === 'Sales' || currentReport === 'Daily Sales') && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-gray-600 text-xs uppercase font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Transaction ID</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4 text-right">Qty</th>
                    <th className="px-6 py-4 text-right">Unit Price</th>
                    <th className="px-6 py-4 text-right">Total</th>
                    <th className="px-6 py-4">Payment</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.id}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(item.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(item.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</td>
                      <td className="px-6 py-4 text-gray-900">{item.customer}</td>
                      <td className="px-6 py-4 text-gray-600">{item.item}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">{item.quantity}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">₱{item.unitPrice.toFixed(2)}</td>
                      <td className="px-6 py-4 font-semibold text-gray-900 text-right">₱{item.total.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-600">
                        <Badge variant="outline" className="bg-white">{item.paymentMethod}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/80 border-t border-gray-200">
                  <tr>
                    <td colSpan={7} className="px-6 py-4 text-right font-bold text-gray-900 uppercase text-xs">
                      Grand Total:
                    </td>
                    <td className="px-6 py-4 font-bold text-lg text-[#1D73EC] text-right">
                      ₱{calculateTotalSales().toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Orders Table */}
          {currentReport === 'Orders' && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-gray-600 text-xs uppercase font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4 text-right">Pages</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportData.map((order: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{order.id}</td>
                      <td className="px-6 py-4 text-gray-900">{order.customer}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(order.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(order.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">{order.pages}</td>
                      <td className="px-6 py-4">
                        <Badge className={
                          order.status === 'Completed' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-0' :
                          order.status === 'Printing' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-0' :
                          order.status === 'Released' ? 'bg-gray-100 text-gray-700 hover:bg-gray-100 border-0' :
                          'bg-blue-100 text-yellow-700 hover:bg-blue-100 border-0'
                        }>
                          {order.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 font-semibold text-gray-900 text-right">{order.total}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Inventory Table */}
          {currentReport === 'Inventory' && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-gray-600 text-xs uppercase font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Item</th>
                    <th className="px-6 py-4 text-right">Current Stock</th>
                    <th className="px-6 py-4 text-right">Reams</th>
                    <th className="px-6 py-4 text-right">Unit</th>
                    <th className="px-6 py-4 text-right">Sold</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportData.map((item: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{item.item}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">{item.currentStock}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">{item.reams}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">{item.unit}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">{item.sold}</td>
                      <td className="px-6 py-4">
                        <Badge className={
                          item.status === 'In Stock' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-0' :
                          item.status === 'Low Stock' ? 'bg-orange-100 text-orange-700 hover:bg-orange-100 border-0' :
                          'bg-red-100 text-red-700 hover:bg-blue-100 border-0'
                        }>
                          {item.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Payment Table */}
          {currentReport === 'Payment' && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-gray-600 text-xs uppercase font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Payment ID</th>
                    <th className="px-6 py-4">Order ID</th>
                    <th className="px-6 py-4">Customer</th>
                    <th className="px-6 py-4">Date</th>
                    <th className="px-6 py-4">Time</th>
                    <th className="px-6 py-4 text-right">Amount</th>
                    <th className="px-6 py-4">Method</th>
                    <th className="px-6 py-4">Status</th>
                    <th className="px-6 py-4">Verified By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportData.map((payment: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{payment.id}</td>
                      <td className="px-6 py-4 text-gray-900">{payment.orderId}</td>
                      <td className="px-6 py-4 text-gray-900">{payment.customer}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(payment.date).toLocaleDateString()}</td>
                      <td className="px-6 py-4 text-gray-600">{new Date(payment.date).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">₱{payment.amount.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-600">{payment.method}</td>
                      <td className="px-6 py-4">
                        <Badge className={
                          payment.status === 'Verified' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-0' :
                          'bg-red-100 text-red-700 hover:bg-blue-100 border-0'
                        }>
                          {payment.status}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-gray-600">{payment.verifiedBy}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/80 border-t border-gray-200">
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-right font-bold text-gray-900 uppercase text-xs">
                      Grand Total:
                    </td>
                    <td className="px-6 py-4 font-bold text-lg text-[#1D73EC] text-right">
                      ₱{calculateTotalPayments().toFixed(2)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Customer Table */}
          {currentReport === 'Customer' && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-gray-600 text-xs uppercase font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Customer ID</th>
                    <th className="px-6 py-4">Name</th>
                    <th className="px-6 py-4">Email</th>
                    <th className="px-6 py-4 text-right">Total Orders</th>
                    <th className="px-6 py-4 text-right">Total Spent</th>
                    <th className="px-6 py-4">Last Order</th>
                    <th className="px-6 py-4">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportData.map((customer: any, index: number) => (
                    <tr key={index} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-900">{customer.id}</td>
                      <td className="px-6 py-4 text-gray-900">{customer.name}</td>
                      <td className="px-6 py-4 text-gray-900">{customer.email}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">{customer.totalOrders}</td>
                      <td className="px-6 py-4 text-gray-600 text-right">₱{customer.totalSpent.toFixed(2)}</td>
                      <td className="px-6 py-4 text-gray-600">{customer.lastOrder}</td>
                      <td className="px-6 py-4">
                        <Badge className={
                          customer.status === 'Active' ? 'bg-blue-100 text-blue-700 hover:bg-blue-100 border-0' :
                          'bg-red-100 text-red-700 hover:bg-blue-100 border-0'
                        }>
                          {customer.status}
                        </Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50/80 border-t border-gray-200">
                  <tr>
                    <td colSpan={6} className="px-6 py-4 text-right font-bold text-gray-900 uppercase text-xs">
                      Grand Total:
                    </td>
                    <td className="px-6 py-4 font-bold text-lg text-[#1D73EC] text-right">
                      ₱{calculateTotalCustomerSpent().toFixed(2)}
                    </td>
                    <td></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}

          {/* Summary Table */}
          {currentReport === 'Summary' && (
            <div className="w-full overflow-x-auto">
              <table className="w-full text-sm text-left">
                <thead className="bg-gray-50/80 text-gray-600 text-xs uppercase font-medium border-b border-gray-200">
                  <tr>
                    <th className="px-6 py-4">Metric</th>
                    <th className="px-6 py-4">Value</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {reportData.map((summary: any, index: number) => (
                    <React.Fragment key={index}>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">Total Sales</td>
                        <td className="px-6 py-4 text-gray-600 text-right">₱{summary.totalSales.toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">Total Orders</td>
                        <td className="px-6 py-4 text-gray-600 text-right">{summary.totalOrders}</td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">Total Customers</td>
                        <td className="px-6 py-4 text-gray-600 text-right">{summary.totalCustomers}</td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">Average Order Value</td>
                        <td className="px-6 py-4 text-gray-600 text-right">₱{summary.averageOrderValue.toFixed(2)}</td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">Top Selling Items</td>
                        <td className="px-6 py-4 text-gray-600">
                          {summary.topSellingItems.map((item: any, i: number) => (
                            <div key={i} className="mb-1">
                              <span className="font-bold">{item.item}:</span> {item.quantity} units, ₱{item.revenue.toFixed(2)}
                            </div>
                          ))}
                        </td>
                      </tr>
                      <tr className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4 font-medium text-gray-900">Payment Method Breakdown</td>
                        <td className="px-6 py-4 text-gray-600">
                          {summary.paymentMethodBreakdown.map((method: any, i: number) => (
                            <div key={i} className="mb-1">
                              <span className="font-bold">{method.method}:</span> {method.transactions} transactions, ₱{method.total.toFixed(2)}
                            </div>
                          ))}
                        </td>
                      </tr>
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
