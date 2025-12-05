import React, { useEffect } from 'react';
import { StorageService } from '../services/storageService';

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ children }) => {
  useEffect(() => {
    const loadTheme = async () => {
        const config = await StorageService.getConfig();
        const root = document.documentElement;
        if (config.primaryColor) root.style.setProperty('--primary', config.primaryColor);
        if (config.accentColor) root.style.setProperty('--accent', config.accentColor);
    };
    loadTheme();
  }, []);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-gray-800">
      {children}
    </div>
  );
};

export const Modal: React.FC<{
    isOpen: boolean; 
    onClose: () => void; 
    title: string; 
    children: React.ReactNode
}> = ({ isOpen, onClose, title, children }) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black bg-opacity-70 backdrop-blur-sm">
            <div className="bg-gray-800 text-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto border border-gray-700">
                <div className="flex justify-between items-center p-4 border-b border-gray-700">
                    <h3 className="text-xl font-bold text-theme-accent">{title}</h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-white">
                        <i className="fas fa-times text-xl"></i>
                    </button>
                </div>
                <div className="p-4">
                    {children}
                </div>
            </div>
        </div>
    );
};