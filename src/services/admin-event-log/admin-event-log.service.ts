import { axiosInterceptorsRequest } from '@/api/interceptors'

export type AdminEventLogSection =
	| 'PAYMENTS'
	| 'MAILINGS'
	| 'TASKS'
	| 'SUBSCRIPTIONS'
	| 'USERS'
	| 'BACKLOG'

export type AdminEventLogAction =
	| 'PAYMENT_MANUAL_CHECK'
	| 'PAYMENT_CLEANUP_RUN'
	| 'MAILING_BROADCAST_SEND'
	| 'SUBSCRIPTION_ACTIVATE'
	| 'SUBSCRIPTION_EXTEND_DAYS'
	| 'SUBSCRIPTION_CANCEL'
	| 'SUBSCRIPTION_EXPIRY_CHECK_RUN'
	| 'VERIFICATION_CHALLENGE_CLEANUP_RUN'
	| 'USER_UPDATE'
	| 'USER_TOGGLE_ACTIVATION'
	| 'USER_DELETE'
	| 'BACKLOG_TASK_CREATE'
	| 'BACKLOG_TASK_UPDATE'
	| 'BACKLOG_TASK_DELETE'

export interface IAdminEventLogItem {
	id: string
	adminId: string | null
	adminName: string | null
	adminEmail: string | null
	section: AdminEventLogSection
	action: AdminEventLogAction
	description: string
	entityType: string | null
	entityId: string | null
	entityLabel: string | null
	targetUserId: string | null
	targetUserName: string | null
	targetUserEmail: string | null
	metadata: Record<string, unknown> | null
	ip: string | null
	userAgent: string | null
	createdAt: string
}

export interface IAdminEventLogResponse {
	items: IAdminEventLogItem[]
	total: number
	page: number
	limit: number
	totalPages: number
}

const adminEventLogService = {
	async getAll(
		page: number,
		limit: number,
		userId?: string
	): Promise<IAdminEventLogResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/admin-event-log',
			{
				params: { page, limit, userId: userId || undefined }
			}
		)
		return data
	}
}

export default adminEventLogService
