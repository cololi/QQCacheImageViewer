/**
 * 设置类型定义
 */

/**
 * 用户偏好设置
 */
export interface UserPreferences {
  // 路径配置
  defaultExportPath: string | null;

  // 扫描配置
  autoScanOnStartup: boolean;
}

/**
 * 应用设置
 */
export interface AppSettings {
  version: string;
  preferences: UserPreferences;
  lastUpdated?: string;
}

/**
 * 默认设置
 */
export const DEFAULT_SETTINGS: AppSettings = {
  version: '1.0.0',
  preferences: {
    // Empty sentinel: settings-service resolves this lazily to
    // `<user-downloads>/QQCacheImageViewer` at read time. Storing an
    // empty value (instead of a hardcoded path) lets the default adapt
    // to whatever user / OS actually runs the app.
    defaultExportPath: '',
    autoScanOnStartup: false,
  },
};

/**
 * 设置验证错误
 */
export interface SettingsValidationError {
  field: keyof UserPreferences;
  message: string;
}

/**
 * 验证设置
 */
export function validatePreferences(_prefs: Partial<UserPreferences>): SettingsValidationError[] {
  const errors: SettingsValidationError[] = [];
  // 路径验证可在这里添加
  return errors;
}
