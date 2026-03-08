import { handleJsonResponse } from './client';

const AUTH_BASE_URL = '/auth';

export interface AuthUser {
  id: string;
  email: string;
  role: 'ADMIN' | 'CLIENT' | 'REFERRER' | 'TEAM_MEMBER';
  emailVerified: boolean;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export interface MfaChallengeResponse {
  mfaRequired: true;
  mfaToken: string;
}

export interface VerifyEmailResponse {
  success?: boolean;
  message?: string;
}

const USER_KEY = 'authUser';

let memoryAccessToken: string | null = null;

export function getStoredAccessToken(): string | null {
  return memoryAccessToken;
}

export function getStoredRefreshToken(): string | null {
  return null;
}

export function getStoredUser(): AuthUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function storeAuthData(data: AuthResponse): void {
  memoryAccessToken = data.accessToken;
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
}

export function clearAuthData(): void {
  memoryAccessToken = null;
  localStorage.removeItem(USER_KEY);
}

export async function registerApi(
  email: string,
  password: string,
  inviteToken?: string | null
): Promise<void> {
  const res = await fetch(`${AUTH_BASE_URL}/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password, inviteToken: inviteToken || undefined }),
  });
  await handleJsonResponse<unknown>(res);
}

export async function loginApi(
  email: string,
  password: string
): Promise<AuthResponse | MfaChallengeResponse> {
  const res = await fetch(`${AUTH_BASE_URL}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, password }),
  });
  return handleJsonResponse<AuthResponse | MfaChallengeResponse>(res);
}

export async function verifyEmailApi(token: string): Promise<VerifyEmailResponse> {
  const res = await fetch(`${AUTH_BASE_URL}/verify-email`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ token }),
  });
  return handleJsonResponse<VerifyEmailResponse>(res);
}

export async function lookupInviteEmail(token: string): Promise<{ email: string }> {
  const res = await fetch(`${AUTH_BASE_URL}/invite?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    credentials: 'include',
  });
  return handleJsonResponse<{ email: string }>(res);
}

export async function refreshTokenApi(refreshToken?: string | null): Promise<AuthResponse> {
  const body = refreshToken ? JSON.stringify({ refreshToken }) : undefined;
  const res = await fetch(`${AUTH_BASE_URL}/refresh`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body,
  });
  return handleJsonResponse<AuthResponse>(res);
}

export async function logoutApi(refreshToken: string | null): Promise<void> {
  const body = refreshToken ? JSON.stringify({ refreshToken }) : undefined;
  const res = await fetch(`${AUTH_BASE_URL}/logout`, {
    method: 'POST',
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    credentials: 'include',
    body,
  });
  await handleJsonResponse<unknown>(res);
}

export async function loginWithGoogleApi(
  idToken: string
): Promise<AuthResponse | MfaChallengeResponse> {
  const res = await fetch(`${AUTH_BASE_URL}/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ idToken }),
  });
  return handleJsonResponse<AuthResponse | MfaChallengeResponse>(res);
}

export async function verifyMfaTotpApi(mfaToken: string, code: string): Promise<AuthResponse> {
  const res = await fetch(`${AUTH_BASE_URL}/mfa/totp/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ mfaToken, code }),
  });
  return handleJsonResponse<AuthResponse>(res);
}

export async function forgotPasswordApi(email: string): Promise<{ message?: string }> {
  const res = await fetch(`${AUTH_BASE_URL}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email }),
  });
  return handleJsonResponse<{ message?: string }>(res);
}

export async function resetPasswordApi(
  email: string,
  code: string,
  newPassword: string
): Promise<{ message?: string }> {
  const res = await fetch(`${AUTH_BASE_URL}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    body: JSON.stringify({ email, code, newPassword }),
  });
  return handleJsonResponse<{ message?: string }>(res);
}
