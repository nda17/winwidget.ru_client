import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	BillingPeriod,
	Plan,
	Subscription
} from '@/services/widget/widget.types'

export interface IAdminSubscriptionUser {
	id: string
	name: string | null
	email: string | null
}

export interface IAdminSubscription extends Subscription {
	user: IAdminSubscriptionUser | null
}

export interface IAdminSubscriptionsResponse {
	items: IAdminSubscription[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export type SubscriptionHistoryAction = 'BONUS_DAYS'
export type AdminBonusAudience =
	| 'SINGLE'
	| 'ACTIVE_SUBSCRIPTION'
	| 'INACTIVE_SUBSCRIPTION'
	| 'ALL'

export interface IAdminSubscriptionHistory {
	id: string
	subscriptionId: string | null
	userId: string | null
	adminId: string | null
	action: SubscriptionHistoryAction
	days: number | null
	oldExpiresAt: string | null
	newExpiresAt: string | null
	targetAudience: AdminBonusAudience | null
	targetLabel: string | null
	affectedUsersCount: number | null
	createdAt: string
	user: IAdminSubscriptionUser | null
	admin: IAdminSubscriptionUser | null
}

export interface IAdminSubscriptionHistoryResponse {
	items: IAdminSubscriptionHistory[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface IAdminActivateInput {
	userId: string
	plan: Plan
	billingPeriod?: BillingPeriod
	startsAt?: string
	extendIfActive?: boolean
}

export interface IAdminExtendDaysInput {
	userId?: string
	days: number
	audience?: AdminBonusAudience
}

export interface IAdminExtendDaysResult {
	audience: AdminBonusAudience
	audienceLabel: string
	affectedUsersCount: number
	historyId: string
	subscription?: Subscription
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

	async adminGetAll(
		page: number,
		limit: number
	): Promise<IAdminSubscriptionsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/subscriptions/admin/list',
			{
				params: { page, limit }
			}
		)
		return data
	},

	async adminGetHistory(
		page: number,
		limit: number
	): Promise<IAdminSubscriptionHistoryResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/subscriptions/admin/history',
			{
				params: { page, limit }
			}
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

	async adminExtendDays(
		body: IAdminExtendDaysInput
	): Promise<IAdminExtendDaysResult> {
		const { data } = await axiosInterceptorsRequest.post(
			'/subscriptions/admin/extend-days',
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
