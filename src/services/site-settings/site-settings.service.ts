import { axiosInterceptorsRequest } from '@/api/interceptors'
import type { SiteSettings } from '@/services/site-settings/site-settings.types'

const siteSettingsService = {
	async get(): Promise<SiteSettings> {
		const { data } = await axiosInterceptorsRequest.get('/site-settings')
		return data
	},

	async update(
		payload: Partial<
			Pick<
				SiteSettings,
				| 'bannerEnabled'
				| 'bannerText'
				| 'snowflakeEnabled'
				| 'paymentEnabled'
				| 'recaptchaEnabled'
				| 'googleAuthEnabled'
				| 'yandexAuthEnabled'
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
