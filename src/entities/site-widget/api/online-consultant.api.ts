import { axiosInterceptorsRequest } from '@/shared/api'
import {
	OnlineConsultantConfig,
	OnlineConsultantLeadsResponse,
	OnlineConsultantsResponse
} from '@/entities/site-widget/model/online-consultant.types'

const onlineConsultantService = {
	async getMyOnlineConsultants(): Promise<OnlineConsultantsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/online-consultants'
		)
		return data
	},

	async createOnlineConsultant(name?: string) {
		const { data } = await axiosInterceptorsRequest.post(
			'/online-consultants',
			{ name }
		)
		return data
	},

	async updateOnlineConsultant(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<OnlineConsultantConfig>
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/online-consultants/${id}`,
			payload
		)
		return data
	},

	async uploadButtonImage(id: string, file: FormData) {
		const { data } = await axiosInterceptorsRequest.post(
			`/online-consultants/${id}/button-image`,
			file,
			{
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			}
		)
		return data
	},

	async deleteOnlineConsultant(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/online-consultants/${id}`
		)
		return data
	},

	async getLeads(
		id: string,
		page = 1,
		limit = 50
	): Promise<OnlineConsultantLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/online-consultants/${id}/leads`,
			{ params: { page, limit } }
		)
		return data
	},

	async getAllLeads(id: string): Promise<OnlineConsultantLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/online-consultants/${id}/leads`,
			{ params: { page: 1, limit: 10000 } }
		)
		return data
	},

	async exportLeads(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
		const { data } = await axiosInterceptorsRequest.get(
			`/online-consultants/${id}/leads/export`,
			{ params: { format }, responseType: 'blob' }
		)
		return data
	}
}

export default onlineConsultantService
