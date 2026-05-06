import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	CallbackConfig,
	CallbackLeadsResponse,
	CallbacksResponse
} from '@/services/callback/callback.types'

const callbackService = {
	async getMyCallbacks(): Promise<CallbacksResponse> {
		const { data } = await axiosInterceptorsRequest.get('/callbacks')
		return data
	},

	async createCallback(name?: string) {
		const { data } = await axiosInterceptorsRequest.post('/callbacks', {
			name
		})
		return data
	},

	async updateCallback(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<CallbackConfig>
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/callbacks/${id}`,
			payload
		)
		return data
	},

	async uploadButtonImage(id: string, file: FormData) {
		const { data } = await axiosInterceptorsRequest.post(
			`/callbacks/${id}/button-image`,
			file,
			{
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			}
		)
		return data
	},

	async deleteCallback(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/callbacks/${id}`
		)
		return data
	},

	async getLeads(
		id: string,
		page = 1,
		limit = 50
	): Promise<CallbackLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/callbacks/${id}/leads`,
			{
				params: { page, limit }
			}
		)
		return data
	},

	async getAllLeads(id: string): Promise<CallbackLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/callbacks/${id}/leads`,
			{
				params: { page: 1, limit: 10000 }
			}
		)
		return data
	},

	async exportLeads(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
		const { data } = await axiosInterceptorsRequest.get(
			`/callbacks/${id}/leads/export`,
			{
				params: { format },
				responseType: 'blob'
			}
		)
		return data
	}
}

export default callbackService
