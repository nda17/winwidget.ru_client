import type { ReactNode } from 'react'

export interface WidgetSettingsPersistence<TEntity, TConfig> {
	update: (payload: {
		expectedDraftRevision: number
		name?: string
		isActive?: boolean
		installDomain?: string
		config?: Partial<TConfig>
	}) => Promise<TEntity>
	uploadButtonImage?: (file: FormData) => Promise<TEntity>
}

export type WidgetSettingsPresentation = 'modal' | 'page'

export interface WidgetSettingsPresentationProps {
	presentation?: WidgetSettingsPresentation
	previewPortalTarget?: HTMLElement | null
	onDirtyChange?: (hasUnsavedChanges: boolean) => void
	onPreviewDeviceChange?: (device: 'desktop' | 'mobile') => void
	onPreviewConfigChange?: () => void
	onRevisionConflict?: () => Promise<number | null>
	lifecycleActions?: ReactNode
}
