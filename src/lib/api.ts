import type {
  BalanceSide,
  LoginResponse,
  ReconciliationDetail,
  ReconciliationsResponse,
} from '@/lib/types';

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_BASE_URL || 'http://localhost:3000';

type ApiRequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.token) {
    headers.Authorization = `Bearer ${options.token}`;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    throw new ApiError(data?.message || `Request failed (${response.status})`, response.status);
  }

  return data as T;
}

export function adminLogin(email: string, password: string) {
  return apiRequest<LoginResponse>('/api/v1/admin/session', {
    method: 'POST',
    body: { email, password },
  });
}

export function adminSignOut(token: string) {
  return apiRequest<{ message: string }>('/api/v1/admin/session', {
    method: 'DELETE',
    token,
  });
}

export function getReconciliations(token: string) {
  return apiRequest<ReconciliationsResponse>('/api/v1/admin/reconciliations', { token });
}

export function getReconciliation(token: string, reconciliationId: number) {
  return apiRequest<ReconciliationDetail>(`/api/v1/admin/reconciliations/${reconciliationId}`, {
    token,
  });
}

export function updateBalancePaid(
  token: string,
  reconciliationId: number,
  balanceId: number,
  paid: boolean
) {
  return apiRequest<ReconciliationDetail>(
    `/api/v1/admin/reconciliations/${reconciliationId}/balances/${balanceId}`,
    {
      method: 'PATCH',
      token,
      body: { paid },
    }
  );
}

export function updateUnitBalancesPaid(
  token: string,
  reconciliationId: number,
  unitId: number,
  side: BalanceSide,
  paid: boolean
) {
  return apiRequest<ReconciliationDetail>(
    `/api/v1/admin/reconciliations/${reconciliationId}/units/${unitId}/balances`,
    {
      method: 'PATCH',
      token,
      body: { paid, side },
    }
  );
}
