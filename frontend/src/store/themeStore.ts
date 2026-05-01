import { create } from 'zustand';

interface ThemeStore {
  isDark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

const savedTheme = localStorage.getItem('ims_theme');
const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
const initialDark = savedTheme ? savedTheme === 'dark' : prefersDark;

if (initialDark) {
  document.documentElement.classList.add('dark');
}

export const useThemeStore = create<ThemeStore>((set) => ({
  isDark: initialDark,

  toggle: () =>
    set((state) => {
      const newDark = !state.isDark;
      if (newDark) {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
      localStorage.setItem('ims_theme', newDark ? 'dark' : 'light');
      return { isDark: newDark };
    }),

  setDark: (dark) => {
    if (dark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('ims_theme', dark ? 'dark' : 'light');
    set({ isDark: dark });
  },
}));
