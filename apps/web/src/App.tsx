import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { Toaster } from 'sonner';
import { router } from './app/router';
import { queryClient } from './lib/api/query-client';
import { AuthBootstrap } from './features/auth/AuthBootstrap';

export default function App(): React.ReactElement {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthBootstrap>
        <RouterProvider router={router} />
      </AuthBootstrap>
      <Toaster richColors />
    </QueryClientProvider>
  );
}
