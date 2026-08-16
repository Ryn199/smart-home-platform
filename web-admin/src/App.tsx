import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './features/auth/AuthContext';
import { WebSocketProvider } from './websocket/socket';
import { AppRouter } from './router/AppRouter';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 5000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <WebSocketProvider>
        <AuthProvider>
          <AppRouter />
        </AuthProvider>
      </WebSocketProvider>
    </QueryClientProvider>
  );
};
