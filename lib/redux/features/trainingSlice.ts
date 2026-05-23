import { createSlice, PayloadAction } from '@reduxjs/toolkit';

// Define the shape of our data (must handle undefined links if link data is sensitive)
interface TrainingState {
  currentVideoId: number | null;
  videoLink: string | null;
  fallbackLink: string | null;
  duration: number;
  title: string | null;
  segments: Array<{ id: number; url: string; duration_minutes: number; duration_seconds?: number | null }> | null;
}

const initialState: TrainingState = {
  currentVideoId: null,
  videoLink: null,
  fallbackLink: null,
  duration: 0,
  title: null,
  segments: null,
};

export const trainingSlice = createSlice({
  name: 'training',
  initialState,
  reducers: {
    setVideo: (state, action: PayloadAction<{ id: number; link: string; fallbackLink?: string | null; duration: number; title: string, segments?: Array<{ id: number; url: string; duration_minutes: number }> }>) => {
      state.currentVideoId = action.payload.id;
      // If we want to hide the full link or manipulate it before storing
      state.videoLink = action.payload.link; 
      state.fallbackLink = action.payload.fallbackLink || null;
      state.duration = action.payload.duration;
      state.title = action.payload.title;
      state.segments = action.payload.segments || null;
    },
    clearVideo: (state) => {
      state.currentVideoId = null;
      state.videoLink = null;
      state.fallbackLink = null;
      state.duration = 0;
      state.title = null;
      state.segments = null;
    },
  },
});

export const { setVideo, clearVideo } = trainingSlice.actions;

export default trainingSlice.reducer;
