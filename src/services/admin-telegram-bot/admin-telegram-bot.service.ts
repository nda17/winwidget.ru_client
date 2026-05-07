import { axiosInterceptorsRequest } from '@/api/interceptors'

export interface AdminTelegramBotSettings {
	dailySummaryEnabled: boolean
	dailySummaryChatId: string
	dailySummaryLastSentPeriodStart: string | null
	dailySummaryLastSentAt: string | null
	telegramBotTokenConfigured: boolean
	updatedAt: string
}

export interface UpdateAdminTelegramBotSettings {
	dailySummaryEnabled?: boolean
	dailySummaryChatId?: string
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
	}
}

export default adminTelegramBotService
