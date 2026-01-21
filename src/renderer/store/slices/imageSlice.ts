import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { Image } from '../../../shared/types';

export interface ImageState {
  images: Image[];
  loading: boolean;
  error: string | null;
  currentMonth: string | null;
  selectedIds: number[];
  sortField: string;
  sortOrder: 'asc' | 'desc';
  totalCount: number;
}

const initialState: ImageState = {
  images: [],
  loading: false,
  error: null,
  currentMonth: null,
  selectedIds: [],
  sortField: 'file_time',
  sortOrder: 'desc',
  totalCount: 0,
};

const imageSlice = createSlice({
  name: 'images',
  initialState,
  reducers: {
    setImages: (state, action: PayloadAction<Image[]>) => {
      state.images = action.payload;
      state.loading = false;
    },
    setLoading: (state, action: PayloadAction<boolean>) => {
      state.loading = action.payload;
    },
    setError: (state, action: PayloadAction<string | null>) => {
      state.error = action.payload;
    },
    setCurrentMonth: (state, action: PayloadAction<string | null>) => {
      state.currentMonth = action.payload;
      state.selectedIds = [];
    },
    toggleImageSelection: (state, action: PayloadAction<number>) => {
      const index = state.selectedIds.indexOf(action.payload);
      if (index > -1) {
        state.selectedIds.splice(index, 1);
      } else {
        state.selectedIds.push(action.payload);
      }
    },
    setSortField: (state, action: PayloadAction<string>) => {
      state.sortField = action.payload;
    },
    setSortOrder: (state, action: PayloadAction<'asc' | 'desc'>) => {
      state.sortOrder = action.payload;
    },
    setTotalCount: (state, action: PayloadAction<number>) => {
      state.totalCount = action.payload;
    },
    clearSelection: (state) => {
      state.selectedIds = [];
    },
    setSelectedIds: (state, action: PayloadAction<number[]>) => {
      state.selectedIds = action.payload;
    },
    removeImages: (state, action: PayloadAction<number[]>) => {
      const removeSet = new Set(action.payload);
      state.images = state.images.filter((img) => !removeSet.has(img.id));
      state.selectedIds = state.selectedIds.filter((id) => !removeSet.has(id));
    },
  },
});

export const {
  setImages,
  setLoading,
  setError,
  setCurrentMonth,
  toggleImageSelection,
  setSortField,
  setSortOrder,
  setTotalCount,
  clearSelection,
  setSelectedIds,
  removeImages,
} = imageSlice.actions;

export default imageSlice.reducer;
