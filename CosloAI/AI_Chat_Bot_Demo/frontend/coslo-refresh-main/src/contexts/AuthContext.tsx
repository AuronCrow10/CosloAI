import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import {
  AuthUser,
  loginApi,
  registerApi,
  refreshTokenApi,
  logoutApi,
  getStoredAccessToken,
  getStoredRefreshToken,
  getStoredUser,
  storeAuthData,
  clearAuthData,
  loginWithGoogleApi,
  verifyMfaTotpApi,
  AuthResponse,
  MfaChallengeResponse,
} from '@/api/auth';

type LoginResult =
  | { kind: 'success' }
  | { kind: 'mfa-required'; mfaToken: string };

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<LoginResult>;
  loginWithGoogle: (idToken: string) => Promise<LoginResult>;
  loginWithMfaTotp: (mfaToken: string, code: string) => Promise<void>;
  register: (email: string, password: string, inviteToken?: string | null) => Promise<void>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthState | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
};

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(() => getStoredUser());
  const [accessToken, setAccessToken] = useState<string | null>(() => getStoredAccessToken());
  const [isLoading, setIsLoading] = useState(false);

  function handleAuthSuccess(data: AuthResponse) {
    storeAuthData(data);
    setUser(data.user);
    setAccessToken(data.accessToken);
  }

  const login = async (email: string, password: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const data = await loginApi(email, password);

      if ('accessToken' in data && 'user' in data) {
        handleAuthSuccess(data as AuthResponse);
        return { kind: 'success' };
      }

      const mfa = data as MfaChallengeResponse;
      if (mfa.mfaRequired && mfa.mfaToken) {
        return { kind: 'mfa-required', mfaToken: mfa.mfaToken };
      }

      throw new Error('Unexpected login response.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithGoogle = async (idToken: string): Promise<LoginResult> => {
    setIsLoading(true);
    try {
      const data = await loginWithGoogleApi(idToken);

      if ('accessToken' in data && 'user' in data) {
        handleAuthSuccess(data as AuthResponse);
        return { kind: 'success' };
      }

      const mfa = data as MfaChallengeResponse;
      if (mfa.mfaRequired && mfa.mfaToken) {
        return { kind: 'mfa-required', mfaToken: mfa.mfaToken };
      }

      throw new Error('Unexpected Google login response.');
    } finally {
      setIsLoading(false);
    }
  };

  const loginWithMfaTotp = async (mfaToken: string, code: string): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await verifyMfaTotpApi(mfaToken, code);
      handleAuthSuccess(data);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (
    email: string,
    password: string,
    inviteToken?: string | null
  ): Promise<void> => {
    setIsLoading(true);
    try {
      await registerApi(email, password, inviteToken);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const refreshToken = getStoredRefreshToken();
      await logoutApi(refreshToken);
    } catch {
      // ignore backend errors on logout
    } finally {
      clearAuthData();
      setUser(null);
      setAccessToken(null);
      setIsLoading(false);
    }
  };

  const refreshSession = async (): Promise<void> => {
    setIsLoading(true);
    try {
      const data = await refreshTokenApi();
      handleAuthSuccess(data);
    } catch (err) {
      clearAuthData();
      setUser(null);
      setAccessToken(null);
      throw err;
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!accessToken) {
      refreshSession().catch(() => {
        // ignore; refreshSession already cleared on failure
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        accessToken,
        isLoading,
        login,
        loginWithGoogle,
        loginWithMfaTotp,
        register,
        logout,
        refreshSession,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
