import { configureStore } from '@reduxjs/toolkit';
import imageReducer from './slices/imageSlice';
import filterReducer from './slices/filterSlice';
import settingsReducer from './slices/settingsSlice';

const store = configureStore({
  reducer: {
    images: imageReducer,
    filters: filterReducer,
    settings: settingsReducer,
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export default store;
