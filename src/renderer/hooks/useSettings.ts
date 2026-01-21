/**
 * 设置 Hook
 */

import { useDispatch, useSelector } from 'react-redux';
import {
  selectSettings,
  selectPreferences,
  updatePreference,
  savePreference,
} from '../store/slices/settingsSlice';
import { RootState, AppDispatch } from '../store/store';
import { UserPreferences, AppSettings } from '../../shared/settings-types';

interface UseSettingsReturn {
  settings: AppSettings;
  preferences: UserPreferences;
  updateSetting: <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => void;
}

/**
 * 提供设置访问和更新功能的 Hook
 */
export function useSettings(): UseSettingsReturn {
  const dispatch = useDispatch<AppDispatch>();
  const settings = useSelector((state: RootState) => selectSettings(state));
  const preferences = useSelector((state: RootState) => selectPreferences(state));

  const updateSetting = <K extends keyof UserPreferences>(key: K, value: UserPreferences[K]) => {
    // 立即更新 Redux 状态
    dispatch(updatePreference({ key, value }));

    // 持久化到主进程
    dispatch(
      savePreference({
        key: key as string,
        value,
      })
    );
  };

  return {
    settings,
    preferences,
    updateSetting,
  };
}

export default useSettings;
