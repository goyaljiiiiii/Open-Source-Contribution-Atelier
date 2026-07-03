/**
 * Accessible input component with full screen reader support.
 * 
 * @file AccessibleInput.tsx
 * @location frontend/src/components/Accessible/AccessibleInput.tsx
 */

import React, { forwardRef, InputHTMLAttributes, ReactNode, useState } from 'react';
import { ScreenReaderAnnouncer } from '../../utils/accessibility';

interface AccessibleInputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  hint?: string;
  required?: boolean;
  iconLeft?: ReactNode;
  iconRight?: ReactNode;
  announceChanges?: boolean;
}

export const AccessibleInput = forwardRef<HTMLInputElement, AccessibleInputProps>(
  ({
    label,
    error,
    hint,
    required = false,
    iconLeft,
    iconRight,
    announceChanges = false,
    id,
    type = 'text',
    value,
    onChange,
    onFocus,
    onBlur,
    className = '',
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const [hasValue, setHasValue] = useState(!!value);
    const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;

    const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
      const newValue = event.target.value;
      setHasValue(!!newValue);
      
      if (announceChanges) {
        ScreenReaderAnnouncer.announce(`Value changed to ${newValue || 'empty'}`);
      }
      
      onChange?.(event);
    };

    const handleFocus = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(true);
      onFocus?.(event);
    };

    const handleBlur = (event: React.FocusEvent<HTMLInputElement>) => {
      setIsFocused(false);
      onBlur?.(event);
    };

    return (
      <div className="w-full">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
          >
            {label}
            {required && (
              <span className="text-red-500 ml-1" aria-hidden="true">*</span>
            )}
            {required && (
              <span className="sr-only">required</span>
            )}
          </label>
        )}
        
        <div className="relative">
          {iconLeft && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <span className="text-gray-400">{iconLeft}</span>
            </div>
          )}
          
          <input
            ref={ref}
            id={inputId}
            type={type}
            value={value}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            aria-invalid={!!error}
            aria-describedby={`
              ${error ? errorId : ''}
              ${hint ? hintId : ''}
            `}
            aria-required={required}
            aria-label={!label ? props.placeholder || 'Input' : undefined}
            className={`
              w-full rounded-lg border
              ${error ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'}
              ${isFocused ? 'ring-2 ring-blue-500 border-blue-500' : ''}
              ${iconLeft ? 'pl-10' : 'pl-4'}
              ${iconRight ? 'pr-10' : 'pr-4'}
              py-2 bg-white dark:bg-gray-800 text-gray-900 dark:text-white
              focus:outline-none transition-all duration-200
              disabled:opacity-50 disabled:cursor-not-allowed
              ${className}
            `}
            {...props}
          />
          
          {iconRight && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
              <span className="text-gray-400">{iconRight}</span>
            </div>
          )}
        </div>
        
        {hint && !error && (
          <p id={hintId} className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            {hint}
          </p>
        )}
        
        {error && (
          <div
            id={errorId}
            role="alert"
            aria-live="polite"
            className="mt-1 text-sm text-red-600 dark:text-red-400 flex items-center gap-1"
          >
            <span aria-hidden="true">⚠️</span>
            {error}
          </div>
        )}
      </div>
    );
  }
);

AccessibleInput.displayName = 'AccessibleInput';

export default AccessibleInput;