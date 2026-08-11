import { axiosInterceptorsRequest } from '@/shared/api'

export interface DatabaseRestoreResult {
	restored: boolean
	fileName: string
	fileSize: number
	restoredAt: string
}

export interface DatabaseRestoreSettings {
	confirmation: string
}

export type DatabaseRestoreTarget =
	| 'core'
	| 'notification-delivery'
	| 'campaigns'
	| 'reporting'
	| 'widgets'
	| 'billing'

export type DatabaseRestoreJobStatus =
	| 'QUEUED'
	| 'PROCESSING'
	| 'CANCELLED'
	| 'SUCCEEDED'
	| 'FAILED'
	| 'FAILED_FENCED'

export interface DatabaseRestoreTargetSettings {
	id: DatabaseRestoreTarget
	label: string
	confirmation: string
}

export interface DatabaseRestoreApproval {
	target: DatabaseRestoreTarget
	jobId: string
	expiresAt: string
}

export interface DatabaseRestoresSettings {
	enabled: boolean
	approved: DatabaseRestoreApproval | null
	maxFileSizeBytes: number
	allowedFileExtension: string
	targets: DatabaseRestoreTargetSettings[]
}

export interface DatabaseRestoreJobError {
	code: string
	message: string
}

export interface DatabaseRestoreJob {
	jobId: string
	target: DatabaseRestoreTarget
	status: DatabaseRestoreJobStatus
	originalFileName: string
	fileSize: number
	sha256: string
	requestedAt: string
	startedAt: string | null
	finishedAt: string | null
	attempt: number
	error: DatabaseRestoreJobError | null
	canCancel: boolean
	cancellationPending: boolean
	cancellationRequested: boolean
	publicationConfirmed: boolean
}

const devToolsService = {
	async getDatabaseRestoreSettings(): Promise<DatabaseRestoreSettings> {
		const { data } =
			await axiosInterceptorsRequest.get<DatabaseRestoreSettings>(
				'/dev-tools/database-backup/restore-settings'
			)

		return data
	},

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
	},

	async getDatabaseRestoresSettings(): Promise<DatabaseRestoresSettings> {
		const { data } =
			await axiosInterceptorsRequest.get<DatabaseRestoresSettings>(
				'/dev-tools/database-restores/settings'
			)

		return data
	},

	async startDatabaseRestore(
		target: DatabaseRestoreTarget,
		file: File,
		confirmation: string,
		requestId?: string
	): Promise<DatabaseRestoreJob> {
		const formData = new FormData()
		formData.append('file', file)
		formData.append('confirmation', confirmation)
		if (requestId) formData.append('requestId', requestId)

		const { data } =
			await axiosInterceptorsRequest.post<DatabaseRestoreJob>(
				`/dev-tools/database-restores/${encodeURIComponent(target)}`,
				formData,
				{
					headers: { 'Content-Type': 'multipart/form-data' }
				}
			)

		return data
	},

	async getDatabaseRestoreJob(
		jobId: string,
		signal?: AbortSignal
	): Promise<DatabaseRestoreJob> {
		const { data } =
			await axiosInterceptorsRequest.get<DatabaseRestoreJob>(
				`/dev-tools/database-restores/jobs/${encodeURIComponent(jobId)}`,
				{ signal }
			)

		return data
	},

	async cancelDatabaseRestoreJob(
		jobId: string
	): Promise<DatabaseRestoreJob> {
		const { data } =
			await axiosInterceptorsRequest.post<DatabaseRestoreJob>(
				`/dev-tools/database-restores/jobs/${encodeURIComponent(jobId)}/cancel`
			)

		return data
	}
}

export default devToolsService
