/**
 * Hook for keyboard shortcuts management
 */

import { useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { AppDispatch } from '../store/store';

export interface ShortcutAction {
  key: string;
  description: string;
  handler: () => void;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: ShortcutAction[];
  enabled?: boolean;
}

/**
 * Hook that sets up global keyboard shortcuts
 */
export function useKeyboardShortcuts(options: UseKeyboardShortcutsOptions): void {
  const { shortcuts, enabled = true } = options;

  useEffect(() => {
    if (!enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      // Build key combination string
      const keys: string[] = [];

      if (event.ctrlKey || event.metaKey) keys.push('ctrl');
      if (event.shiftKey) keys.push('shift');
      if (event.altKey) keys.push('alt');

      // Add the actual key
      const key = event.key.toLowerCase();
      if (key !== 'control' && key !== 'shift' && key !== 'alt' && key !== 'meta') {
        keys.push(key);
      }

      const combination = keys.join('+');

      // Find matching shortcut
      const shortcut = shortcuts.find((s) => s.key.toLowerCase() === combination);

      if (shortcut) {
        event.preventDefault();
        shortcut.handler();
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [shortcuts, enabled]);
}

/**
 * Common shortcuts configuration
 */
export const COMMON_SHORTCUTS: ShortcutAction[] = [
  {
    key: 'ctrl+s',
    description: 'Scan QQ cache',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
  {
    key: 'ctrl+f',
    description: 'Focus search',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
  {
    key: 'ctrl+,',
    description: 'Open settings',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
  {
    key: 'ctrl+t',
    description: 'Toggle theme',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
  {
    key: 'ctrl+1',
    description: 'Grid view',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
  {
    key: 'ctrl+2',
    description: 'List view',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
  {
    key: 'ctrl+r',
    description: 'Refresh images',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
  {
    key: 'escape',
    description: 'Close modals',
    handler: () => {
      // Will be overridden by actual handler
    },
  },
];

export default useKeyboardShortcuts;
