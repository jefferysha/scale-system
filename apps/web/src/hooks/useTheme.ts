import { useThemeStore } from '@/stores/theme-store';

export const useTheme = (): {
  theme: 'dark' | 'light';
  toggle: () => void;
  setTheme: (t: 'dark' | 'light') => void;
} => {
  const { theme, toggle, setTheme } = useThemeStore();
  return { theme, toggle, setTheme };
};
