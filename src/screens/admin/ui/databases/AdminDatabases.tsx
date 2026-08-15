'use client'

import { UserRole, useUser } from '@/entities/user'
import { adminTelegramBotService } from '@/features/manage-telegram-bot'
import type {
	AdminTelegramBotSettings,
	TelegramDatabaseBackupAdminJobSummary,
	TelegramDatabaseBackupFreshness,
	TelegramDatabaseBackupJobStatus,
	TelegramDatabaseBackupJobTrigger,
	TelegramDatabaseBackupOverviewItem,
	TelegramDatabaseBackupTarget
} from '@/features/manage-telegram-bot'
import {
	devToolsService,
	type DatabaseRestoreJob,
	type DatabaseRestoreJobStatus,
	type DatabaseRestoreTarget,
	type DatabaseRestoreTargetSettings
} from '@/features/run-admin-task'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import AdminTooltip from '@/screens/admin/ui/common/admin-tooltip/AdminTooltip'
import { errorCatch } from '@/shared/api'
import Heading from '@/shared/ui/heading/Heading'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { NextPage } from 'next'
import {
	type ChangeEvent,
	useCallback,
	useEffect,
	useRef,
	useState
} from 'react'
import toast from 'react-hot-toast'
import styles from './AdminDatabases.module.scss'

const SETTINGS_QUERY_KEY = ['admin-telegram-bot-settings']
const DATABASE_BACKUP_OVERVIEW_QUERY_KEY = [
	'admin-telegram-database-backup-overview'
]
const DATABASE_BACKUP_HISTORY_QUERY_KEY = [
	'admin-telegram-database-backup-history'
]
const RESTORE_SETTINGS_QUERY_KEY = ['admin-database-restore-settings']
const DATABASE_BACKUP_JOB_POLL_INTERVAL_MS = 2500
const DATABASE_BACKUP_HISTORY_LIMIT = 20
const DATABASE_RESTORE_JOB_POLL_INTERVAL_MS = 2500
const DATABASE_RESTORE_PUBLICATION_GRACE_MS = 5 * 60 * 1000
const DATABASE_BACKUP_STORAGE_KEY_PREFIX =
	'winwidget:admin:database-backup:active'
const DATABASE_RESTORE_STORAGE_KEY_PREFIX =
	'winwidget:admin:database-restore:latest'
const UUID_PATTERN =
	/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TERMINAL_DATABASE_BACKUP_JOB_STATUSES: ReadonlySet<TelegramDatabaseBackupJobStatus> =
	new Set<TelegramDatabaseBackupJobStatus>([
		'SUCCEEDED',
		'FAILED',
		'CANCELLED',
		'SKIPPED'
	])
const DATABASE_BACKUP_JOB_STATUS_LABELS: Record<
	TelegramDatabaseBackupJobStatus,
	string
> = {
	QUEUED: 'Ожидает запуска',
	PROCESSING: 'Выполняется',
	SUCCEEDED: 'Завершён',
	FAILED: 'Ошибка',
	CANCELLED: 'Отменён',
	SKIPPED: 'Пропущен'
}
const DATABASE_BACKUP_TARGET_OPTIONS: readonly TelegramDatabaseBackupTarget[] =
	[
		'core',
		'notification-delivery',
		'campaigns',
		'reporting',
		'widgets',
		'billing',
		'identity'
	]
const DATABASE_BACKUP_TRIGGER_LABELS: Record<
	TelegramDatabaseBackupJobTrigger,
	string
> = {
	SCHEDULED: 'Плановый',
	MANUAL: 'Ручной'
}
const DATABASE_BACKUP_FRESHNESS_LABELS: Record<
	TelegramDatabaseBackupFreshness,
	string
> = {
	DISABLED: 'Расписание выключено',
	MISSING: 'Нет успешного backup',
	FRESH: 'Актуален',
	STALE: 'Устарел'
}
const TERMINAL_DATABASE_RESTORE_JOB_STATUSES: ReadonlySet<DatabaseRestoreJobStatus> =
	new Set<DatabaseRestoreJobStatus>([
		'CANCELLED',
		'SUCCEEDED',
		'FAILED',
		'FAILED_FENCED'
	])
const DATABASE_RESTORE_JOB_STATUS_LABELS: Record<
	DatabaseRestoreJobStatus,
	string
> = {
	QUEUED: 'Ожидает запуска',
	PROCESSING: 'Выполняется',
	CANCELLED: 'Отменено до блокировки БД',
	SUCCEEDED: 'Завершён',
	FAILED: 'Ошибка',
	FAILED_FENCED: 'Ошибка — БД заблокирована'
}

const isAmbiguousDatabaseRestoreRequestError = (error: unknown) =>
	isAxiosError(error) &&
	(error.response?.status === undefined || error.response.status >= 500)

interface DatabaseRestoreMarker {
	jobId: string
	target: DatabaseRestoreTarget
	recoveryStartedAt: string | null
}

const DATABASE_RESTORE_TARGETS: readonly DatabaseRestoreTarget[] = [
	'core',
	'notification-delivery',
	'campaigns',
	'reporting',
	'widgets',
	'billing',
	'identity'
]

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

const isDatabaseRestoreTarget = (
	value: unknown
): value is DatabaseRestoreTarget =>
	typeof value === 'string' &&
	DATABASE_RESTORE_TARGETS.some(target => target === value)

const getDatabaseRestoreMarker = (
	storageKey: string | null
): DatabaseRestoreMarker | null => {
	if (!storageKey || typeof window === 'undefined') return null

	try {
		const rawMarker = window.localStorage.getItem(storageKey)
		if (!rawMarker) return null

		const marker = JSON.parse(rawMarker) as Partial<DatabaseRestoreMarker>
		if (
			typeof marker.jobId !== 'string' ||
			!UUID_PATTERN.test(marker.jobId) ||
			!isDatabaseRestoreTarget(marker.target)
		) {
			return null
		}

		return {
			jobId: marker.jobId.toLowerCase(),
			target: marker.target,
			recoveryStartedAt:
				typeof marker.recoveryStartedAt === 'string' &&
				!Number.isNaN(Date.parse(marker.recoveryStartedAt))
					? marker.recoveryStartedAt
					: null
		}
	} catch {
		return null
	}
}

const saveDatabaseRestoreMarker = (
	storageKey: string,
	marker: DatabaseRestoreMarker
) => {
	try {
		window.localStorage.setItem(storageKey, JSON.stringify(marker))
	} catch {
		// Job остаётся доступен в текущей вкладке даже без localStorage.
	}
}

const clearDatabaseRestoreMarker = (
	storageKey: string | null,
	jobId?: string
) => {
	if (!storageKey || typeof window === 'undefined') return
	const marker = getDatabaseRestoreMarker(storageKey)
	if (jobId && marker?.jobId && marker.jobId !== jobId) return

	try {
		window.localStorage.removeItem(storageKey)
	} catch {
		// Некорректный marker будет проигнорирован при следующей загрузке.
	}
}

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

