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

  // 界面配置
  theme: 'light' | 'dark';
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
    defaultExportPath: 'C:\\Users\\admin\\Downloads\\picture',
    autoScanOnStartup: false,
    theme: 'light',
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
export function validatePreferences(prefs: Partial<UserPreferences>): SettingsValidationError[] {
  const errors: SettingsValidationError[] = [];
  // 路径验证可在这里添加
  return errors;
}
