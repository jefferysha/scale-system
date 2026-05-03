import { afterEach, describe, expect, it } from 'vitest';
import { useThemeStore } from './theme-store';

describe('theme-store', () => {
  afterEach(() => {
    useThemeStore.getState().setTheme('dark');
    localStorage.clear();
  });

  it('defaults to dark', () => {
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('toggle switches theme', () => {
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('light');
    useThemeStore.getState().toggle();
    expect(useThemeStore.getState().theme).toBe('dark');
  });

  it('setTheme writes data-theme attr', () => {
    useThemeStore.getState().setTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
  });
});
