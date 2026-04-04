import { projectId, publicAnonKey } from '/utils/supabase/info';
import type { Camera, Transaction, User } from '../types';
import { getSessionToken, setSessionToken, clearSessionToken } from '../utils/session';

const BASE = `https://${projectId}.supabase.co/functions/v1/make-server-355b453c`;

/** Build request headers. Supabase requires the anon key; our app auth uses X-App-Session. */
function headers(): Record<string, string> {
  const h: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${publicAnonKey}`,
  };
  const token = getSessionToken();
  if (token) h['X-App-Session'] = token;
  return h;
}

async function handleResponse<T>(res: Response, context: string): Promise<T> {
  if (!res.ok) {
    const body = await res.text().catch(() => res.statusText);
    throw new Error(`[${context}] ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

// ─── Auth ───────────────────────────────────────────────────────────────────
export interface SafeUser {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'staff';
  department?: string;
  active: boolean;
  createdAt: string;
}

export async function login(
  email: string,
  password: string,
): Promise<{ token: string; user: SafeUser }> {
  const res = await fetch(`${BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify({ email, password }),
  });
  const data = await handleResponse<{ token: string; user: SafeUser }>(res, 'login');
  setSessionToken(data.token);
  return data;
}

export async function logout(): Promise<void> {
  const token = getSessionToken();
  if (token) {
    await fetch(`${BASE}/logout`, { method: 'POST', headers: headers() }).catch(() => {});
  }
  clearSessionToken();
}

export async function forgotPassword(
  email: string,
): Promise<{ message: string; tempPassword: string | null; userName?: string }> {
  const res = await fetch(`${BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify({ email }),
  });
  return handleResponse<{ message: string; tempPassword: string | null; userName?: string }>(
    res,
    'forgotPassword',
  );
}

export async function resetAdminPassword(): Promise<{ message: string }> {
  const res = await fetch(`${BASE}/reset-admin-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
    body: JSON.stringify({ resetKey: 'DNG-RESET-2026' }),
  });
  return handleResponse<{ message: string }>(res, 'resetAdminPassword');
}

// ─── Seed ───────────────────────────────────────────────────────────────────
export async function seed(): Promise<void> {
  // Seed is called before login so we don't include the session token
  const res = await fetch(`${BASE}/seed`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${publicAnonKey}` },
  });
  await handleResponse(res, 'seed');
}

// ─── Cameras ────────────────────────────────────────────────────────────────
export async function getCameras(): Promise<Camera[]> {
  const res = await fetch(`${BASE}/cameras`, { headers: headers() });
  return handleResponse<Camera[]>(res, 'getCameras');
}

export async function createCamera(camera: Camera): Promise<Camera> {
  const res = await fetch(`${BASE}/cameras`, {
    method: 'POST', headers: headers(), body: JSON.stringify(camera),
  });
  return handleResponse<Camera>(res, 'createCamera');
}

export async function updateCamera(id: string, updates: Partial<Camera>): Promise<Camera> {
  const res = await fetch(`${BASE}/cameras/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(updates),
  });
  return handleResponse<Camera>(res, 'updateCamera');
}

export async function deleteCamera(id: string): Promise<void> {
  const res = await fetch(`${BASE}/cameras/${encodeURIComponent(id)}`, {
    method: 'DELETE', headers: headers(),
  });
  await handleResponse(res, 'deleteCamera');
}

// ─── Transactions ────────────────────────────────────────────────────────────
export async function getTransactions(): Promise<Transaction[]> {
  const res = await fetch(`${BASE}/transactions`, { headers: headers() });
  return handleResponse<Transaction[]>(res, 'getTransactions');
}

export async function createTransaction(transaction: Transaction): Promise<Transaction> {
  const res = await fetch(`${BASE}/transactions`, {
    method: 'POST', headers: headers(), body: JSON.stringify(transaction),
  });
  return handleResponse<Transaction>(res, 'createTransaction');
}

export async function updateTransaction(
  id: string, updates: Partial<Transaction>,
): Promise<Transaction> {
  const res = await fetch(`${BASE}/transactions/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(updates),
  });
  return handleResponse<Transaction>(res, 'updateTransaction');
}

// ─── Users ───────────────────────────────────────────────────────────────────
export async function getUsers(): Promise<User[]> {
  const res = await fetch(`${BASE}/users`, { headers: headers() });
  return handleResponse<User[]>(res, 'getUsers');
}

export async function createUser(user: User): Promise<User> {
  const res = await fetch(`${BASE}/users`, {
    method: 'POST', headers: headers(), body: JSON.stringify(user),
  });
  return handleResponse<User>(res, 'createUser');
}

export async function updateUser(id: string, updates: Partial<User>): Promise<User> {
  const res = await fetch(`${BASE}/users/${encodeURIComponent(id)}`, {
    method: 'PUT', headers: headers(), body: JSON.stringify(updates),
  });
  return handleResponse<User>(res, 'updateUser');
}