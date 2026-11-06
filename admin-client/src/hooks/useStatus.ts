import { useQuery } from '@tanstack/react-query';
import { statusApi } from '@/api/status';
import { queryKeys } from '@/lib/query-client';

export function useStatus() {
  return useQuery({ queryKey: queryKeys.status, queryFn: statusApi.get });
}
