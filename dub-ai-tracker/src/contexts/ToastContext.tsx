import { createContext, useCallback, useContext, useState } from 'react';
import { Toast, type ToastType } from '../components/common/Toast';

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    setToast({ message, type, key: Date.now() });
  }, []);

  const handleDismiss = useCallback(() => {
    setToast(null);
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          onDismiss={handleDismiss}
        />
      )}
    </ToastContext.Provider>
  );
}
