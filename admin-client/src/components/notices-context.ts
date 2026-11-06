import { createContext, useContext } from 'react';

export interface NoticesApi {
  /** Show a transient snackbar message. */
  notify: (message: string) => void;
}

export const NoticesContext = createContext<NoticesApi | null>(null);

export function useNotices(): NoticesApi {
  const ctx = useContext(NoticesContext);
  if (!ctx) throw new Error('useNotices must be used inside <NoticesProvider>');
  return ctx;
}
