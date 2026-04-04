import React, { useState, useMemo } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Archive,
  RotateCcw,
  Camera,
  Filter,
  X,
  Save,
  AlertCircle,
  QrCode,
  Eye,
  Trash2,
} from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { useData } from '../context/DataContext';
import { useAuth } from '../context/AuthContext';
import { CameraStatusBadge } from '../components/StatusBadge';
import type { Camera as CameraType, CameraStatus } from '../types';

type FilterStatus = CameraStatus | 'all';

interface CameraFormData {
  name: string;
  brand: string;
  model: string;
  serialNumber: string;
  amrNumber: string;
  status: CameraStatus;
  description: string;
  notes: string;
}

const defaultForm: CameraFormData = {
  name: '',
  brand: '',
  model: '',
  serialNumber: '',
  amrNumber: '',
  status: 'available',
  description: '',
  notes: '',
};

export default function Cameras() {
  const { cameras, transactions, addCamera, updateCamera, archiveCamera, unarchiveCamera, deleteCamera } = useData();
  const { currentUser } = useAuth();
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [showArchived, setShowArchived] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailCamera, setDetailCamera] = useState<CameraType | null>(null);
  const [editingCamera, setEditingCamera] = useState<CameraType | null>(null);
  const [form, setForm] = useState<CameraFormData>(defaultForm);
  const [formError, setFormError] = useState('');

  const filtered = useMemo(() => {
    return cameras.filter((c) => {
      if (c.archived !== showArchived) return false;
      if (filterStatus !== 'all' && c.status !== filterStatus) return false;
      const q = search.toLowerCase();
      if (q && !c.name.toLowerCase().includes(q) && !c.barcode.toLowerCase().includes(q) && !c.brand.toLowerCase().includes(q) && !c.serialNumber.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [cameras, search, filterStatus, showArchived]);

  const openAdd = () => {
    setEditingCamera(null);
    setForm(defaultForm);
    setFormError('');
    setModalOpen(true);
  };

  const openEdit = (camera: CameraType) => {
    setEditingCamera(camera);
    setForm({
      name: camera.name,
      brand: camera.brand,
      model: camera.model,
      serialNumber: camera.serialNumber,
      amrNumber: camera.amrNumber || '',
      status: camera.status,
      description: camera.description || '',
      notes: camera.notes || '',
    });
    setFormError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');
    if (!form.name || !form.brand || !form.model || !form.serialNumber) {
      setFormError('Please fill in all required fields.');
      return;
    }
    // Check for duplicate serial number
    const existingWithSerial = cameras.find(
      (c) => c.serialNumber === form.serialNumber && (!editingCamera || c.id !== editingCamera.id)
    );
    if (existingWithSerial) {
      setFormError('A camera with this serial number already exists.');
      return;
    }
    if (editingCamera) {
      updateCamera(editingCamera.id, { ...form });
    } else {
      addCamera({ ...form });
    }
    setModalOpen(false);
  };

  const handleArchive = (camera: CameraType) => {
    const hasActiveBorrow = transactions.some(
      (t) => t.cameraId === camera.id && (t.status === 'active' || t.status === 'overdue')
    );
    if (hasActiveBorrow) {
      alert('Cannot archive: this camera has an active or overdue borrow transaction.');
      return;
    }
    if (window.confirm(`Archive "${camera.name}"? It will be hidden from active inventory.`)) {
      archiveCamera(camera.id);
    }
  };

  const handleDelete = (camera: CameraType) => {
    const hasActiveBorrow = transactions.some(
      (t) => t.cameraId === camera.id && (t.status === 'active' || t.status === 'overdue')
    );
    if (hasActiveBorrow) {
      alert('Cannot delete: this camera has an active or overdue borrow transaction.');
      return;
    }
    if (window.confirm(`Permanently delete "${camera.name}"? This action cannot be undone.`)) {
      deleteCamera(camera.id);
    }
  };

  const statusOptions: { value: FilterStatus; label: string }[] = [
    { value: 'all', label: 'All Status' },
    { value: 'available', label: 'Available' },
    { value: 'borrowed', label: 'Borrowed' },
    { value: 'overdue', label: 'Overdue' },
    { value: 'maintenance', label: 'Maintenance' },
    { value: 'unavailable', label: 'Unavailable' },
    { value: 'defective', label: 'Defective' },
  ];

  return (
    <div className="p-4 lg:p-6 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-800">Camera Inventory</h1>
          <p className="text-slate-500 text-sm mt-0.5">{cameras.filter(c => !c.archived).length} active cameras · {cameras.filter(c => c.archived).length} archived</p>
        </div>
        <button
          onClick={openAdd}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" />
          <span className="hidden sm:inline">Add Camera</span>
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, barcode, brand..."
              className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white text-slate-700"
          >
            {statusOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          <button
            onClick={() => setShowArchived(!showArchived)}
            className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
              showArchived
                ? 'bg-amber-50 border-amber-200 text-amber-700'
                : 'border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Archive className="w-4 h-4" />
            {showArchived ? 'Archived' : 'Show Archived'}
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="text-left text-xs font-medium text-slate-500 px-5 py-3">#</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Barcode / ID</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Camera</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden sm:table-cell">Brand</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3">Status</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden lg:table-cell">Serial No.</th>
                <th className="text-left text-xs font-medium text-slate-500 px-3 py-3 hidden xl:table-cell">Date Added</th>
                <th className="text-right text-xs font-medium text-slate-500 px-5 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="text-center py-12 text-slate-400">
                    <Camera className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No cameras found</p>
                  </td>
                </tr>
              ) : (
                filtered.map((camera, idx) => (
                  <tr key={camera.id} className="border-b border-slate-50 last:border-0 hover:bg-slate-50 transition-colors">
                    <td className="px-5 py-3 text-sm text-slate-500">{idx + 1}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-1.5">
                        <QrCode className="w-3 h-3 text-slate-400" />
                        <span className="text-xs font-mono text-slate-600">{camera.barcode}</span>
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{camera.id}</p>
                    </td>
                    <td className="px-3 py-3">
                      <p className="text-sm font-medium text-slate-800">{camera.name}</p>
                      <p className="text-xs text-slate-400">{camera.model}</p>
                    </td>
                    <td className="px-3 py-3 hidden sm:table-cell">
                      <p className="text-sm text-slate-600">{camera.brand}</p>
                    </td>
                    <td className="px-3 py-3">
                      {camera.archived ? (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Archived
                        </span>
                      ) : (
                        <CameraStatusBadge status={camera.status} />
                      )}
                    </td>
                    <td className="px-3 py-3 hidden lg:table-cell">
                      <p className="text-xs font-mono text-slate-600">{camera.serialNumber}</p>
                    </td>
                    <td className="px-3 py-3 hidden xl:table-cell">
                      <p className="text-xs text-slate-600">
                        {format(parseISO(camera.addedDate), 'MMM dd, yyyy')}
                      </p>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => setDetailCamera(camera)}
                          className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        {!camera.archived && (
                          <button
                            onClick={() => openEdit(camera)}
                            className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}
                        {camera.archived ? (
                          <button
                            onClick={() => unarchiveCamera(camera.id)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Unarchive"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleArchive(camera)}
                            className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                            title="Archive"
                          >
                            <Archive className="w-4 h-4" />
                          </button>
                        )}
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={() => handleDelete(camera)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Delete Permanently"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setModalOpen(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">
                {editingCamera ? 'Edit Camera' : 'Add New Camera'}
              </h2>
              <button onClick={() => setModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
              {formError && (
                <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-lg">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  {formError}
                </div>
              )}
              {!editingCamera && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 text-xs text-blue-700">
                  Barcode and Camera ID will be auto-generated upon saving.
                </div>
              )}
              {editingCamera && (
                <div className="bg-slate-50 rounded-lg px-3 py-2">
                  <p className="text-xs text-slate-500">Barcode: <span className="font-mono font-medium text-slate-700">{editingCamera.barcode}</span></p>
                  <p className="text-xs text-slate-500">ID: <span className="font-medium text-slate-700">{editingCamera.id}</span></p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Camera Name *</label>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Canon EOS R5"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Brand *</label>
                  <input
                    type="text"
                    value={form.brand}
                    onChange={(e) => setForm({ ...form, brand: e.target.value })}
                    placeholder="e.g. Canon"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Model *</label>
                  <input
                    type="text"
                    value={form.model}
                    onChange={(e) => setForm({ ...form, model: e.target.value })}
                    placeholder="e.g. EOS R5"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Serial Number *</label>
                  <input
                    type="text"
                    value={form.serialNumber}
                    onChange={(e) => setForm({ ...form, serialNumber: e.target.value })}
                    placeholder="SN-XXXX-XXXXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">AMR Number</label>
                  <input
                    type="text"
                    value={form.amrNumber}
                    onChange={(e) => setForm({ ...form, amrNumber: e.target.value })}
                    placeholder="AMR-XXXX-XXXX"
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-1">Status</label>
                  <select
                    value={form.status}
                    onChange={(e) => setForm({ ...form, status: e.target.value as CameraStatus })}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                  >
                    <option value="available">Available</option>
                    <option value="maintenance">Under Maintenance</option>
                    <option value="unavailable">Unavailable</option>
                    <option value="defective">Defective</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Description</label>
                  <textarea
                    value={form.description}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    placeholder="Brief description of the camera..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={form.notes}
                    onChange={(e) => setForm({ ...form, notes: e.target.value })}
                    placeholder="Additional notes (maintenance schedule, condition, etc.)..."
                    rows={2}
                    className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-lg text-sm font-medium transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {editingCamera ? 'Save Changes' : 'Add Camera'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailCamera && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => setDetailCamera(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
              <h2 className="text-base font-semibold text-slate-800">Camera Details</h2>
              <button onClick={() => setDetailCamera(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-6 py-5 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold text-slate-800">{detailCamera.name}</h3>
                  <p className="text-sm text-slate-500">{detailCamera.brand} · {detailCamera.model}</p>
                </div>
                <CameraStatusBadge status={detailCamera.status} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: 'Camera ID', value: detailCamera.id },
                  { label: 'Barcode', value: detailCamera.barcode },
                  { label: 'Serial No.', value: detailCamera.serialNumber },
                  ...(detailCamera.amrNumber ? [{ label: 'AMR No.', value: detailCamera.amrNumber }] : []),
                  { label: 'Date Added', value: format(parseISO(detailCamera.addedDate), 'MMM dd, yyyy') },
                ].map((item) => (
                  <div key={item.label} className="bg-slate-50 rounded-lg p-3">
                    <p className="text-xs text-slate-500">{item.label}</p>
                    <p className="text-sm font-mono font-medium text-slate-800 mt-0.5">{item.value}</p>
                  </div>
                ))}
              </div>
              {detailCamera.description && (
                <div>
                  <p className="text-xs text-slate-500 mb-1">Description</p>
                  <p className="text-sm text-slate-700">{detailCamera.description}</p>
                </div>
              )}
              {detailCamera.notes && (
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <p className="text-xs text-amber-600 font-medium mb-1">Notes</p>
                  <p className="text-sm text-amber-800">{detailCamera.notes}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}