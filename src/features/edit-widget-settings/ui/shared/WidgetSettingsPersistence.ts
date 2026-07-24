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
