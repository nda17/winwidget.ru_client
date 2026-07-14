import { axiosInterceptorsRequest } from '@/shared/api'

export interface DatabaseRestoreResult {
	restored: boolean
	fileName: string
	fileSize: number
	restoredAt: string
}

const devToolsService = {
	async restoreDatabaseBackup(
		file: File,
		confirmation: string
	): Promise<DatabaseRestoreResult> {
		const formData = new FormData()
		formData.append('file', file)
		formData.append('confirmation', confirmation)

		const { data } = await axiosInterceptorsRequest.post(
			'/dev-tools/database-backup/restore',
			formData,
			{
				headers: { 'Content-Type': 'multipart/form-data' }
			}
		)

		return data
	}
}

export default devToolsService
