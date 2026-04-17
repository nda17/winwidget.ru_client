import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	BillingPeriod,
	Plan,
	Subscription
} from '@/services/widget/widget.types'

const subscriptionService = {
	async getMySubscription(): Promise<Subscription> {
		const { data } = await axiosInterceptorsRequest.get(
			'/subscriptions/me'
		)
		return data
	},

	async createPayment(
		plan: Plan,
		billingPeriod: BillingPeriod
	): Promise<{ confirmationUrl: string }> {
		const { data } = await axiosInterceptorsRequest.post(
			'/payments/create',
			{
				plan,
				billingPeriod
			}
		)
		return data
	},

	async verifyPayment(): Promise<{ activated: boolean }> {
		const { data } =
			await axiosInterceptorsRequest.post('/payments/verify')
		return data
	}
}

export default subscriptionService
