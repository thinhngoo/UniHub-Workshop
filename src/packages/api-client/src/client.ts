import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import type { ApiErrorBody } from '@unihub/types';

export interface CreateApiClientOptions {
  baseURL: string;
  withCredentials?: boolean;
  onUnauthorized?: () => void;
  defaultHeaders?: Record<string, string>;
  refreshAccessToken?: () => Promise<void>;
}

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: Record<string, unknown>;

  constructor(status: number, body: ApiErrorBody) {
    super(body.message);
    this.name = 'ApiError';
    this.status = status;
    this.code = body.code;
    this.details = body.details;
  }
}

function pickMessage(raw: unknown, fallback: string): string {
  if (typeof raw === 'string') {
    const t = raw.trim();
    if (t.length > 0) return t;
    return fallback;
  }
  if (Array.isArray(raw)) {
    const s = raw
      .map(String)
      .join(' ')
      .trim();
    if (s.length > 0) return s;
    return fallback;
  }
  return fallback;
}

function apiErrorBodyFromResponse(data: unknown, fallbackMessage: string): ApiErrorBody {
  if (!data || typeof data !== 'object') {
    return { code: 'unknown_error', message: fallbackMessage };
  }
  const raw = data as Record<string, unknown>;
  const code = typeof raw.code === 'string' ? raw.code : 'unknown_error';
  const message = pickMessage(raw.message, fallbackMessage);

  const merged: Record<string, unknown> = {};
  const nested = raw.details;
  if (typeof nested === 'object' && nested !== null && !Array.isArray(nested)) {
    Object.assign(merged, nested as Record<string, unknown>);
  }

  const reserved = new Set(['code', 'message', 'details', 'statusCode', 'error']);
  for (const [k, v] of Object.entries(raw)) {
    if (reserved.has(k)) continue;
    if (!(k in merged)) merged[k] = v;
  }

  return {
    code,
    message,
    details: Object.keys(merged).length ? merged : undefined,
  };
}

export function createApiClient(options: CreateApiClientOptions): AxiosInstance {
  const { baseURL, withCredentials, onUnauthorized, defaultHeaders, refreshAccessToken } = options;

  const instance = axios.create({
    baseURL,
    timeout: 15_000,
    withCredentials: withCredentials ?? false,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...defaultHeaders,
    },
  });

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError<ApiErrorBody>) => {
      const original = error.config as (AxiosRequestConfig & { __retried?: boolean }) | undefined;

      if (error.response?.status === 401 && original && !original.__retried) {
        if (refreshAccessToken) {
          try {
            await refreshAccessToken();
            original.__retried = true;
            // Retry once. Any request interceptor registered by the caller
            // will re-read updated tokens (header / cookie) before sending.
            return instance.request(original);
          } catch {
            // Refresh failed — fall through to the unauthorized handler.
          }
        }
        onUnauthorized?.();
      }

      if (error.response?.data) {
        const status = error.response.status;
        const body = apiErrorBodyFromResponse(error.response.data, error.message);
        const apiError = new ApiError(status, body);
        return Promise.reject(apiError);
      }
      return Promise.reject(error);
    },
  );

  return instance;
}
