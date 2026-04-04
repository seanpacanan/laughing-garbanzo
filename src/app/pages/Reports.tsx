import React, { useState, useMemo } from 'react';
import { FileText, Download, FileSpreadsheet, Filter, Calendar } from 'lucide-react';
import { format, parseISO, startOfDay, endOfDay } from 'date-fns';
import { useData } from '../context/DataContext';
import { TransactionStatusBadge, CameraStatusBadge } from '../components/StatusBadge';
import type { TransactionStatus } from '../types';
import * as XLSX from 'xlsx';

type ReportType = 'all_transactions' | 'active_borrows' | 'overdue_items' | 'camera_summary';

export default function Reports() {
  const { transactions, cameras } = useData();
  const [reportType, setReportType] = useState<ReportType>('all_transactions');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all');

  const reportOptions: { value: ReportType; label: string; description: string }[] = [
    { value: 'all_transactions', label: 'All Transactions', description: 'Complete borrow/return history' },
    { value: 'active_borrows', label: 'Active Borrows', description: 'Currently borrowed cameras' },
    { value: 'overdue_items', label: 'Overdue Items', description: 'Overdue borrow records' },
    { value: 'camera_summary', label: 'Camera Summary', description: 'Status of all camera units' },
  ];

  const filteredData = useMemo(() => {
    if (reportType === 'camera_summary') {
      return cameras.filter((c) => !c.archived);
    }

    let list = [...transactions];

    if (reportType === 'active_borrows') {
      list = list.filter((t) => t.status === 'active');
    } else if (reportType === 'overdue_items') {
      list = list.filter((t) => t.status === 'overdue');
    } else {
      if (filterStatus !== 'all') {
        list = list.filter((t) => t.status === filterStatus);
      }
    }

    if (dateFrom) {
      list = list.filter((t) => parseISO(t.borrowedAt) >= startOfDay(parseISO(dateFrom)));
    }
    if (dateTo) {
      list = list.filter((t) => parseISO(t.borrowedAt) <= endOfDay(parseISO(dateTo)));
    }

    return list.sort((a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime());
  }, [reportType, transactions, cameras, filterStatus, dateFrom, dateTo]);

  const isCameraSummary = reportType === 'camera_summary';

  const generateExcel = () => {
    let data: Record<string, string>[] = [];
    let sheetName = 'Report';

    if (isCameraSummary) {
      sheetName = 'Camera Summary';
      data = (filteredData as typeof cameras).map((c) => ({
        'Camera ID': c.id,
        'Barcode': c.barcode,
        'Camera Name': c.name,
        'Brand': c.brand,
        'Model': c.model,
        'Serial Number': c.serialNumber,
        'Status': c.status.charAt(0).toUpperCase() + c.status.slice(1),
        'Description': c.description || '',
        'Date Added': format(parseISO(c.addedDate), 'MMM dd, yyyy'),
        'Notes': c.notes || '',
      }));
    } else {
      sheetName = 'Transactions';
      data = (filteredData as typeof transactions).map((t) => ({
        'Transaction ID': t.id,
        'Camera': t.cameraName,
        'Barcode': t.cameraBarcode,
        'Borrower Name': t.borrowerName,
        'Borrower ID': t.borrowerIdNumber,
        'Department': t.department,
        'Borrowed At': format(parseISO(t.borrowedAt), 'MMM dd, yyyy hh:mm a'),
        'Expected Return': format(parseISO(t.expectedReturnAt), 'MMM dd, yyyy hh:mm a'),
        'Actual Return': t.returnedAt ? format(parseISO(t.returnedAt), 'MMM dd, yyyy hh:mm a') : 'Not returned',
        'Status': t.status.charAt(0).toUpperCase() + t.status.slice(1),
        'Approved By': t.approvedBy,
        'Notes': t.notes || '',
      }));
    }

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const filename = `camera_room_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.xlsx`;
    XLSX.writeFile(wb, filename);
  };

  const generatePDF = async () => {
    const { default: jsPDF } = await import('jspdf');
    const { default: autoTable } = await import('jspdf-autotable');

    const doc = new jsPDF({ orientation: 'landscape' });

    // Header
    doc.setFillColor(37, 99, 235);
    doc.rect(0, 0, 297, 20, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(14);
    doc.text('Camera Equipment Room — Inventory Management System', 14, 13);

    // Report Title
    doc.setTextColor(30, 41, 59);
    doc.setFontSize(11);
    const reportLabel = reportOptions.find((r) => r.value === reportType)?.label || 'Report';
    doc.text(`Report: ${reportLabel}`, 14, 30);
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${format(new Date(), 'MMMM dd, yyyy hh:mm a')}`, 14, 37);
    if (dateFrom || dateTo) {
      doc.text(`Date Range: ${dateFrom || 'Beginning'} to ${dateTo || 'Now'}`, 14, 43);
    }
    doc.text(`Total Records: ${filteredData.length}`, 14, dateFrom || dateTo ? 49 : 43);

    if (isCameraSummary) {
      autoTable(doc, {
        startY: 55,
        head: [['Camera ID', 'Barcode', 'Name', 'Brand', 'Model', 'Serial No.', 'Status', 'Date Added']],
        body: (filteredData as typeof cameras).map((c) => [
          c.id,
          c.barcode,
          c.name,
          c.brand,
          c.model,
          c.serialNumber,
          c.status.charAt(0).toUpperCase() + c.status.slice(1),
          format(parseISO(c.addedDate), 'MMM dd, yyyy'),
        ]),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
        bodyStyles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
      });
    } else {
      autoTable(doc, {
        startY: 55,
        head: [['TRX ID', 'Camera', 'Borrower', 'Borrower ID', 'Department', 'Borrowed At', 'Expected Return', 'Actual Return', 'Status', 'Approved By']],
        body: (filteredData as typeof transactions).map((t) => [
          t.id,
          t.cameraName,
          t.borrowerName,
          t.borrowerIdNumber,
          t.department,
          format(parseISO(t.borrowedAt), 'MMM dd, yyyy hh:mm a'),
          format(parseISO(t.expectedReturnAt), 'MMM dd, yyyy hh:mm a'),
          t.returnedAt ? format(parseISO(t.returnedAt), 'MMM dd, yyyy hh:mm a') : 'Not returned',
          t.status.charAt(0).toUpperCase() + t.status.slice(1),
          t.approvedBy,
        ]),
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], fontSize: 7 },
        bodyStyles: { fontSize: 7 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles: {
          0: { cellWidth: 18 },
          1: { cellWidth: 30 },
          5: { cellWidth: 30 },
          6: { cellWidth: 30 },
          7: { cellWidth: 30 },
        },
      });
    }

    const filename = `camera_room_${reportType}_${format(new Date(), 'yyyy-MM-dd')}.pdf`;
    doc.save(filename);
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Reports</h1>
        <p className="text-slate-500 text-sm mt-0.5">Generate and download inventory reports in PDF or Excel format</p>
      </div>

      {/* Report Configuration */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-slate-800 mb-4 flex items-center gap-2">
          <Filter className="w-4 h-4 text-blue-600" /> Report Settings
        </h2>
        <div className="space-y-4">
          {/* Report Type */}
          <div>
            <label className="block text-xs font-medium text-slate-700 mb-2">Report Type</label>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {reportOptions.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => setReportType(opt.value)}
                  className={`text-left p-3 rounded-xl border transition-all ${
                    reportType === opt.value
                      ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-300'
                      : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <p className={`text-sm font-medium ${reportType === opt.value ? 'text-blue-700' : 'text-slate-700'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">{opt.description}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Date Range & Status Filter (for transaction reports) */}
          {!isCameraSummary && (
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400" />
                <label className="text-xs text-slate-600 whitespace-nowrap">Date From:</label>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs text-slate-600 whitespace-nowrap">Date To:</label>
                <input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {reportType === 'all_transactions' && (
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as TransactionStatus | 'all')}
                  className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active</option>
                  <option value="returned">Returned</option>
                  <option value="overdue">Overdue</option>
                </select>
              )}
              <button
                onClick={() => { setDateFrom(''); setDateTo(''); setFilterStatus('all'); }}
                className="text-xs text-slate-500 hover:text-slate-700 px-3 py-2 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          )}

          {/* Export Buttons */}
          <div className="flex flex-wrap gap-3 pt-2 border-t border-slate-100">
            <div className="flex-1 min-w-fit">
              <p className="text-xs text-slate-500 mb-2">
                <span className="font-medium text-slate-700">{filteredData.length}</span> records in preview
              </p>
            </div>
            <button
              onClick={generateExcel}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Export Excel
            </button>
            <button
              onClick={generatePDF}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-5 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
            >
              <FileText className="w-4 h-4" />
              Export PDF
            </button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100">
          <h2 className="text-sm font-semibold text-slate-800">
            Report Preview — {reportOptions.find((r) => r.value === reportType)?.label}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">Showing {filteredData.length} records</p>
        </div>
        <div className="overflow-x-auto">
          {isCameraSummary ? (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Camera ID</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Barcode</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Camera Name</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Brand</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Serial No.</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Date Added</th>
                </tr>
              </thead>
              <tbody>
                {(filteredData as typeof cameras).map((c) => (
                  <tr key={c.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-xs font-mono text-slate-700">{c.id}</td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-600">{c.barcode}</td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-slate-800">{c.name}</p>
                      <p className="text-xs text-slate-400">{c.model}</p>
                    </td>
                    <td className="px-3 py-3 text-sm text-slate-600">{c.brand}</td>
                    <td className="px-3 py-3"><CameraStatusBadge status={c.status} /></td>
                    <td className="px-3 py-3 text-xs font-mono text-slate-600">{c.serialNumber}</td>
                    <td className="px-3 py-3 text-xs text-slate-600">{format(parseISO(c.addedDate), 'MMM dd, yyyy')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">TRX ID</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Camera</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Borrower</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden md:table-cell">Department</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Borrowed At</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden lg:table-cell">Expected Return</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden xl:table-cell">Actual Return</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Status</th>
                  <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden xl:table-cell">Approved By</th>
                </tr>
              </thead>
              <tbody>
                {(filteredData as typeof transactions).length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p className="text-sm">No records found for this report</p>
                    </td>
                  </tr>
                ) : (
                  (filteredData as typeof transactions).map((t) => (
                    <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                      <td className="px-5 py-3 text-xs font-mono font-medium text-slate-700">{t.id}</td>
                      <td className="px-3 py-3">
                        <p className="text-sm font-medium text-slate-800">{t.cameraName}</p>
                        <p className="text-xs text-slate-400 font-mono">{t.cameraBarcode}</p>
                      </td>
                      <td className="px-3 py-3">
                        <p className="text-sm text-slate-700">{t.borrowerName}</p>
                        <p className="text-xs text-slate-400">{t.borrowerIdNumber}</p>
                      </td>
                      <td className="px-3 py-3 hidden md:table-cell text-sm text-slate-600">{t.department}</td>
                      <td className="px-3 py-3">
                        <p className="text-xs text-slate-600">{format(parseISO(t.borrowedAt), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-slate-400">{format(parseISO(t.borrowedAt), 'hh:mm a')}</p>
                      </td>
                      <td className="px-3 py-3 hidden lg:table-cell">
                        <p className="text-xs text-slate-600">{format(parseISO(t.expectedReturnAt), 'MMM dd, yyyy')}</p>
                        <p className="text-xs text-slate-400">{format(parseISO(t.expectedReturnAt), 'hh:mm a')}</p>
                      </td>
                      <td className="px-3 py-3 hidden xl:table-cell">
                        {t.returnedAt ? (
                          <>
                            <p className="text-xs text-emerald-700">{format(parseISO(t.returnedAt), 'MMM dd, yyyy')}</p>
                            <p className="text-xs text-slate-400">{format(parseISO(t.returnedAt), 'hh:mm a')}</p>
                          </>
                        ) : (
                          <p className="text-xs text-slate-400">—</p>
                        )}
                      </td>
                      <td className="px-3 py-3"><TransactionStatusBadge status={t.status} /></td>
                      <td className="px-3 py-3 hidden xl:table-cell text-xs text-slate-600">{t.approvedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
