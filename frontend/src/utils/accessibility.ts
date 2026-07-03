/**
 * Accessibility utilities for screen reader support.
 * 
 * @file accessibility.ts
 * @location frontend/src/utils/accessibility.ts
 */

// ============================================================
// ARIA Roles and Attributes
// ============================================================

export const ARIA_ROLES = {
  // Landmarks
  BANNER: 'banner',
  NAVIGATION: 'navigation',
  MAIN: 'main',
  COMPLEMENTARY: 'complementary',
  CONTENTINFO: 'contentinfo',
  SEARCH: 'search',
  
  // Widgets
  BUTTON: 'button',
  CHECKBOX: 'checkbox',
  RADIO: 'radio',
  TEXTBOX: 'textbox',
  COMBOBOX: 'combobox',
  LISTBOX: 'listbox',
  MENU: 'menu',
  MENUITEM: 'menuitem',
  TAB: 'tab',
  TABLIST: 'tablist',
  TABPANEL: 'tabpanel',
  TREE: 'tree',
  TREEGRID: 'treegrid',
  
  // Structure
  ARTICLE: 'article',
  HEADING: 'heading',
  LIST: 'list',
  LISTITEM: 'listitem',
  PRESENTATION: 'presentation',
  REGION: 'region',
  
  // Live Regions
  ALERT: 'alert',
  STATUS: 'status',
  LOG: 'log',
  MARQUEE: 'marquee',
  TIMER: 'timer',
};

// ============================================================
// Focus Management
// ============================================================

export const FocusManager = {
  /**
   * Trap focus within a container
   */
  trapFocus: (container: HTMLElement, event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;
    
    const focusableElements = container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    
    if (focusableElements.length === 0) return;
    
    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;
    
    if (event.shiftKey && document.activeElement === firstElement) {
      event.preventDefault();
      lastElement.focus();
    } else if (!event.shiftKey && document.activeElement === lastElement) {
      event.preventDefault();
      firstElement.focus();
    }
  },

  /**
   * Focus on first focusable element in container
   */
  focusFirst: (container: HTMLElement) => {
    const focusable = container.querySelector(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    ) as HTMLElement;
    if (focusable) focusable.focus();
  },

  /**
   * Restore focus to previous element
   */
  restoreFocus: (element: HTMLElement | null) => {
    if (element) element.focus();
  },

  /**
   * Get focusable elements in container
   */
  getFocusableElements: (container: HTMLElement): HTMLElement[] => {
    return Array.from(container.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )) as HTMLElement[];
  },
};

// ============================================================
// Screen Reader Announcements
// ============================================================

export const ScreenReaderAnnouncer = {
  /**
   * Create a live region for announcements
   */
  createLiveRegion: (politeness: 'polite' | 'assertive' = 'polite') => {
    const existing = document.getElementById('sr-announcer');
    if (existing) return existing;
    
    const announcer = document.createElement('div');
    announcer.id = 'sr-announcer';
    announcer.setAttribute('aria-live', politeness);
    announcer.setAttribute('aria-atomic', 'true');
    announcer.style.position = 'absolute';
    announcer.style.width = '1px';
    announcer.style.height = '1px';
    announcer.style.padding = '0';
    announcer.style.margin = '-1px';
    announcer.style.overflow = 'hidden';
    announcer.style.clip = 'rect(0, 0, 0, 0)';
    announcer.style.border = '0';
    document.body.appendChild(announcer);
    return announcer;
  },

  /**
   * Announce a message to screen readers
   */
  announce: (message: string, politeness: 'polite' | 'assertive' = 'polite') => {
    const announcer = ScreenReaderAnnouncer.createLiveRegion(politeness);
    announcer.textContent = message;
    
    // Clear after announcement
    setTimeout(() => {
      announcer.textContent = '';
    }, 1000);
  },

  /**
   * Announce page navigation
   */
  announceNavigation: (pageName: string) => {
    ScreenReaderAnnouncer.announce(`Navigated to ${pageName}`);
  },

  /**
   * Announce success message
   */
  announceSuccess: (message: string) => {
    ScreenReaderAnnouncer.announce(`✅ ${message}`, 'assertive');
  },

  /**
   * Announce error message
   */
  announceError: (message: string) => {
    ScreenReaderAnnouncer.announce(`❌ ${message}`, 'assertive');
  },

  /**
   * Announce loading state
   */
  announceLoading: (message: string = 'Loading...') => {
    ScreenReaderAnnouncer.announce(message, 'polite');
  },
};

// ============================================================
// Keyboard Shortcuts
// ============================================================

export const KeyboardShortcuts = {
  /**
   * Register keyboard shortcuts
   */
  register: (key: string, callback: (event: KeyboardEvent) => void, ctrl: boolean = false) => {
    document.addEventListener('keydown', (event) => {
      const keyMatch = event.key === key || event.key === key.toLowerCase();
      const ctrlMatch = !ctrl || event.ctrlKey || event.metaKey;
      
      if (keyMatch && ctrlMatch && !event.repeat) {
        callback(event);
      }
    });
  },

  /**
   * Common shortcuts
   */
  common: {
    // Navigation
    GO_HOME: 'h',
    GO_BACK: 'b',
    SEARCH: '/',
    
    // Actions
    SUBMIT: 'Enter',
    CANCEL: 'Escape',
    DELETE: 'Delete',
    
    // Help
    HELP: '?',
  },
};

