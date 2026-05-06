import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	CountdownTimerConfig,
	CountdownTimerLeadsResponse,
	CountdownTimersResponse
} from '@/services/countdown-timer/countdown-timer.types'

const countdownTimerService = {
	async getMyCountdownTimers(): Promise<CountdownTimersResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			'/countdown-timers'
		)
		return data
	},

	async createCountdownTimer(name?: string) {
		const { data } = await axiosInterceptorsRequest.post(
			'/countdown-timers',
			{ name }
		)
		return data
	},

	async updateCountdownTimer(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<CountdownTimerConfig>
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/countdown-timers/${id}`,
			payload
		)
		return data
	},

	async uploadButtonImage(id: string, file: FormData) {
		const { data } = await axiosInterceptorsRequest.post(
			`/countdown-timers/${id}/button-image`,
			file,
			{
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			}
		)
		return data
	},

	async deleteCountdownTimer(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/countdown-timers/${id}`
		)
		return data
	},

	async getLeads(
		id: string,
		page = 1,
		limit = 50
	): Promise<CountdownTimerLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/countdown-timers/${id}/leads`,
			{ params: { page, limit } }
		)
		return data
	},

	async getAllLeads(id: string): Promise<CountdownTimerLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/countdown-timers/${id}/leads`,
			{ params: { page: 1, limit: 10000 } }
		)
		return data
	},

	async exportLeads(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
		const { data } = await axiosInterceptorsRequest.get(
			`/countdown-timers/${id}/leads/export`,
			{ params: { format }, responseType: 'blob' }
		)
		return data
	}
}

export default countdownTimerService
