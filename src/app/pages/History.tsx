import React, { useState, useMemo } from 'react';
import { Search, Filter, History as HistoryIcon, ChevronDown } from 'lucide-react';
import { format, parseISO, isWithinInterval, startOfDay, endOfDay } from 'date-fns';
import { useData } from '../context/DataContext';
import { TransactionStatusBadge } from '../components/StatusBadge';
import type { TransactionStatus } from '../types';

type SortField = 'borrowedAt' | 'borrowerName' | 'cameraName' | 'status';
type SortDir = 'asc' | 'desc';

export default function History() {
  const { transactions } = useData();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<TransactionStatus | 'all'>('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [sortField, setSortField] = useState<SortField>('borrowedAt');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [showFilters, setShowFilters] = useState(false);

  const filtered = useMemo(() => {
    let list = [...transactions];

    if (filterStatus !== 'all') {
      list = list.filter((t) => t.status === filterStatus);
    }

    if (search) {
      const q = search.toLowerCase();
      list = list.filter(
        (t) =>
          t.borrowerName.toLowerCase().includes(q) ||
          t.cameraName.toLowerCase().includes(q) ||
          t.borrowerIdNumber.toLowerCase().includes(q) ||
          t.department.toLowerCase().includes(q) ||
          t.id.toLowerCase().includes(q) ||
          t.approvedBy.toLowerCase().includes(q)
      );
    }

    if (dateFrom) {
      list = list.filter(
        (t) => parseISO(t.borrowedAt) >= startOfDay(parseISO(dateFrom))
      );
    }
    if (dateTo) {
      list = list.filter(
        (t) => parseISO(t.borrowedAt) <= endOfDay(parseISO(dateTo))
      );
    }

    list.sort((a, b) => {
      let aVal: string | number = '';
      let bVal: string | number = '';
      if (sortField === 'borrowedAt') { aVal = a.borrowedAt; bVal = b.borrowedAt; }
      else if (sortField === 'borrowerName') { aVal = a.borrowerName; bVal = b.borrowerName; }
      else if (sortField === 'cameraName') { aVal = a.cameraName; bVal = b.cameraName; }
      else if (sortField === 'status') { aVal = a.status; bVal = b.status; }
      if (aVal < bVal) return sortDir === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

    return list;
  }, [transactions, search, filterStatus, dateFrom, dateTo, sortField, sortDir]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  const SortIcon = ({ field }: { field: SortField }) =>
    sortField === field ? (
      <ChevronDown className={`w-3 h-3 inline ml-1 transition-transform ${sortDir === 'asc' ? 'rotate-180' : ''}`} />
    ) : null;

  const stats = {
    total: transactions.length,
    active: transactions.filter((t) => t.status === 'active').length,
    returned: transactions.filter((t) => t.status === 'returned').length,
    overdue: transactions.filter((t) => t.status === 'overdue').length,
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Borrow History</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {stats.total} total · {stats.active} active · {stats.returned} returned · {stats.overdue} overdue
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, color: 'bg-slate-50 text-slate-600 border-slate-200' },
          { label: 'Active', value: stats.active, color: 'bg-blue-50 text-blue-600 border-blue-200' },
          { label: 'Returned', value: stats.returned, color: 'bg-emerald-50 text-emerald-600 border-emerald-200' },
          { label: 'Overdue', value: stats.overdue, color: 'bg-red-50 text-red-600 border-red-200' },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl border p-4 ${s.color}`}>
            <p className="text-2xl font-bold">{s.value}</p>
            <p className="text-xs mt-0.5 opacity-70">{s.label} Transactions</p>
          </div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm space-y-3">
        <div className="flex gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by borrower, camera, department, ID..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showFilters ? 'bg-blue-50 border-blue-200 text-blue-700' : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
          </button>
        </div>
        {showFilters && (
          <div className="flex flex-col sm:flex-row gap-3 pt-1">
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
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap">From:</label>
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-500 whitespace-nowrap">To:</label>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button
              onClick={() => { setFilterStatus('all'); setDateFrom(''); setDateTo(''); setSearch(''); }}
              className="px-3 py-2 text-slate-500 hover:text-slate-700 border border-slate-200 rounded-lg text-sm hover:bg-slate-50 transition-colors"
            >
              Clear
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <HistoryIcon className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-800">Transaction History</h2>
          <span className="ml-auto text-xs text-slate-400">{filtered.length} of {transactions.length}</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">TRX ID</th>
                <th
                  className="text-left text-xs font-medium text-slate-500 px-3 py-3 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort('cameraName')}
                >
                  Camera <SortIcon field="cameraName" />
                </th>
                <th
                  className="text-left text-xs font-medium text-slate-500 px-3 py-3 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort('borrowerName')}
                >
                  Borrower <SortIcon field="borrowerName" />
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden md:table-cell">Department</th>
                <th
                  className="text-left text-xs font-medium text-slate-500 px-3 py-3 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort('borrowedAt')}
                >
                  Borrowed <SortIcon field="borrowedAt" />
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden lg:table-cell">Expected Return</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden xl:table-cell">Actual Return</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden xl:table-cell">Approved By</th>
                <th
                  className="text-left text-xs font-medium text-slate-500 px-3 py-3 cursor-pointer hover:text-slate-700"
                  onClick={() => handleSort('status')}
                >
                  Status <SortIcon field="status" />
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-center py-12 text-slate-400">
                    <HistoryIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No transactions found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3">
                      <p className="text-xs font-mono font-medium text-slate-700">{t.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-slate-800">{t.cameraName}</p>
                      <p className="text-xs text-slate-400 font-mono">{t.cameraBarcode}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-slate-700">{t.borrowerName}</p>
                      <p className="text-xs text-slate-400">{t.borrowerIdNumber}</p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <p className="text-sm text-slate-600">{t.department}</p>
                    </td>
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
                    <td className="px-3 py-3 hidden xl:table-cell">
                      <p className="text-xs text-slate-600">{t.approvedBy}</p>
                    </td>
                    <td className="px-3 py-3">
                      <TransactionStatusBadge status={t.status} />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
