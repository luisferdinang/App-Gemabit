
import { create } from 'zustand';
import { User } from '../types';

export interface UserState {
  currentUser: User | null;
  exchangeRate: number; // Tasa de cambio VES/USD
  systemStartDate: string | null; // ISO Date of the Monday of Week 1
  setUser: (user: User | null) => void;
  setExchangeRate: (rate: number) => void;
  setSystemStartDate: (date: string | null) => void;
  updateUserFields: (fields: Partial<User>) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentUser: null,
  exchangeRate: 0,
  systemStartDate: null,
  setUser: (user) => set({ currentUser: user }),
  setExchangeRate: (rate) => set({ exchangeRate: rate }),
  setSystemStartDate: (date) => set({ systemStartDate: date }),
  updateUserFields: (fields) => set((state: UserState) => ({
    currentUser: state.currentUser ? { ...state.currentUser, ...fields } : null
  })),
}));
