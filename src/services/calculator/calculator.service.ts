import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	CalculatorConfig,
	CalculatorLeadsResponse,
	CalculatorsResponse
} from '@/services/calculator/calculator.types'

const calculatorService = {
	async getMyCalculators(): Promise<CalculatorsResponse> {
		const { data } = await axiosInterceptorsRequest.get('/calculators')
		return data
	},

	async createCalculator(name?: string) {
		const { data } = await axiosInterceptorsRequest.post('/calculators', {
			name
		})
		return data
	},

	async updateCalculator(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<CalculatorConfig>
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/calculators/${id}`,
			payload
		)
		return data
	},

	async uploadButtonImage(id: string, file: FormData) {
		const { data } = await axiosInterceptorsRequest.post(
			`/calculators/${id}/button-image`,
			file,
			{ headers: { 'Content-Type': 'multipart/form-data' } }
		)
		return data
	},

	async deleteCalculator(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/calculators/${id}`
		)
		return data
	},

	async getLeads(
		id: string,
		page = 1,
		limit = 50
	): Promise<CalculatorLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/calculators/${id}/leads`,
			{ params: { page, limit } }
		)
		return data
	},

	async getAllLeads(id: string): Promise<CalculatorLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/calculators/${id}/leads`,
			{ params: { page: 1, limit: 10000 } }
		)
		return data
	},

	async exportLeads(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
		const { data } = await axiosInterceptorsRequest.get(
			`/calculators/${id}/leads/export`,
			{ params: { format }, responseType: 'blob' }
		)
		return data
	}
}

export default calculatorService
