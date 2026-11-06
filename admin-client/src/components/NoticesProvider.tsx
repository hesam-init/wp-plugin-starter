import { SnackbarList } from '@wordpress/components';
import { type ReactNode, useCallback, useMemo, useState } from 'react';
import { NoticesContext } from './notices-context';

let nextId = 0;

interface Snack {
  id: string;
  content: string;
}

/** Lightweight snackbar system using @wordpress/components' SnackbarList. */
export function NoticesProvider({ children }: { children: ReactNode }) {
  const [notices, setNotices] = useState<Snack[]>([]);

  const notify = useCallback((content: string) => {
    setNotices((prev) => [...prev, { id: String(++nextId), content }]);
  }, []);

  const remove = useCallback((id: string) => {
    setNotices((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const api = useMemo(() => ({ notify }), [notify]);

  return (
    <NoticesContext.Provider value={api}>
      {children}
      <div className="tw:fixed tw:start-6 tw:bottom-6 tw:z-[100000] tw:md:start-[184px]">
        <SnackbarList notices={notices} onRemove={remove} />
      </div>
    </NoticesContext.Provider>
  );
}
