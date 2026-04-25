import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	BillingPeriod,
	Plan,
	Subscription
} from '@/services/widget/widget.types'
import { IUser } from '@/shared/types/user.types'

export interface IAdminSubscription extends Subscription {
	user: Pick<IUser, 'id' | 'name' | 'email'>
}

export interface IAdminActivateInput {
	userId: string
	plan: Plan
	billingPeriod?: BillingPeriod
	startsAt?: string
	extendIfActive?: boolean
}

export interface IPendingPayment {
	id: string
	yookassaId: string
	amount: string
	plan: Plan | null
	billingPeriod: BillingPeriod | null
	confirmationUrl: string | null
	createdAt: string
}

export interface IPaymentVerification {
	activated: boolean
	status: 'succeeded' | 'pending' | 'cancelled' | 'not_found'
	plan: Plan | null
	billingPeriod: BillingPeriod | null
	message: string
}

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

	async verifyPayment(): Promise<IPaymentVerification> {
		const { data } =
			await axiosInterceptorsRequest.post('/payments/verify')
		return data
	},

	async getPendingPayment(): Promise<IPendingPayment | null> {
		const { data } = await axiosInterceptorsRequest.get(
			'/payments/pending'
		)
		return data
	},

	async cancelPendingPayment(): Promise<{
		cancelled: boolean
		message: string
		cancelledAt: string
	}> {
		const { data } = await axiosInterceptorsRequest.post(
			'/payments/pending/cancel'
		)
		return data
	},

	async adminGetAll(): Promise<IAdminSubscription[]> {
		const { data } = await axiosInterceptorsRequest.get(
			'/subscriptions/admin/list'
		)
		return data
	},

	async adminActivate(body: IAdminActivateInput): Promise<Subscription> {
		const { data } = await axiosInterceptorsRequest.post(
			'/subscriptions/admin/activate',
			body
		)
		return data
	},

	async adminCancel(userId: string): Promise<Subscription> {
		const { data } = await axiosInterceptorsRequest.patch(
			`/subscriptions/admin/${userId}/cancel`
		)
		return data
	}
}

export default subscriptionService