const getDatabaseRestoreJobBadgeClass = (
	status: DatabaseRestoreJobStatus
) => {
	if (status === 'SUCCEEDED') return styles.badgeOk
	if (status === 'CANCELLED') return styles.badgeNeutral
	if (status === 'FAILED' || status === 'FAILED_FENCED') {
		return styles.badgeError
	}
	return styles.badgeProgress
}

const getDatabaseBackupTargetLabel = (
	target: TelegramDatabaseBackupTarget
) =>
	({
		core: 'основной БД',
		'notification-delivery': 'БД Notification Delivery',
		campaigns: 'БД Campaigns',
		reporting: 'БД Reporting',
		widgets: 'БД Widgets',
		billing: 'БД Billing',
		identity: 'БД Identity'
	})[target]

const formatDatabaseBackupDate = (value: string | null) => {
	if (!value) return '—'
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) return '—'

	return new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(parsed)
}

const getDatabaseBackupFreshnessBadgeClass = (
	freshness: TelegramDatabaseBackupFreshness
) => {
	if (freshness === 'FRESH') return styles.badgeOk
	if (freshness === 'STALE' || freshness === 'MISSING') {
		return styles.badgeError
	}
	return styles.badgeNeutral
}

const DatabaseBackupJobSummary = ({
	job
}: {
	job: TelegramDatabaseBackupAdminJobSummary | null
}) => {
	if (!job) return <p className={styles.statusValue}>Не запускался</p>

	return (
		<>
			<span
				className={`${styles.badge} ${getDatabaseBackupJobBadgeClass(job.status)}`}
			>
				{DATABASE_BACKUP_JOB_STATUS_LABELS[job.status]}
			</span>
			<p className={styles.hint}>
				{formatDatabaseBackupDate(job.completedAt ?? job.queuedAt)}
			</p>
		</>
	)
}

const getDatabaseRestoreTargetLabel = (
	target: DatabaseRestoreTarget,
	targetSettings: DatabaseRestoreTargetSettings[] = []
) =>
	targetSettings.find(item => item.id === target)?.label ??
	{
		core: 'Основная БД',
		'notification-delivery': 'Notification Delivery',
		campaigns: 'Campaigns',
		reporting: 'Reporting',
		widgets: 'Widgets',
		billing: 'Billing',
		identity: 'Identity'
	}[target]

const useDatabaseBackup = (
	target: TelegramDatabaseBackupTarget,
	userId: string | null | undefined
) => {
	const queryClient = useQueryClient()
	const [databaseBackupJobId, setDatabaseBackupJobId] = useState<
		string | null
	>(null)
	const notifiedDatabaseBackupJob = useRef<string | null>(null)
	const checkedStaleDatabaseBackupJob = useRef<string | null>(null)
	const databaseBackupStorageKey = userId
		? `${DATABASE_BACKUP_STORAGE_KEY_PREFIX}:${target}:${userId}`
		: null

	const latestActiveDatabaseBackupJob = useQuery({
		queryKey: [
			'admin-telegram-database-backup-active',
			target,
			userId ?? null
		],
		queryFn: () =>
			adminTelegramBotService.getLatestActiveDatabaseBackupJob(target),
		enabled: Boolean(userId)
	})
	const refetchLatestActiveDatabaseBackupJob =
		latestActiveDatabaseBackupJob.refetch

	const databaseBackupMutation = useMutation({
		mutationFn: (idempotencyKey: string) =>
			adminTelegramBotService.sendDatabaseBackup(target, idempotencyKey),
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
			void queryClient.invalidateQueries({
				queryKey: DATABASE_BACKUP_OVERVIEW_QUERY_KEY
			})
			void queryClient.invalidateQueries({
				queryKey: DATABASE_BACKUP_HISTORY_QUERY_KEY
			})
		}
	})

	const databaseBackupJob = useQuery({
		queryKey: [
			'admin-telegram-database-backup-job',
			target,
			databaseBackupJobId
		],
		queryFn: () =>
			adminTelegramBotService.getDatabaseBackupJob(
				target,
				databaseBackupJobId!
			),
		enabled: Boolean(databaseBackupJobId),
		refetchInterval: query => {
			const job = query.state.data
			return job && TERMINAL_DATABASE_BACKUP_JOB_STATUSES.has(job.status)
				? false
				: DATABASE_BACKUP_JOB_POLL_INTERVAL_MS
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
			['admin-telegram-database-backup-job', target, activeJob.jobId],
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
		queryClient,
		target
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
				`Задание backup ${getDatabaseBackupTargetLabel(target)} больше не доступно. Активных запусков нет.`
			)
		})
	}, [
		databaseBackupJob.error,
		databaseBackupJob.isError,
		databaseBackupJobId,
		databaseBackupStorageKey,
		refetchLatestActiveDatabaseBackupJob,
		target
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
			['admin-telegram-database-backup-active', target, userId ?? null],
			null
		)
		void queryClient.invalidateQueries({
			queryKey: DATABASE_BACKUP_OVERVIEW_QUERY_KEY
		})
		void queryClient.invalidateQueries({
			queryKey: DATABASE_BACKUP_HISTORY_QUERY_KEY
		})

		if (job.status === 'SUCCEEDED') {
			const fileSize = job.fileSize
			toast.success(
				fileSize === null
					? `Backup ${getDatabaseBackupTargetLabel(target)} создан и отправлен в Telegram`
					: `Backup ${getDatabaseBackupTargetLabel(target)} отправлен в Telegram: ${formatFileSize(fileSize)}`
			)
			void queryClient.invalidateQueries({
				queryKey: SETTINGS_QUERY_KEY
			})
			return
		}

		if (job.status === 'CANCELLED') {
			toast.error(
				`Создание backup ${getDatabaseBackupTargetLabel(target)} отменено`
			)
			return
		}
		if (job.status === 'SKIPPED') {
			toast(
				`Backup ${getDatabaseBackupTargetLabel(target)} пропущен планировщиком`
			)
			return
		}

		toast.error(
			`Backup ${getDatabaseBackupTargetLabel(target)} завершился с ошибкой`
		)
	}, [
		databaseBackupJob.data,
		databaseBackupStorageKey,
		queryClient,
		target,
		userId
	])

	const handleSendDatabaseBackup = () => {
		if (!databaseBackupStorageKey) {
			toast.error('Не удалось определить администратора')
			return
		}

		const activeJob = latestActiveDatabaseBackupJob.data
		if (activeJob) {
			setDatabaseBackupJobId(activeJob.jobId)
			toast.success(
				`Активный backup ${getDatabaseBackupTargetLabel(target)} уже выполняется`
			)
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
			loading: `Ставим backup ${getDatabaseBackupTargetLabel(target)} в очередь...`,
			success: result =>
				result.created
					? `Backup ${getDatabaseBackupTargetLabel(target)} поставлен в очередь`
					: result.status === 'SUCCEEDED'
						? `Этот backup ${getDatabaseBackupTargetLabel(target)} уже был успешно завершён`
						: `Активный backup ${getDatabaseBackupTargetLabel(target)} уже поставлен в очередь`,
			error: error =>
				`Ошибка backup ${getDatabaseBackupTargetLabel(target)}: ${errorCatch(error)}`
		})
	}

	return {
		databaseBackupJob,
		databaseBackupJobId,
		databaseBackupMutation,
		handleSendDatabaseBackup,
		isDatabaseBackupAvailabilityUnknown:
			latestActiveDatabaseBackupJob.isLoading ||
			latestActiveDatabaseBackupJob.isError,
		isDatabaseBackupJobActive: Boolean(
			databaseBackupJobId &&
			(!databaseBackupJob.data ||
				!TERMINAL_DATABASE_BACKUP_JOB_STATUSES.has(
					databaseBackupJob.data.status
				))
		),
		latestActiveDatabaseBackupJob
	}
}

