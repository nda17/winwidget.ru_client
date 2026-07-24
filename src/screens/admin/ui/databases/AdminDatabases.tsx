'use client'

import { UserRole, useUser } from '@/entities/user'
import { adminTelegramBotService } from '@/features/manage-telegram-bot'
import type { TelegramDatabaseBackupJobStatus } from '@/features/manage-telegram-bot'
import { devToolsService } from '@/features/run-admin-task'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import { errorCatch } from '@/shared/api'
import Heading from '@/shared/ui/heading/Heading'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { NextPage } from 'next'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminDatabases.module.scss'

const SETTINGS_QUERY_KEY = ['admin-telegram-bot-settings']
const RESTORE_SETTINGS_QUERY_KEY = ['admin-database-restore-settings']
const DATABASE_BACKUP_JOB_POLL_INTERVAL_MS = 2500
const DATABASE_BACKUP_STORAGE_KEY_PREFIX =
	'winwidget:admin:database-backup:active'
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TERMINAL_DATABASE_BACKUP_JOB_STATUSES: ReadonlySet<TelegramDatabaseBackupJobStatus> =
	new Set<TelegramDatabaseBackupJobStatus>([
		'SUCCEEDED',
		'FAILED',
		'CANCELLED'
	])
const DATABASE_BACKUP_JOB_STATUS_LABELS: Record<
	TelegramDatabaseBackupJobStatus,
	string
> = {
	QUEUED: 'Ожидает запуска',
	PROCESSING: 'Выполняется',
	SUCCEEDED: 'Завершён',
	FAILED: 'Ошибка',
	CANCELLED: 'Отменён'
}

interface DatabaseBackupActiveMarker {
	idempotencyKey: string | null
	jobId: string | null
}

const getDatabaseBackupMarker = (
	storageKey: string | null
): DatabaseBackupActiveMarker | null => {
	if (!storageKey || typeof window === 'undefined') return null

	try {
		const rawMarker = window.localStorage.getItem(storageKey)
		if (!rawMarker) return null

		const marker = JSON.parse(
			rawMarker
		) as Partial<DatabaseBackupActiveMarker>
		const idempotencyKey =
			typeof marker.idempotencyKey === 'string' &&
			UUID_PATTERN.test(marker.idempotencyKey)
				? marker.idempotencyKey.toLowerCase()
				: null
		const jobId =
			typeof marker.jobId === 'string' && UUID_PATTERN.test(marker.jobId)
				? marker.jobId.toLowerCase()
				: null

		return idempotencyKey || jobId ? { idempotencyKey, jobId } : null
	} catch {
		return null
	}
}

const saveDatabaseBackupMarker = (
	storageKey: string,
	marker: DatabaseBackupActiveMarker
) => {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(marker))
	} catch {
		// Серверная идемпотентность и active-job endpoint остаются fallback.
	}
}

const clearDatabaseBackupMarker = (
	storageKey: string | null,
	jobId: string
) => {
	if (!storageKey || typeof window === 'undefined') return
	const marker = getDatabaseBackupMarker(storageKey)
	if (!marker?.jobId || marker.jobId === jobId) {
		try {
			window.localStorage.removeItem(storageKey)
		} catch {
			// Marker безопасно очистится при следующем доступном storage.
		}
	}
}

const formatDate = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'medium'
	}).format(new Date(value))

const formatFileSize = (value: number) => {
	if (value < 1024 * 1024) return `${Math.round(value / 1024)} КБ`
	return `${(value / 1024 / 1024).toFixed(1)} МБ`
}

const getDatabaseBackupJobBadgeClass = (
	status: TelegramDatabaseBackupJobStatus
) => {
	if (status === 'SUCCEEDED') return styles.badgeOk
	if (status === 'FAILED' || status === 'CANCELLED') {
		return styles.badgeError
	}
	return styles.badgeProgress
}

