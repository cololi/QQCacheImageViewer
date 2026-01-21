/**
 * Settings Service - Main Process
 * Manages application settings persistence using electron-store
 */

import fs from 'fs';
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
 * Get all settings
 */
export function getSettings(): AppSettings {
  return store.store;
}

/**
 * Get specific setting by key
 */
export function getSetting<K extends keyof UserPreferences>(key: K): UserPreferences[K] {
  const settings = store.get('preferences') as UserPreferences;
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
export function setPreference<K extends keyof UserPreferences>(key: K, value: UserPreferences[K]): void {
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

/**
 * Reset specific preference to default
 */
export function resetPreference<K extends keyof UserPreferences>(key: K): void {
  const defaultValue = DEFAULT_SETTINGS.preferences[key];
  setPreference(key, defaultValue);
}

/**
 * Check if settings file exists and is valid
 */
export function hasValidSettings(): boolean {
  try {
    const settings = store.store;
    return settings && settings.preferences !== undefined;
  } catch {
    return false;
  }
}

/**
 * Get settings file path (for debugging)
 */
export function getSettingsPath(): string {
  return store.path;
}


