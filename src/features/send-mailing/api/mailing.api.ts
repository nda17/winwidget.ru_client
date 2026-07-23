import { axiosInterceptorsRequest } from '@/shared/api'

export type AdminMailingAudience = 'ACTIVE_SUBSCRIPTION' | 'ALL'
export type AdminMailingChannel = 'EMAIL' | 'TELEGRAM' | 'BOTH'
export type AdminMailingCampaignStatus =
	| 'QUEUED'
	| 'RUNNING'
	| 'COMPLETED'
	| 'PARTIAL_FAILED'
	| 'CANCELLED'

export interface IAdminBroadcastInput {
	subject: string
	message: string
	audience: AdminMailingAudience
	channel: AdminMailingChannel
}

export interface IAdminMailingCampaign {
	id: string
	subject: string
	message: string
	audience: AdminMailingAudience
	requestedChannel: AdminMailingChannel
	status: AdminMailingCampaignStatus
	recipientCount: number
	sentCount: number
	failedCount: number
	cancelledCount: number
	emailRecipientCount: number
	telegramRecipientCount: number
	startedAt: string | null
	completedAt: string | null
	cancelRequestedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface IAdminMailingCampaignsResponse {
	items: IAdminMailingCampaign[]
	total: number
	page: number
	limit: number
	totalPages: number
}

const adminMailingsService = {
	async sendBroadcast(
		payload: IAdminBroadcastInput
	): Promise<IAdminMailingCampaign> {
		const { data } = await axiosInterceptorsRequest.post(
			'/mailings/admin/broadcast',
			payload
		)
		return data
	},

	async getCampaigns(page: number, limit: number) {
		const { data } =
			await axiosInterceptorsRequest.get<IAdminMailingCampaignsResponse>(
				'/mailings/admin/campaigns',
				{ params: { page, limit } }
			)
		return data
	},

	async cancelCampaign(id: string): Promise<IAdminMailingCampaign> {
		const { data } = await axiosInterceptorsRequest.post(
			`/mailings/admin/campaigns/${id}/cancel`
		)
		return data
	}
}

export default adminMailingsService
