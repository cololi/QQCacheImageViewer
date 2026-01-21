/**
 * Light theme configuration for Ant Design
 */

import { ThemeConfig } from 'antd';

export const lightTheme: ThemeConfig = {
  token: {
    colorPrimary: '#1890ff',
    colorBgBase: '#ffffff',
    colorTextBase: 'rgba(0, 0, 0, 0.85)',
    colorBorder: '#d9d9d9',
    colorBgLayout: '#fafafa',
    colorBgElevated: '#ffffff',
    colorBgContainer: '#ffffff',
    borderRadius: 6,
    fontSize: 14,
    lineHeight: 1.5715,
    wireframe: false,
  },
  components: {
    Button: {
      controlHeight: 32,
      primaryColor: '#ffffff',
      colorPrimaryHover: '#ffffff',
      colorPrimaryActive: '#ffffff',
      dangerColor: '#ffffff',
      colorErrorHover: '#ffffff',
      colorErrorActive: '#ffffff',
    },
    Input: {
      controlHeight: 32,
    },
    Select: {
      controlHeight: 32,
    },
    Table: {
      headerBg: '#fafafa',
      headerBorderRadius: 2,
    },
    Menu: {
      darkItemBg: 'transparent',
    },
    Layout: {
      headerBg: '#ffffff',
      headerHeight: 64,
      headerPadding: '0 24px',
      headerColor: 'rgba(0, 0, 0, 0.85)',
      bodyBg: '#fafafa',
      footerBg: '#f5f5f5',
      footerPadding: '24px 50px',
    },
    Card: {
      controlHeight: 32,
    },
    Modal: {
      contentBg: '#ffffff',
    },
  },
};

export default lightTheme;
