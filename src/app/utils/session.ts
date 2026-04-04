/**
 * Session token utilities.
 * The token is stored independently of the user object so passwords
 * are never persisted to localStorage.
 */

const SESSION_KEY = 'dng_session_token';

export function getSessionToken(): string | null {
  try {
    return localStorage.getItem(SESSION_KEY);
  } catch {
    return null;
  }
}

export function setSessionToken(token: string): void {
  localStorage.setItem(SESSION_KEY, token);
}

export function clearSessionToken(): void {
  localStorage.removeItem(SESSION_KEY);
}
