import { axiosInterceptorsRequest } from '@/shared/api'

export interface AdminTelegramBotSettings {
	dailySummaryEnabled: boolean
	dailySummaryChatId: string
	supportThreadId: number | null
	databaseBackupThreadId: number | null
	paymentsThreadId: number | null
	reportsThreadId: number | null
	dailySummaryTime: string
	dailySummaryTimeLabel: string
	dailySummaryLastSentPeriodStart: string | null
	dailySummaryLastSentAt: string | null
	databaseBackupEnabled: boolean
	databaseBackupTime: string
	databaseBackupTimeLabel: string
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
	dailySummaryEnabled?: boolean
	dailySummaryChatId?: string
	supportThreadId?: number | null
	databaseBackupThreadId?: number | null
	paymentsThreadId?: number | null
	reportsThreadId?: number | null
	dailySummaryTime?: string
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

export interface TelegramDatabaseBackupJobResult {
	fileName: string
	fileSize: number
	createdAt: string
	telegramSent: boolean
}

export interface TelegramDatabaseBackupAcceptedJob {
	jobId: string
	status: TelegramDatabaseBackupJobStatus
	queuedAt: string
	created: boolean
}

export interface TelegramDatabaseBackupJob {
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
		idempotencyKey: string
	): Promise<TelegramDatabaseBackupAcceptedJob> {
		const { data } = await axiosInterceptorsRequest.post(
			'/telegram-bot/admin/database-backup/send',
			undefined,
			{
				headers: {
					'Idempotency-Key': idempotencyKey
				}
			}
		)
		return data
	},

	async getLatestActiveDatabaseBackupJob(): Promise<TelegramDatabaseBackupJob | null> {
		const { data } =
			await axiosInterceptorsRequest.get<TelegramDatabaseBackupJob | null>(
				'/telegram-bot/admin/database-backup/jobs/active'
			)
		return data
	},

	async getDatabaseBackupJob(
		jobId: string
	): Promise<TelegramDatabaseBackupJob> {
		const { data } =
			await axiosInterceptorsRequest.get<TelegramDatabaseBackupJob>(
				`/telegram-bot/admin/database-backup/jobs/${jobId}`
			)
		return data
	}
}

export default adminTelegramBotService
