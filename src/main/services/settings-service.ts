/**
 * Settings Service - Main Process
 * Manages application settings persistence using electron-store
 */

import path from 'path';
import { app } from 'electron';
import Store from 'electron-store';
import { AppSettings, DEFAULT_SETTINGS, UserPreferences } from '../../shared/settings-types';

// Initialize electron-store
const store = new Store<AppSettings>({
  defaults: DEFAULT_SETTINGS,
  schema: {
    version: {
      type: 'string',
      default: '1.0.0',
    },
    preferences: {
      type: 'object',
      properties: {
        defaultExportPath: { type: ['string', 'null'] },
        autoScanOnStartup: { type: 'boolean', default: true },
      },
    },
    lastUpdated: { type: 'string' },
  },
});

/**
 * Resolve the lazy default for `defaultExportPath`.
 *
 * The stored value is an empty string / null sentinel meaning
 * "not set; use the OS default". We resolve it here at read time
 * because `app.getPath('downloads')` is only available after the
 * Electron app is ready — too late for a module-load-time constant.
 *
 * Returns '' if `app` is not yet ready or the lookup fails so the
 * caller can fall back to its own behaviour (e.g. show a save dialog).
 */
function resolveDefaultExportPath(): string {
  try {
    return path.join(app.getPath('downloads'), 'QQCacheImageViewer');
  } catch {
    return '';
  }
}

/**
 * Apply computed defaults (e.g. the lazy `defaultExportPath`) to a
 * settings object without mutating the underlying store. The on-disk
 * value stays empty so the default keeps adapting if the user moves
 * machines or accounts.
 */
function applyComputedDefaults(settings: AppSettings): AppSettings {
  if (!settings.preferences.defaultExportPath) {
    return {
      ...settings,
      preferences: {
        ...settings.preferences,
        defaultExportPath: resolveDefaultExportPath(),
      },
    };
  }
  return settings;
}

/**
 * Get all settings
 */
export function getSettings(): AppSettings {
  return applyComputedDefaults(store.store);
}

/**
 * Get specific setting by key
 */
export function getSetting<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  const settings = store.get('preferences') as UserPreferences;
  if (key === 'defaultExportPath' && !settings.defaultExportPath) {
    return resolveDefaultExportPath() as UserPreferences[K];
  }
  return settings[key];
}

/**
 * Set all settings
 */
export function setSettings(settings: AppSettings): void {
  // Update lastUpdated timestamp
  settings.lastUpdated = new Date().toISOString();

  // Merge with existing settings to preserve any missing fields
  const current = store.store;
  const merged = {
    ...current,
    ...settings,
    preferences: {
      ...current.preferences,
      ...settings.preferences,
    },
  };

  store.set(merged);
}

/**
 * Set specific preference
 */
export function setPreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): void {
  const preferences = store.get('preferences') as UserPreferences;
  preferences[key] = value;
  store.set('preferences', preferences);
  store.set('lastUpdated', new Date().toISOString());
}

/**
 * Update multiple preferences
 */
export function updatePreferences(updates: Partial<UserPreferences>): void {
  const preferences = store.get('preferences') as UserPreferences;
  const merged = { ...preferences, ...updates };
  store.set('preferences', merged);
  store.set('lastUpdated', new Date().toISOString());
}

/**
 * Reset all settings to defaults
 */
export function resetSettings(): void {
  store.clear();
  store.set(DEFAULT_SETTINGS);
  store.set('lastUpdated', new Date().toISOString());
}
