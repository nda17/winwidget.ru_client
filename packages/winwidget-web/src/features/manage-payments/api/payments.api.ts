import { axiosInterceptorsRequest } from '@/shared/api'
import type { BillingPeriod, Plan } from '@/entities/subscription'

export type AdminPaymentStatus =
	| 'PENDING'
	| 'SUCCEEDED'
	| 'CANCELLED'
	| 'EXPIRED'

export interface IAdminPaymentUser {
	id: string
	name: string | null
	email: string | null
	phone: string | null
}

export interface IAdminPayment {
	id: string
	yookassaId: string | null
	status: AdminPaymentStatus
	amount: string
	plan: Plan | null
	billingPeriod: BillingPeriod | null
	confirmationUrl: string | null
	createdAt: string
	updatedAt: string
	succeededAt: string | null
	user: IAdminPaymentUser
}

export interface IAdminPaymentsResponse {
	items: IAdminPayment[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export type AdminPaymentNullablePlanFilter = Plan | 'NONE'
export type AdminPaymentNullablePeriodFilter = BillingPeriod | 'NONE'

export interface IAdminPaymentFilters {
	status?: AdminPaymentStatus
	plan?: AdminPaymentNullablePlanFilter
	billingPeriod?: AdminPaymentNullablePeriodFilter
	createdFrom?: string
	createdTo?: string
	search?: string
}

export interface IAdminCheckPaymentResult {
	payment: IAdminPayment
	providerStatus: string
	message: string
	checkedAt: string
}

export interface IDevResolveUnknownProviderPaymentInput {
	schemaVersion: 1
	commandId: string
	paymentId: string
	resolution: 'PROVIDER_PAYMENT_NOT_FOUND'
	reason: string
	providerReconciliationConfirmed: true
	checkedMetadataPaymentId: string
	checkedProviderIdempotencyKey: string
}

export interface IDevResolveUnknownProviderPaymentResult {
	schemaVersion: 1
	resolved: true
	commandId: string
	paymentId: string
	resolution: 'PROVIDER_PAYMENT_NOT_FOUND'
	status: 'CANCELLED'
	providerStatus: 'not_found'
	resolvedAt: string
}

export interface IDevUnknownProviderPaymentEvidence {
	schemaVersion: 1
	paymentId: string
	status: 'PENDING'
	providerStatus: 'creating' | 'unknown'
	checkoutExpiresAt: string
	yookassaId: null
	providerOperation: {
		id: string
		kind: 'CREATE_CHECKOUT' | 'CAPTURE_RECURRING'
		status: 'UNKNOWN'
		providerPaymentId: null
		idempotencyKey: string
	}
}

const adminPaymentsService = {
	async getPayments(
		page: number,
		limit: number,
		filters?: IAdminPaymentFilters
	): Promise<IAdminPaymentsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/payments/admin/list',
			{
				params: { page, limit, ...filters }
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
	},

	async resolveUnknownProviderPayment(
		payload: IDevResolveUnknownProviderPaymentInput
	): Promise<IDevResolveUnknownProviderPaymentResult> {
		const { data } = await axiosInterceptorsRequest.post(
			'/payments/dev/unknown-provider/resolve',
			payload
		)
		return data
	},

	async getUnknownProviderPaymentEvidence(
		paymentId: string
	): Promise<IDevUnknownProviderPaymentEvidence> {
		const { data } = await axiosInterceptorsRequest.get(
			`/payments/dev/unknown-provider/${encodeURIComponent(paymentId)}/evidence`
		)
		return data
	}
}

export default adminPaymentsService
