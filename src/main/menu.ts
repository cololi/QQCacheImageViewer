/**
 * Application menu definition for Electron
 */

import { Menu, MenuItemConstructorOptions, ipcMain } from 'electron';

export function createApplicationMenu(): Menu {
  const template: MenuItemConstructorOptions[] = [
    {
      label: '文件',
      submenu: [
        {
          label: '扫描 QQ 缓存',
          accelerator: 'Ctrl+S',
          click: () => {
            // Will be handled by IPC
          },
        },
        {
          label: '导出选中',
          accelerator: 'Ctrl+E',
          click: () => {
            // Will be handled by IPC
          },
        },
        { type: 'separator' },
        {
          label: '设置',
          accelerator: 'Ctrl+,',
          click: () => {
            // Will be handled by IPC
          },
        },
        { type: 'separator' },
        {
          label: '退出',
          accelerator: 'Alt+F4',
          click: () => {
            process.exit(0);
          },
        },
      ],
    },
    {
      label: '编辑',
      submenu: [
        {
          label: '全选',
          accelerator: 'Ctrl+A',
          click: () => {
            // Will be handled by IPC
          },
        },
        {
          label: '复制',
          accelerator: 'Ctrl+C',
          click: () => {
            // Will be handled by IPC
          },
        },
        { type: 'separator' },
        {
          label: '清除选中',
          accelerator: 'Ctrl+D',
          click: () => {
            // Will be handled by IPC
          },
        },
      ],
    },
    {
      label: '视图',
      submenu: [
        {
          label: '网格视图',
          accelerator: 'Ctrl+1',
          click: () => {
            // Will be handled by IPC
          },
        },
        {
          label: '列表视图',
          accelerator: 'Ctrl+2',
          click: () => {
            // Will be handled by IPC
          },
        },
        { type: 'separator' },
        {
          label: '切换主题',
          accelerator: 'Ctrl+T',
          click: () => {
            // Will be handled by IPC
          },
        },
        { type: 'separator' },
        {
          label: '重新加载',
          accelerator: 'Ctrl+R',
          click: () => {
            // Will be handled by IPC
          },
        },
        {
          label: '开发者工具',
          accelerator: 'F12',
          click: () => {
            // Will be handled by IPC
          },
        },
      ],
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '关于',
          click: () => {
            // Will be handled by IPC
          },
        },
        {
          label: '快捷键',
          accelerator: 'Ctrl+/',
          click: () => {
            // Will be handled by IPC
          },
        },
      ],
    },
  ];

  return Menu.buildFromTemplate(template);
}

export default createApplicationMenu;
