// Store creation and configuration
import { configureStore } from '@reduxjs/toolkit';
import trainingReducer from './features/trainingSlice';

export const makeStore = () => {
  return configureStore({
    reducer: {
      training: trainingReducer,
    },
  });
};

// Infer the `RootState` and `AppDispatch` types from the store itself
export type AppStore = ReturnType<typeof makeStore>;
export type RootState = ReturnType<AppStore['getState']>;
export type AppDispatch = AppStore['dispatch'];
