import { IAuthStore } from '@/store/auth-store/auth-store.interface'
import { create } from 'zustand'

export const useAuthStore = create<IAuthStore>(set => ({
	auth: false,
	isAuthResolved: false,
	setAuth: value => set({ auth: value }),
	setAuthResolved: value => set({ isAuthResolved: value })
}))
