import * as SecureStore from 'expo-secure-store';
import React, { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Platform } from 'react-native';

import { adminLogin, adminSignOut } from '@/lib/api';
import type { AdminUser } from '@/lib/types';

const TOKEN_KEY = 'comeals.admin.token';

type AuthContextValue = {
  adminUser: AdminUser | null;
  isLoading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  token: string | null;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function readToken() {
  if (Platform.OS === 'web') {
    return typeof localStorage === 'undefined' ? null : localStorage.getItem(TOKEN_KEY);
  }

  return SecureStore.getItemAsync(TOKEN_KEY);
}

async function writeToken(value: string | null) {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') {
      return;
    }
    if (value) {
      localStorage.setItem(TOKEN_KEY, value);
    } else {
      localStorage.removeItem(TOKEN_KEY);
    }
    return;
  }

  if (value) {
    await SecureStore.setItemAsync(TOKEN_KEY, value);
  } else {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [adminUser, setAdminUser] = useState<AdminUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    readToken()
      .then((storedToken) => {
        if (mounted) {
          setToken(storedToken);
        }
      })
      .finally(() => {
        if (mounted) {
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await adminLogin(email, password);
    await writeToken(response.token);
    setToken(response.token);
    setAdminUser(response.admin_user);
  }, []);

  const signOut = useCallback(async () => {
    const currentToken = token;
    setToken(null);
    setAdminUser(null);
    await writeToken(null);

    if (currentToken) {
      try {
        await adminSignOut(currentToken);
      } catch {
        // Local sign-out is authoritative for stateless JWT sessions.
      }
    }
  }, [token]);

  const value = useMemo(
    () => ({ adminUser, isLoading, signIn, signOut, token }),
    [adminUser, isLoading, signIn, signOut, token]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);

  if (!value) {
    throw new Error('useAuth must be used inside AuthProvider');
  }

  return value;
}
