import { axiosInterceptorsRequest } from '@/shared/api'

export const DATABASE_RESTORE_TARGETS = [
	'notification-delivery',
	'campaigns',
	'reporting',
	'widgets',
	'identity',
	'platform',
	'support'
] as const

export type DatabaseRestoreTarget =
	(typeof DATABASE_RESTORE_TARGETS)[number]

export type DatabaseRestoreJobStatus =
	| 'QUEUED'
	| 'PROCESSING'
	| 'CANCELLED'
	| 'SUCCEEDED'
	| 'FAILED'
	| 'RECOVERY_REQUIRED'

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

const isDatabaseRestoreTarget = (
	value: unknown
): value is DatabaseRestoreTarget =>
	typeof value === 'string' &&
	DATABASE_RESTORE_TARGETS.includes(value as DatabaseRestoreTarget)

const devToolsService = {
	async getDatabaseRestoresSettings(): Promise<DatabaseRestoresSettings> {
		const { data } =
			await axiosInterceptorsRequest.get<DatabaseRestoresSettings>(
				'/dev-tools/database-restores/settings'
			)

		return {
			...data,
			approved:
				data.approved && isDatabaseRestoreTarget(data.approved.target)
					? data.approved
					: null,
			targets: data.targets.filter(target =>
				isDatabaseRestoreTarget(target.id)
			)
		}
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
