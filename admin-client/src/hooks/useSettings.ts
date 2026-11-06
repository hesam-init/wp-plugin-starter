import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { settingsApi } from '@/api/settings';
import type { Settings } from '@/api/schemas';
import { queryKeys } from '@/lib/query-client';

export function useSettings() {
  return useQuery({ queryKey: queryKeys.settings, queryFn: settingsApi.get });
}

export function useUpdateSettings() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (changes: Partial<Settings>) => settingsApi.update(changes),
    onSuccess: (settings) => {
      queryClient.setQueryData(queryKeys.settings, settings);
      // itemsPerPage affects the list.
      void queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
    },
  });
}
