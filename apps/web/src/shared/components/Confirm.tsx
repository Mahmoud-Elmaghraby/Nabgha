import { createContext, useCallback, useContext, useRef, useState, ReactNode } from 'react';

interface ConfirmOptions {
  title?: string;
  danger?: boolean;
  confirmLabel?: string;
  cancelLabel?: string;
}

type ConfirmFn = (message: string, options?: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = createContext<ConfirmFn | null>(null);

interface ConfirmState extends ConfirmOptions {
  message: string;
}

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<ConfirmState | null>(null);
  const resolverRef = useRef<((value: boolean) => void) | null>(null);

  const confirm = useCallback<ConfirmFn>((message, options) => {
    setState({ message, ...options });
    return new Promise<boolean>(resolve => {
      resolverRef.current = resolve;
    });
  }, []);

  const handle = (result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div className="fixed inset-0 z-[300] bg-black/40 flex items-center justify-center p-4" dir="rtl">
          <div className="bg-white rounded-2xl w-full max-w-sm p-5 space-y-4 shadow-xl">
            {state.title && <h2 className="text-base font-bold text-gray-900">{state.title}</h2>}
            <p className="text-sm text-gray-600">{state.message}</p>
            <div className="flex gap-2 pt-1">
              <button onClick={() => handle(true)}
                className={`flex-1 py-2.5 text-sm font-bold rounded-xl text-white transition-colors ${
                  state.danger ? 'bg-red-600 hover:bg-red-700' : 'bg-[#0E3B2E] hover:bg-[#1F6B4E]'
                }`}>
                {state.confirmLabel || 'تأكيد'}
              </button>
              <button onClick={() => handle(false)}
                className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50">
                {state.cancelLabel || 'إلغاء'}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
