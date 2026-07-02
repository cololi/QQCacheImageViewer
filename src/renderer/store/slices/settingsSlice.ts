/**
 * Redux设置状态管理
 */

import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { AppSettings, DEFAULT_SETTINGS } from '../../../shared/settings-types';
import { ipc } from '../../lib/ipc-client';

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
export const loadSettings = createAsyncThunk(
  'settings/loadSettings',
  async (_, { rejectWithValue }) => {
    try {
      return await ipc.getSettings();
    } catch (error) {
      return rejectWithValue((error as Error).message || '加载设置失败');
    }
  },
);

/**
 * 保存设置到主进程
 */
export const saveSettings = createAsyncThunk(
  'settings/saveSettings',
  async (settings: AppSettings, { rejectWithValue }) => {
    try {
      await ipc.setSettings(settings);
      return new Date().toISOString();
    } catch (error) {
      return rejectWithValue((error as Error).message || '保存设置失败');
    }
  },
);

/**
 * 重置为默认设置
 */
export const resetToDefaults = createAsyncThunk(
  'settings/resetToDefaults',
  async (_, { rejectWithValue }) => {
    try {
      return await ipc.resetSettings();
    } catch (error) {
      return rejectWithValue((error as Error).message || '重置设置失败');
    }
  },
);

export const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {},

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
export const selectPreferences = (state: { settings: SettingsState }) =>
  state.settings.data.preferences;
export const selectSettingsLoading = (state: { settings: SettingsState }) => state.settings.loading;
export const selectSettingsError = (state: { settings: SettingsState }) => state.settings.error;

export default settingsSlice.reducer;