// ============================================================
// Accessibility Helpers
// ============================================================

export const AccessibilityHelpers = {
  /**
   * Add aria-label to element
   */
  addAriaLabel: (element: HTMLElement, label: string) => {
    element.setAttribute('aria-label', label);
  },

  /**
   * Add aria-describedby to element
   */
  addAriaDescribedBy: (element: HTMLElement, descriptionId: string) => {
    element.setAttribute('aria-describedby', descriptionId);
  },

  /**
   * Add aria-expanded to element
   */
  addAriaExpanded: (element: HTMLElement, expanded: boolean) => {
    element.setAttribute('aria-expanded', String(expanded));
  },

  /**
   * Add aria-controls to element
   */
  addAriaControls: (element: HTMLElement, controlsId: string) => {
    element.setAttribute('aria-controls', controlsId);
  },

  /**
   * Add aria-current to element
   */
  addAriaCurrent: (element: HTMLElement, current: 'page' | 'step' | 'location' | 'date' | 'time') => {
    element.setAttribute('aria-current', current);
  },

  /**
   * Make element hidden from screen readers
   */
  hideFromScreenReaders: (element: HTMLElement) => {
    element.setAttribute('aria-hidden', 'true');
  },

  /**
   * Make element visible to screen readers only
   */
  visibleToScreenReadersOnly: (element: HTMLElement) => {
    element.style.position = 'absolute';
    element.style.width = '1px';
    element.style.height = '1px';
    element.style.padding = '0';
    element.style.margin = '-1px';
    element.style.overflow = 'hidden';
    element.style.clip = 'rect(0, 0, 0, 0)';
    element.style.border = '0';
  },

  /**
   * Get accessible name for element
   */
  getAccessibleName: (element: HTMLElement): string => {
    // Check for aria-label
    const ariaLabel = element.getAttribute('aria-label');
    if (ariaLabel) return ariaLabel;
    
    // Check for aria-labelledby
    const ariaLabelledBy = element.getAttribute('aria-labelledby');
    if (ariaLabelledBy) {
      const labelElement = document.getElementById(ariaLabelledBy);
      if (labelElement) return labelElement.textContent || '';
    }
    
    // Check for associated label (for inputs)
    if (element instanceof HTMLInputElement) {
      const label = document.querySelector(`label[for="${element.id}"]`);
      if (label) return label.textContent || '';
    }
    
    // Check for title
    const title = element.getAttribute('title');
    if (title) return title;
    
    // Check for text content
    return element.textContent || '';
  },

  /**
   * Create a skip link
   */
  createSkipLink: (targetId: string, label: string = 'Skip to main content') => {
    const skipLink = document.createElement('a');
    skipLink.href = `#${targetId}`;
    skipLink.textContent = label;
    skipLink.style.position = 'absolute';
    skipLink.style.top = '-9999px';
    skipLink.style.left = '-9999px';
    skipLink.style.zIndex = '9999';
    skipLink.style.background = '#000';
    skipLink.style.color = '#fff';
    skipLink.style.padding = '12px 24px';
    skipLink.style.textDecoration = 'none';
    skipLink.style.borderRadius = '4px';
    skipLink.style.fontSize = '16px';
    
    skipLink.addEventListener('focus', () => {
      skipLink.style.top = '10px';
      skipLink.style.left = '10px';
    });
    
    skipLink.addEventListener('blur', () => {
      skipLink.style.top = '-9999px';
      skipLink.style.left = '-9999px';
    });
    
    document.body.prepend(skipLink);
  },
};

// ============================================================
// React Hooks for Accessibility
// ============================================================

import { useEffect, useRef, useCallback } from 'react';

export function useAccessibleModal(isOpen: boolean) {
  const previousFocus = useRef<HTMLElement | null>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      // Save current focus
      previousFocus.current = document.activeElement as HTMLElement;
      
      // Disable body scroll
      document.body.style.overflow = 'hidden';
      
      // Focus on modal
      if (modalRef.current) {
        FocusManager.focusFirst(modalRef.current);
      }
      
      // Trap focus
      const handleKeyDown = (event: KeyboardEvent) => {
        if (modalRef.current) {
          FocusManager.trapFocus(modalRef.current, event);
        }
        if (event.key === 'Escape') {
          // Close modal callback
        }
      };
      
      document.addEventListener('keydown', handleKeyDown);
      
      return () => {
        document.removeEventListener('keydown', handleKeyDown);
      };
    } else {
      // Restore focus
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
      
      // Restore body scroll
      document.body.style.overflow = '';
    }
  }, [isOpen]);

  return modalRef;
}

export function useAriaLive(politeness: 'polite' | 'assertive' = 'polite') {
  const announcer = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!announcer.current) {
      announcer.current = ScreenReaderAnnouncer.createLiveRegion(politeness);
    }
  }, [politeness]);

  const announce = useCallback((message: string) => {
    if (announcer.current) {
      announcer.current.textContent = message;
      setTimeout(() => {
        if (announcer.current) {
          announcer.current.textContent = '';
        }
      }, 1000);
    }
  }, []);

  return announce;
}