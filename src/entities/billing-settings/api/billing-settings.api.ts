import { axiosInterceptorsRequest } from '@/shared/api'
import type {
	BillingAdminSettings,
	BillingAdminSettingsPatch
} from '@/entities/billing-settings/model/billing-settings.types'

const billingSettingsService = {
	async getAdmin(): Promise<BillingAdminSettings> {
		const { data } =
			await axiosInterceptorsRequest.get<BillingAdminSettings>(
				'/billing-settings/admin'
			)

		return data
	},

	async updateAdmin(
		payload: BillingAdminSettingsPatch
	): Promise<BillingAdminSettings> {
		const { data } =
			await axiosInterceptorsRequest.patch<BillingAdminSettings>(
				'/billing-settings/admin',
				payload
			)

		return data
	}
}

export default billingSettingsService
