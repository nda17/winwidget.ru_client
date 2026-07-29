import { axiosInterceptorsRequest } from '@/shared/api'

export type AdminAlertType =
	| 'SUBSCRIPTION_EXPIRES_SOON'
	| 'EXPIRED_ACTIVE_SUBSCRIPTION'
	| 'PENDING_PAYMENT'
	| 'USER_WITHOUT_CONTACT'
	| 'ACTIVE_SUBSCRIBER_WITHOUT_CONTACT'
	| 'SUCCEEDED_PAYMENT_WITHOUT_ACCESS'
	| 'MULTIPLE_PENDING_PAYMENTS'
	| 'ACTIVE_WIDGET_WITHOUT_ACCESS'
	| 'WIDGET_DOMAIN_CONFLICT'
	| 'WIDGET_INVALID_DOMAIN'
	| 'INTEGRATION_PROBLEM'
	| 'AFFILIATE_REWARD_STALE'
	| 'AFFILIATE_REWARD_PAYMENT_CANCELLED'

export type AdminAlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW'

export interface IAdminAlertTargetUser {
	id: string
	name: string | null
	email: string | null
	phone: string | null
}

export interface IAdminAlert {
	type: AdminAlertType
	severity: AdminAlertSeverity
	referenceId: string
	targetUser: IAdminAlertTargetUser | null
	title: string
	message: string
	alertAt: string
}

export interface IAdminAlertsResponse {
	items: IAdminAlert[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface IAdminAlertFilters {
	type?: AdminAlertType
	severity?: AdminAlertSeverity
	search?: string
}

const adminAlertsService = {
	async getAll(
		page: number,
		limit: number,
		filters?: IAdminAlertFilters
	): Promise<IAdminAlertsResponse> {
		const { data } = await axiosInterceptorsRequest.get('/admin-alerts', {
			params: { page, limit, ...filters }
		})
		return data
	}
}

export default adminAlertsService
