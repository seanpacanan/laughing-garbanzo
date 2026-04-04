import React from 'react';
import { useNavigate } from 'react-router';
import {
  Camera,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Wrench,
  TrendingUp,
  ArrowRight,
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { format, parseISO, subMonths, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { useData } from '../context/DataContext';
import { TransactionStatusBadge } from '../components/StatusBadge';

const COLORS = {
  available: '#10b981',
  borrowed: '#3b82f6',
  overdue: '#ef4444',
  maintenance: '#f59e0b',
};

export default function Dashboard() {
  const { cameras, transactions } = useData();
  const navigate = useNavigate();

  const activeCameras = cameras.filter((c) => !c.archived);
  const totalCameras = activeCameras.length;
  const available = activeCameras.filter((c) => c.status === 'available').length;
  const borrowed = activeCameras.filter((c) => c.status === 'borrowed').length;
  const overdue = activeCameras.filter((c) => c.status === 'overdue').length;
  const maintenance = activeCameras.filter((c) => c.status === 'maintenance').length;

  const pieData = [
    { name: 'Available', value: available, color: COLORS.available },
    { name: 'Borrowed', value: borrowed, color: COLORS.borrowed },
    { name: 'Overdue', value: overdue, color: COLORS.overdue },
    { name: 'Maintenance', value: maintenance, color: COLORS.maintenance },
  ].filter((d) => d.value > 0);

  // Monthly activity (last 6 months)
  const monthlyData = Array.from({ length: 6 }, (_, i) => {
    const date = subMonths(new Date(), 5 - i);
    const start = startOfMonth(date);
    const end = endOfMonth(date);
    const count = transactions.filter((t) =>
      isWithinInterval(parseISO(t.borrowedAt), { start, end })
    ).length;
    return { month: format(date, 'MMM'), borrows: count };
  });

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.borrowedAt).getTime() - new Date(a.borrowedAt).getTime())
    .slice(0, 6);

  const overdueItems = transactions.filter((t) => t.status === 'overdue');

  const statCards = [
    { label: 'Total Cameras', value: totalCameras, icon: Camera, color: 'bg-slate-100 text-slate-600', border: 'border-slate-200' },
    { label: 'Available', value: available, icon: CheckCircle2, color: 'bg-emerald-100 text-emerald-600', border: 'border-emerald-200' },
    { label: 'Borrowed', value: borrowed, icon: Clock, color: 'bg-blue-100 text-blue-600', border: 'border-blue-200' },
    { label: 'Overdue', value: overdue, icon: AlertTriangle, color: 'bg-red-100 text-red-600', border: 'border-red-200' },
    { label: 'Maintenance', value: maintenance, icon: Wrench, color: 'bg-amber-100 text-amber-600', border: 'border-amber-200' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-xl font-bold text-slate-800">Dashboard</h1>
        <p className="text-slate-500 text-sm mt-0.5">
          {format(new Date(), 'EEEE, MMMM dd, yyyy')} · Camera Equipment Room Overview
        </p>
      </div>

      {/* Overdue Alert Banner */}
      {overdueItems.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-red-800">
              {overdueItems.length} overdue item{overdueItems.length > 1 ? 's' : ''} need attention!
            </p>
            <p className="text-xs text-red-600 mt-0.5">
              {overdueItems.map((t) => `${t.cameraName} (${t.borrowerName})`).join(' · ')}
            </p>
          </div>
          <button
            onClick={() => navigate('/transactions')}
            className="text-xs text-red-700 font-medium hover:underline flex items-center gap-1"
          >
            View <ArrowRight className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        {statCards.map((card) => (
          <div key={card.label} className={`bg-white rounded-xl border ${card.border} p-4 shadow-sm`}>
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg ${card.color} flex items-center justify-center`}>
                <card.icon className="w-4 h-4" />
              </div>
            </div>
            <p className="text-2xl font-bold text-slate-800">{card.value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{card.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Bar Chart */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            <h2 className="text-sm font-semibold text-slate-800">Monthly Borrow Activity</h2>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
              <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} />
              <Tooltip
                contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                cursor={{ fill: '#f1f5f9' }}
              />
              <Bar dataKey="borrows" name="Borrows" fill="#3b82f6" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Pie Chart */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">Equipment Status</h2>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={45}
                outerRadius={70}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, index) => (
                  <Cell key={`cell-${entry.name}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1 mt-2">
            {pieData.map((entry) => (
              <div key={entry.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: entry.color }} />
                  <span className="text-slate-600">{entry.name}</span>
                </div>
                <span className="font-medium text-slate-800">{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Transactions */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">Recent Transactions</h2>
          <button
            onClick={() => navigate('/history')}
            className="text-xs text-blue-600 hover:underline flex items-center gap-1"
          >
            View all <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100">
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">Camera</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Borrower</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden md:table-cell">Department</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden lg:table-cell">Borrowed</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {recentTransactions.map((t) => (
                <tr key={t.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                  <td className="px-5 py-3">
                    <p className="text-sm font-medium text-slate-800">{t.cameraName}</p>
                    <p className="text-xs text-slate-400">{t.cameraBarcode}</p>
                  </td>
                  <td className="px-3 py-3">
                    <p className="text-sm text-slate-700">{t.borrowerName}</p>
                    <p className="text-xs text-slate-400">{t.borrowerIdNumber}</p>
                  </td>
                  <td className="px-3 py-3 hidden md:table-cell">
                    <p className="text-sm text-slate-600">{t.department}</p>
                  </td>
                  <td className="px-3 py-3 hidden lg:table-cell">
                    <p className="text-xs text-slate-600">
                      {format(parseISO(t.borrowedAt), 'MMM dd, yyyy')}
                    </p>
                    <p className="text-xs text-slate-400">
                      {format(parseISO(t.borrowedAt), 'hh:mm a')}
                    </p>
                  </td>
                  <td className="px-3 py-3">
                    <TransactionStatusBadge status={t.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}