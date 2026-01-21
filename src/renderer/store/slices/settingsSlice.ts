/**
 * Redux设置状态管理
 */

import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { AppSettings, UserPreferences, DEFAULT_SETTINGS } from '../../../shared/settings-types';

export interface SettingsState {
  data: AppSettings;
  loading: boolean;
  error: string | null;
  lastSaved: string | null;
}

const initialState: SettingsState = {
  data: DEFAULT_SETTINGS,
  loading: false,
  error: null,
  lastSaved: null,
};

/**
 * 从主进程加载设置
 */
export const loadSettings = createAsyncThunk('settings/loadSettings', async (_, { rejectWithValue }) => {
  try {
    const settings = await window.electron!.ipcRenderer.invoke('get-settings');
    return settings;
  } catch (error) {
    return rejectWithValue((error as Error).message || '加载设置失败');
  }
});

/**
 * 保存设置到主进程
 */
export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (settings: AppSettings, { rejectWithValue }) => {
    try {
      await window.electron!.ipcRenderer.invoke('set-settings', settings);
      return new Date().toISOString();
    } catch (error) {
      return rejectWithValue((error as Error).message || '保存设置失败');
    }
  }
);

/**
 * 保存单个偏好设置
 */
export const savePreference = createAsyncThunk(
  'settings/savePreference',
  async (payload: { key: string; value: any }, { rejectWithValue }) => {
    try {
      await window.electron!.ipcRenderer.invoke('set-preference', payload.key, payload.value);
      return new Date().toISOString();
    } catch (error) {
      return rejectWithValue((error as Error).message || '保存偏好设置失败');
    }
  }
);

/**
 * 重置为默认设置
 */
export const resetToDefaults = createAsyncThunk('settings/resetToDefaults', async (_, { rejectWithValue }) => {
  try {
    await window.electron!.ipcRenderer.invoke('reset-settings');
    return DEFAULT_SETTINGS;
  } catch (error) {
    return rejectWithValue((error as Error).message || '重置设置失败');
  }
});

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    /**
     * 更新偏好设置
     */
    updatePreference: <K extends keyof UserPreferences>(
      state: SettingsState,
      action: PayloadAction<{ key: K; value: UserPreferences[K] }>
    ) => {
      (state.data.preferences[action.payload.key] as any) = action.payload.value;
    },

    /**
     * 清除错误状态
     */
    clearError: (state) => {
      state.error = null;
    },
  },

  extraReducers: (builder) => {
    // 加载设置
    builder
      .addCase(loadSettings.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(loadSettings.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
      })
      .addCase(loadSettings.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });

    // 保存设置
    builder
      .addCase(saveSettings.pending, (state) => {
        state.error = null;
      })
      .addCase(saveSettings.fulfilled, (state, action) => {
        state.lastSaved = action.payload;
      })
      .addCase(saveSettings.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // 保存单个设置
    builder
      .addCase(savePreference.fulfilled, (state, action) => {
        state.lastSaved = action.payload;
      })
      .addCase(savePreference.rejected, (state, action) => {
        state.error = action.payload as string;
      });

    // 重置设置
    builder
      .addCase(resetToDefaults.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(resetToDefaults.fulfilled, (state, action) => {
        state.loading = false;
        state.data = action.payload;
        state.lastSaved = new Date().toISOString();
      })
      .addCase(resetToDefaults.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

// Selectors
export const selectSettings = (state: { settings: SettingsState }) => state.settings.data;
export const selectPreferences = (state: { settings: SettingsState }) => state.settings.data.preferences;
export const selectSettingsLoading = (state: { settings: SettingsState }) => state.settings.loading;
export const selectSettingsError = (state: { settings: SettingsState }) => state.settings.error;

export const { updatePreference, clearError } = settingsSlice.actions;

export default settingsSlice.reducer;
