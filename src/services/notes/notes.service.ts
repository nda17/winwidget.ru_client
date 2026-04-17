import { axiosInterceptorsRequest } from '@/api/interceptors'

export interface Note {
	id: string
	text: string
	done: boolean
	createdAt: string
	updatedAt: string
}

const notesService = {
	async getAll(): Promise<Note[]> {
		const { data } = await axiosInterceptorsRequest.get('/notes')
		return data
	},

	async create(text: string): Promise<Note> {
		const { data } = await axiosInterceptorsRequest.post('/notes', {
			text
		})
		return data
	},

	async update(
		id: string,
		patch: { text?: string; done?: boolean }
	): Promise<Note> {
		const { data } = await axiosInterceptorsRequest.patch(
			`/notes/${id}`,
			patch
		)
		return data
	},

	async delete(id: string): Promise<void> {
		await axiosInterceptorsRequest.delete(`/notes/${id}`)
	}
}

export default notesService
