export type CameraStatus = 'available' | 'borrowed' | 'overdue' | 'maintenance' | 'unavailable' | 'defective';
export type TransactionStatus = 'active' | 'returned' | 'overdue';
export type UserRole = 'admin' | 'staff';

export interface Camera {
  id: string;
  barcode: string;
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  amrNumber?: string;
  status: CameraStatus;
  description?: string;
  archived: boolean;
  addedDate: string;
  notes?: string;
}

export interface Transaction {
  id: string;
  cameraId: string;
  cameraName: string;
  cameraBarcode: string;
  borrowerName: string;
  borrowerIdNumber: string;
  department: string;
  borrowedAt: string;
  expectedReturnAt: string;
  returnedAt?: string;
  approvedBy: string;
  status: TransactionStatus;
  notes?: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;   // Optional: present only when creating/updating; never returned by GET /users
  role: UserRole;
  department?: string;
  active: boolean;
  createdAt: string;
}