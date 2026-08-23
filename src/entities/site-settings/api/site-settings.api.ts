import { axiosInterceptorsRequest } from '@/shared/api'
import type {
	SiteSettings,
	SiteSettingsPatch
} from '@/entities/site-settings/model/site-settings.types'

const siteSettingsService = {
	async get(): Promise<SiteSettings> {
		const { data } = await axiosInterceptorsRequest.get('/site-settings')
		return data
	},

	async update(payload: SiteSettingsPatch): Promise<SiteSettings> {
		const { data } = await axiosInterceptorsRequest.patch(
			'/site-settings',
			payload
		)
		return data
	}
}

export default siteSettingsService
