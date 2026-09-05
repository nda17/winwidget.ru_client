import { axiosInterceptorsRequest } from '@/shared/api'
import type {
	BillingAdminSettings,
	BillingProviderReadiness,
	BillingSettingsPatch
} from '@/entities/billing-settings/model/billing-settings.types'

const billingSettingsService = {
	async getAdmin(): Promise<BillingAdminSettings> {
		const { data } = await axiosInterceptorsRequest.get(
			'/billing-settings/admin'
		)
		return data
	},

	async getProviderReadiness(): Promise<BillingProviderReadiness> {
		const { data } = await axiosInterceptorsRequest.get(
			'/billing-settings/admin/provider-readiness'
		)
		return data
	},

	async updateAdmin(
		payload: BillingSettingsPatch
	): Promise<BillingAdminSettings> {
		const { data } = await axiosInterceptorsRequest.patch(
			'/billing-settings/admin',
			payload
		)
		return data
	}
}

export default billingSettingsService
