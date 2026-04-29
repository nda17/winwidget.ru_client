import { axiosInterceptorsRequest } from '@/api/interceptors'

export type AdminMailingAudience = 'ACTIVE_SUBSCRIPTION' | 'ALL'

export interface IAdminBroadcastInput {
	subject: string
	message: string
	audience: AdminMailingAudience
}

export interface IAdminBroadcastResult {
	audience: AdminMailingAudience
	recipientCount: number
	sentCount: number
	failedCount: number
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
