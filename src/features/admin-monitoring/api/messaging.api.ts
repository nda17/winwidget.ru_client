import { axiosInterceptorsRequest } from '@/shared/api'

export type MessagingIntegration =
	| 'email'
	| 'webhook'
	| 'telegram'
	| 'bitrix24'
	| 'amo-crm'
	| 'payment-email'
	| 'payment-telegram'
	| 'mailing-email'
	| 'mailing-telegram'
	| 'limit-email'
	| 'limit-telegram'

export interface MessagingOverview {
	generatedAt: string
	outbox: Record<'PENDING' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED', number>
	oldestPendingAt: string | null
	unresolvedFailures: number
	retryingFailures: number
	deliveredLast24Hours: number
	rabbitMqError: string | null
	heartbeats: Array<{
		service: string
		status: 'ok' | 'down'
		activeInstances: number
		lastSeenAt: string | null
	}>
	queues: Array<{
		name: string
		messages: number
		ready: number
		unacknowledged: number
		consumers: number
		state: string | null
	}>
}

export interface MessagingFailure {
	id: string
	eventId: string
	integration: MessagingIntegration
	attempts: number
	lastError: string
	failedAt: string
	retryingAt: string | null
	resolvedAt: string | null
	source?: { type?: string }
	entity?: { id?: string; name?: string }
	lead?: {
		id?: string | null
		contact?: string | null
		phone?: string | null
		email?: string | null
		url?: string | null
		createdAt?: string | null
	}
}

export interface MessagingFailuresResponse {
	items: MessagingFailure[]
	total: number
	page: number
	limit: number
	totalPages: number
}

class MessagingService {
	async getOverview() {
		const { data } = await axiosInterceptorsRequest.get<MessagingOverview>(
			'/messaging/admin/overview'
		)
		return data
	}

	async getFailures(params: {
		page: number
		limit: number
		integration?: string
		status?: string
	}) {
		const { data } =
			await axiosInterceptorsRequest.get<MessagingFailuresResponse>(
				'/messaging/admin/failures',
				{ params }
			)
		return data
	}

	async retryFailure(id: string) {
		const { data } = await axiosInterceptorsRequest.post(
			`/messaging/admin/failures/${id}/retry`
		)
		return data
	}
}

const messagingService = new MessagingService()

export default messagingService