interface DatabaseBackupPanelProps {
	description: string
	overviewError: unknown
	overviewItem: TelegramDatabaseBackupOverviewItem | null
	overviewLoading: boolean
	scheduleTimeLabel: string
	settings: AdminTelegramBotSettings
	target: TelegramDatabaseBackupTarget
	title: string
	userId: string | null | undefined
}

const DatabaseBackupPanel = ({
	description,
	overviewError,
	overviewItem,
	overviewLoading,
	scheduleTimeLabel,
	settings,
	target,
	title,
	userId
}: DatabaseBackupPanelProps) => {
	const backup = useDatabaseBackup(target, userId)

	return (
		<div className={styles.card}>
			<div className={styles.backupPanel}>
				<div className={styles.backupHeader}>
					<div>
						<p className={styles.label}>{title}</p>
						<p className={styles.hint}>{description}</p>
					</div>
					<button
						type="button"
						className={styles.actionBtn}
						onClick={backup.handleSendDatabaseBackup}
						disabled={
							backup.databaseBackupMutation.isPending ||
							backup.isDatabaseBackupJobActive ||
							backup.isDatabaseBackupAvailabilityUnknown ||
							!userId ||
							!settings.telegramBotTokenConfigured ||
							!settings.dailySummaryChatId.trim() ||
							!settings.databaseBackupThreadId
						}
					>
						Отправить
					</button>
				</div>
				<div className={styles.backupMetaGrid}>
					<div className={styles.statusItem}>
						<p className={styles.statusLabel}>Плановое время</p>
						<p className={styles.statusValue}>{scheduleTimeLabel}</p>
					</div>
					<div className={styles.statusItem}>
						<p className={styles.statusLabel}>Последний плановый</p>
						{overviewLoading ? (
							<p className={styles.statusValue}>Загрузка...</p>
						) : overviewError ? (
							<p className={styles.hint}>Статус недоступен</p>
						) : (
							<DatabaseBackupJobSummary
								job={overviewItem?.latestScheduled ?? null}
							/>
						)}
					</div>
					<div className={styles.statusItem} aria-live="polite">
						<p className={styles.statusLabel}>Последний ручной</p>
						{backup.databaseBackupJob.data ? (
							<>
								<span
									className={`${styles.badge} ${getDatabaseBackupJobBadgeClass(backup.databaseBackupJob.data.status)}`}
								>
									{
										DATABASE_BACKUP_JOB_STATUS_LABELS[
											backup.databaseBackupJob.data.status
										]
									}
								</span>
								{backup.databaseBackupJob.data.hasError && (
									<p className={styles.hint}>
										Подробности доступны в защищённых server logs
									</p>
								)}
							</>
						) : backup.databaseBackupJob.isError ? (
							<p className={styles.hint}>
								Не удалось получить статус:{' '}
								{errorCatch(backup.databaseBackupJob.error)}
							</p>
						) : backup.databaseBackupJobId ? (
							<p className={styles.statusValue}>Проверяем статус...</p>
						) : overviewLoading ? (
							<p className={styles.statusValue}>Загрузка...</p>
						) : overviewError ||
						  backup.latestActiveDatabaseBackupJob.isError ? (
							<p className={styles.hint}>
								Не удалось получить общий статус backup
							</p>
						) : (
							<DatabaseBackupJobSummary
								job={overviewItem?.latestManual ?? null}
							/>
						)}
					</div>
					<div className={styles.statusItem}>
						<p className={styles.statusLabel}>Свежесть</p>
						{overviewLoading ? (
							<p className={styles.statusValue}>Загрузка...</p>
						) : overviewItem ? (
							<>
								<span
									className={`${styles.badge} ${getDatabaseBackupFreshnessBadgeClass(overviewItem.freshness)}`}
								>
									{
										DATABASE_BACKUP_FRESHNESS_LABELS[
											overviewItem.freshness
										]
									}
								</span>
								{overviewItem.staleAfter && (
									<p className={styles.hint}>
										{overviewItem.freshness === 'STALE'
											? 'устарел с'
											: 'свеж до'}{' '}
										{formatDatabaseBackupDate(overviewItem.staleAfter)}
									</p>
								)}
							</>
						) : (
							<p className={styles.hint}>Статус недоступен</p>
						)}
					</div>
					<div className={styles.statusItem}>
						<p className={styles.statusLabel}>Последний успешный файл</p>
						{overviewItem?.latestSuccessful ? (
							<>
								<p className={styles.statusValue}>
									{overviewItem.latestSuccessful.fileSize === null
										? 'Размер не записан'
										: formatFileSize(
												overviewItem.latestSuccessful.fileSize
											)}
								</p>
								<p className={styles.hint}>
									{formatDatabaseBackupDate(
										overviewItem.latestSuccessful.completedAt
									)}
								</p>
							</>
						) : overviewLoading ? (
							<p className={styles.statusValue}>Загрузка...</p>
						) : (
							<p className={styles.statusValue}>Нет данных</p>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

const DatabaseBackupHistory = () => {
	const [page, setPage] = useState(1)
	const [target, setTarget] = useState<TelegramDatabaseBackupTarget | ''>(
		''
	)
	const [trigger, setTrigger] = useState<
		TelegramDatabaseBackupJobTrigger | ''
	>('')
	const [status, setStatus] = useState<
		TelegramDatabaseBackupJobStatus | ''
	>('')
	const history = useQuery({
		queryKey: [
			...DATABASE_BACKUP_HISTORY_QUERY_KEY,
			page,
			target,
			trigger,
			status
		],
		queryFn: () =>
			adminTelegramBotService.getDatabaseBackupJobs({
				page,
				limit: DATABASE_BACKUP_HISTORY_LIMIT,
				...(target ? { target } : {}),
				...(trigger ? { trigger } : {}),
				...(status ? { status } : {})
			}),
		refetchInterval: 30_000
	})
	const totalPages = history.data?.totalPages ?? 1
	const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

	useEffect(() => {
		if (page > totalPages) setPage(totalPages)
	}, [page, totalPages])

	return (
		<div className={styles.card}>
			<div className={styles.historyHeader}>
				<div>
					<p className={styles.label}>История резервных копий</p>
					<p className={styles.hint}>
						Общая серверная история плановых и ручных запусков всех
						активных PostgreSQL-баз.
					</p>
				</div>
				<p className={styles.hint}>
					{history.data
						? `Всего заданий: ${history.data.total}`
						: 'Загрузка...'}
				</p>
			</div>
			<div className={styles.historyFilters}>
				<label className={styles.fieldLabel}>
					База данных
					<select
						className={styles.select}
						value={target}
						onChange={event => {
							setTarget(
								event.target.value as TelegramDatabaseBackupTarget | ''
							)
							setPage(1)
						}}
					>
						<option value="">Все базы</option>
						{DATABASE_BACKUP_TARGET_OPTIONS.map(item => (
							<option key={item} value={item}>
								{getDatabaseBackupTargetLabel(item)}
							</option>
						))}
					</select>
				</label>
				<label className={styles.fieldLabel}>
					Запуск
					<select
						className={styles.select}
						value={trigger}
						onChange={event => {
							setTrigger(
								event.target.value as TelegramDatabaseBackupJobTrigger | ''
							)
							setPage(1)
						}}
					>
						<option value="">Все запуски</option>
						<option value="SCHEDULED">Плановые</option>
						<option value="MANUAL">Ручные</option>
					</select>
				</label>
				<label className={styles.fieldLabel}>
					Статус
					<select
						className={styles.select}
						value={status}
						onChange={event => {
							setStatus(
								event.target.value as TelegramDatabaseBackupJobStatus | ''
							)
							setPage(1)
						}}
					>
						<option value="">Все статусы</option>
						{Object.entries(DATABASE_BACKUP_JOB_STATUS_LABELS).map(
							([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							)
						)}
					</select>
				</label>
			</div>

			{history.isLoading ? (
				<SkeletonLoader count={4} className="h-[52px]" />
			) : history.isError ? (
				<p className={styles.restoreError}>
					Не удалось получить историю backup: {errorCatch(history.error)}
				</p>
			) : history.data?.items.length ? (
				<>
					<div className={styles.historyTableWrap}>
						<table className={styles.historyTable}>
							<thead>
								<tr>
									<th>База</th>
									<th>Запуск</th>
									<th>Статус</th>
									<th>Поставлен</th>
									<th>Завершён</th>
									<th>Попытки</th>
									<th>Размер</th>
								</tr>
							</thead>
							<tbody>
								{history.data.items.map(job => (
									<tr key={job.jobId}>
										<td>{getDatabaseBackupTargetLabel(job.target)}</td>
										<td>{DATABASE_BACKUP_TRIGGER_LABELS[job.trigger]}</td>
										<td>
											<span
												className={`${styles.badge} ${getDatabaseBackupJobBadgeClass(job.status)}`}
											>
												{DATABASE_BACKUP_JOB_STATUS_LABELS[job.status]}
											</span>
										</td>
										<td>{formatDatabaseBackupDate(job.queuedAt)}</td>
										<td>{formatDatabaseBackupDate(job.completedAt)}</td>
										<td>
											{job.attempts} / {job.maxAttempts}
										</td>
										<td>
											{job.fileSize === null
												? '—'
												: formatFileSize(job.fileSize)}
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
					{totalPages > 1 && (
						<Pagination
							listPage={pages}
							currentPage={page}
							prevPage={() => setPage(value => Math.max(1, value - 1))}
							nextPage={() =>
								setPage(value => Math.min(totalPages, value + 1))
							}
							changeActivePage={setPage}
						/>
					)}
				</>
			) : (
				<p className={styles.empty}>По выбранным фильтрам запусков нет</p>
			)}
		</div>
	)
}

interface DatabaseRestorePanelProps {
	isDev: boolean
	isUserLoading: boolean
	userId: string | null | undefined
}

const formatRestoreJobDate = (value: string | null) => {
	if (!value) return '—'
	const parsed = new Date(value)
	if (Number.isNaN(parsed.getTime())) return value

	return new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'medium'
	}).format(parsed)
}

const DatabaseRestorePanel = ({
	isDev,
	isUserLoading,
	userId
}: DatabaseRestorePanelProps) => {
	const queryClient = useQueryClient()
	const [restoreTarget, setRestoreTarget] =
		useState<DatabaseRestoreTarget>('core')
	const [restoreFile, setRestoreFile] = useState<File | null>(null)
	const [restoreConfirmation, setRestoreConfirmation] = useState('')
	const [restoreJobMarker, setRestoreJobMarker] =
		useState<DatabaseRestoreMarker | null>(null)
	const restoreFileInput = useRef<HTMLInputElement | null>(null)
	const notifiedRestoreJob = useRef<string | null>(null)
	const databaseRestoreStorageKey = userId
		? `${DATABASE_RESTORE_STORAGE_KEY_PREFIX}:${userId}`
		: null

	const databaseRestoreSettings = useQuery({
		queryKey: RESTORE_SETTINGS_QUERY_KEY,
		queryFn: devToolsService.getDatabaseRestoresSettings,
		enabled: isDev
	})
	const trackDatabaseRestoreJob = useCallback(
		async (job: DatabaseRestoreJob) => {
			await queryClient.cancelQueries({
				queryKey: ['admin-database-restore-job', job.jobId],
				exact: true
			})
			const marker = {
				jobId: job.jobId,
				target: job.target,
				recoveryStartedAt: null
			}
			notifiedRestoreJob.current = null
			setRestoreJobMarker(marker)
			queryClient.setQueryData(
				['admin-database-restore-job', job.jobId],
				job
			)
			if (databaseRestoreStorageKey) {
				saveDatabaseRestoreMarker(databaseRestoreStorageKey, marker)
			}
		},
		[databaseRestoreStorageKey, queryClient]
	)

	const databaseRestoreJob = useQuery({
		queryKey: [
			'admin-database-restore-job',
			restoreJobMarker?.jobId ?? null
		],
		queryFn: ({ signal }) =>
			devToolsService.getDatabaseRestoreJob(
				restoreJobMarker!.jobId,
				signal
			),
		enabled: isDev && Boolean(restoreJobMarker?.jobId),
		refetchInterval: query => {
			const job = query.state.data
			return job && TERMINAL_DATABASE_RESTORE_JOB_STATUSES.has(job.status)
				? false
				: DATABASE_RESTORE_JOB_POLL_INTERVAL_MS
		}
	})

	const databaseRestoreMutation = useMutation({
		mutationFn: ({
			target,
			file,
			confirmation,
			requestId
		}: {
			target: DatabaseRestoreTarget
			file: File
			confirmation: string
			requestId?: string
		}) => {
			const request = async () => {
				const assertExactJob = (job: DatabaseRestoreJob) => {
					if (
						requestId &&
						(job.jobId !== requestId || job.target !== target)
					) {
						throw new Error(
							'Сервер вернул задание, не соответствующее одобренному восстановлению'
						)
					}

					return job
				}
				const getExactJob = async () => {
					if (!requestId) return null
					const job = await devToolsService
						.getDatabaseRestoreJob(requestId)
						.catch(() => null)

					return job?.jobId === requestId && job.target === target
						? job
						: null
				}
				const publish = async () =>
					assertExactJob(
						await devToolsService.startDatabaseRestore(
							target,
							file,
							confirmation,
							requestId
						)
					)

				let job: DatabaseRestoreJob
				try {
					job = await publish()
				} catch (error) {
					if (
						!requestId ||
						!isAmbiguousDatabaseRestoreRequestError(error)
					) {
						throw error
					}
					const exactJob = await getExactJob()
					if (!exactJob) throw error
					job = exactJob
				}

				if (!requestId || job.publicationConfirmed) return job

				try {
					const retriedJob = await publish()
					if (retriedJob.publicationConfirmed) return retriedJob

					const exactJob = await getExactJob()
					if (exactJob?.publicationConfirmed) return exactJob
					throw new Error(
						'Публикация задания не подтверждена. Повторно выберите тот же backup для восстановления по одобренному jobId.'
					)
				} catch (error) {
					if (!isAmbiguousDatabaseRestoreRequestError(error)) throw error
					const exactJob = await getExactJob()
					if (exactJob?.publicationConfirmed) return exactJob
					throw error
				}
			}

			return request()
		},
		onSuccess: async job => {
			await trackDatabaseRestoreJob(job)
			setRestoreFile(null)
			setRestoreConfirmation('')
			if (restoreFileInput.current) {
				restoreFileInput.current.value = ''
			}
		},
		onError: (error, variables) => {
			if (!variables.requestId) return
			const status = isAxiosError(error)
				? error.response?.status
				: undefined
			if (status === undefined || status >= 500) {
				const recoveryMarker: DatabaseRestoreMarker = {
					jobId: variables.requestId,
					target: variables.target,
					recoveryStartedAt: new Date().toISOString()
				}
				setRestoreJobMarker(current =>
					current?.jobId === variables.requestId ? recoveryMarker : current
				)
				if (
					databaseRestoreStorageKey &&
					getDatabaseRestoreMarker(databaseRestoreStorageKey)?.jobId ===
						variables.requestId
				) {
					saveDatabaseRestoreMarker(
						databaseRestoreStorageKey,
						recoveryMarker
					)
				}
				return
			}

			clearDatabaseRestoreMarker(
				databaseRestoreStorageKey,
				variables.requestId
			)
			setRestoreJobMarker(current =>
				current?.jobId === variables.requestId ? null : current
			)
		}
	})

	const databaseRestoreCancelMutation = useMutation({
		mutationFn: (jobId: string) =>
			devToolsService.cancelDatabaseRestoreJob(jobId),
		onSuccess: job => {
			queryClient.setQueryData(
				['admin-database-restore-job', job.jobId],
				job
			)
		}
	})

	useEffect(() => {
		const marker = getDatabaseRestoreMarker(databaseRestoreStorageKey)
		setRestoreJobMarker(marker)
		if (marker) setRestoreTarget(marker.target)
	}, [databaseRestoreStorageKey])

	useEffect(() => {
		const targets = databaseRestoreSettings.data?.targets
		if (!targets?.length) return
		const approvedTarget = databaseRestoreSettings.data?.approved?.target
		if (
			approvedTarget &&
			targets.some(target => target.id === approvedTarget)
		) {
			if (restoreTarget === approvedTarget) return

			setRestoreTarget(approvedTarget)
			setRestoreFile(null)
			setRestoreConfirmation('')
			if (restoreFileInput.current) restoreFileInput.current.value = ''
			return
		}
		if (targets.some(target => target.id === restoreTarget)) return

		setRestoreTarget(targets[0].id)
	}, [
		databaseRestoreSettings.data?.approved?.target,
		databaseRestoreSettings.data?.targets,
		restoreTarget
	])

	useEffect(() => {
		if (!databaseRestoreStorageKey) return

		const handleStorage = (event: StorageEvent) => {
			if (event.key !== databaseRestoreStorageKey) return
			const marker = getDatabaseRestoreMarker(databaseRestoreStorageKey)
			notifiedRestoreJob.current = null
			setRestoreJobMarker(marker)
			if (marker) setRestoreTarget(marker.target)
		}

		window.addEventListener('storage', handleStorage)
		return () => window.removeEventListener('storage', handleStorage)
	}, [databaseRestoreStorageKey])

	useEffect(() => {
		const marker = restoreJobMarker
		const status = isAxiosError(databaseRestoreJob.error)
			? databaseRestoreJob.error.response?.status
			: undefined
		const recoveryStartedAt = marker?.recoveryStartedAt
			? Date.parse(marker.recoveryStartedAt)
			: Number.NaN
		const publicationGraceActive =
			status === 404 &&
			(databaseRestoreMutation.isPending ||
				Number.isNaN(recoveryStartedAt) ||
				Date.now() - recoveryStartedAt <
					DATABASE_RESTORE_PUBLICATION_GRACE_MS)
		if (
			!marker ||
			!databaseRestoreJob.isError ||
			(status !== 403 && status !== 404) ||
			databaseRestoreJob.data?.jobId === marker.jobId ||
			publicationGraceActive
		) {
			if (
				marker &&
				status === 404 &&
				!databaseRestoreMutation.isPending &&
				databaseRestoreJob.data?.jobId !== marker.jobId &&
				Number.isNaN(recoveryStartedAt)
			) {
				const recoveryMarker = {
					...marker,
					recoveryStartedAt: new Date().toISOString()
				}
				setRestoreJobMarker(recoveryMarker)
				if (databaseRestoreStorageKey) {
					saveDatabaseRestoreMarker(
						databaseRestoreStorageKey,
						recoveryMarker
					)
				}
			}
			return
		}

		clearDatabaseRestoreMarker(databaseRestoreStorageKey, marker.jobId)
		setRestoreJobMarker(current =>
			current?.jobId === marker.jobId ? null : current
		)
		toast.error(
			'Задание восстановления больше недоступно. Проверьте журнал событий и состояние целевой БД.'
		)
	}, [
		databaseRestoreJob.error,
		databaseRestoreJob.data,
		databaseRestoreJob.isError,
		databaseRestoreStorageKey,
		databaseRestoreMutation.isPending,
		restoreJobMarker
	])

	useEffect(() => {
		const job = databaseRestoreJob.data
		if (
			!job ||
			!TERMINAL_DATABASE_RESTORE_JOB_STATUSES.has(job.status) ||
			notifiedRestoreJob.current === job.jobId
		) {
			return
		}

		notifiedRestoreJob.current = job.jobId
		if (job.status !== 'FAILED_FENCED') {
			clearDatabaseRestoreMarker(databaseRestoreStorageKey, job.jobId)
		}
		const targetLabel = getDatabaseRestoreTargetLabel(
			job.target,
			databaseRestoreSettings.data?.targets
		)

		if (job.status === 'SUCCEEDED') {
			toast.success(`БД ${targetLabel} успешно восстановлена`)
			return
		}

		if (job.status === 'CANCELLED') {
			toast.success(
				`Восстановление БД ${targetLabel} отменено до блокировки подключений`
			)
			return
		}

		if (job.status === 'FAILED_FENCED') {
			toast.error(
				`КРИТИЧНО: восстановление БД ${targetLabel} завершилось с ошибкой после блокировки подключений. БД оставлена ограждённой; не запускайте сервис вручную и следуйте production runbook.`,
				{ duration: 15000 }
			)
			return
		}

		toast.error(
			`Восстановление БД ${targetLabel} завершилось с ошибкой: ${job.error?.message || 'неизвестная ошибка'}`
		)
	}, [
		databaseRestoreJob.data,
		databaseRestoreSettings.data?.targets,
		databaseRestoreStorageKey
	])

	if (isUserLoading) {
		return (
			<div className={styles.card}>
				<SkeletonLoader count={1} className="h-[52px]" />
				<SkeletonLoader count={1} className="h-[52px]" />
			</div>
		)
	}

	if (!isDev) {
		return (
			<div
				className={`${styles.card} ${styles.lockedCard}`}
				aria-disabled="true"
			>
				<div className={styles.lockedContent} aria-hidden="true">
					<div>
						<p className={styles.label}>Восстановление БД из backup</p>
						<p className={styles.hint}>
							Изолированный worker восстанавливает основную БД или БД
							выбранного микросервиса и проверяет результат до снятия
							защитной блокировки.
						</p>
					</div>
					<div className={styles.restoreGrid}>
						<select className={styles.select} disabled>
							<option>Основная БД</option>
						</select>
						<label className={styles.fileInputLabel}>
							<span>Файл .dump</span>
							<input type="file" accept=".dump" disabled />
						</label>
						<input
							className={styles.input}
							placeholder="Контрольная фраза"
							disabled
						/>
						<button type="button" className={styles.dangerBtn} disabled>
							Поставить в очередь
						</button>
					</div>
				</div>
				<div className={styles.lockedOverlay}>
					<span className={styles.lockedBadge}>Только для DEV</span>
					<AdminTooltip
						title="Восстановление заблокировано"
						description="Read-only сведения о backup доступны ADMIN, но восстановление любой БД разрешено только пользователям с ролью DEV. Backend проверяет это ограничение отдельно."
					/>
				</div>
			</div>
		)
	}

	if (databaseRestoreSettings.isLoading) {
		return (
			<div className={styles.card}>
				<SkeletonLoader count={1} className="h-[52px]" />
				<SkeletonLoader count={1} className="h-[52px]" />
			</div>
		)
	}

	if (!databaseRestoreSettings.data) {
		return (
			<div className={styles.card}>
				<p className={styles.empty}>
					Не удалось загрузить настройки восстановления
					{databaseRestoreSettings.error
						? `: ${errorCatch(databaseRestoreSettings.error)}`
						: ''}
				</p>
			</div>
		)
	}

	const selectedTargetSettings = databaseRestoreSettings.data.targets.find(
		target => target.id === restoreTarget
	)
	const restoreJob = databaseRestoreJob.data
	const restoreJobErrorStatus = isAxiosError(databaseRestoreJob.error)
		? databaseRestoreJob.error.response?.status
		: undefined
	const restoreRecoveryStartedAt = restoreJobMarker?.recoveryStartedAt
		? Date.parse(restoreJobMarker.recoveryStartedAt)
		: Number.NaN
	const isRestorePublicationPending = Boolean(
		restoreJobMarker &&
		restoreJobErrorStatus === 404 &&
		(databaseRestoreMutation.isPending ||
			Number.isNaN(restoreRecoveryStartedAt) ||
			Date.now() - restoreRecoveryStartedAt <
				DATABASE_RESTORE_PUBLICATION_GRACE_MS)
	)
	const isRestorePublicationUnconfirmed = Boolean(
		restoreJobMarker &&
		restoreJob?.jobId === restoreJobMarker.jobId &&
		restoreJob.status === 'QUEUED' &&
		!restoreJob.publicationConfirmed
	)
	const isRestoreJobActive = Boolean(
		restoreJobMarker &&
		(!restoreJob ||
			!TERMINAL_DATABASE_RESTORE_JOB_STATUSES.has(restoreJob.status)) &&
		!isRestorePublicationUnconfirmed
	)
	const isRestoreBlockedByFence = restoreJob?.status === 'FAILED_FENCED'
	const isRestoreEnabled = databaseRestoreSettings.data.enabled
	const restoreApproval = databaseRestoreSettings.data.approved
	const isRestoreTargetApproved =
		!restoreApproval || restoreApproval.target === restoreTarget
	const canRetryRestorePublication = Boolean(
		isRestorePublicationUnconfirmed &&
		restoreApproval?.jobId === restoreJobMarker?.jobId &&
		restoreApproval.target === restoreJobMarker?.target
	)
	const isRestoreStartAllowed =
		isRestoreEnabled || canRetryRestorePublication
	const allowedFileExtension =
		databaseRestoreSettings.data.allowedFileExtension
	const maxFileSizeBytes = databaseRestoreSettings.data.maxFileSizeBytes

	const handleRestoreTargetChange = (
		event: ChangeEvent<HTMLSelectElement>
	) => {
		const target = event.target.value
		if (!isDatabaseRestoreTarget(target)) return
		if (restoreApproval && target !== restoreApproval.target) {
			toast.error(
				'Разовый production-допуск разрешает восстановление только одобренной БД.'
			)
			return
		}

		setRestoreTarget(target)
		setRestoreFile(null)
		setRestoreConfirmation('')
		if (restoreFileInput.current) restoreFileInput.current.value = ''
	}

	const handleRestoreDatabaseBackup = () => {
		if (!isRestoreStartAllowed) {
			toast.error(
				'Production-восстановление отключено до отдельного согласования и полного rehearsal.'
			)
			return
		}
		if (!selectedTargetSettings) {
			toast.error('Выберите целевую БД')
			return
		}
		if (!isRestoreTargetApproved) {
			toast.error(
				'Выбранная БД не соответствует разовому production-допуску.'
			)
			return
		}
		if (isRestoreJobActive) {
			toast.error('Дождитесь завершения текущего восстановления')
			return
		}
		if (isRestoreBlockedByFence) {
			toast.error(
				'Сначала проверьте состояние ограждённой БД по production runbook и подтвердите критическое предупреждение.'
			)
			return
		}
		if (!restoreFile) {
			toast.error(`Выберите файл backup ${allowedFileExtension}`)
			return
		}
		if (!restoreFile.name.toLowerCase().endsWith(allowedFileExtension)) {
			toast.error(`Допустим только файл ${allowedFileExtension}`)
			return
		}
		if (restoreFile.size > maxFileSizeBytes) {
			toast.error(
				`Файл превышает допустимый размер ${formatFileSize(maxFileSizeBytes)}`
			)
			return
		}
		if (
			restoreConfirmation.trim() !== selectedTargetSettings.confirmation
		) {
			toast.error(
				`Введите точную контрольную фразу для БД ${selectedTargetSettings.label}`
			)
			return
		}

		const requestId = restoreApproval?.jobId
		if (requestId) {
			const requestMarker: DatabaseRestoreMarker = {
				jobId: requestId,
				target: restoreTarget,
				recoveryStartedAt: null
			}
			notifiedRestoreJob.current = null
			setRestoreJobMarker(requestMarker)
			if (databaseRestoreStorageKey) {
				saveDatabaseRestoreMarker(databaseRestoreStorageKey, requestMarker)
			}
		}
		const promise = databaseRestoreMutation.mutateAsync({
			target: restoreTarget,
			file: restoreFile,
			confirmation: restoreConfirmation.trim(),
			requestId
		})

		toast.promise(promise, {
			loading: `Загружаем backup БД ${selectedTargetSettings.label}...`,
			success: `Восстановление БД ${selectedTargetSettings.label} поставлено в очередь`,
			error: error =>
				requestId &&
				isAxiosError(error) &&
				(error.response?.status === undefined ||
					error.response.status >= 500)
					? 'Ответ не подтверждён; интерфейс продолжает точную проверку по requestId.'
					: `Ошибка запуска восстановления: ${errorCatch(error)}`
		})
	}

	const handleClearRestoreJob = () => {
		if (
			!restoreJob ||
			!TERMINAL_DATABASE_RESTORE_JOB_STATUSES.has(restoreJob.status)
		) {
			return
		}
		clearDatabaseRestoreMarker(databaseRestoreStorageKey, restoreJob.jobId)
		setRestoreJobMarker(null)
		if (restoreJob.status === 'FAILED_FENCED') {
			toast.error(
				'Предупреждение скрыто только в интерфейсе. Защитная блокировка БД этим действием не снимается.',
				{ duration: 10000 }
			)
			return
		}
		toast.success('Завершённое задание скрыто')
	}

	const handleCancelRestoreJob = () => {
		if (
			!restoreJob?.canCancel ||
			restoreJob.cancellationRequested ||
			databaseRestoreCancelMutation.isPending
		) {
			return
		}

		const promise = databaseRestoreCancelMutation.mutateAsync(
			restoreJob.jobId
		)
		void toast.promise(promise, {
			loading: 'Фиксируем отмену до начала блокировки БД...',
			success: 'Отмена принята. Worker завершит задание без изменения БД.',
			error: error =>
				`Не удалось отменить восстановление: ${errorCatch(error)}`
		})
	}

	return (
		<div className={styles.card}>
			<div>
				<p className={styles.label}>Восстановление БД из backup</p>
				<p className={styles.hint}>
					Файл загружается в защищённую очередь. Изолированный worker
					создаёт страховочный backup, блокирует подключения только к
					выбранной БД, восстанавливает и проверяет её перед снятием
					блокировки. Запуск и отмена записываются в Журнал событий, а итог
					сохраняется в статусе задания.
				</p>
			</div>
			{!isRestoreEnabled && !canRetryRestorePublication && (
				<p className={styles.restoreError} role="alert">
					Запуск новых восстановлений отключён release-gate. Read-only
					статус уже созданного задания и безопасная отмена до
					destructive-фазы остаются доступны.
				</p>
			)}
			{canRetryRestorePublication && (
				<p className={styles.restoreApproval} role="status">
					Manifest задания сохранён, но публикация ещё не подтверждена.
					Повторно выберите тот же backup и отправьте его с тем же jobId;
					worker не начнёт восстановление до подписанного подтверждения.
				</p>
			)}
			{restoreApproval && (
				<p className={styles.restoreApproval} role="status">
					Разовый production-допуск: БД{' '}
					<b>
						{getDatabaseRestoreTargetLabel(
							restoreApproval.target,
							databaseRestoreSettings.data.targets
						)}
					</b>
					, jobId <b>{restoreApproval.jobId}</b>, действует до{' '}
					<b>{formatRestoreJobDate(restoreApproval.expiresAt)}</b>.
					Остальные целевые БД заблокированы этим допуском.
				</p>
			)}

			<div className={styles.restoreGrid}>
				<label className={styles.fieldLabel}>
					<span>Целевая БД</span>
					<select
						className={styles.select}
						value={restoreTarget}
						onChange={handleRestoreTargetChange}
						disabled={
							databaseRestoreMutation.isPending ||
							!isRestoreStartAllowed ||
							Boolean(restoreApproval) ||
							isRestoreJobActive ||
							isRestoreBlockedByFence
						}
					>
						{databaseRestoreSettings.data.targets.map(target => (
							<option
								key={target.id}
								value={target.id}
								disabled={Boolean(
									restoreApproval && target.id !== restoreApproval.target
								)}
							>
								{target.label}
							</option>
						))}
					</select>
				</label>
				<label className={styles.fileInputLabel}>
					<span>Файл {allowedFileExtension}</span>
					<input
						ref={restoreFileInput}
						type="file"
						accept={allowedFileExtension}
						onChange={event =>
							setRestoreFile(event.target.files?.[0] ?? null)
						}
						disabled={
							databaseRestoreMutation.isPending ||
							!isRestoreStartAllowed ||
							!isRestoreTargetApproved ||
							isRestoreJobActive ||
							isRestoreBlockedByFence
						}
					/>
				</label>
				<label className={styles.fieldLabel}>
					<span>Контрольная фраза</span>
					<input
						className={styles.input}
						value={restoreConfirmation}
						onChange={event => setRestoreConfirmation(event.target.value)}
						placeholder={selectedTargetSettings?.confirmation}
						disabled={
							databaseRestoreMutation.isPending ||
							!isRestoreStartAllowed ||
							!isRestoreTargetApproved ||
							isRestoreJobActive ||
							isRestoreBlockedByFence
						}
					/>
				</label>
				<button
					type="button"
					className={styles.dangerBtn}
					onClick={handleRestoreDatabaseBackup}
					disabled={
						databaseRestoreMutation.isPending ||
						!isRestoreStartAllowed ||
						!isRestoreTargetApproved ||
						isRestoreJobActive ||
						isRestoreBlockedByFence
					}
				>
					{canRetryRestorePublication
						? 'Подтвердить публикацию повторно'
						: 'Поставить в очередь'}
				</button>
			</div>

			<p className={styles.hint}>
				Для БД <b>{selectedTargetSettings?.label}</b> введите:{' '}
				<b>{selectedTargetSettings?.confirmation}</b>. Максимальный размер:{' '}
				{formatFileSize(maxFileSizeBytes)}
				{restoreFile ? `; выбран файл ${restoreFile.name}` : ''}.
			</p>
			{restoreJobMarker && (
				<div className={styles.restoreStatus} aria-live="polite">
					<div className={styles.restoreStatusHeader}>
						<div>
							<p className={styles.statusLabel}>Последнее задание</p>
							<p className={styles.statusValue}>
								{getDatabaseRestoreTargetLabel(
									restoreJob?.target ?? restoreJobMarker.target,
									databaseRestoreSettings.data.targets
								)}
							</p>
						</div>
						{restoreJob && (
							<span
								className={`${styles.badge} ${getDatabaseRestoreJobBadgeClass(restoreJob.status)}`}
							>
								{DATABASE_RESTORE_JOB_STATUS_LABELS[restoreJob.status]}
							</span>
						)}
					</div>

					{restoreJob ? (
						<>
							<div className={styles.restoreStatusGrid}>
								<div>
									<p className={styles.statusLabel}>Файл</p>
									<p className={styles.statusValue}>
										{restoreJob.originalFileName} ·{' '}
										{formatFileSize(restoreJob.fileSize)}
									</p>
								</div>
								<div>
									<p className={styles.statusLabel}>Запрошено</p>
									<p className={styles.statusValue}>
										{formatRestoreJobDate(restoreJob.requestedAt)}
									</p>
								</div>
								<div>
									<p className={styles.statusLabel}>Завершено</p>
									<p className={styles.statusValue}>
										{formatRestoreJobDate(restoreJob.finishedAt)}
									</p>
								</div>
							</div>
							{restoreJob.error && (
								<p className={styles.restoreError}>
									{restoreJob.error.code}: {restoreJob.error.message}
								</p>
							)}
							{restoreJob.status === 'FAILED_FENCED' && (
								<div className={styles.fencedWarning} role="alert">
									<strong>Критическое состояние.</strong> Подключения к БД
									оставлены заблокированными после ошибки. Не запускайте
									сервис вручную и не повторяйте восстановление без
									проверки production runbook.
								</div>
							)}
							{restoreJob.cancellationRequested &&
								restoreJob.status !== 'CANCELLED' && (
									<p className={styles.hint}>
										Отмена зафиксирована. Worker ещё не начинал блокировку
										БД и завершит задание безопасно.
									</p>
								)}
							{restoreJob.cancellationPending && (
								<p className={styles.hint}>
									Worker приостановлен: отмена зарезервирована и ожидает
									обязательной записи в Журнал событий.
								</p>
							)}
							{restoreJob.canCancel &&
								!restoreJob.cancellationRequested && (
									<button
										type="button"
										className={styles.secondaryBtn}
										onClick={handleCancelRestoreJob}
										disabled={databaseRestoreCancelMutation.isPending}
									>
										{databaseRestoreCancelMutation.isPending
											? 'Отменяем...'
											: 'Отменить до блокировки БД'}
									</button>
								)}
							{TERMINAL_DATABASE_RESTORE_JOB_STATUSES.has(
								restoreJob.status
							) && (
								<button
									type="button"
									className={styles.secondaryBtn}
									onClick={handleClearRestoreJob}
								>
									{restoreJob.status === 'FAILED_FENCED'
										? 'Подтвердить предупреждение и скрыть'
										: 'Скрыть завершённое задание'}
								</button>
							)}
						</>
					) : isRestorePublicationPending ? (
						<p className={styles.hint}>
							Запрос отправлен. Ожидаем появление подписанного задания по
							точному requestId; повторно загружать backup не нужно.
						</p>
					) : databaseRestoreJob.isError ? (
						<p className={styles.restoreError}>
							Не удалось получить статус:{' '}
							{errorCatch(databaseRestoreJob.error)}
						</p>
					) : (
						<p className={styles.hint}>Проверяем состояние задания...</p>
					)}
				</div>
			)}
		</div>
	)
}

const AdminDatabases: NextPage = () => {
	const { user, isLoading: isUserLoading } = useUser()
	const isDev = Boolean(user?.rights?.includes(UserRole.DEV))

	const { data: settings, isLoading } = useQuery({
		queryKey: SETTINGS_QUERY_KEY,
		queryFn: adminTelegramBotService.get
	})
	const databaseBackupOverview = useQuery({
		queryKey: DATABASE_BACKUP_OVERVIEW_QUERY_KEY,
		queryFn: adminTelegramBotService.getDatabaseBackupOverview,
		refetchInterval: 30_000
	})
	const databaseBackupOverviewByTarget = new Map(
		databaseBackupOverview.data?.items.map(item => [item.target, item]) ??
			[]
	)
	const getDatabaseBackupOverviewProps = (
		target: TelegramDatabaseBackupTarget
	) => ({
		overviewError: databaseBackupOverview.error,
		overviewItem: databaseBackupOverviewByTarget.get(target) ?? null,
		overviewLoading: databaseBackupOverview.isLoading
	})

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Базы данных"
				title="Backup и восстановление PostgreSQL"
				description={
					isDev
						? 'Здесь можно отдельно поставить backup каждой БД в очередь и восстановить основную БД или БД выбранного микросервиса из PostgreSQL .dump.'
						: 'Здесь можно отдельно поставить backup каждой базы PostgreSQL в очередь и следить за их выполнением.'
				}
				risk={isDev ? 'high' : 'medium'}
				riskText={
					isDev
						? 'DEV restore заменяет данные только явно выбранной БД и оставляет подключения заблокированными, если обязательная проверка результата не пройдена.'
						: 'Перед ручным запуском проверь настройки Telegram и статус выбранной БД.'
				}
			/>

			{isLoading ? (
				Array.from({ length: 7 }, (_, cardIndex) => (
					<div key={cardIndex} className={styles.card}>
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
					</div>
				))
			) : settings ? (
				<>
					<DatabaseBackupPanel
						target="core"
						{...getDatabaseBackupOverviewProps('core')}
						title="Backup БАЗЫ СТАРОГО МОНОЛИТА"
						description="БД ЛЕГАСИ МОНОЛИТА"
						scheduleTimeLabel={settings.databaseBackupTimeLabel}
						settings={settings}
						userId={user.id}
					/>
					<DatabaseBackupPanel
						target="notification-delivery"
						{...getDatabaseBackupOverviewProps('notification-delivery')}
						title="Backup базы Notification Delivery"
						description="Локальная БД микросервиса Notification Delivery Service"
						scheduleTimeLabel={
							settings.notificationDeliveryDatabaseBackupTimeLabel
						}
						settings={settings}
						userId={user.id}
					/>
					<DatabaseBackupPanel
						target="campaigns"
						{...getDatabaseBackupOverviewProps('campaigns')}
						title="Backup базы Campaigns"
						description="Локальная БД микросервиса Campaigns Service"
						scheduleTimeLabel={settings.campaignsDatabaseBackupTimeLabel}
						settings={settings}
						userId={user.id}
					/>
					<DatabaseBackupPanel
						target="reporting"
						{...getDatabaseBackupOverviewProps('reporting')}
						title="Backup базы Reporting"
						description="Локальная БД микросервиса Reporting Service"
						scheduleTimeLabel={settings.reportingDatabaseBackupTimeLabel}
						settings={settings}
						userId={user.id}
					/>
					<DatabaseBackupPanel
						target="widgets"
						{...getDatabaseBackupOverviewProps('widgets')}
						title="Backup базы Widgets"
						description="Локальная БД микросервиса Widgets Service"
						scheduleTimeLabel={settings.widgetsDatabaseBackupTimeLabel}
						settings={settings}
						userId={user.id}
					/>
					<DatabaseBackupPanel
						target="billing"
						{...getDatabaseBackupOverviewProps('billing')}
						title="Backup базы Billing"
						description="Локальная БД микросервиса Billing Service"
						scheduleTimeLabel={settings.billingDatabaseBackupTimeLabel}
						settings={settings}
						userId={user.id}
					/>
					<DatabaseBackupPanel
						target="identity"
						{...getDatabaseBackupOverviewProps('identity')}
						title="Backup базы Identity"
						description="Локальная БД микросервиса Identity Service"
						scheduleTimeLabel={settings.identityDatabaseBackupTimeLabel}
						settings={settings}
						userId={user.id}
					/>
				</>
			) : (
				<div className={styles.card}>
					<p className={styles.empty}>Не удалось загрузить настройки</p>
				</div>
			)}

			<DatabaseBackupHistory />

			<DatabaseRestorePanel
				isDev={isDev}
				isUserLoading={isUserLoading}
				userId={user?.id}
			/>
		</section>
	)
}

export default AdminDatabases
