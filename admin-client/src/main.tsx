// Must be first: enables React Fast Refresh when WordPress (not Vite) serves the HTML.
import '@vitejs/plugin-react/preamble';
// Locale setup (zod messages, Intl formatters) before anything validates or renders.
import '@/lib/i18n';

import { QueryClientProvider } from '@tanstack/react-query';
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from '@/App';
import { Devtools } from '@/components/Devtools';
import { NoticesProvider } from '@/components/NoticesProvider';
import { loadComponentStyles } from '@/lib/component-styles';
import { ROOT_ID } from '@/lib/config';
import { queryClient } from '@/lib/query-client';
import './styles.css';

const container = document.getElementById(ROOT_ID);

if (container) {
  void loadComponentStyles().then(() => {
    createRoot(container).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <NoticesProvider>
            <App />
          </NoticesProvider>
          <Devtools />
        </QueryClientProvider>
      </StrictMode>,
    );
  });
}
