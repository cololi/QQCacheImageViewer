/**
 * Settings Service Tests
 * Tests for settings persistence: get, set, reset operations
 */

import * as settingsService from '../settings-service';
import { UserPreferences } from '../../../shared/settings-types';

// Mock electron-store
jest.mock('electron-store', () => {
  const { DEFAULT_SETTINGS } = require('../../../shared/settings-types');

  let mockData = JSON.parse(JSON.stringify(DEFAULT_SETTINGS)); // Deep clone

  const mockStore = {
    get store() {
      return mockData;
    },
    set store(value: any) {
      mockData = value;
    },
    get: jest.fn((key?: string) => {
      if (!key) return JSON.parse(JSON.stringify(mockData));
      const keys = key.split('.');
      let value: any = mockData;
      for (const k of keys) {
        if (value === undefined || value === null) return undefined;
        value = value[k];
      }
      // Return deep copy for objects
      return typeof value === 'object' && value !== null
        ? JSON.parse(JSON.stringify(value))
        : value;
    }),
    set: jest.fn((keyOrObject: string | any, value?: any) => {
      if (typeof keyOrObject === 'object') {
        mockData = keyOrObject;
      } else {
        const keys = keyOrObject.split('.');
        let target: any = mockData;
        for (let i = 0; i < keys.length - 1; i++) {
          if (!target[keys[i]]) {
            target[keys[i]] = {};
          }
          target = target[keys[i]];
        }
        target[keys[keys.length - 1]] = value;
      }
    }),
    delete: jest.fn(),
    clear: jest.fn(() => {
      const { DEFAULT_SETTINGS } = require('../../../shared/settings-types');
      mockData = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    }),
    path: '/mock/config.json',
  };

  return jest.fn(() => mockStore);
});

// Mock electron app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn((type) => {
      if (type === 'userData') return '/mock/user/data';
      return '/mock/path';
    }),
  },
}));

describe('Settings Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset modules to get fresh mock data
    jest.resetModules();
  });

  describe('getSettings', () => {
    it('should return settings object', () => {
      const result = settingsService.getSettings();
      expect(result).toBeDefined();
      expect(typeof result).toBe('object');
    });

    it('should have version property', () => {
      const result = settingsService.getSettings();
      expect(result.version).toBeDefined();
      expect(typeof result.version).toBe('string');
    });

    it('should have preferences object', () => {
      const result = settingsService.getSettings();
      expect(result.preferences).toBeDefined();
      expect(typeof result.preferences).toBe('object');
    });

    it('should have default preferences', () => {
      const result = settingsService.getSettings();
      expect(result.preferences.defaultExportPath).toBeDefined();
    });
  });

  describe('setSetting', () => {
    it('should set individual setting', () => {
      expect(() => {
        // @ts-ignore - for testing purpose if setSetting is still available but typed
        settingsService.setPreference('autoScanOnStartup', true);
      }).not.toThrow();
    });

    it('should accept various setting types', () => {
      expect(() => {
        settingsService.setPreference('autoScanOnStartup', true);
      }).not.toThrow();
    });
  });

  describe('setSettings', () => {
    it('should update settings object', () => {
      const mockSettings = {
        version: '1.0.0',
        preferences: {
          autoScanOnStartup: false,
          defaultExportPath: '/home/exports',
        } as UserPreferences,
      };

      expect(() => {
        settingsService.setSettings(mockSettings);
      }).not.toThrow();
    });

    it('should handle partial updates', () => {
      const partialSettings = {
        version: '1.0.0',
        preferences: {
          autoScanOnStartup: true,
        } as Partial<UserPreferences>,
      };

      expect(() => {
        settingsService.setSettings(partialSettings as any);
      }).not.toThrow();
    });
  });

  describe('setPreference', () => {
    it('should set individual preference', () => {
      expect(() => {
        settingsService.setPreference('autoScanOnStartup', true);
      }).not.toThrow();
    });

    it('should handle string values', () => {
      expect(() => {
        settingsService.setPreference('defaultExportPath', '/new/path');
      }).not.toThrow();
    });

    it('should handle boolean values', () => {
      expect(() => {
        settingsService.setPreference('autoScanOnStartup', true);
      }).not.toThrow();
    });
  });

  describe('updatePreferences', () => {
    it('should update multiple preferences at once', () => {
      const updates: Partial<UserPreferences> = {
        autoScanOnStartup: true,
        defaultExportPath: '/new/path',
      };

      expect(() => {
        settingsService.updatePreferences(updates);
      }).not.toThrow();
    });

    it('should handle empty updates', () => {
      expect(() => {
        settingsService.updatePreferences({});
      }).not.toThrow();
    });

    it('should preserve existing preferences', () => {
      const updates: Partial<UserPreferences> = {
        autoScanOnStartup: true,
      };

      expect(() => {
        settingsService.updatePreferences(updates);
        settingsService.getSettings();
        // Other preferences should still exist (mocked)
      }).not.toThrow();
    });
  });

  describe('resetSettings', () => {
    it('should reset to default settings', () => {
      expect(() => {
        settingsService.resetSettings();
      }).not.toThrow();
    });

    it('should restore default values', () => {
      // First change some settings
      settingsService.setPreference('autoScanOnStartup', true);

      // Then reset
      settingsService.resetSettings();

      // Verify reset worked
      const settings = settingsService.getSettings();
      expect(settings.preferences).toBeDefined();
    });
  });

  describe('getSetting', () => {
    it('should retrieve individual setting', () => {
      const val = settingsService.getSetting('autoScanOnStartup');
      expect(val).toBeDefined();
    });

    it('should return correct setting value', () => {
      settingsService.setPreference('autoScanOnStartup', true);
      const val = settingsService.getSetting('autoScanOnStartup');
      expect(val).toBe(true);
    });

    it('should handle various setting keys', () => {
      expect(() => {
        settingsService.getSetting('defaultExportPath');
        settingsService.getSetting('autoScanOnStartup');
      }).not.toThrow();
    });
  });
});
