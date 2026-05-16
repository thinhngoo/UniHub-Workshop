import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '@unihub/api-client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        if (error instanceof ApiError) {
          if (error.status >= 400 && error.status < 500) return false;
        }
        return failureCount < 1;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retryDelay: 3_000,
    },
    mutations: {
      retry: false,
    },
  },
});
