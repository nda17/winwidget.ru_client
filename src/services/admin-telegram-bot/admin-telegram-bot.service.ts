import { axiosInterceptorsRequest } from '@/api/interceptors'

export interface AdminTelegramBotSettings {
	dailySummaryEnabled: boolean
	dailySummaryChatId: string
	dailySummaryLastSentPeriodStart: string | null
	dailySummaryLastSentAt: string | null
	telegramBotTokenConfigured: boolean
	telegramBotUsernameConfigured: boolean
	authTelegramBotTokenConfigured: boolean
	authTelegramBotUsernameConfigured: boolean
	telegramWebhookHostConfigured: boolean
	updatedAt: string
}

export interface UpdateAdminTelegramBotSettings {
	dailySummaryEnabled?: boolean
	dailySummaryChatId?: string
}

export type TelegramWebhookBot = 'info' | 'auth'

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
	}
}

export default adminTelegramBotService
