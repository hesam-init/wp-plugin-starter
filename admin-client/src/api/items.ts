import { z } from 'zod';
import { request } from './client';
import {
  DeleteResponseSchema,
  ItemSchema,
  type Item,
  type ItemInput,
  type ItemStatus,
} from './schemas';

export interface ItemsQuery {
  page: number;
  perPage: number;
  search?: string;
  status?: ItemStatus | '';
}

export interface Paginated<T> {
  items: T[];
  total: number;
  totalPages: number;
}

export const itemsApi = {
  list: async ({ page, perPage, search, status }: ItemsQuery): Promise<Paginated<Item>> => {
    const { data, headers } = await request(z.array(ItemSchema), {
      path: 'items',
      query: { page, per_page: perPage, search, status },
    });
    return {
      items: data,
      total: Number(headers.get('X-WP-Total') ?? data.length),
      totalPages: Number(headers.get('X-WP-TotalPages') ?? 1),
    };
  },

  get: async (id: number): Promise<Item> =>
    (await request(ItemSchema, { path: `items/${id}` })).data,

  create: async (input: ItemInput): Promise<Item> =>
    (await request(ItemSchema, { path: 'items', method: 'POST', data: input })).data,

  update: async (id: number, changes: Partial<ItemInput>): Promise<Item> =>
    (await request(ItemSchema, { path: `items/${id}`, method: 'PATCH', data: changes })).data,

  remove: async (id: number): Promise<Item> =>
    (await request(DeleteResponseSchema, { path: `items/${id}`, method: 'DELETE' })).data.previous,
};
