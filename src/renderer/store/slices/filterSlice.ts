import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FilterState {
  selectedFormats: string[];
  selectedCategories: string[];
  sizeRange: [number, number]; // in bytes
  ratioRange: [number, number];
}

const initialState: FilterState = {
  selectedFormats: [],
  selectedCategories: [],
  sizeRange: [0, Infinity],
  ratioRange: [0, Infinity],
};

const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setSelectedFormats: (state, action: PayloadAction<string[]>) => {
      state.selectedFormats = action.payload;
    },
    setSelectedCategories: (state, action: PayloadAction<string[]>) => {
      state.selectedCategories = action.payload;
    },
    setSizeRange: (state, action: PayloadAction<[number, number]>) => {
      state.sizeRange = action.payload;
    },
    setRatioRange: (state, action: PayloadAction<[number, number]>) => {
      state.ratioRange = action.payload;
    },
    resetFilters: () => initialState,
  },
});

export const {
  setSelectedFormats,
  setSelectedCategories,
  setSizeRange,
  setRatioRange,
  resetFilters,
} = filterSlice.actions;

export default filterSlice.reducer;
