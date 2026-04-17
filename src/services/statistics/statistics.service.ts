import { axiosInterceptorsRequest } from '@/api/interceptors'

export interface IUserRegistrationsByMonth {
	month: string
	year: number
	count: number
}

export interface IStatisticsOverview {
	totalUsers: number
	activeUsers30d: number
	newUsers30d: number
	multiLoginUsers: number
	adminUsers: number
}

class StatisticsService {
	private _BASE_URL = '/statistics'

	async getRegistrationsByMonth() {
		return axiosInterceptorsRequest.get<IUserRegistrationsByMonth[]>(
			`${this._BASE_URL}/registrations-by-month`
		)
	}

	async getOverview() {
		return axiosInterceptorsRequest.get<IStatisticsOverview>(
			`${this._BASE_URL}/overview`
		)
	}
}

const statisticsService = new StatisticsService()

export default statisticsService
