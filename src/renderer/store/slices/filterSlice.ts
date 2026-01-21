import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export interface FilterState {

  selectedFormats: string[];
  selectedCategories: string[];
  sizeRange: [number, number]; // in bytes
  dimensionRange: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
    minPixels?: number;
    maxPixels?: number;
  };
  ratioRange: [number, number];
  dateRange: {
    startDate?: Date | null;
    endDate?: Date | null;
  };
  selectedTags: string[];
}

const initialState: FilterState = {

  selectedFormats: [],
  selectedCategories: [],
  sizeRange: [0, Infinity],
  dimensionRange: {},
  ratioRange: [0, Infinity],
  dateRange: {},
  selectedTags: [],
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
    setDimensionRange: (state, action: PayloadAction<FilterState['dimensionRange']>) => {
      state.dimensionRange = action.payload;
    },
    setRatioRange: (state, action: PayloadAction<[number, number]>) => {
      state.ratioRange = action.payload;
    },
    setDateRange: (state, action: PayloadAction<FilterState['dateRange']>) => {
      state.dateRange = action.payload;
    },
    setSelectedTags: (state, action: PayloadAction<string[]>) => {
      state.selectedTags = action.payload;
    },
    resetFilters: () => initialState,
  },
});

export const {

  setSelectedFormats,
  setSelectedCategories,
  setSizeRange,
  setDimensionRange,
  setRatioRange,
  setDateRange,
  setSelectedTags,
  resetFilters,
} = filterSlice.actions;

export default filterSlice.reducer;