const AdminDatabases: NextPage = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const isDev = Boolean(user?.rights?.includes(UserRole.DEV))
	const [databaseBackupJobId, setDatabaseBackupJobId] = useState<
		string | null
	>(null)
	const [restoreFile, setRestoreFile] = useState<File | null>(null)
	const [restoreConfirmation, setRestoreConfirmation] = useState('')
	const notifiedDatabaseBackupJob = useRef<string | null>(null)
	const checkedStaleDatabaseBackupJob = useRef<string | null>(null)
	const restoreFileInput = useRef<HTMLInputElement | null>(null)
	const databaseBackupStorageKey = user.id
		? `${DATABASE_BACKUP_STORAGE_KEY_PREFIX}:${user.id}`
		: null

	const { data: settings, isLoading } = useQuery({
		queryKey: SETTINGS_QUERY_KEY,
		queryFn: adminTelegramBotService.get
	})

	const databaseRestoreSettings = useQuery({
		queryKey: RESTORE_SETTINGS_QUERY_KEY,
		queryFn: devToolsService.getDatabaseRestoreSettings,
		enabled: isDev
	})

	const latestActiveDatabaseBackupJob = useQuery({
		queryKey: ['admin-telegram-database-backup-active', user.id ?? null],
		queryFn: adminTelegramBotService.getLatestActiveDatabaseBackupJob,
		enabled: Boolean(user.id)
	})
	const refetchLatestActiveDatabaseBackupJob =
		latestActiveDatabaseBackupJob.refetch

	const databaseBackupMutation = useMutation({
		mutationFn: adminTelegramBotService.sendDatabaseBackup,
		onSuccess: (result, idempotencyKey) => {
			notifiedDatabaseBackupJob.current = null
			checkedStaleDatabaseBackupJob.current = null
			setDatabaseBackupJobId(result.jobId)
			if (databaseBackupStorageKey) {
				saveDatabaseBackupMarker(databaseBackupStorageKey, {
					idempotencyKey,
					jobId: result.jobId
				})
			}
		}
	})

	const databaseBackupJob = useQuery({
		queryKey: ['admin-telegram-database-backup-job', databaseBackupJobId],
		queryFn: () =>
			adminTelegramBotService.getDatabaseBackupJob(databaseBackupJobId!),
		enabled: Boolean(databaseBackupJobId),
		refetchInterval: query => {
			const job = query.state.data
			return job && TERMINAL_DATABASE_BACKUP_JOB_STATUSES.has(job.status)
				? false
				: DATABASE_BACKUP_JOB_POLL_INTERVAL_MS
		}
	})

	const databaseRestoreMutation = useMutation({
		mutationFn: ({
			file,
			confirmation
		}: {
			file: File
			confirmation: string
		}) => devToolsService.restoreDatabaseBackup(file, confirmation),
		onSuccess: () => {
			setRestoreFile(null)
			setRestoreConfirmation('')
			if (restoreFileInput.current) {
				restoreFileInput.current.value = ''
			}
		}
	})

	useEffect(() => {
		setDatabaseBackupJobId(null)
		checkedStaleDatabaseBackupJob.current = null
		const marker = getDatabaseBackupMarker(databaseBackupStorageKey)
		if (marker?.jobId) {
			setDatabaseBackupJobId(marker.jobId)
		}
	}, [databaseBackupStorageKey])

	useEffect(() => {
		const activeJob = latestActiveDatabaseBackupJob.data
		if (!activeJob || !databaseBackupStorageKey) return

		notifiedDatabaseBackupJob.current = null
		setDatabaseBackupJobId(activeJob.jobId)
		queryClient.setQueryData(
			['admin-telegram-database-backup-job', activeJob.jobId],
			activeJob
		)
		const marker = getDatabaseBackupMarker(databaseBackupStorageKey)
		saveDatabaseBackupMarker(databaseBackupStorageKey, {
			idempotencyKey: marker?.idempotencyKey ?? null,
			jobId: activeJob.jobId
		})
	}, [
		databaseBackupStorageKey,
		latestActiveDatabaseBackupJob.data,
		queryClient
	])

	useEffect(() => {
		if (!databaseBackupStorageKey) return

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== databaseBackupStorageKey) return
			const marker = getDatabaseBackupMarker(databaseBackupStorageKey)
			if (marker?.jobId) {
				notifiedDatabaseBackupJob.current = null
				checkedStaleDatabaseBackupJob.current = null
				setDatabaseBackupJobId(marker.jobId)
				return
			}

			void refetchLatestActiveDatabaseBackupJob().then(result => {
				if (result.isSuccess && result.data === null) {
					setDatabaseBackupJobId(null)
				}
			})
		}

		window.addEventListener('storage', handleStorage)
		return () => window.removeEventListener('storage', handleStorage)
	}, [databaseBackupStorageKey, refetchLatestActiveDatabaseBackupJob])

	useEffect(() => {
		const jobId = databaseBackupJobId
		const status = isAxiosError(databaseBackupJob.error)
			? databaseBackupJob.error.response?.status
			: undefined
		if (
			!jobId ||
			!databaseBackupJob.isError ||
			(status !== 403 && status !== 404) ||
			checkedStaleDatabaseBackupJob.current === jobId
		) {
			return
		}

		checkedStaleDatabaseBackupJob.current = jobId
		void refetchLatestActiveDatabaseBackupJob().then(result => {
			if (!result.isSuccess) {
				checkedStaleDatabaseBackupJob.current = null
				return
			}
			if (result.data !== null) return

			clearDatabaseBackupMarker(databaseBackupStorageKey, jobId)
			setDatabaseBackupJobId(currentJobId =>
				currentJobId === jobId ? null : currentJobId
			)
			toast.error(
				'Задание backup больше не доступно. Активных запусков нет.'
			)
		})
	}, [
		databaseBackupJob.error,
		databaseBackupJob.isError,
		databaseBackupJobId,
		databaseBackupStorageKey,
		refetchLatestActiveDatabaseBackupJob
	])

	useEffect(() => {
		const job = databaseBackupJob.data
		if (
			!job ||
			!TERMINAL_DATABASE_BACKUP_JOB_STATUSES.has(job.status) ||
			notifiedDatabaseBackupJob.current === job.jobId
		) {
			return
		}

		notifiedDatabaseBackupJob.current = job.jobId
		clearDatabaseBackupMarker(databaseBackupStorageKey, job.jobId)
		queryClient.setQueryData(
			['admin-telegram-database-backup-active', user.id ?? null],
			null
		)

		if (job.status === 'SUCCEEDED') {
			const fileSize = job.result?.fileSize
			toast.success(
				fileSize === undefined
					? 'Backup создан и отправлен в Telegram'
					: `Backup отправлен в Telegram: ${formatFileSize(fileSize)}`
			)
			void queryClient.invalidateQueries({
				queryKey: SETTINGS_QUERY_KEY
			})
			return
		}

		if (job.status === 'CANCELLED') {
			toast.error('Создание backup отменено')
			return
		}

		toast.error(`Ошибка backup: ${job.lastError || 'неизвестная ошибка'}`)
	}, [
		databaseBackupJob.data,
		databaseBackupStorageKey,
		queryClient,
		user.id
	])

	const handleSendDatabaseBackup = () => {
		if (!databaseBackupStorageKey) {
			toast.error('Не удалось определить администратора')
			return
		}

		const activeJob = latestActiveDatabaseBackupJob.data
		if (activeJob) {
			setDatabaseBackupJobId(activeJob.jobId)
			toast.success('Активный backup уже выполняется')
			return
		}

		const marker = getDatabaseBackupMarker(databaseBackupStorageKey)
		const idempotencyKey =
			marker?.idempotencyKey ?? window.crypto.randomUUID()
		saveDatabaseBackupMarker(databaseBackupStorageKey, {
			idempotencyKey,
			jobId: marker?.jobId ?? null
		})
		const promise = databaseBackupMutation.mutateAsync(idempotencyKey)

		toast.promise(promise, {
			loading: 'Ставим backup в очередь...',
			success: result =>
				result.created
					? 'Backup поставлен в очередь'
					: result.status === 'SUCCEEDED'
						? 'Этот backup уже был успешно завершён'
						: 'Активный backup уже поставлен в очередь',
			error: error => `Ошибка backup: ${errorCatch(error)}`
		})
	}

	const handleRestoreDatabaseBackup = () => {
		if (!restoreFile) {
			toast.error('Выберите файл backup .dump')
			return
		}

		const promise = databaseRestoreMutation.mutateAsync({
			file: restoreFile,
			confirmation: restoreConfirmation.trim()
		})

		toast.promise(promise, {
			loading: 'Восстанавливаем базу данных...',
			success: 'База данных восстановлена из backup',
			error: error => `Ошибка восстановления: ${errorCatch(error)}`
		})
	}

	const lastBackupText = settings?.databaseBackupLastSentAt
		? formatDate(settings.databaseBackupLastSentAt)
		: 'Ещё не отправлялся'
	const isDatabaseBackupJobActive = Boolean(
		databaseBackupJobId &&
		(!databaseBackupJob.data ||
			!TERMINAL_DATABASE_BACKUP_JOB_STATUSES.has(
				databaseBackupJob.data.status
			))
	)
	const isDatabaseBackupAvailabilityUnknown =
		latestActiveDatabaseBackupJob.isLoading ||
		latestActiveDatabaseBackupJob.isError

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Базы данных"
				title="Backup и восстановление PostgreSQL"
				description={
					isDev
						? 'Здесь можно поставить ручной backup в очередь и восстановить базу из PostgreSQL .dump.'
						: 'Здесь можно поставить ручной backup PostgreSQL в очередь и следить за его выполнением.'
				}
				risk={isDev ? 'high' : 'medium'}
				riskText={
					isDev
						? 'Восстановление заменяет текущие данные содержимым backup-файла. Перед запуском проверь окружение, файл и подтверждение.'
						: 'Перед ручным запуском проверь настройки Telegram и убедись, что другой backup уже не выполняется.'
				}
			/>

			<div className={styles.card}>
				{isLoading ? (
					<>
						<SkeletonLoader count={1} className="h-[64px]" />
						<div className={styles.backupMetaGrid}>
							{Array.from({ length: 3 }, (_, index) => (
								<SkeletonLoader
									key={index}
									count={1}
									className="h-[76px]"
								/>
							))}
						</div>
					</>
				) : settings ? (
					<div className={styles.backupPanel}>
						<div className={styles.backupHeader}>
							<div>
								<p className={styles.label}>Backup базы данных</p>
								<p className={styles.hint}>
									Можно отправить вне расписания. Файл приходит в топик
									Backups.
								</p>
							</div>
							<button
								type="button"
								className={styles.actionBtn}
								onClick={handleSendDatabaseBackup}
								disabled={
									databaseBackupMutation.isPending ||
									isDatabaseBackupJobActive ||
									isDatabaseBackupAvailabilityUnknown ||
									!databaseBackupStorageKey ||
									!settings.telegramBotTokenConfigured ||
									!settings.dailySummaryChatId.trim() ||
									!settings.databaseBackupThreadId
								}
							>
								Отправить backup
							</button>
						</div>
						<div className={styles.backupMetaGrid}>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Последний backup</p>
								<p className={styles.statusValue}>{lastBackupText}</p>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Формат</p>
								<p className={styles.statusValue}>PostgreSQL .dump</p>
							</div>
							<div className={styles.statusItem} aria-live="polite">
								<p className={styles.statusLabel}>Ручной backup</p>
								{databaseBackupJob.data ? (
									<>
										<span
											className={`${styles.badge} ${getDatabaseBackupJobBadgeClass(databaseBackupJob.data.status)}`}
										>
											{
												DATABASE_BACKUP_JOB_STATUS_LABELS[
													databaseBackupJob.data.status
												]
											}
										</span>
										{databaseBackupJob.data.status === 'FAILED' &&
											databaseBackupJob.data.lastError && (
												<p className={styles.hint}>
													{databaseBackupJob.data.lastError}
												</p>
											)}
									</>
								) : databaseBackupJob.isError ? (
									<p className={styles.hint}>
										Не удалось получить статус:{' '}
										{errorCatch(databaseBackupJob.error)}
									</p>
								) : databaseBackupJobId ? (
									<p className={styles.statusValue}>Проверяем статус...</p>
								) : latestActiveDatabaseBackupJob.isError ? (
									<p className={styles.hint}>
										Не удалось проверить активный backup:{' '}
										{errorCatch(latestActiveDatabaseBackupJob.error)}
									</p>
								) : (
									<p className={styles.statusValue}>Не запускался</p>
								)}
							</div>
						</div>
					</div>
				) : (
					<p className={styles.empty}>Не удалось загрузить настройки</p>
				)}
			</div>

			{isDev && (
				<div className={styles.card}>
					{databaseRestoreSettings.isLoading ? (
						<>
							<SkeletonLoader count={1} className="h-[52px]" />
							<SkeletonLoader count={1} className="h-[52px]" />
						</>
					) : databaseRestoreSettings.data ? (
						<>
							<div>
								<p className={styles.label}>Восстановление из backup</p>
								<p className={styles.hint}>
									Операция принимает PostgreSQL `.dump` и запускает restore
									через серверный инструмент. Действие логируется в журнале
									событий.
								</p>
							</div>
							<div className={styles.restoreGrid}>
								<label className={styles.fileInputLabel}>
									<span>Файл .dump</span>
									<input
										ref={restoreFileInput}
										type="file"
										accept=".dump"
										onChange={event =>
											setRestoreFile(event.target.files?.[0] ?? null)
										}
									/>
								</label>
								<input
									className={styles.input}
									value={restoreConfirmation}
									onChange={event =>
										setRestoreConfirmation(event.target.value)
									}
									placeholder={databaseRestoreSettings.data.confirmation}
								/>
								<button
									type="button"
									className={styles.dangerBtn}
									onClick={handleRestoreDatabaseBackup}
									disabled={databaseRestoreMutation.isPending}
								>
									Восстановить БД
								</button>
							</div>
							<p className={styles.hint}>
								Для подтверждения введите:{' '}
								<b>{databaseRestoreSettings.data.confirmation}</b>
								{restoreFile ? `; выбран файл ${restoreFile.name}` : ''}
							</p>
						</>
					) : (
						<p className={styles.empty}>
							Не удалось загрузить настройки восстановления
							{databaseRestoreSettings.error
								? `: ${errorCatch(databaseRestoreSettings.error)}`
								: ''}
						</p>
					)}
				</div>
			)}
		</section>
	)
}

export default AdminDatabases
