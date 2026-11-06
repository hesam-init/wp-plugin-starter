import { QueryClient } from '@tanstack/react-query';
import type { ItemsQuery } from '@/api/items';
import { ApiError } from '@/api/client';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      // Don't retry client errors (403, 404, 400 …).
      retry: (failureCount, error) =>
        !(error instanceof ApiError && error.status >= 400 && error.status < 500) &&
        failureCount < 2,
    },
  },
});

/** Central query-key factory — keeps invalidation consistent. */
export const queryKeys = {
  settings: ['settings'] as const,
  items: {
    all: ['items'] as const,
    list: (query: ItemsQuery) => ['items', 'list', query] as const,
    detail: (id: number) => ['items', 'detail', id] as const,
  },
};
