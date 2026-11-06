import { lazy, Suspense } from 'react';

// Code-split and only loaded in development; tree-shaken from production builds.
const ReactQueryDevtools = import.meta.env.DEV
  ? lazy(() =>
      import('@tanstack/react-query-devtools').then((m) => ({ default: m.ReactQueryDevtools })),
    )
  : () => null;

export function Devtools() {
  return (
    <Suspense>
      <ReactQueryDevtools buttonPosition="bottom-right" />
    </Suspense>
  );
}
