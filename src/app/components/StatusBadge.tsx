import React from 'react';
import type { CameraStatus, TransactionStatus } from '../types';

const cameraStatusConfig: Record<CameraStatus, { label: string; classes: string }> = {
  available: { label: 'Available', classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  borrowed: { label: 'Borrowed', classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
  overdue: { label: 'Overdue', classes: 'bg-red-100 text-red-700 border border-red-200' },
  maintenance: { label: 'Under Maintenance', classes: 'bg-amber-100 text-amber-700 border border-amber-200' },
  unavailable: { label: 'Unavailable', classes: 'bg-slate-100 text-slate-600 border border-slate-200' },
  defective: { label: 'Defective', classes: 'bg-orange-100 text-orange-700 border border-orange-200' },
};

const transactionStatusConfig: Record<TransactionStatus, { label: string; classes: string }> = {
  active: { label: 'Active', classes: 'bg-blue-100 text-blue-700 border border-blue-200' },
  returned: { label: 'Returned', classes: 'bg-emerald-100 text-emerald-700 border border-emerald-200' },
  overdue: { label: 'Overdue', classes: 'bg-red-100 text-red-700 border border-red-200' },
};

interface CameraStatusBadgeProps {
  status: CameraStatus;
}

interface TransactionStatusBadgeProps {
  status: TransactionStatus;
}

export function CameraStatusBadge({ status }: CameraStatusBadgeProps) {
  const config = cameraStatusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current inline-block" />
      {config.label}
    </span>
  );
}

export function TransactionStatusBadge({ status }: TransactionStatusBadgeProps) {
  const config = transactionStatusConfig[status];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.classes}`}>
      <span className="mr-1.5 h-1.5 w-1.5 rounded-full bg-current inline-block" />
      {config.label}
    </span>
  );
}