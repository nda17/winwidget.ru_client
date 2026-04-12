import { IHamburgerStore } from '@/store/hamburger-store/hamburger-store.interface'
import { create } from 'zustand'

export const useHamburgerStore = create<IHamburgerStore>(set => ({
	visible: false,
	setVisible: (value?) =>
		set(state => ({
			visible: value !== undefined ? value : !state.visible
		}))
}))
