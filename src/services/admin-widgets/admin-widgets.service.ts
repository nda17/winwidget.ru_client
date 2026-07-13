import { axiosInterceptorsRequest } from '@/api/interceptors'
import { Plan, SubscriptionStatus } from '@/services/widget/widget.types'

export type AdminWidgetType =
	| 'WHEEL'
	| 'QUIZ'
	| 'CALLBACK'
	| 'TIMER'
	| 'STOP_OFFER'
	| 'ONLINE_CONSULTANT'
	| 'CALCULATOR'
export type AdminWidgetActiveFilter = 'true' | 'false'
export type AdminWidgetPlanFilter = Plan | 'NONE'

export interface IAdminWidgetOwner {
	id: string
	name: string | null
	email: string | null
	phone: string | null
}

export interface IAdminWidgetMonitoringItem {
	type: AdminWidgetType
	id: string
	name: string
	publicKey: string
	isActive: boolean
	installDomain: string
	owner: IAdminWidgetOwner
	ownerPlan: Plan | null
	subscriptionStatus: SubscriptionStatus | null
	leadCount: number
	lastLeadAt: string | null
	createdAt: string
	updatedAt: string
}

export interface IAdminWidgetMonitoringResponse {
	items: IAdminWidgetMonitoringItem[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface IAdminWidgetMonitoringFilters {
	type?: AdminWidgetType
	isActive?: AdminWidgetActiveFilter
	plan?: AdminWidgetPlanFilter
	search?: string
}

const adminWidgetsService = {
	async getMonitoring(
		page: number,
		limit: number,
		filters?: IAdminWidgetMonitoringFilters
	): Promise<IAdminWidgetMonitoringResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/widgets/admin/monitoring',
			{
				params: { page, limit, ...filters }
			}
		)
		return data
	}
}

export default adminWidgetsService
