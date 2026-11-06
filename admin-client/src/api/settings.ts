import { request } from './client';
import { type Settings, SettingsSchema } from './schemas';

export const settingsApi = {
  get: async (): Promise<Settings> => (await request(SettingsSchema, { path: 'settings' })).data,

  update: async (changes: Partial<Settings>): Promise<Settings> =>
    (await request(SettingsSchema, { path: 'settings', method: 'PATCH', data: changes })).data,
};
