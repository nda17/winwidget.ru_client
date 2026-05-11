import { axiosInterceptorsRequest } from '@/api/interceptors'

export type AdminAlertType =
	| 'SUBSCRIPTION_EXPIRES_SOON'
	| 'EXPIRED_ACTIVE_SUBSCRIPTION'
	| 'PENDING_PAYMENT'
	| 'USER_WITHOUT_CONTACT'

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
