import React, { useEffect, useRef, useId } from "react";
import { createPortal } from "react-dom";
import { useFocusTrap } from "../../hooks/useFocusTrap";

export interface AccessibleModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  ariaLabel?: string;
  ariaLabelledBy?: string;
  ariaDescribedBy?: string;
  titleId?: string;
  descriptionId?: string;
  children?: React.ReactNode;
  className?: string;
  backdropClassName?: string;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

export const AccessibleModal: React.FC<AccessibleModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  ariaLabel,
  ariaLabelledBy,
  ariaDescribedBy,
  titleId,
  descriptionId,
  children,
  className = "bg-white p-6 border-4 border-black max-w-lg w-full rounded-2xl shadow-[6px_6px_0px_0px_#000000] relative",
  backdropClassName = "fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4",
  closeOnOverlayClick = true,
  closeOnEscape = true,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const generatedId = useId();
  const computedTitleId = titleId || `accessible-modal-title-${generatedId}`;
  const computedDescriptionId =
    descriptionId || `accessible-modal-desc-${generatedId}`;

  useFocusTrap(modalRef, isOpen);

  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  if (!isOpen) return null;

  const finalLabelledBy =
    ariaLabelledBy || (title ? computedTitleId : undefined);
  const finalDescribedBy =
    ariaDescribedBy || (description ? computedDescriptionId : undefined);

  return createPortal(
    <div
      className={backdropClassName}
      onClick={(e) => {
        if (closeOnOverlayClick && e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={finalLabelledBy}
        aria-describedby={finalDescribedBy}
        className={className}
      >
        {title && (
          <h2 id={computedTitleId} className="font-extrabold text-xl mb-2">
            {title}
          </h2>
        )}
        {description && (
          <p id={computedDescriptionId} className="text-sm text-gray-600 mb-4">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body,
  );
};

export default AccessibleModal;
