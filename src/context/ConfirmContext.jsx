import React, { createContext, useContext, useState, useCallback } from 'react';
import ConfirmDialog from '../components/ConfirmDialog';

const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) throw new Error('useConfirm must be used within a ConfirmProvider');
  return context;
};

export const ConfirmProvider = ({ children }) => {
  const [config, setConfig] = useState(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      setConfig({
        ...options,
        isOpen: true,
        onConfirm: () => {
          setConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfig(null);
          resolve(false);
        },
      });
    });
  }, []);

  const alert = useCallback((options) => {
    return new Promise((resolve) => {
      setConfig({
        ...options,
        isOpen: true,
        cancelText: null, // This flag can be used to hide the cancel button
        onConfirm: () => {
          setConfig(null);
          resolve(true);
        },
        onCancel: () => {
          setConfig(null);
          resolve(true);
        },
      });
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm, alert }}>
      {children}
      {config && (
        <ConfirmDialog 
          {...config} 
          onCancel={config.onCancel}
          onConfirm={config.onConfirm}
        />
      )}
    </ConfirmContext.Provider>
  );
};
