import { axiosInterceptorsRequest } from '@/shared/api'
import type {
	AiConsultantMessageRequest,
	AiConsultantMessageResponse,
	AiConsultantConfig,
	AiConsultantsResponse
} from '@/entities/site-widget/model/ai-consultant.types'

const aiConsultantService = {
	async getMyAiConsultants(): Promise<AiConsultantsResponse> {
		const { data } =
			await axiosInterceptorsRequest.get<AiConsultantsResponse>(
				'/ai-consultants'
			)
		return data
	},

	async createAiConsultant(name?: string) {
		const { data } = await axiosInterceptorsRequest.post(
			'/ai-consultants',
			{ name }
		)
		return data
	},

	async updateAiConsultant(
		id: string,
		payload: Partial<{
			name: string
			isActive: boolean
			installDomain: string
			config: Partial<AiConsultantConfig>
			expectedDraftRevision: number
		}>
	) {
		const { data } = await axiosInterceptorsRequest.patch(
			`/ai-consultants/${id}`,
			payload
		)
		return data
	},

	async uploadButtonImage(id: string, file: FormData) {
		const { data } = await axiosInterceptorsRequest.post(
			`/ai-consultants/${id}/button-image`,
			file,
			{
				headers: {
					'Content-Type': 'multipart/form-data'
				}
			}
		)
		return data
	},

	async testMessage(
		id: string,
		payload: AiConsultantMessageRequest
	): Promise<AiConsultantMessageResponse> {
		const { data } =
			await axiosInterceptorsRequest.post<AiConsultantMessageResponse>(
				`/ai-consultants/${id}/test-message`,
				payload
			)
		return data
	},

	async deleteAiConsultant(id: string) {
		const { data } = await axiosInterceptorsRequest.delete(
			`/ai-consultants/${id}`
		)
		return data
	}
}

export default aiConsultantService
