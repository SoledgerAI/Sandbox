import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
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

// Toast visible duration (ms) + buffer for slide-out animation.
// Provider-level safety timer ensures dismissal even if Toast's internal
// Animated callback fails to fire (Bug #7: TestFlight reports of stuck toasts).
const TOAST_SAFETY_MS = 3500;

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const safetyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearSafetyTimer = () => {
    if (safetyTimerRef.current) {
      clearTimeout(safetyTimerRef.current);
      safetyTimerRef.current = null;
    }
  };

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    clearSafetyTimer();
    setToast({ message, type, key: Date.now() });
    safetyTimerRef.current = setTimeout(() => {
      setToast(null);
      safetyTimerRef.current = null;
    }, TOAST_SAFETY_MS);
  }, []);

  const handleDismiss = useCallback(() => {
    clearSafetyTimer();
    setToast(null);
  }, []);

  useEffect(() => () => clearSafetyTimer(), []);

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
