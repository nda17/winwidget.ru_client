import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	LeadsResponse,
	WidgetConfig,
	WidgetsResponse
} from '@/services/widget/widget.types'

const widgetService = {
	async getMyWidgets(): Promise<WidgetsResponse> {
		const { data } = await axiosInterceptorsRequest.get('/widgets')
		return data
	},

	async createWidget(name?: string) {
		const { data } = await axiosInterceptorsRequest.post('/widgets', {
			name
		})
		return data
	},

	async updateWidget(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<WidgetConfig>
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/widgets/${id}`,
			payload
		)
		return data
	},

	async uploadButtonImage(id: string, file: FormData) {
		const { data } = await axiosInterceptorsRequest.post(
			`/widgets/${id}/button-image`,
			file,
			{
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			}
		)
		return data
	},

	async deleteWidget(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/widgets/${id}`
		)
		return data
	},

	async getLeads(
		id: string,
		page = 1,
		limit = 50
	): Promise<LeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/${id}/leads`,
			{
				params: { page, limit }
			}
		)
		return data
	},

	async getAllLeads(id: string): Promise<LeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/${id}/leads`,
			{
				params: { page: 1, limit: 10000 }
			}
		)
		return data
	},

	async exportLeads(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/${id}/leads/export`,
			{
				params: { format },
				responseType: 'blob'
			}
		)
		return data
	},

	async getLeadsStats(id: string) {
		const { data } = await axiosInterceptorsRequest.get(
			`/widgets/${id}/leads/stats`
		)
		return data
	},

	async getSubscription() {
		const { data } = await axiosInterceptorsRequest.get(
			'/subscriptions/me'
		)
		return data
	}
}

export default widgetService
