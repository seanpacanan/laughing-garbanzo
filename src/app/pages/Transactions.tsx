import React, { useState, useMemo } from "react";
import {
  Plus,
  Search,
  RotateCcw,
  AlertTriangle,
  Clock,
  Camera,
  X,
  AlertCircle,
  CheckCircle,
  User,
  Building,
  CalendarClock,
} from "lucide-react";
import { format, parseISO, differenceInDays } from "date-fns";
import { useData } from "../context/DataContext";
import { useAuth } from "../context/AuthContext";
import { TransactionStatusBadge } from "../components/StatusBadge";
import type { Transaction } from "../types";

interface BorrowForm {
  cameraId: string;
  borrowerName: string;
  borrowerIdNumber: string;
  department: string;
  expectedReturnDate: string;
  expectedReturnTime: string;
  approvedBy: string;
  notes: string;
}

export default function Transactions() {
  const {
    cameras,
    transactions,
    addTransaction,
    returnCamera,
  } = useData();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState("");
  const [borrowModalOpen, setBorrowModalOpen] = useState(false);
  const [returnTxn, setReturnTxn] =
    useState<Transaction | null>(null);
  const [returnNotes, setReturnNotes] = useState("");
  const [formError, setFormError] = useState("");

  const today = format(new Date(), "yyyy-MM-dd");
  const nowTime = format(new Date(), "HH:mm");

  const [borrowForm, setBorrowForm] = useState<BorrowForm>({
    cameraId: "",
    borrowerName: "",
    borrowerIdNumber: "",
    department: "",
    expectedReturnDate: today,
    expectedReturnTime: "17:00",
    approvedBy: currentUser?.name || "",
    notes: "",
  });

  const availableCameras = useMemo(
    () =>
      cameras.filter(
        (c) => c.status === "available" && !c.archived,
      ),
    [cameras],
  );

  const activeTransactions = useMemo(() => {
    return transactions
      .filter((t) => {
        if (t.status === "returned") return false;
        const q = search.toLowerCase();
        if (
          q &&
          !t.cameraName.toLowerCase().includes(q) &&
          !t.borrowerName.toLowerCase().includes(q) &&
          !t.department.toLowerCase().includes(q) &&
          !t.borrowerIdNumber.toLowerCase().includes(q)
        )
          return false;
        return true;
      })
      .sort((a, b) => {
        // Sort overdue first
        if (a.status === "overdue" && b.status !== "overdue")
          return -1;
        if (b.status === "overdue" && a.status !== "overdue")
          return 1;
        return (
          new Date(b.borrowedAt).getTime() -
          new Date(a.borrowedAt).getTime()
        );
      });
  }, [transactions, search]);

  const overdueTxns = activeTransactions.filter(
    (t) => t.status === "overdue",
  );
  const activeTxns = activeTransactions.filter(
    (t) => t.status === "active",
  );

  const openBorrowModal = () => {
    setBorrowForm({
      cameraId: "",
      borrowerName: "",
      borrowerIdNumber: "",
      department: "",
      expectedReturnDate: today,
      expectedReturnTime: "17:00",
      approvedBy: currentUser?.name || "",
      notes: "",
    });
    setFormError("");
    setBorrowModalOpen(true);
  };

  const handleBorrowSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    if (!borrowForm.cameraId) {
      setFormError("Please select a camera.");
      return;
    }
    if (!borrowForm.borrowerName) {
      setFormError("Please enter the borrower's full name.");
      return;
    }
    if (!borrowForm.borrowerIdNumber) {
      setFormError("Please enter the borrower's ID number.");
      return;
    }
    if (!borrowForm.department) {
      setFormError("Please enter the department/section.");
      return;
    }
    if (!borrowForm.expectedReturnDate) {
      setFormError("Please set an expected return date.");
      return;
    }
    if (!borrowForm.approvedBy) {
      setFormError("Please enter who approved this request.");
      return;
    }

    const camera = cameras.find(
      (c) => c.id === borrowForm.cameraId,
    );
    if (!camera || camera.status !== "available") {
      setFormError(
        "This camera is no longer available. Please select another.",
      );
      return;
    }

    const expectedReturnAt = `${borrowForm.expectedReturnDate}T${borrowForm.expectedReturnTime}:00`;
    if (new Date(expectedReturnAt) <= new Date()) {
      setFormError(
        "Expected return date/time must be in the future.",
      );
      return;
    }

    addTransaction({
      cameraId: camera.id,
      cameraName: camera.name,
      cameraBarcode: camera.barcode,
      borrowerName: borrowForm.borrowerName,
      borrowerIdNumber: borrowForm.borrowerIdNumber,
      department: borrowForm.department,
      borrowedAt: new Date().toISOString(),
      expectedReturnAt,
      approvedBy: borrowForm.approvedBy,
      notes: borrowForm.notes,
    });

    setBorrowModalOpen(false);
  };

  const handleReturn = () => {
    if (!returnTxn) return;
    returnCamera(returnTxn.id, returnNotes);
    setReturnTxn(null);
    setReturnNotes("");
  };

  const getDaysOverdue = (expectedReturnAt: string) => {
    const diff = differenceInDays(
      new Date(),
      parseISO(expectedReturnAt),
    );
    return diff;
  };

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">
            Transactions
          </h1>
          <p className="text-slate-500 text-sm mt-0.5">
            {activeTxns.length} active · {overdueTxns.length}{" "}
            overdue
          </p>
        </div>
        <button
          onClick={openBorrowModal}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">New Borrow</span>
        </button>
      </div>

      {/* Overdue Alert */}
      {overdueTxns.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-semibold text-red-800">
              {overdueTxns.length} Overdue Item
              {overdueTxns.length > 1 ? "s" : ""}
            </p>
          </div>
          <div className="space-y-1">
            {overdueTxns.map((t) => (
              <div
                key={t.id}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-red-700">
                  <strong>{t.cameraName}</strong> — borrowed by{" "}
                  {t.borrowerName} ({t.department})
                </span>
                <span className="text-red-600 text-xs font-medium ml-2">
                  {getDaysOverdue(t.expectedReturnAt)} day
                  {getDaysOverdue(t.expectedReturnAt) !== 1
                    ? "s"
                    : ""}{" "}
                  overdue
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by camera, borrower, department..."
            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Active Borrows Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
          <Clock className="w-4 h-4 text-blue-600" />
          <h2 className="text-sm font-semibold text-slate-800">
            Active & Overdue Borrows
          </h2>
          <span className="ml-auto text-xs text-slate-400">
            {activeTransactions.length} item
            {activeTransactions.length !== 1 ? "s" : ""}
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">
                  TRX ID
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">
                  Camera
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">
                  Borrower
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden md:table-cell">
                  Department
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden lg:table-cell">
                  Borrowed
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">
                  Expected Return
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden xl:table-cell">
                  Approved By
                </th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">
                  Status
                </th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">
                  Action
                </th>
              </tr>
            </thead>
            <tbody>
              {activeTransactions.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="text-center py-12 text-slate-400"
                  >
                    <CheckCircle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No active borrows</p>
                  </td>
                </tr>
              ) : (
                activeTransactions.map((t) => (
                  <tr
                    key={t.id}
                    className={`border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors ${
                      t.status === "overdue"
                        ? "bg-red-50 hover:bg-red-50"
                        : ""
                    }`}
                  >
                    <td className="px-5 py-3">
                      <p className="text-xs font-mono font-medium text-slate-700">
                        {t.id}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-slate-800">
                        {t.cameraName}
                      </p>
                      <p className="text-xs text-slate-400 font-mono">
                        {t.cameraBarcode}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm text-slate-700">
                        {t.borrowerName}
                      </p>
                      <p className="text-xs text-slate-400">
                        {t.borrowerIdNumber}
                      </p>
                    </td>
                    <td className="px-3 py-3 hidden md:table-cell">
                      <p className="text-sm text-slate-600">
                        {t.department}
                      </p>
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <p className="text-xs text-slate-600">
                        {format(
                          parseISO(t.borrowedAt),
                          "MMM dd, yyyy",
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(
                          parseISO(t.borrowedAt),
                          "hh:mm a",
                        )}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-xs text-slate-600">
                        {format(
                          parseISO(t.expectedReturnAt),
                          "MMM dd, yyyy",
                        )}
                      </p>
                      <p className="text-xs text-slate-400">
                        {format(
                          parseISO(t.expectedReturnAt),
                          "hh:mm a",
                        )}
                      </p>
                      {t.status === "overdue" && (
                        <p className="text-xs text-red-600 font-medium">
                          {getDaysOverdue(t.expectedReturnAt)}d
                          overdue
                        </p>
                      )}
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell">
                      <p className="text-xs text-slate-600">
                        {t.approvedBy}
                      </p>
                    </td>
                    <td className="px-3 py-3">
                      <TransactionStatusBadge
                        status={t.status}
                      />
                    </td>
                    <td className="px-5 py-3">
                      <button
                        onClick={() => {
                          setReturnTxn(t);
                          setReturnNotes("");
                        }}
                        className="flex items-center gap-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                      >
                        <RotateCcw className="w-3 h-3" />
                        Return
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Borrow Modal */}
      {borrowModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setBorrowModalOpen(false)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Camera className="w-5 h-5 text-blue-600" />
                <h2 className="text-base font-semibold text-slate-800">
                  New Borrow Request
                </h2>
              </div>
              <button
                onClick={() => setBorrowModalOpen(false)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={handleBorrowSubmit}
              className="px-6 py-5 space-y-4"
            >
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}
              <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-xs text-blue-700">
                Timestamp will be automatically recorded upon
                submission.
              </div>

              {/* Camera Selection */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1">
                    <Camera className="w-3 h-3" /> Equipment Description *
                  </span>
                </label>
                <select
                  value={borrowForm.cameraId}
                  onChange={(e) =>
                    setBorrowForm({
                      ...borrowForm,
                      cameraId: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                >
                  <option value="">
                    -- Select available camera --
                  </option>
                  {availableCameras.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} [{c.barcode}]
                    </option>
                  ))}
                </select>
                {availableCameras.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No cameras currently available for
                    borrowing.
                  </p>
                )}
              </div>

              {/* Borrower Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    <span className="flex items-center gap-1">
                      <User className="w-3 h-3" /> Borrower Full
                      Name *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={borrowForm.borrowerName}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        borrowerName: e.target.value,
                      })
                    }
                    placeholder="Full name"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    Employee ID *
                  </label>
                  <input
                    type="text"
                    value={borrowForm.borrowerIdNumber}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        borrowerIdNumber: e.target.value,
                      })
                    }
                    placeholder="STU-XXXX-XXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">
                    <span className="flex items-center gap-1">
                      <Building className="w-3 h-3" />{" "}
                      Department / Division *
                    </span>
                  </label>
                  <input
                    type="text"
                    value={borrowForm.department}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        department: e.target.value,
                      })
                    }
                    placeholder="e.g. Multimedia Arts"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Return Date/Time */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  <span className="flex items-center gap-1">
                    <CalendarClock className="w-3 h-3" />{" "}
                    Expected Return Date & Time *
                  </span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <input
                    type="date"
                    value={borrowForm.expectedReturnDate}
                    min={today}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        expectedReturnDate: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <input
                    type="time"
                    value={borrowForm.expectedReturnTime}
                    onChange={(e) =>
                      setBorrowForm({
                        ...borrowForm,
                        expectedReturnTime: e.target.value,
                      })
                    }
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Approved By */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Approved By *
                </label>
                <input
                  type="text"
                  value={borrowForm.approvedBy}
                  onChange={(e) =>
                    setBorrowForm({
                      ...borrowForm,
                      approvedBy: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Purpose / Notes (optional)
                </label>
                <textarea
                  value={borrowForm.notes}
                  onChange={(e) =>
                    setBorrowForm({
                      ...borrowForm,
                      notes: e.target.value,
                    })
                  }
                  placeholder="Purpose of borrowing..."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setBorrowModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  Confirm Borrow
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Confirmation Modal */}
      {returnTxn && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black bg-opacity-50"
            onClick={() => setReturnTxn(null)}
          />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-5 h-5 text-emerald-600" />
                <h2 className="text-base font-semibold text-slate-800">
                  Process Return
                </h2>
              </div>
              <button
                onClick={() => setReturnTxn(null)}
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="bg-slate-50 rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Transaction
                  </span>
                  <span className="font-mono font-medium text-slate-700">
                    {returnTxn.id}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">Camera</span>
                  <span className="font-medium text-slate-800">
                    {returnTxn.cameraName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Borrower
                  </span>
                  <span className="text-slate-700">
                    {returnTxn.borrowerName}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Borrowed
                  </span>
                  <span className="text-slate-700">
                    {format(
                      parseISO(returnTxn.borrowedAt),
                      "MMM dd, yyyy hh:mm a",
                    )}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    Expected Return
                  </span>
                  <span
                    className={
                      returnTxn.status === "overdue"
                        ? "text-red-600 font-medium"
                        : "text-slate-700"
                    }
                  >
                    {format(
                      parseISO(returnTxn.expectedReturnAt),
                      "MMM dd, yyyy hh:mm a",
                    )}
                  </span>
                </div>
                {returnTxn.status === "overdue" && (
                  <div className="flex items-center gap-2 bg-red-50 rounded-lg px-3 py-2 mt-1">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    <p className="text-xs text-red-600 font-medium">
                      {getDaysOverdue(
                        returnTxn.expectedReturnAt,
                      )}{" "}
                      day
                      {getDaysOverdue(
                        returnTxn.expectedReturnAt,
                      ) !== 1
                        ? "s"
                        : ""}{" "}
                      overdue
                    </p>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Return Time (Auto-recorded)
                </label>
                <input
                  type="text"
                  value={format(
                    new Date(),
                    "MMM dd, yyyy hh:mm a",
                  )}
                  disabled
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm text-slate-600"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">
                  Return Notes (optional)
                </label>
                <textarea
                  value={returnNotes}
                  onChange={(e) =>
                    setReturnNotes(e.target.value)
                  }
                  placeholder="Camera condition upon return, any damages, etc."
                  rows={2}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setReturnTxn(null)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleReturn}
                  className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <CheckCircle className="w-4 h-4" />
                  Confirm Return
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}