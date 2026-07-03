/**
 * Accessible button component with full screen reader support.
 * 
 * @file AccessibleButton.tsx
 * @location frontend/src/components/Accessible/AccessibleButton.tsx
 */

import React, { forwardRef, ButtonHTMLAttributes, ReactNode } from 'react';
import { ScreenReaderAnnouncer } from '../../utils/accessibility';

interface AccessibleButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  ariaLabel?: string;
  ariaDescription?: string;
  loading?: boolean;
  loadingText?: string;
  announceOnClick?: string;
  variant?: 'primary' | 'secondary' | 'danger' | 'success' | 'warning';
  size?: 'small' | 'medium' | 'large';
  fullWidth?: boolean;
}

export const AccessibleButton = forwardRef<HTMLButtonElement, AccessibleButtonProps>(
  ({
    children,
    ariaLabel,
    ariaDescription,
    loading = false,
    loadingText = 'Loading...',
    announceOnClick,
    variant = 'primary',
    size = 'medium',
    fullWidth = false,
    disabled,
    onClick,
    ...props
  }, ref) => {
    const handleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
      if (loading || disabled) return;
      
      if (announceOnClick) {
        ScreenReaderAnnouncer.announce(announceOnClick);
      }
      
      onClick?.(event);
    };

    const getVariantClasses = () => {
      const base = {
        primary: 'bg-blue-600 hover:bg-blue-700 text-white',
        secondary: 'bg-gray-600 hover:bg-gray-700 text-white',
        danger: 'bg-red-600 hover:bg-red-700 text-white',
        success: 'bg-green-600 hover:bg-green-700 text-white',
        warning: 'bg-yellow-600 hover:bg-yellow-700 text-white',
      };
      return base[variant] || base.primary;
    };

    const getSizeClasses = () => {
      const sizes = {
        small: 'px-3 py-1.5 text-sm',
        medium: 'px-4 py-2 text-base',
        large: 'px-6 py-3 text-lg',
      };
      return sizes[size] || sizes.medium;
    };

    const ariaLabelText = ariaLabel || (typeof children === 'string' ? children : undefined);

    return (
      <button
        ref={ref}
        {...props}
        onClick={handleClick}
        disabled={disabled || loading}
        aria-label={ariaLabelText}
        aria-describedby={ariaDescription}
        aria-busy={loading}
        aria-disabled={disabled || loading}
        role="button"
        className={`
          ${getVariantClasses()}
          ${getSizeClasses()}
          ${fullWidth ? 'w-full' : ''}
          rounded-lg font-medium transition-all duration-200
          focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2
          disabled:opacity-50 disabled:cursor-not-allowed
          ${loading ? 'cursor-wait' : ''}
        `}
      >
        <span className="flex items-center justify-center gap-2">
          {loading && (
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          )}
          <span>{loading ? loadingText : children}</span>
        </span>
      </button>
    );
  }
);

AccessibleButton.displayName = 'AccessibleButton';

export default AccessibleButton;