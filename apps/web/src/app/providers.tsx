import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactNode, useEffect, useState } from 'react';
import { useAuthStore } from '@/shared/stores/auth.store';
import { ToastProvider } from '@/shared/components/Toast';
import { ConfirmProvider } from '@/shared/components/Confirm';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 1000 * 60 * 5,
    },
  },
});

function AuthInitializer({ children }: { children: ReactNode }) {
  const initAuth = useAuthStore((state) => state.initAuth);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    initAuth();
    setReady(true);
  }, [initAuth]);

  if (!ready) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400 text-sm">جاري التحميل...</div>
      </div>
    );
  }

  return <>{children}</>;
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        <ConfirmProvider>
          <AuthInitializer>
            {children}
          </AuthInitializer>
        </ConfirmProvider>
      </ToastProvider>
    </QueryClientProvider>
  );
}
