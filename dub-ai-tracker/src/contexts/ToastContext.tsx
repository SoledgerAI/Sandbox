import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { Toast, type ToastType } from '../components/common/Toast';

interface ToastState {
  message: string;
  type: ToastType;
  key: number;
  dismissing: boolean;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

// TF-03: Provider owns both timers. Dismissal does NOT depend on the
// Animated.timing callback firing (iOS native-driver callbacks can silently
// fail when animations interact with screen transitions). Timeline:
//   0ms                              — toast mounts, slides in
//   VISIBLE_MS                       — provider sets dismissing=true, slide-out starts
//   VISIBLE_MS + EXIT_MS + buffer    — provider unmounts toast (setToast(null))
const VISIBLE_MS = 3000;
const EXIT_MS = 320; // slightly more than Toast's SLIDE_DURATION

export function useToast() {
  return useContext(ToastContext);
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const visibleTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearTimers = () => {
    if (visibleTimerRef.current) {
      clearTimeout(visibleTimerRef.current);
      visibleTimerRef.current = null;
    }
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
  };

  const startExit = useCallback(() => {
    setToast((prev) => (prev ? { ...prev, dismissing: true } : null));
    exitTimerRef.current = setTimeout(() => {
      exitTimerRef.current = null;
      setToast(null);
    }, EXIT_MS);
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    clearTimers();
    setToast({ message, type, key: Date.now(), dismissing: false });
    visibleTimerRef.current = setTimeout(() => {
      visibleTimerRef.current = null;
      startExit();
    }, VISIBLE_MS);
  }, [startExit]);

  const handleDismiss = useCallback(() => {
    if (exitTimerRef.current) return; // already exiting
    clearTimers();
    startExit();
  }, [startExit]);

  useEffect(() => () => clearTimers(), []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toast && (
        <Toast
          key={toast.key}
          message={toast.message}
          type={toast.type}
          dismissing={toast.dismissing}
          onDismiss={handleDismiss}
        />
      )}
    </ToastContext.Provider>
  );
}
