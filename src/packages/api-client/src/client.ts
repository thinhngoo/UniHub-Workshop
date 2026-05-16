import axios, {
  AxiosError,
  AxiosInstance,
  AxiosRequestConfig,
} from 'axios';
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

export function createApiClient(options: CreateApiClientOptions): AxiosInstance {
  const {
    baseURL,
    withCredentials,
    onUnauthorized,
    defaultHeaders,
    refreshAccessToken,
  } = options;

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
        const body = error.response.data;
        const apiError = new ApiError(error.response.status, {
          code: body.code ?? 'unknown_error',
          message: body.message ?? error.message,
          details: body.details,
        });
        return Promise.reject(apiError);
      }
      return Promise.reject(error);
    },
  );

  return instance;
}
