import { axiosInterceptorsRequest } from '@/shared/api'
import type { Plan, SubscriptionStatus } from '@/entities/subscription'
import type { UserStatus } from '@/entities/user'
import type {
	Calculator,
	Callback,
	CountdownTimer,
	AiConsultant,
	Quiz,
	StopOffer,
	Widget,
	WidgetCloneResponse,
	WidgetConfigVersionsResponse,
	WidgetLifecycleState,
	WidgetRuntimeAnalytics,
	WidgetRuntimeStatus
} from '@/entities/site-widget'

export type AdminWidgetType =
	| 'WHEEL'
	| 'QUIZ'
	| 'CALLBACK'
	| 'TIMER'
	| 'STOP_OFFER'
	| 'AI_CONSULTANT'
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

export interface AdminWidgetEntityMap {
	WHEEL: Widget
	QUIZ: Quiz
	CALLBACK: Callback
	TIMER: CountdownTimer
	STOP_OFFER: StopOffer
	AI_CONSULTANT: AiConsultant
	CALCULATOR: Calculator
}

export type AdminWidgetEntity =
	AdminWidgetEntityMap[keyof AdminWidgetEntityMap]

export type AdminWidgetDetails = {
	[TType in AdminWidgetType]: {
		type: TType
		entity: AdminWidgetEntityMap[TType]
		owner: IAdminWidgetOwner
		ownerStatus: UserStatus
		ownerPlan: Plan | null
		subscriptionStatus: SubscriptionStatus | null
		lifecycle: WidgetLifecycleState<AdminWidgetEntityMap[TType]['config']>
	}
}[AdminWidgetType]

export interface IAdminWidgetUpdatePayload<TType extends AdminWidgetType> {
	name?: string
	isActive?: boolean
	installDomain?: string
	config?: Partial<AdminWidgetEntityMap[TType]['config']>
	expectedDraftRevision?: number
}

export interface IAdminWidgetMutationResponse<
	TType extends AdminWidgetType
> {
	type: TType
	entity: AdminWidgetEntityMap[TType]
}

export interface IAdminWidgetDeleteResponse<
	TType extends AdminWidgetType = AdminWidgetType
> {
	type: TType
	id: string
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
	},

	async getById<TType extends AdminWidgetType>(
		type: TType,
		id: string
	): Promise<Extract<AdminWidgetDetails, { type: TType }>> {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/admin/${type}/${id}`
		)
		return data
	},

	async update<TType extends AdminWidgetType>(
		type: TType,
		id: string,
		payload: IAdminWidgetUpdatePayload<TType>
	): Promise<IAdminWidgetMutationResponse<TType>> {
		const { data } = await axiosInterceptorsRequest.patch(
			`/widgets/admin/${type}/${id}`,
			payload
		)
		return data
	},

	async publish<TType extends AdminWidgetType>(
		type: TType,
		id: string,
		expectedDraftRevision: number
	): Promise<WidgetLifecycleState<AdminWidgetEntityMap[TType]['config']>> {
		const { data } = await axiosInterceptorsRequest.post(
			`/widgets/admin/${type}/${id}/publish`,
			{ expectedDraftRevision }
		)
		return data
	},

	async discardDraft<TType extends AdminWidgetType>(
		type: TType,
		id: string,
		expectedDraftRevision: number
	): Promise<WidgetLifecycleState<AdminWidgetEntityMap[TType]['config']>> {
		const { data } = await axiosInterceptorsRequest.post(
			`/widgets/admin/${type}/${id}/discard-draft`,
			{ expectedDraftRevision }
		)
		return data
	},

	async getVersions(
		type: AdminWidgetType,
		id: string,
		page = 1,
		limit = 10
	): Promise<WidgetConfigVersionsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/admin/${type}/${id}/versions`,
			{ params: { page, limit } }
		)
		return data
	},

	async restoreVersion<TType extends AdminWidgetType>(
		type: TType,
		id: string,
		version: number,
		expectedDraftRevision: number
	): Promise<WidgetLifecycleState<AdminWidgetEntityMap[TType]['config']>> {
		const { data } = await axiosInterceptorsRequest.post(
			`/widgets/admin/${type}/${id}/versions/${version}/restore`,
			{ expectedDraftRevision }
		)
		return data
	},

	async clone(
		type: AdminWidgetType,
		id: string
	): Promise<WidgetCloneResponse> {
		const { data } = await axiosInterceptorsRequest.post(
			`/widgets/admin/${type}/${id}/clone`,
			{}
		)
		return data
	},

	async getRuntimeStatus(
		type: AdminWidgetType,
		id: string
	): Promise<WidgetRuntimeStatus> {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/admin/${type}/${id}/runtime-status`
		)
		return data
	},

	async getAnalytics(
		type: AdminWidgetType,
		id: string,
		days = 30
	): Promise<WidgetRuntimeAnalytics> {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/admin/${type}/${id}/analytics`,
			{ params: { days } }
		)
		return data
	},

	async deleteWidget<TType extends AdminWidgetType>(
		type: TType,
		id: string
	): Promise<IAdminWidgetDeleteResponse<TType>> {
		const { data } = await axiosInterceptorsRequest.delete<
			IAdminWidgetDeleteResponse<TType>
		>(`/widgets/admin/${type}/${id}`)
		return data
	},

	async uploadButtonImage<
		TType extends Exclude<AdminWidgetType, 'STOP_OFFER'>
	>(
		type: TType,
		id: string,
		file: FormData
	): Promise<IAdminWidgetMutationResponse<TType>> {
		const { data } = await axiosInterceptorsRequest.post(
			`/widgets/admin/${type}/${id}/button-image`,
			file,
			{
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			}
		)
		return data
	}
}

export default adminWidgetsService
