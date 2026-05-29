import type { ApiResponse } from '../types';

const BASE = '/api';

function getToken(): string | null {
  return localStorage.getItem('token');
}

async function request<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(`${BASE}${path}`, options);
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: `HTTP ${res.status}` }));
      return { success: false, error: err.error ?? `请求失败 (${res.status})` };
    }
    return res.json();
  } catch {
    return { success: false, error: '网络连接失败，请确认后端服务已启动' };
  }
}

async function authRequest<T>(path: string, options?: RequestInit): Promise<ApiResponse<T>> {
  const token = getToken();
  return request<T>(path, {
    ...options,
    headers: {
      ...options?.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
}

export { request, authRequest };
