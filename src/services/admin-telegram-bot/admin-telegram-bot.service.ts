import { axiosInterceptorsRequest } from '@/api/interceptors'

export interface AdminTelegramBotSettings {
	dailySummaryEnabled: boolean
	dailySummaryChatId: string
	dailySummaryLastSentPeriodStart: string | null
	dailySummaryLastSentAt: string | null
	databaseBackupLastSentPeriodStart: string | null
	databaseBackupLastSentAt: string | null
	databaseBackupTime: string
	databaseRestoreConfirmation: string
	telegramBotTokenConfigured: boolean
	telegramBotUsernameConfigured: boolean
	authTelegramBotTokenConfigured: boolean
	authTelegramBotUsernameConfigured: boolean
	supportTelegramBotTokenConfigured: boolean
	telegramWebhookHostConfigured: boolean
	updatedAt: string
}

export interface UpdateAdminTelegramBotSettings {
	dailySummaryEnabled?: boolean
	dailySummaryChatId?: string
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

export interface TelegramDatabaseBackupResult {
	fileName: string
	fileSize: number
	createdAt: string
	sent: boolean
}

export interface TelegramDatabaseRestoreResult {
	restored: boolean
	fileName: string
	fileSize: number
	restoredAt: string
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

	async sendDatabaseBackup(): Promise<TelegramDatabaseBackupResult> {
		const { data } = await axiosInterceptorsRequest.post(
			'/telegram-bot/admin/database-backup/send'
		)
		return data
	},

	async restoreDatabaseBackup(
		file: File,
		confirmation: string
	): Promise<TelegramDatabaseRestoreResult> {
		const formData = new FormData()
		formData.append('file', file)
		formData.append('confirmation', confirmation)

		const { data } = await axiosInterceptorsRequest.post(
			'/telegram-bot/admin/database-backup/restore',
			formData,
			{
				headers: { 'Content-Type': 'multipart/form-data' }
			}
		)

		return data
	}
}

export default adminTelegramBotService
