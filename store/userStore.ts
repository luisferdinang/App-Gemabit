
import { create } from 'zustand';
import { User } from '../types';

export interface UserState {
  currentUser: User | null;
  exchangeRate: number; // Tasa de cambio VES/USD
  setUser: (user: User | null) => void;
  setExchangeRate: (rate: number) => void;
  updateUserFields: (fields: Partial<User>) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentUser: null,
  exchangeRate: 0, // Default 0
  setUser: (user) => set({ currentUser: user }),
  setExchangeRate: (rate) => set({ exchangeRate: rate }),
  updateUserFields: (fields) => set((state: UserState) => ({
    currentUser: state.currentUser ? { ...state.currentUser, ...fields } : null
  })),
}));
