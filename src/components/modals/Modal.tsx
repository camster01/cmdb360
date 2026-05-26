import { useEffect } from 'react';

interface ModalProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: string;
}

export default function Modal({ title, onClose, children, width = 'max-w-lg' }: ModalProps) {
  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`bg-white rounded-lg shadow-2xl w-full ${width} flex flex-col max-h-[90vh]`}>
        {/* Modal Header */}
        <div className="bg-blue-800 text-white px-4 py-3 flex items-center justify-between rounded-t-lg flex-shrink-0">
          <h2 className="font-semibold text-sm">{title}</h2>
          <button
            onClick={onClose}
            className="text-blue-300 hover:text-white transition-colors text-lg leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        {/* Modal Body */}
        <div className="flex-1 overflow-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );
}
