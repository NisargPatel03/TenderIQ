import React, { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export interface Toast {
  id: string;
  message: string;
  type: 'success' | 'error' | 'info';
}

export interface ConfirmConfig {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel?: () => void;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

interface NotificationContextType {
  showToast: (message: string, type?: 'success' | 'error' | 'info') => void;
  showConfirm: (config: ConfirmConfig) => void;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotification = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
};

interface NotificationProviderProps {
  children: ReactNode;
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
    confirmText?: string;
    cancelText?: string;
    isDanger?: boolean;
  } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const showConfirm = (config: ConfirmConfig) => {
    setConfirmState({
      isOpen: true,
      title: config.title,
      message: config.message,
      confirmText: config.confirmText || 'Confirm',
      cancelText: config.cancelText || 'Cancel',
      isDanger: config.isDanger || false,
      onConfirm: () => {
        config.onConfirm();
        setConfirmState(null);
      },
      onCancel: () => {
        if (config.onCancel) config.onCancel();
        setConfirmState(null);
      },
    });
  };

  return (
    <NotificationContext.Provider value={{ showToast, showConfirm }}>
      {children}

      {/* Toast Banners Wrapper */}
      <div className="toast-container">
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onClose={(id) => setToasts((prev) => prev.filter((t) => t.id !== id))} />
        ))}
      </div>

      {/* Confirmation Modal */}
      {confirmState?.isOpen && (
        <div className="confirm-modal-overlay">
          <div className={`confirm-modal-card ${confirmState.isDanger ? 'modal-danger' : ''}`}>
            <div className="confirm-modal-header">
              <h3>{confirmState.title}</h3>
              <button className="confirm-modal-close" onClick={confirmState.onCancel}>
                <X size={16} />
              </button>
            </div>
            <div className="confirm-modal-body">
              <p>{confirmState.message}</p>
            </div>
            <div className="confirm-modal-footer">
              <button className="btn" onClick={confirmState.onCancel}>
                {confirmState.cancelText}
              </button>
              <button 
                className={`btn ${confirmState.isDanger ? 'btn-danger' : 'btn-primary'}`} 
                onClick={confirmState.onConfirm}
              >
                {confirmState.confirmText}
              </button>
            </div>
          </div>
        </div>
      )}
    </NotificationContext.Provider>
  );
};

// Sub-component for individual toast item timer auto-destruction
const ToastItem: React.FC<{ toast: Toast; onClose: (id: string) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose(toast.id);
    }, 4000);
    return () => clearTimeout(timer);
  }, [toast.id, onClose]);

  const getIcon = () => {
    switch (toast.type) {
      case 'success':
        return <CheckCircle2 size={16} style={{ color: 'var(--primary)' }} />;
      case 'error':
        return <AlertCircle size={16} style={{ color: 'var(--accent-red)' }} />;
      case 'info':
      default:
        return <Info size={16} style={{ color: 'var(--secondary)' }} />;
    }
  };

  return (
    <div className={`toast-item toast-${toast.type}`}>
      {getIcon()}
      <span className="toast-message">{toast.message}</span>
      <button className="toast-close-btn" onClick={() => onClose(toast.id)}>
        <X size={14} />
      </button>
    </div>
  );
};
