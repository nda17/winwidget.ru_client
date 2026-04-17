import { axiosInterceptorsRequest } from '@/api/interceptors'

export interface SiteSettings {
	id: string
	bannerEnabled: boolean
	bannerText: string
	snowflakeEnabled: boolean
	updatedAt: string
}

const siteSettingsService = {
	async get(): Promise<SiteSettings> {
		const { data } = await axiosInterceptorsRequest.get('/site-settings')
		return data
	},

	async update(
		payload: Partial<
			Pick<
				SiteSettings,
				'bannerEnabled' | 'bannerText' | 'snowflakeEnabled'
			>
		>
	): Promise<SiteSettings> {
		const { data } = await axiosInterceptorsRequest.patch(
			'/site-settings',
			payload
		)
		return data
	}
}

export default siteSettingsService
