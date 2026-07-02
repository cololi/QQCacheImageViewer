/**
 * Dark theme for Ant Design.
 *
 * The gallery UI is fully custom (inline frosted-glass styles), so this theme
 * only needs to make the remaining antd surfaces — SettingsModal, Modal.confirm,
 * message toasts — match the design's dark aesthetic and accent colour.
 */

import { theme, ThemeConfig } from 'antd';

export const darkTheme: ThemeConfig = {
  algorithm: theme.darkAlgorithm,
  token: {
    colorPrimary: '#0A77E0',
    colorInfo: '#0A77E0',
    colorBgBase: '#0B0D11',
    borderRadius: 10,
    fontSize: 14,
    wireframe: false,
  },
  components: {
    Modal: {
      contentBg: '#141820',
      headerBg: '#141820',
    },
  },
};

export default darkTheme;
