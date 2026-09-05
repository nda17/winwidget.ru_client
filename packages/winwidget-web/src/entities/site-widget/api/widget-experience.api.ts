import { axiosInterceptorsRequest } from '@/shared/api'
import type {
	WidgetCloneResponse,
	WidgetConfigVersionsResponse,
	WidgetExperienceType,
	WidgetLifecycleState,
	WidgetRuntimeAnalytics,
	WidgetRuntimeStatus
} from '../model/widget-experience.types'

const lifecyclePath = (type: WidgetExperienceType, id: string) =>
	`/widget-settings/${type}/${id}`

const runtimePath = (type: WidgetExperienceType, id: string) =>
	`/widget-runtime/${type}/${id}`

const widgetExperienceService = {
	async getLifecycle<TConfig>(
		type: WidgetExperienceType,
		id: string
	): Promise<WidgetLifecycleState<TConfig>> {
		const { data } = await axiosInterceptorsRequest.get(
			lifecyclePath(type, id)
		)
		return data
	},

	async publish<TConfig>(
		type: WidgetExperienceType,
		id: string,
		expectedDraftRevision: number
	): Promise<WidgetLifecycleState<TConfig>> {
		const { data } = await axiosInterceptorsRequest.post(
			`${lifecyclePath(type, id)}/publish`,
			{ expectedDraftRevision }
		)
		return data
	},

	async discardDraft<TConfig>(
		type: WidgetExperienceType,
		id: string,
		expectedDraftRevision: number
	): Promise<WidgetLifecycleState<TConfig>> {
		const { data } = await axiosInterceptorsRequest.post(
			`${lifecyclePath(type, id)}/discard-draft`,
			{ expectedDraftRevision }
		)
		return data
	},

	async getVersions(
		type: WidgetExperienceType,
		id: string,
		page = 1,
		limit = 10
	): Promise<WidgetConfigVersionsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`${lifecyclePath(type, id)}/versions`,
			{ params: { page, limit } }
		)
		return data
	},

	async restoreVersion<TConfig>(
		type: WidgetExperienceType,
		id: string,
		version: number,
		expectedDraftRevision: number
	): Promise<WidgetLifecycleState<TConfig>> {
		const { data } = await axiosInterceptorsRequest.post(
			`${lifecyclePath(type, id)}/versions/${version}/restore`,
			{ expectedDraftRevision }
		)
		return data
	},

	async clone(
		type: WidgetExperienceType,
		id: string
	): Promise<WidgetCloneResponse> {
		const { data } = await axiosInterceptorsRequest.post(
			`${lifecyclePath(type, id)}/clone`,
			{}
		)
		return data
	},

	async getRuntimeStatus(
		type: WidgetExperienceType,
		id: string
	): Promise<WidgetRuntimeStatus> {
		const { data } = await axiosInterceptorsRequest.get(
			`${runtimePath(type, id)}/status`
		)
		return data
	},

	async getAnalytics(
		type: WidgetExperienceType,
		id: string,
		days = 30
	): Promise<WidgetRuntimeAnalytics> {
		const { data } = await axiosInterceptorsRequest.get(
			`${runtimePath(type, id)}/analytics`,
			{ params: { days } }
		)
		return data
	}
}

export default widgetExperienceService
