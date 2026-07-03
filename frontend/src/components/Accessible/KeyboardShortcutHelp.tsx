/**
 * Keyboard shortcuts help modal/component.
 * 
 * @file KeyboardShortcutsHelp.tsx
 * @location frontend/src/components/Accessible/KeyboardShortcutsHelp.tsx
 */

import React, { useState } from 'react';
import { KeyboardShortcuts } from '../../utils/accessibility';

interface Shortcut {
  key: string;
  description: string;
  ctrl?: boolean;
}

interface KeyboardShortcutsHelpProps {
  shortcuts?: Shortcut[];
}

const defaultShortcuts: Shortcut[] = [
  { key: 'h', description: 'Go to Home' },
  { key: 'b', description: 'Go Back' },
  { key: '/', description: 'Focus Search' },
  { key: '?', description: 'Open Help' },
  { key: 'Enter', description: 'Submit/Confirm' },
  { key: 'Escape', description: 'Cancel/Close' },
];

export const KeyboardShortcutsHelp: React.FC<KeyboardShortcutsHelpProps> = ({
  shortcuts = defaultShortcuts,
}) => {
  const [isOpen, setIsOpen] = useState(false);

  // Register help shortcut
  React.useEffect(() => {
    KeyboardShortcuts.register('?', () => {
      setIsOpen(prev => !prev);
    });
  }, []);

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 p-3 bg-gray-800 text-white rounded-full shadow-lg hover:bg-gray-700 transition-all z-50"
        aria-label="Keyboard shortcuts help"
        title="Keyboard shortcuts (Press ?)"
      >
        <span aria-hidden="true">⌨️</span>
        <span className="sr-only">Keyboard shortcuts help</span>
      </button>
    );
  }

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
      onClick={() => setIsOpen(false)}
    >
      <div
        className="bg-white dark:bg-gray-800 rounded-lg max-w-md w-full p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-label="Keyboard shortcuts"
        aria-modal="true"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            ⌨️ Keyboard Shortcuts
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            aria-label="Close shortcuts help"
          >
            ✕
          </button>
        </div>
        
        <div className="space-y-2">
          {shortcuts.map((shortcut, index) => (
            <div
              key={index}
              className="flex justify-between items-center py-2 border-b border-gray-200 dark:border-gray-700 last:border-0"
            >
              <span className="text-gray-700 dark:text-gray-300">
                {shortcut.description}
              </span>
              <kbd className="px-3 py-1 bg-gray-200 dark:bg-gray-700 rounded text-sm font-mono text-gray-800 dark:text-gray-200">
                {shortcut.ctrl ? 'Ctrl+' : ''}
                {shortcut.key}
              </kbd>
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          Press <kbd className="px-2 py-0.5 bg-gray-200 dark:bg-gray-700 rounded font-mono">?</kbd> to toggle this help
        </div>
      </div>
    </div>
  );
};

export default KeyboardShortcutsHelp;