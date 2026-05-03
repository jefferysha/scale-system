import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ThemeToggle } from './ThemeToggle';
import { useThemeStore } from '@/stores/theme-store';

describe('<ThemeToggle/>', () => {
  it('clicks switch theme', () => {
    render(<ThemeToggle />);
    fireEvent.click(screen.getByText('浅色'));
    expect(useThemeStore.getState().theme).toBe('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    fireEvent.click(screen.getByText('深色'));
    expect(useThemeStore.getState().theme).toBe('dark');
  });
});
