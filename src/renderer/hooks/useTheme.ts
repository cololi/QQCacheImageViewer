/**
 * Hook for theme management
 */

import { useDispatch, useSelector } from 'react-redux';
import { ThemeConfig } from 'antd';
import { selectPreferences, updatePreference, savePreference } from '../store/slices/settingsSlice';
import { RootState, AppDispatch } from '../store/store';
import lightTheme from '../themes/light';
import darkTheme from '../themes/dark';

interface UseThemeReturn {
  theme: 'light' | 'dark';
  themeConfig: ThemeConfig;
  toggleTheme: () => void;
  setThemeMode: (theme: 'light' | 'dark') => void;
}

/**
 * Hook that provides current theme configuration and toggle function
 */
export function useTheme(): UseThemeReturn {
  const dispatch = useDispatch<AppDispatch>();
  const preferences = useSelector((state: RootState) => selectPreferences(state));
  const theme = preferences.theme;

  const themeConfig = theme === 'dark' ? darkTheme : lightTheme;

  const toggleTheme = () => {
    const newTheme = theme === 'dark' ? 'light' : 'dark';
    setThemeMode(newTheme);
  };

  const setThemeMode = (newTheme: 'light' | 'dark') => {
    dispatch(updatePreference({ key: 'theme', value: newTheme }));
    // Save to persist across app restarts
    dispatch(
      savePreference({
        key: 'theme',
        value: newTheme,
      })
    );
  };

  return {
    theme,
    themeConfig,
    toggleTheme,
    setThemeMode,
  };
}

export default useTheme;
