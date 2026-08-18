import React from 'react';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { LanguageSwitcher, SUPPORTED_LOCALES } from '../components/ui/LanguageSwitcher';
import { I18nContext } from '../i18n/I18nProvider';

describe('LanguageSwitcher', () => {
  const mockSetLocale = vi.fn();

  beforeEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
  });

  const renderWithContext = (locale = 'en', isLoading = false) => {
    return render(
      <I18nContext.Provider
        value={{
          locale,
          translations: {},
          fallbackChain: ['en'],
          setLocale: mockSetLocale,
          isLoading,
        }}
      >
        <LanguageSwitcher />
      </I18nContext.Provider>
    );
  };


  it('renders the language switcher button with current locale code', () => {
    renderWithContext('en');
    const button = screen.getByRole('button', { name: /Change language/i });
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('EN');
  });

  it('opens language dropdown when button is clicked', () => {
    renderWithContext('en');
    const button = screen.getByRole('button', { name: /Change language/i });
    fireEvent.click(button);

    expect(screen.getByRole('menu', { name: /Select Language/i })).toBeInTheDocument();
    expect(screen.getByText('Español')).toBeInTheDocument();
    expect(screen.getByText('Français')).toBeInTheDocument();
    expect(screen.getByText('Deutsch')).toBeInTheDocument();
    expect(screen.getByText('हिन्दी')).toBeInTheDocument();
    expect(screen.getByText('日本語')).toBeInTheDocument();
    expect(screen.getByText('简体中文')).toBeInTheDocument();
    expect(screen.getByText('Português')).toBeInTheDocument();
    expect(screen.getByText('العربية')).toBeInTheDocument();
  });

  it('calls setLocale and closes menu when a language is selected', () => {
    renderWithContext('en');
    const button = screen.getByRole('button', { name: /Change language/i });
    fireEvent.click(button);

    const spanishOption = screen.getByText('Español');
    fireEvent.click(spanishOption);

    expect(mockSetLocale).toHaveBeenCalledWith('es');
    expect(screen.queryByRole('menu', { name: /Select Language/i })).not.toBeInTheDocument();
  });

  it('closes dropdown when Escape key is pressed', () => {
    renderWithContext('en');
    const button = screen.getByRole('button', { name: /Change language/i });
    fireEvent.click(button);

    expect(screen.getByRole('menu', { name: /Select Language/i })).toBeInTheDocument();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('menu', { name: /Select Language/i })).not.toBeInTheDocument();
  });
});
