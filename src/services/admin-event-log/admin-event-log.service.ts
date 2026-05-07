import { axiosInterceptorsRequest } from '@/api/interceptors'

export type AdminEventLogSection =
	| 'PAYMENTS'
	| 'MAILINGS'
	| 'TASKS'
	| 'SUBSCRIPTIONS'
	| 'USERS'
	| 'BACKLOG'
	| 'TELEGRAM_BOT'

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
	| 'TELEGRAM_BOT_SETTINGS_UPDATE'

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

export interface IAdminEventLogFilters {
	userId?: string
	adminId?: string
	section?: AdminEventLogSection
	action?: AdminEventLogAction
	createdFrom?: string
	createdTo?: string
}

const adminEventLogService = {
	async getAll(
		page: number,
		limit: number,
		filters?: IAdminEventLogFilters
	): Promise<IAdminEventLogResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/admin-event-log',
			{
				params: { page, limit, ...filters }
			}
		)
		return data
	}
}

export default adminEventLogService
