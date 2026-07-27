export interface WidgetSettingsPersistence<TEntity, TConfig> {
	update: (
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<TConfig>
		}>
	) => Promise<TEntity>
	uploadButtonImage?: (file: FormData) => Promise<TEntity>
}

export type WidgetSettingsPresentation = 'modal' | 'page'

export interface WidgetSettingsPresentationProps {
	presentation?: WidgetSettingsPresentation
	previewPortalTarget?: HTMLElement | null
}
