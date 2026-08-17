import React, { useState, createContext, useContext } from 'react';
import { X, CheckCircle, AlertCircle } from 'lucide-react';

type ToastType = 'success' | 'error' | 'info';

interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

interface ToasterContextType {
  toast: (message: string, type?: ToastType) => void;
}

const ToasterContext = createContext<ToasterContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToasterContext);
  if (!context) throw new Error('useToast must be used within a Toaster');
  return context;
}

export function Toaster({ children }: { children?: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const toast = (message: string, type: ToastType = 'info') => {
    const id = Math.random().toString(36).substr(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3000);
  };

  return (
    <ToasterContext.Provider value={{ toast }}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg ${
              t.type === 'success' ? 'bg-emerald-500 text-white' :
              t.type === 'error' ? 'bg-rose-500 text-white' : 'bg-slate-800 text-white'
            }`}
          >
            {t.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
            <span className="text-sm font-medium">{t.message}</span>
            <button onClick={() => setToasts((prev) => prev.filter((toast) => toast.id !== t.id))}>
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </ToasterContext.Provider>
  );
}
