import { useEffect, useRef, type ReactNode } from 'react';
import { t } from '../../i18n';
import { Button } from './Button';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  children: ReactNode;
  confirmLabel: string;
  danger?: boolean;
  confirmDisabled?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Azione aggiuntiva facoltativa. */
  extra?: ReactNode;
}

/** Finestra di conferma basata su <dialog>: gestisce focus ed Esc in modo nativo. */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  danger,
  confirmDisabled,
  onConfirm,
  onCancel,
  extra,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal();
      else dialog.setAttribute('open', '');
    } else if (!open && dialog.open) {
      dialog.close();
    }
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,26rem)] rounded-3xl border border-line bg-surface p-6 text-fg shadow-2xl backdrop:bg-[#060b16]/60 backdrop:backdrop-blur-sm"
    >
      {open && (
        <>
          <h2 id="confirm-title" className="font-display text-xl font-semibold">
            {title}
          </h2>
          <div className="mt-2 space-y-3 text-[0.95rem]">{children}</div>
          <div className="mt-5 flex flex-col gap-2">
            <Button variant={danger ? 'danger' : 'primary'} block disabled={confirmDisabled} onClick={onConfirm}>
              {confirmLabel}
            </Button>
            {extra}
            <Button variant="secondary" block onClick={onCancel}>
              {t.app.cancel}
            </Button>
          </div>
        </>
      )}
    </dialog>
  );
}
