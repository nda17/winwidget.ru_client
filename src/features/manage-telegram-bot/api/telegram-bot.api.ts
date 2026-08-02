import { axiosInterceptorsRequest } from '@/shared/api'

export interface AdminTelegramBotSettings {
	dailySummaryChatId: string
	supportThreadId: number | null
	databaseBackupThreadId: number | null
	paymentsThreadId: number | null
	operationalAlertsThreadId: number | null
	databaseBackupEnabled: boolean
	databaseBackupTime: string
	databaseBackupTimeLabel: string
	notificationDeliveryDatabaseBackupDelayMinutes: number
	notificationDeliveryDatabaseBackupTime: string
	notificationDeliveryDatabaseBackupTimeLabel: string
	campaignsDatabaseBackupDelayMinutes: number
	campaignsDatabaseBackupTime: string
	campaignsDatabaseBackupTimeLabel: string
	reportingDatabaseBackupDelayMinutes: number
	reportingDatabaseBackupTime: string
	reportingDatabaseBackupTimeLabel: string
	databaseBackupLastSentPeriodStart: string | null
	databaseBackupLastSentAt: string | null
	telegramBotTokenConfigured: boolean
	telegramBotUsernameConfigured: boolean
	authTelegramBotTokenConfigured: boolean
	authTelegramBotUsernameConfigured: boolean
	supportTelegramBotTokenConfigured: boolean
	telegramWebhookHostConfigured: boolean
	telegramWebhookHost: string | null
	telegramWebhookHealthUrl: string | null
	updatedAt: string
}

export interface UpdateAdminTelegramBotSettings {
	dailySummaryChatId?: string
	supportThreadId?: number | null
	databaseBackupThreadId?: number | null
	paymentsThreadId?: number | null
	operationalAlertsThreadId?: number | null
	databaseBackupEnabled?: boolean
	databaseBackupTime?: string
}

export type TelegramWebhookBot = 'info' | 'auth' | 'support'

export interface TelegramWebhookInstallResult {
	bot: TelegramWebhookBot
	title: string
	webhookUrl: string
	dropPendingUpdates: boolean
	allowedUpdates: string[]
	secretConfigured: boolean
	installedAt: string
}

export interface TelegramWebhookInstallAllResult {
	items: TelegramWebhookInstallResult[]
}

export interface TelegramWebhookStatus {
	bot: TelegramWebhookBot
	title: string
	configured: boolean
	ok: boolean
	expectedWebhookUrl: string | null
	webhookUrl: string | null
	webhookMatchesExpected: boolean
	pendingUpdateCount: number | null
	lastErrorAt: string | null
	lastErrorMessage: string | null
	allowedUpdates: string[] | null
	secretConfigured: boolean
	configuredUsername: string | null
	actualUsername: string | null
	usernameMatchesConfigured: boolean | null
	error: string | null
}

export interface TelegramWebhookStatusResponse {
	items: TelegramWebhookStatus[]
}

export type TelegramDatabaseBackupJobStatus =
	| 'QUEUED'
	| 'PROCESSING'
	| 'SUCCEEDED'
	| 'FAILED'
	| 'CANCELLED'

export type TelegramDatabaseBackupTarget =
	| 'core'
	| 'notification-delivery'
	| 'campaigns'
	| 'reporting'

export interface TelegramDatabaseBackupJobResult {
	target: TelegramDatabaseBackupTarget
	databaseName: string
	schema: string
	fileName: string
	fileSize: number
	createdAt: string
	telegramSent: true
}

export interface TelegramDatabaseBackupAcceptedJob {
	target: TelegramDatabaseBackupTarget
	jobId: string
	status: TelegramDatabaseBackupJobStatus
	queuedAt: string
	created: boolean
}

export interface TelegramDatabaseBackupJob {
	target: TelegramDatabaseBackupTarget
	jobId: string
	status: TelegramDatabaseBackupJobStatus
	queuedAt: string
	startedAt: string | null
	completedAt: string | null
	lastError: string | null
	result: TelegramDatabaseBackupJobResult | null
}

const adminTelegramBotService = {
	async get(): Promise<AdminTelegramBotSettings> {
		const { data } = await axiosInterceptorsRequest.get(
			'/telegram-bot/admin/settings'
		)
		return data
	},

	async update(
		dto: UpdateAdminTelegramBotSettings
	): Promise<AdminTelegramBotSettings> {
		const { data } = await axiosInterceptorsRequest.patch(
			'/telegram-bot/admin/settings',
			dto
		)
		return data
	},

	async reinstallWebhook(
		bot: TelegramWebhookBot
	): Promise<TelegramWebhookInstallResult> {
		const { data } = await axiosInterceptorsRequest.post(
			`/telegram-bot/admin/webhooks/${bot}/reinstall`
		)
		return data
	},

	async reinstallWebhooks(): Promise<TelegramWebhookInstallAllResult> {
		const { data } = await axiosInterceptorsRequest.post(
			'/telegram-bot/admin/webhooks/reinstall'
		)
		return data
	},

	async getWebhookStatuses(): Promise<TelegramWebhookStatusResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/telegram-bot/admin/webhooks/status'
		)
		return data
	},

	async sendDatabaseBackup(
		target: TelegramDatabaseBackupTarget,
		idempotencyKey: string
	): Promise<TelegramDatabaseBackupAcceptedJob> {
		const { data } = await axiosInterceptorsRequest.post(
			`/telegram-bot/admin/database-backups/${target}/send`,
			undefined,
			{
				headers: {
					'Idempotency-Key': idempotencyKey
				}
			}
		)
		return data
	},

	async getLatestActiveDatabaseBackupJob(
		target: TelegramDatabaseBackupTarget
	): Promise<TelegramDatabaseBackupJob | null> {
		const { data } =
			await axiosInterceptorsRequest.get<TelegramDatabaseBackupJob | null>(
				`/telegram-bot/admin/database-backups/${target}/jobs/active`
			)
		return data
	},

	async getDatabaseBackupJob(
		target: TelegramDatabaseBackupTarget,
		jobId: string
	): Promise<TelegramDatabaseBackupJob> {
		const { data } =
			await axiosInterceptorsRequest.get<TelegramDatabaseBackupJob>(
				`/telegram-bot/admin/database-backups/${target}/jobs/${jobId}`
			)
		return data
	}
}

export default adminTelegramBotService
