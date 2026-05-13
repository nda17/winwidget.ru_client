import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	StopOfferConfig,
	StopOfferLeadsResponse,
	StopOffersResponse
} from '@/services/stop-offer/stop-offer.types'

const stopOfferService = {
	async getMyStopOffers(): Promise<StopOffersResponse> {
		const { data } = await axiosInterceptorsRequest.get('/stop-offers')
		return data
	},

	async createStopOffer(name?: string) {
		const { data } = await axiosInterceptorsRequest.post('/stop-offers', {
			name
		})
		return data
	},

	async updateStopOffer(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<StopOfferConfig>
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/stop-offers/${id}`,
			payload
		)
		return data
	},

	async deleteStopOffer(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/stop-offers/${id}`
		)
		return data
	},

	async getLeads(
		id: string,
		page = 1,
		limit = 50
	): Promise<StopOfferLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/stop-offers/${id}/leads`,
			{ params: { page, limit } }
		)
		return data
	},

	async getAllLeads(id: string): Promise<StopOfferLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/stop-offers/${id}/leads`,
			{ params: { page: 1, limit: 10000 } }
		)
		return data
	},

	async exportLeads(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
		const { data } = await axiosInterceptorsRequest.get(
			`/stop-offers/${id}/leads/export`,
			{ params: { format }, responseType: 'blob' }
		)
		return data
	}
}

export default stopOfferService
