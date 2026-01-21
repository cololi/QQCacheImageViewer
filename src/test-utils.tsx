import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { Provider } from 'react-redux';
import { I18nextProvider } from 'react-i18next';
import { configureStore } from '@reduxjs/toolkit';
import i18n from './renderer/i18n';
import imageReducer from './renderer/store/slices/imageSlice';
import filterReducer from './renderer/store/slices/filterSlice';
import settingsReducer from './renderer/store/slices/settingsSlice';
import type { RootState } from './renderer/store/store';

// Helper type for deep partial
type DeepPartial<T> = {
  [P in keyof T]?: DeepPartial<T[P]>;
};

// Create a mock store for testing
export function createMockStore(preloadedState?: DeepPartial<RootState>) {
  return configureStore({
    reducer: {
      images: imageReducer,
      filters: filterReducer,
      settings: settingsReducer,
    },
    preloadedState: preloadedState as RootState | undefined,
  });
}

// Render component with providers
interface ExtendedRenderOptions extends Omit<RenderOptions, 'queries'> {
  preloadedState?: DeepPartial<RootState>;
  store?: ReturnType<typeof createMockStore>;
}

export function renderWithProviders(
  ui: ReactElement,
  {
    preloadedState,
    store = createMockStore(preloadedState),
    ...renderOptions
  }: ExtendedRenderOptions = {},
) {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <Provider store={store}>
        <I18nextProvider i18n={i18n}>{children}</I18nextProvider>
      </Provider>
    );
  }

  return { ...render(ui, { wrapper: Wrapper, ...renderOptions }), store };
}

// Mock image data factory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockImage(overrides?: Partial<any>) {
  return {
    id: 1,
    filePath: '/mock/path/image.jpg',
    fileName: 'image.jpg',
    fileSize: 1024000,
    fileSizeFormatted: '1.0 MB',
    width: 1920,
    height: 1080,
    aspectRatio: 1.78,
    colorSpace: 'RGB',
    createdAt: new Date('2024-01-10').getTime(),
    modifiedAt: new Date('2024-01-10').getTime(),
    accessedAt: new Date('2024-01-10').getTime(),
    format: 'jpg',
    tags: [],
    ...overrides,
  };
}

// Mock images array factory
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createMockImages(count: number = 5, overrides?: Partial<any>) {
  return Array.from({ length: count }, (_, i) =>
    createMockImage({ id: i + 1, fileName: `image-${i + 1}.jpg`, ...overrides }),
  );
}

export * from '@testing-library/react';
