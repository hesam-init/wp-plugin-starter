import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { itemsApi, type ItemsQuery } from '@/api/items';
import type { ItemInput } from '@/api/schemas';
import { queryKeys } from '@/lib/query-client';

export function useItems(query: ItemsQuery) {
  return useQuery({
    queryKey: queryKeys.items.list(query),
    queryFn: () => itemsApi.list(query),
    placeholderData: keepPreviousData, // no flicker while paginating
  });
}

export function useCreateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: ItemInput) => itemsApi.create(input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
  });
}

export function useUpdateItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, changes }: { id: number; changes: Partial<ItemInput> }) =>
      itemsApi.update(id, changes),
    onSuccess: (item) => {
      queryClient.setQueryData(queryKeys.items.detail(item.id), item);
      return queryClient.invalidateQueries({ queryKey: queryKeys.items.all });
    },
  });
}

export function useDeleteItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => itemsApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.items.all }),
  });
}
