import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Camera, Transaction, User, CameraStatus } from '../types';
import { useAuth } from './AuthContext';
import * as api from '../services/api';

interface DataContextType {
  cameras: Camera[];
  transactions: Transaction[];
  users: User[];
  isLoading: boolean;
  dataError: string | null;
  refreshData: () => Promise<void>;
  addCamera: (data: Omit<Camera, 'id' | 'barcode' | 'addedDate' | 'archived'>) => Camera;
  updateCamera: (id: string, updates: Partial<Camera>) => void;
  archiveCamera: (id: string) => void;
  unarchiveCamera: (id: string) => void;
  deleteCamera: (id: string) => void;
  addTransaction: (data: Omit<Transaction, 'id' | 'status' | 'returnedAt'>) => Transaction;
  returnCamera: (transactionId: string, notes?: string) => void;
  addUser: (data: Omit<User, 'id' | 'createdAt'>) => User;
  updateUser: (id: string, updates: Partial<User>) => void;
  overdueCount: number;
}

const DataContext = createContext<DataContextType | null>(null);

// ─── ID helpers ────────────────────────────────────────────────────────────
function generateId(prefix: string, items: { id: string }[]): string {
  const nums = items
    .map((i) => parseInt(i.id.split('-').pop() || '0', 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `${prefix}-${String(next).padStart(3, '0')}`;
}

function generateBarcode(cameras: Camera[]): string {
  const year = new Date().getFullYear();
  const nums = cameras
    .map((c) => parseInt(c.barcode.split('-').pop() || '0', 10))
    .filter((n) => !isNaN(n));
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `CRMLAB-${year}-${String(next).padStart(3, '0')}`;
}

// ─── Overdue checker (pure) ────────────────────────────────────────────────
function applyOverdueCheck(
  txns: Transaction[],
  cams: Camera[],
): { updatedTxns: Transaction[]; updatedCams: Camera[]; changedTxnIds: string[]; changedCamIds: string[] } {
  const now = new Date();
  const changedTxnIds: string[] = [];
  const changedCamIds: string[] = [];

  const updatedTxns = txns.map((t) => {
    if (t.status === 'active' && new Date(t.expectedReturnAt) < now) {
      changedTxnIds.push(t.id);
      return { ...t, status: 'overdue' as const };
    }
    return t;
  });

  const updatedCams = cams.map((c) => {
    const hasOverdue = updatedTxns.some((t) => t.cameraId === c.id && t.status === 'overdue');
    if (hasOverdue && c.status !== 'overdue') {
      changedCamIds.push(c.id);
      return { ...c, status: 'overdue' as CameraStatus };
    }
    return c;
  });

  return { updatedTxns, updatedCams, changedTxnIds, changedCamIds };
}

// ─── Provider ──────────────────────────────────────────────────────────────
export function DataProvider({ children }: { children: React.ReactNode }) {
  // DataProvider is now INSIDE AuthProvider so useAuth() is safe here
  const { currentUser, logout } = useAuth();

  const [cameras, setCameras] = useState<Camera[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dataError, setDataError] = useState<string | null>(null);

  const refreshData = useCallback(async () => {
    try {
      setIsLoading(true);
      setDataError(null);

      const [cams, txns, usrs] = await Promise.all([
        api.getCameras(),
        api.getTransactions(),
        api.getUsers(),
      ]);

      const { updatedTxns, updatedCams, changedTxnIds, changedCamIds } = applyOverdueCheck(txns, cams);

      if (changedTxnIds.length > 0 || changedCamIds.length > 0) {
        Promise.all([
          ...changedTxnIds.map((id) =>
            api.updateTransaction(id, { status: 'overdue' }).catch((e) =>
              console.log(`Failed to persist overdue status for transaction ${id}:`, e),
            ),
          ),
          ...changedCamIds.map((id) =>
            api.updateCamera(id, { status: 'overdue' }).catch((e) =>
              console.log(`Failed to persist overdue status for camera ${id}:`, e),
            ),
          ),
        ]);
      }

      setCameras(updatedCams);
      setTransactions(updatedTxns);
      setUsers(usrs);
    } catch (e: any) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log('Error loading data from database:', msg);
      // Session expired or invalid — force logout
      if (msg.includes('401')) {
        console.log('Session expired, logging out.');
        await logout();
        return;
      }
      setDataError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [logout]);

  // Load data only when the user is authenticated
  useEffect(() => {
    if (currentUser) {
      refreshData();
    } else {
      // Clear all data on logout so it's never visible to the next user
      setCameras([]);
      setTransactions([]);
      setUsers([]);
      setDataError(null);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id]);

  // Periodic overdue check (every 60 seconds) — only when authenticated
  useEffect(() => {
    if (!currentUser) return;

    const interval = setInterval(() => {
      setTransactions((prevTxns) => {
        setCameras((prevCams) => {
          const { updatedTxns, updatedCams, changedTxnIds, changedCamIds } = applyOverdueCheck(
            prevTxns,
            prevCams,
          );

          if (changedTxnIds.length > 0 || changedCamIds.length > 0) {
            Promise.all([
              ...changedTxnIds.map((id) =>
                api.updateTransaction(id, { status: 'overdue' }).catch((e) =>
                  console.log(`Failed to persist overdue transaction ${id}:`, e),
                ),
              ),
              ...changedCamIds.map((id) =>
                api.updateCamera(id, { status: 'overdue' }).catch((e) =>
                  console.log(`Failed to persist overdue camera ${id}:`, e),
                ),
              ),
            ]);
            setTransactions(updatedTxns);
            return updatedCams;
          }

          return prevCams;
        });
        return prevTxns;
      });
    }, 60_000);

    return () => clearInterval(interval);
  }, [currentUser]);

  const overdueCount = transactions.filter((t) => t.status === 'overdue').length;

  // ─── Camera mutations ──────────────────────────────────────────────────
  const addCamera = (data: Omit<Camera, 'id' | 'barcode' | 'addedDate' | 'archived'>): Camera => {
    const newCamera: Camera = {
      ...data,
      id: generateId('CAM', cameras),
      barcode: generateBarcode(cameras),
      addedDate: new Date().toISOString(),
      archived: false,
    };
    setCameras((prev) => [...prev, newCamera]);
    api.createCamera(newCamera).catch((e) => console.log('Error saving camera to database:', e));
    return newCamera;
  };

  const updateCamera = (id: string, updates: Partial<Camera>) => {
    setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, ...updates } : c)));
    api.updateCamera(id, updates).catch((e) =>
      console.log(`Error updating camera ${id} in database:`, e),
    );
  };

  const archiveCamera = (id: string) => {
    setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, archived: true } : c)));
    api.updateCamera(id, { archived: true }).catch((e) =>
      console.log(`Error archiving camera ${id} in database:`, e),
    );
  };

  const unarchiveCamera = (id: string) => {
    setCameras((prev) => prev.map((c) => (c.id === id ? { ...c, archived: false } : c)));
    api.updateCamera(id, { archived: false }).catch((e) =>
      console.log(`Error unarchiving camera ${id} in database:`, e),
    );
  };

  const deleteCamera = (id: string) => {
    setCameras((prev) => prev.filter((c) => c.id !== id));
    api.deleteCamera(id).catch((e) =>
      console.log(`Error deleting camera ${id} from database:`, e),
    );
  };

  // ─── Transaction mutations ─────────────────────────────────────────────
  const addTransaction = (data: Omit<Transaction, 'id' | 'status' | 'returnedAt'>): Transaction => {
    const newTxn: Transaction = {
      ...data,
      id: generateId('TRX', transactions),
      status: 'active',
    };
    setTransactions((prev) => [...prev, newTxn]);
    setCameras((prev) =>
      prev.map((c) => (c.id === data.cameraId ? { ...c, status: 'borrowed' as CameraStatus } : c)),
    );
    api.createTransaction(newTxn).catch((e) =>
      console.log('Error saving transaction to database:', e),
    );
    return newTxn;
  };

  const returnCamera = (transactionId: string, notes?: string) => {
    const txn = transactions.find((t) => t.id === transactionId);
    if (!txn) return;
    const returnedAt = new Date().toISOString();
    const updates: Partial<Transaction> = {
      returnedAt,
      status: 'returned',
      ...(notes ? { notes } : {}),
    };
    setTransactions((prev) =>
      prev.map((t) => (t.id === transactionId ? { ...t, ...updates } : t)),
    );
    setCameras((prev) =>
      prev.map((c) => (c.id === txn.cameraId ? { ...c, status: 'available' as CameraStatus } : c)),
    );
    api.updateTransaction(transactionId, updates).catch((e) =>
      console.log(`Error returning transaction ${transactionId} in database:`, e),
    );
  };

  // ─── User mutations ────────────────────────────────────────────────────
  const addUser = (data: Omit<User, 'id' | 'createdAt'>): User => {
    const newUser: User = {
      ...data,
      id: generateId('USR', users),
      createdAt: new Date().toISOString(),
    };
    setUsers((prev) => [...prev, newUser]);
    api.createUser(newUser).catch((e) => console.log('Error saving user to database:', e));
    return newUser;
  };

  const updateUser = (id: string, updates: Partial<User>) => {
    setUsers((prev) => prev.map((u) => (u.id === id ? { ...u, ...updates } : u)));
    api.updateUser(id, updates).catch((e) =>
      console.log(`Error updating user ${id} in database:`, e),
    );
  };

  return (
    <DataContext.Provider
      value={{
        cameras,
        transactions,
        users,
        isLoading,
        dataError,
        refreshData,
        addCamera,
        updateCamera,
        archiveCamera,
        unarchiveCamera,
        deleteCamera,
        addTransaction,
        returnCamera,
        addUser,
        updateUser,
        overdueCount,
      }}
    >
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
}
