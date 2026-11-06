import { request } from './client';
import { StatusSchema, type Status } from './schemas';

export const statusApi = {
  get: async (): Promise<Status> => (await request(StatusSchema, { path: 'status' })).data,
};
