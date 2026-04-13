import { IVeilBackgroundStore } from '@/store/veil-background-store/veil-background-store.interface'
import { create } from 'zustand'

export const useVeilBackgroundStore = create<IVeilBackgroundStore>(
	set => ({
		visible: false,
		setVisible: (value?) =>
			set(state => ({
				visible: value !== undefined ? value : !state.visible
			}))
	})
)
