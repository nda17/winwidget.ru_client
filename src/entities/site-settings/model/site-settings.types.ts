export interface SiteSettings {
	id: string
	bannerEnabled: boolean
	bannerText: string
	snowflakeEnabled: boolean
	updatedAt: string
}

export type SiteSettingsPatch = Partial<
	Pick<SiteSettings, 'bannerEnabled' | 'bannerText' | 'snowflakeEnabled'>
>
