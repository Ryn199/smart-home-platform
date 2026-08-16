import React from 'react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  title,
  message,
  confirmLabel = 'Delete',
  cancelLabel = 'Cancel',
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface border border-outline-variant rounded-2xl p-lg max-w-sm w-full shadow-xl space-y-md animate-in fade-in zoom-in-95 duration-150">
        <div className="flex items-center gap-sm">
          <div
            className={`p-2 rounded-full ${
              isDestructive
                ? 'bg-error-container/40 text-error'
                : 'bg-primary-container/20 text-primary'
            }`}
          >
            <span className="material-symbols-outlined text-[24px]">
              {isDestructive ? 'warning' : 'help'}
            </span>
          </div>
          <h3 className="font-headline-md text-headline-md text-on-surface font-semibold">
            {title}
          </h3>
        </div>

        <p className="text-sm text-on-surface-variant leading-relaxed">
          {message}
        </p>

        <div className="flex justify-end gap-sm pt-sm">
          <button
            type="button"
            onClick={onCancel}
            disabled={isLoading}
            className="px-4 py-2 border border-outline-variant rounded-xl text-sm hover:bg-surface-container-low transition-colors cursor-pointer"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isLoading}
            className={`px-4 py-2 text-sm font-semibold rounded-xl text-white shadow-sm transition-colors cursor-pointer disabled:opacity-50 ${
              isDestructive
                ? 'bg-error hover:bg-error/90'
                : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
