/**
 * Dark theme configuration for Ant Design
 */

import { ThemeConfig, theme } from 'antd';

export const darkTheme: ThemeConfig = {
  token: {
    colorBgBase: '#141414',
    colorTextBase: 'rgba(255, 255, 255, 0.85)',
    colorPrimary: '#177ddc',
    colorBorder: '#434343',
    colorBgLayout: '#000000',
    colorBgElevated: '#1f1f1f',
    colorBgContainer: '#1f1f1f',
    borderRadius: 6,
    fontSize: 14,
    lineHeight: 1.5715,
    wireframe: false,
  },
  algorithm: theme.darkAlgorithm,
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
      colorBgContainer: '#262626',
      colorTextPlaceholder: 'rgba(255, 255, 255, 0.45)',
    },
    Select: {
      controlHeight: 32,
      colorBgContainer: '#262626',
    },
    Table: {
      headerBg: '#262626',
      headerBorderRadius: 2,
      rowHoverBg: 'rgba(255, 255, 255, 0.08)',
    },
    Menu: {
      darkItemBg: '#262626',
      darkItemSelectedBg: '#177ddc',
      colorBgElevated: '#1f1f1f',
    },
    Layout: {
      headerBg: '#141414',
      headerHeight: 64,
      headerPadding: '0 24px',
      headerColor: 'rgba(255, 255, 255, 0.85)',
      bodyBg: '#000000',
      footerBg: '#141414',
      footerPadding: '24px 50px',
    },
    Card: {
      controlHeight: 32,
      colorBgContainer: '#1f1f1f',
    },
    Modal: {
      contentBg: '#1f1f1f',
    },
  },
};

export default darkTheme;
