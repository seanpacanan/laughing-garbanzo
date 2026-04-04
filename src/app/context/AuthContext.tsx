import React, { createContext, useContext, useState, useEffect } from 'react';
import * as api from '../services/api';
import type { SafeUser } from '../services/api';
import { clearSessionToken, getSessionToken, setSessionToken } from '../utils/session';

// Re-export so pages can use the type
export type { SafeUser };

interface AuthContextType {
  currentUser: SafeUser | null;
  /** Returns an error string on failure, null on success. */
  login: (email: string, password: string) => Promise<string | null>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

const USER_KEY = 'dng_equipment_user';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<SafeUser | null>(() => {
    try {
      const stored = localStorage.getItem(USER_KEY);
      if (!stored) return null;
      const parsed = JSON.parse(stored);
      // Strip password hash if an old entry slipped through
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { password: _pw, ...safe } = parsed;
      return safe as SafeUser;
    } catch {
      return null;
    }
  });

  // Persist safe user (no password) to localStorage
  useEffect(() => {
    if (currentUser) {
      localStorage.setItem(USER_KEY, JSON.stringify(currentUser));
    } else {
      localStorage.removeItem(USER_KEY);
    }
  }, [currentUser]);

  const login = async (email: string, password: string): Promise<string | null> => {
    try {
      const { token, user } = await api.login(email, password);
      setSessionToken(token);
      setCurrentUser(user);        // user has NO password field
      return null;                 // success
    } catch (e: any) {
      const msg: string = e?.message ?? 'Login failed';
      // Expose a generic message for 401 to avoid leaking info
      if (msg.includes('401')) return 'Invalid email or password. Please try again.';
      if (msg.includes('403')) return 'Your account is deactivated. Contact an administrator.';
      return 'Login failed. Please try again later.';
    }
  };

  const logout = async (): Promise<void> => {
    await api.logout();        // invalidates session on the server
    clearSessionToken();
    setCurrentUser(null);
  };

  return (
    <AuthContext.Provider value={{ currentUser, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
