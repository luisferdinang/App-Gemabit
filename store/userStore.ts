import { create } from 'zustand';
import { User } from '../types';

interface UserState {
  currentUser: User | null;
  setUser: (user: User | null) => void;
  updateUserFields: (fields: Partial<User>) => void;
}

export const useUserStore = create<UserState>((set) => ({
  currentUser: null,
  setUser: (user) => set({ currentUser: user }),
  updateUserFields: (fields) => set((state) => ({
    currentUser: state.currentUser ? { ...state.currentUser, ...fields } : null
  })),
}));