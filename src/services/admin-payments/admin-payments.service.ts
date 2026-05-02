import { axiosInterceptorsRequest } from '@/api/interceptors'
import { BillingPeriod, Plan } from '@/services/widget/widget.types'

export type AdminPaymentStatus = 'PENDING' | 'SUCCEEDED' | 'CANCELLED'

export interface IAdminPaymentUser {
	id: string
	name: string | null
	email: string | null
	phone: string | null
}

export interface IAdminPayment {
	id: string
	yookassaId: string
	status: AdminPaymentStatus
	amount: string
	plan: Plan | null
	billingPeriod: BillingPeriod | null
	confirmationUrl: string | null
	createdAt: string
	updatedAt: string
	user: IAdminPaymentUser
}

export interface IAdminPaymentsResponse {
	items: IAdminPayment[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface IAdminCheckPaymentResult {
	payment: IAdminPayment
	providerStatus: string
	message: string
	checkedAt: string
}

const adminPaymentsService = {
	async getPayments(
		page: number,
		limit: number,
		status?: AdminPaymentStatus
	): Promise<IAdminPaymentsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/payments/admin/list',
			{
				params: { page, limit, status }
			}
		)
		return data
	},

	async checkPayment(
		paymentId: string
	): Promise<IAdminCheckPaymentResult> {
		const { data } = await axiosInterceptorsRequest.post(
			'/payments/admin/check',
			{ paymentId }
		)
		return data
	}
}

export default adminPaymentsService
