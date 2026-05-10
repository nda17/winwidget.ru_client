import { axiosInterceptorsRequest } from '@/api/interceptors'

export type AdminMailingAudience = 'ACTIVE_SUBSCRIPTION' | 'ALL'
export type AdminMailingChannel = 'EMAIL' | 'TELEGRAM' | 'BOTH'

export interface IAdminBroadcastInput {
	subject: string
	message: string
	audience: AdminMailingAudience
	channel: AdminMailingChannel
}

export interface IAdminBroadcastResult {
	audience: AdminMailingAudience
	channel: AdminMailingChannel
	recipientCount: number
	sentCount: number
	failedCount: number
	emailRecipientCount: number
	emailSentCount: number
	emailFailedCount: number
	telegramRecipientCount: number
	telegramSentCount: number
	telegramFailedCount: number
	executedAt: string
}

const adminMailingsService = {
	async sendBroadcast(
		payload: IAdminBroadcastInput
	): Promise<IAdminBroadcastResult> {
		const { data } = await axiosInterceptorsRequest.post(
			'/mailings/admin/broadcast',
			payload
		)
		return data
	}
}

export default adminMailingsService
