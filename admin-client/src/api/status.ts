import { request } from './client';
import { type Status, StatusSchema } from './schemas';

export const statusApi = {
  get: async (): Promise<Status> => (await request(StatusSchema, { path: 'status' })).data,
};
