import { axiosInterceptorsRequest } from '@/api/interceptors'
import {
	QuizConfig,
	QuizLeadsResponse,
	QuizzesResponse
} from '@/services/quiz/quiz.types'

const quizService = {
	async getMyQuizzes(): Promise<QuizzesResponse> {
		const { data } = await axiosInterceptorsRequest.get('/quizzes')
		return data
	},

	async createQuiz(name?: string) {
		const { data } = await axiosInterceptorsRequest.post('/quizzes', {
			name
		})
		return data
	},

	async updateQuiz(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<QuizConfig>
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/quizzes/${id}`,
			payload
		)
		return data
	},

	async deleteQuiz(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/quizzes/${id}`
		)
		return data
	},

	async getLeads(
		id: string,
		page = 1,
		limit = 50
	): Promise<QuizLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/quizzes/${id}/leads`,
			{ params: { page, limit } }
		)
		return data
	},

	async getAllLeads(id: string): Promise<QuizLeadsResponse> {
		const { data } = await axiosInterceptorsRequest.get(
			`/quizzes/${id}/leads`,
			{ params: { page: 1, limit: 10000 } }
		)
		return data
	},

	async exportLeads(id: string, format: 'csv' | 'xlsx'): Promise<Blob> {
		const { data } = await axiosInterceptorsRequest.get(
			`/quizzes/${id}/leads/export`,
			{ params: { format }, responseType: 'blob' }
		)
		return data
	},

	async getLeadsStats(id: string) {
		const { data } = await axiosInterceptorsRequest.get(
			`/quizzes/${id}/leads/stats`
		)
		return data
	}
}

export default quizService
