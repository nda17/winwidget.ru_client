'use client'

import { UserRole, useUser } from '@/entities/user'
import { adminTelegramBotService } from '@/features/manage-telegram-bot'
import type {
	AdminTelegramBotSettings,
	TelegramDatabaseBackupJobStatus,
	TelegramDatabaseBackupTarget
} from '@/features/manage-telegram-bot'
import { devToolsService } from '@/features/run-admin-task'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import AdminTooltip from '@/screens/admin/ui/common/admin-tooltip/AdminTooltip'
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

const getDatabaseBackupTargetLabel = (
	target: TelegramDatabaseBackupTarget
) => (target === 'core' ? 'основной БД' : 'БД Notification Delivery')

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

		if (job.status === 'SUCCEEDED') {
			const fileSize = job.result?.fileSize
			toast.success(
				fileSize === undefined
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

		toast.error(
			`Ошибка backup ${getDatabaseBackupTargetLabel(target)}: ${job.lastError || 'неизвестная ошибка'}`
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
	scheduleTimeLabel: string
	settings: AdminTelegramBotSettings
	target: TelegramDatabaseBackupTarget
	title: string
	userId: string | null | undefined
}

const DatabaseBackupPanel = ({
	description,
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
						Отправить backup
					</button>
				</div>
				<div className={styles.backupMetaGrid}>
					<div className={styles.statusItem}>
						<p className={styles.statusLabel}>Плановое время</p>
						<p className={styles.statusValue}>{scheduleTimeLabel}</p>
					</div>
					<div className={styles.statusItem}>
						<p className={styles.statusLabel}>Формат</p>
						<p className={styles.statusValue}>PostgreSQL .dump</p>
					</div>
					<div className={styles.statusItem} aria-live="polite">
						<p className={styles.statusLabel}>Ручной backup</p>
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
								{backup.databaseBackupJob.data.status === 'FAILED' &&
									backup.databaseBackupJob.data.lastError && (
										<p className={styles.hint}>
											{backup.databaseBackupJob.data.lastError}
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
						) : backup.latestActiveDatabaseBackupJob.isError ? (
							<p className={styles.hint}>
								Не удалось проверить активный backup:{' '}
								{errorCatch(backup.latestActiveDatabaseBackupJob.error)}
							</p>
						) : (
							<p className={styles.statusValue}>Не запускался</p>
						)}
					</div>
				</div>
			</div>
		</div>
	)
}

const AdminDatabases: NextPage = () => {
	const { user, isLoading: isUserLoading } = useUser()
	const isDev = Boolean(user?.rights?.includes(UserRole.DEV))
	const [restoreFile, setRestoreFile] = useState<File | null>(null)
	const [restoreConfirmation, setRestoreConfirmation] = useState('')
	const restoreFileInput = useRef<HTMLInputElement | null>(null)

	const { data: settings, isLoading } = useQuery({
		queryKey: SETTINGS_QUERY_KEY,
		queryFn: adminTelegramBotService.get
	})

	const databaseRestoreSettings = useQuery({
		queryKey: RESTORE_SETTINGS_QUERY_KEY,
		queryFn: devToolsService.getDatabaseRestoreSettings,
		enabled: isDev
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

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Базы данных"
				title="Backup и восстановление PostgreSQL"
				description={
					isDev
						? 'Здесь можно отдельно поставить backup каждой БД в очередь и восстановить основную БД из PostgreSQL .dump.'
						: 'Здесь можно отдельно поставить backup каждой базы PostgreSQL в очередь и следить за их выполнением.'
				}
				risk={isDev ? 'high' : 'medium'}
				riskText={
					isDev
						? 'DEV restore ниже относится только к основной БД и заменяет её текущие данные содержимым backup-файла.'
						: 'Перед ручным запуском проверь настройки Telegram и статус выбранной БД.'
				}
			/>

			{isLoading ? (
				Array.from({ length: 2 }, (_, cardIndex) => (
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
						title="Backup основной базы данных"
						description="Managed PostgreSQL с данными монолита. Ручной dump создаётся отдельно и отправляется вне VPS в Telegram-топик Backups."
						scheduleTimeLabel={settings.databaseBackupTimeLabel}
						settings={settings}
						userId={user.id}
					/>
					<DatabaseBackupPanel
						target="notification-delivery"
						title="Backup базы Notification Delivery"
						description="Локальная БД микросервиса. У неё отдельные job, retry и статус; сбой не перезапускает backup основной БД."
						scheduleTimeLabel={
							settings.notificationDeliveryDatabaseBackupTimeLabel
						}
						settings={settings}
						userId={user.id}
					/>
				</>
			) : (
				<div className={styles.card}>
					<p className={styles.empty}>Не удалось загрузить настройки</p>
				</div>
			)}

			{isUserLoading ? (
				<div className={styles.card}>
					<SkeletonLoader count={1} className="h-[52px]" />
					<SkeletonLoader count={1} className="h-[52px]" />
				</div>
			) : isDev ? (
				<div className={styles.card}>
					{databaseRestoreSettings.isLoading ? (
						<>
							<SkeletonLoader count={1} className="h-[52px]" />
							<SkeletonLoader count={1} className="h-[52px]" />
						</>
					) : databaseRestoreSettings.data ? (
						<>
							<div>
								<p className={styles.label}>
									Восстановление основной БД из backup
								</p>
								<p className={styles.hint}>
									Этот endpoint предназначен только для основной БД. Перед
									запуском убедитесь, что выбран core dump WinWidget:
									сервер проверит схему public и отклонит dump Notification
									Delivery, но источник файла должен подтвердить оператор.
									Восстановление Notification Delivery выполняется только
									по защищённому production runbook. Действие логируется в
									журнале событий.
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
			) : (
				<div
					className={`${styles.card} ${styles.lockedCard}`}
					aria-disabled="true"
				>
					<div className={styles.lockedContent} aria-hidden="true">
						<div>
							<p className={styles.label}>
								Восстановление основной БД из backup
							</p>
							<p className={styles.hint}>
								DEV restore предназначен только для основной БД. Оператор
								должен выбрать core dump WinWidget; БД Notification
								Delivery восстанавливается по production runbook.
							</p>
						</div>
						<div className={styles.restoreGrid}>
							<label className={styles.fileInputLabel}>
								<span>Файл .dump</span>
								<input type="file" accept=".dump" disabled />
							</label>
							<input
								className={styles.input}
								placeholder="RESTORE DATABASE"
								disabled
							/>
							<button type="button" className={styles.dangerBtn} disabled>
								Восстановить БД
							</button>
						</div>
						<p className={styles.hint}>
							Для подтверждения потребуется контрольная фраза.
						</p>
					</div>
					<div className={styles.lockedOverlay}>
						<span className={styles.lockedBadge}>Только для DEV</span>
						<AdminTooltip
							title="Восстановление заблокировано"
							description="Данный функционал доступен только пользователям с ролью DEV."
						/>
					</div>
				</div>
			)}
		</section>
	)
}

export default AdminDatabases
