import { create } from 'zustand';
import { User } from '../types';

interface AuthStore {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
  login: (token: string, user: User) => void;
  logout: () => void;
  setUser: (user: User) => void;
}

const storedToken = localStorage.getItem('ims_token');
const storedUser = localStorage.getItem('ims_user');

export const useAuthStore = create<AuthStore>((set) => ({
  user: storedUser ? JSON.parse(storedUser) : null,
  token: storedToken,
  isAuthenticated: !!storedToken,

  login: (token, user) => {
    localStorage.setItem('ims_token', token);
    localStorage.setItem('ims_user', JSON.stringify(user));
    set({ token, user, isAuthenticated: true });
  },

  logout: () => {
    localStorage.removeItem('ims_token');
    localStorage.removeItem('ims_user');
    set({ token: null, user: null, isAuthenticated: false });
  },

  setUser: (user) => {
    localStorage.setItem('ims_user', JSON.stringify(user));
    set({ user });
  },
}));
