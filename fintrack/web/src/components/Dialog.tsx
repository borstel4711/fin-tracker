import { useEffect, useRef, type ReactNode } from 'react';
import MdiIcon from './MdiIcon';
import styles from './Dialog.module.css';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export default function Dialog({ open, onClose, title, children }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      <div className={styles.header}>
        <h3 className={styles.title}>{title}</h3>
        <button
          type="button"
          className="iconButton"
          aria-label="Schließen"
          onClick={onClose}
        >
          <MdiIcon name="close" />
        </button>
      </div>
      <div className={styles.content}>{children}</div>
    </dialog>
  );
}
