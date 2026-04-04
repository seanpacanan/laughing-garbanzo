import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router';
import {
  Camera, Eye, EyeOff, Lock, Mail, AlertCircle,
  KeyRound, ArrowLeft, CheckCircle2, Copy, RefreshCw, X, ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import * as api from '../services/api';

// ─── Types ────────────────────────────────────────────────────────────────────
type ModalView = 'forgot' | 'reset-admin';

// ─── Forgot Password Modal ────────────────────────────────────────────────────
function ForgotPasswordModal({ onClose }: { onClose: () => void }) {
  const [view, setView] = useState<'form' | 'success' | 'admin-confirm' | 'admin-success' | 'admin-error'>('form');
  const [activeTab, setActiveTab] = useState<'user' | 'admin'>('user');

  // User forgot-password state
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tempPassword, setTempPassword] = useState<string | null>(null);
  const [userName, setUserName] = useState('');
  const [copied, setCopied] = useState(false);

  // Admin reset state
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState('');

  // ── User forgot-password submit ──
  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const result = await api.forgotPassword(email);
      setTempPassword(result.tempPassword);
      setUserName(result.userName ?? '');
      setView('success');
    } catch (err: any) {
      setError('Failed to process your request. Please try again.');
      console.error('Forgot password error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (tempPassword) {
      navigator.clipboard.writeText(tempPassword).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    }
  };

  // ── Admin reset submit ──
  const handleAdminReset = async () => {
    setAdminLoading(true);
    setAdminError('');
    try {
      await api.resetAdminPassword();
      setView('admin-success');
    } catch (err: any) {
      setAdminError('Reset failed. Please try again.');
      console.error('Admin reset error:', err);
      setView('admin-error');
    } finally {
      setAdminLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md relative overflow-hidden">

        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors z-10"
        >
          <X className="w-5 h-5" />
        </button>

        {/* ── SUCCESS: Temp password revealed ── */}
        {view === 'success' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-slate-800 text-xl font-bold mb-1">Temporary Password Ready</h2>
            {tempPassword ? (
              <>
                <p className="text-slate-500 text-sm mb-6">
                  Hi <span className="font-medium text-slate-700">{userName}</span>! Use the temporary
                  password below to sign in, then change it immediately.
                </p>
                <div className="bg-slate-50 border-2 border-dashed border-slate-200 rounded-xl p-4 mb-4">
                  <p className="text-xs text-slate-400 mb-1 uppercase tracking-wide font-medium">Temporary Password</p>
                  <p className="text-2xl font-mono font-bold text-blue-700 tracking-widest break-all">{tempPassword}</p>
                </div>
                <button
                  onClick={handleCopy}
                  className={`w-full flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all mb-3 ${
                    copied
                      ? 'bg-green-100 text-green-700 border border-green-200'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200'
                  }`}
                >
                  <Copy className="w-4 h-4" />
                  {copied ? 'Copied!' : 'Copy to Clipboard'}
                </button>
                <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                  ⚠️ This password is shown only once. Please copy and save it now.
                </p>
              </>
            ) : (
              <p className="text-slate-500 text-sm mt-2">
                If your email is registered and your account is active, a temporary password has been
                generated. Please contact your system administrator to retrieve it.
              </p>
            )}
            <button
              onClick={onClose}
              className="mt-6 w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        )}

        {/* ── ADMIN RESET SUCCESS ── */}
        {view === 'admin-success' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-7 h-7 text-green-600" />
            </div>
            <h2 className="text-slate-800 text-xl font-bold mb-1">Admin Password Reset!</h2>
            <p className="text-slate-500 text-sm mb-6">
              The admin account password has been successfully reset to the default.
            </p>
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6 text-left">
              <p className="text-xs text-blue-500 font-medium mb-2 uppercase tracking-wide">Default Admin Credentials</p>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm text-slate-700 font-mono">admin@cameralab.edu</span>
                </div>
                <div className="flex items-center gap-2">
                  <Lock className="w-3.5 h-3.5 text-blue-400" />
                  <span className="text-sm text-slate-700 font-mono">admin123</span>
                </div>
              </div>
            </div>
            <button
              onClick={onClose}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Go to Sign In
            </button>
          </div>
        )}

        {/* ── ADMIN RESET ERROR ── */}
        {view === 'admin-error' && (
          <div className="p-8 text-center">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="w-7 h-7 text-red-600" />
            </div>
            <h2 className="text-slate-800 text-xl font-bold mb-1">Reset Failed</h2>
            <p className="text-slate-500 text-sm mb-6">{adminError || 'Something went wrong. Please try again.'}</p>
            <button
              onClick={() => { setView('form'); setActiveTab('admin'); setAdminError(''); }}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors"
            >
              Try Again
            </button>
          </div>
        )}

        {/* ── MAIN FORM ── */}
        {view === 'form' && (
          <>
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-800 to-blue-900 px-8 pt-8 pb-6">
              <div className="flex items-center gap-3 mb-1">
                <div className="w-10 h-10 bg-blue-600/30 rounded-xl flex items-center justify-center">
                  <KeyRound className="w-5 h-5 text-blue-300" />
                </div>
                <div>
                  <h2 className="text-white text-lg font-bold">Account Recovery</h2>
                  <p className="text-slate-400 text-xs">DNG Equipment Monitoring</p>
                </div>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-slate-200">
              <button
                onClick={() => { setActiveTab('user'); setError(''); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors ${
                  activeTab === 'user'
                    ? 'text-blue-600 border-b-2 border-blue-600 bg-blue-50/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                Forgot Password
              </button>
              <button
                onClick={() => { setActiveTab('admin'); setError(''); }}
                className={`flex-1 py-3 text-sm font-medium transition-colors flex items-center justify-center gap-1.5 ${
                  activeTab === 'admin'
                    ? 'text-red-600 border-b-2 border-red-500 bg-red-50/50'
                    : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                }`}
              >
                <ShieldAlert className="w-3.5 h-3.5" />
                Admin Recovery
              </button>
            </div>

            <div className="p-8">
              {/* ── TAB: Forgot Password (for any user) ── */}
              {activeTab === 'user' && (
                <>
                  <p className="text-slate-500 text-sm mb-5">
                    Enter your registered email address and we'll generate a temporary password for you.
                  </p>
                  {error && (
                    <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                      <AlertCircle className="w-4 h-4 flex-shrink-0" />
                      {error}
                    </div>
                  )}
                  <form onSubmit={handleForgotSubmit} className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email Address
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                        <input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="your@email.edu"
                          required
                          autoComplete="email"
                          className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                        />
                      </div>
                    </div>
                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                    >
                      {loading ? (
                        <>
                          <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                          </svg>
                          Generating…
                        </>
                      ) : (
                        'Generate Temporary Password'
                      )}
                    </button>
                  </form>
                  <div className="mt-4 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
                    <p className="text-xs text-amber-700">
                      <strong>Note:</strong> Since this system has no email server, the temporary
                      password will be shown on screen. Please note it down immediately.
                    </p>
                  </div>
                </>
              )}

              {/* ── TAB: Admin Recovery ── */}
              {activeTab === 'admin' && (
                <>
                  <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-5">
                    <div className="flex gap-3">
                      <ShieldAlert className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-sm font-semibold text-red-800 mb-1">Admin Password Reset</p>
                        <p className="text-xs text-red-600 leading-relaxed">
                          This will reset the <strong>Admin User</strong> account
                          (<code className="bg-red-100 px-1 rounded">admin@cameralab.edu</code>) password
                          back to the default: <code className="bg-red-100 px-1 rounded">admin123</code>.
                          Use this only if you are locked out.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 mb-5">
                    <p className="text-xs text-slate-500 font-medium mb-3 uppercase tracking-wide">After reset, credentials will be:</p>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Mail className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700 font-mono">admin@cameralab.edu</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Lock className="w-3.5 h-3.5 text-slate-400" />
                        <span className="text-sm text-slate-700 font-mono">admin123</span>
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={handleAdminReset}
                    disabled={adminLoading}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {adminLoading ? (
                      <>
                        <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Resetting…
                      </>
                    ) : (
                      <>
                        <RefreshCw className="w-4 h-4" />
                        Reset Admin to Default Password
                      </>
                    )}
                  </button>
                </>
              )}

              {/* Back to login */}
              <button
                onClick={onClose}
                className="mt-4 w-full flex items-center justify-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 transition-colors py-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Sign In
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ─── Main Login Page ──────────────────────────────────────────────────────────
export default function Login() {
  const { login, currentUser } = useAuth();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [seeding, setSeeding] = useState(true);
  const [showForgot, setShowForgot] = useState(false);

  // Seed initial data on the login page (before any auth is required)
  useEffect(() => {
    api.seed()
      .catch((e) => console.log('Seed error (non-fatal):', e))
      .finally(() => setSeeding(false));
  }, []);

  // Redirect if already logged in
  useEffect(() => {
    if (currentUser) navigate('/');
  }, [currentUser, navigate]);

  if (currentUser) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const errorMsg = await login(email, password);
    if (!errorMsg) {
      navigate('/');
    } else {
      setError(errorMsg);
    }
    setLoading(false);
  };

  return (
    <>
      {showForgot && <ForgotPasswordModal onClose={() => setShowForgot(false)} />}

      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-blue-900 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg">
              <Camera className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-white text-2xl font-bold">DNG Equipment Monitoring</h1>
            <p className="text-slate-400 text-sm mt-1">Inventory Management System</p>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl shadow-2xl p-8">
            <h2 className="text-slate-800 text-xl font-semibold mb-1">Welcome back</h2>
            <p className="text-slate-500 text-sm mb-6">Sign in to your account to continue</p>

            {error && (
              <div className="mb-4 flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-3 rounded-lg">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="your@email.edu"
                    required
                    autoComplete="email"
                    className="w-full pl-10 pr-4 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-sm font-medium text-slate-700">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-xs text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                    autoComplete="current-password"
                    className="w-full pl-10 pr-10 py-2.5 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading || seeding}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
              >
                {(loading || seeding) ? (
                  <>
                    <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    {seeding ? 'Initializing…' : 'Signing in…'}
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            {/* Demo Credentials */}
            <div className="mt-6 pt-6 border-t border-slate-100">
              <p className="text-xs text-slate-500 mb-3 font-medium">Demo Credentials</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => { setEmail('admin@cameralab.edu'); setPassword('admin123'); }}
                  className="text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <p className="text-xs font-medium text-slate-700">Admin</p>
                  <p className="text-xs text-slate-400">admin@cameralab.edu</p>
                  <p className="text-xs text-slate-400">admin123</p>
                </button>
                <button
                  onClick={() => { setEmail('maria@cameralab.edu'); setPassword('staff123'); }}
                  className="text-left px-3 py-2 bg-slate-50 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <p className="text-xs font-medium text-slate-700">Staff</p>
                  <p className="text-xs text-slate-400">maria@cameralab.edu</p>
                  <p className="text-xs text-slate-400">staff123</p>
                </button>
              </div>
            </div>
          </div>

          <p className="text-center text-slate-500 text-xs mt-6">
            Camera Equipment Room · School Media Laboratory
          </p>
        </div>
      </div>
    </>
  );
}
