import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  // UI preferences stored client-side
  sidebarCollapsed: boolean;
  theme: 'light' | 'dark' | 'system';
  setSidebarCollapsed: (collapsed: boolean) => void;
  setTheme: (theme: 'light' | 'dark' | 'system') => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      sidebarCollapsed: false,
      theme: 'system',
      setSidebarCollapsed: (collapsed) => set({ sidebarCollapsed: collapsed }),
      setTheme: (theme) => set({ theme }),
    }),
    {
      name: 'social-agent-auth-store',
    }
  )
);
