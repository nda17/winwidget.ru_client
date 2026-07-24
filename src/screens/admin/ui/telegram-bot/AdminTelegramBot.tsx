'use client'

import { useUser } from '@/entities/user'
import { errorCatch } from '@/shared/api'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import Heading from '@/shared/ui/heading/Heading'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	adminTelegramBotService,
	type AdminTelegramBotSettings,
	type TelegramDatabaseBackupJobStatus,
	type TelegramWebhookBot
} from '@/features/manage-telegram-bot'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { NextPage } from 'next'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminTelegramBot.module.scss'

const SETTINGS_QUERY_KEY = ['admin-telegram-bot-settings']
const WEBHOOKS_QUERY_KEY = ['admin-telegram-bot-webhooks']
const WEBHOOK_BOTS: TelegramWebhookBot[] = ['info', 'auth', 'support']
const MIN_TASK_TIME_GAP_MINUTES = 5
const MAX_TELEGRAM_TOPIC_ID = 2147483647
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

const getDatabaseBackupJobBadgeClass = (
	status: TelegramDatabaseBackupJobStatus
) => {
	if (status === 'SUCCEEDED') return styles.badgeOk
	if (status === 'FAILED' || status === 'CANCELLED') {
		return styles.badgeError
	}
	return styles.badgeProgress
}
const TELEGRAM_TOPIC_FIELDS = [
	{
		key: 'supportThreadId',
		label: 'Support_chat',
		description: 'Переписка техподдержки с пользователями'
	},
	{
		key: 'databaseBackupThreadId',
		label: 'Backups',
		description: 'Ручные и автоматические backup базы данных'
	},
	{
		key: 'paymentsThreadId',
		label: 'Payments',
		description: 'Уведомления о новых успешных платежах'
	},
	{
		key: 'reportsThreadId',
		label: 'Reports',
		description: 'Ежедневные сводки и отчёты'
	}
] as const

type TelegramTopicField = (typeof TELEGRAM_TOPIC_FIELDS)[number]['key']
type TelegramTopicInputs = Record<TelegramTopicField, string>

const EMPTY_TELEGRAM_TOPIC_INPUTS: TelegramTopicInputs = {
	supportThreadId: '',
	databaseBackupThreadId: '',
	paymentsThreadId: '',
	reportsThreadId: ''
}

const getTelegramTopicInputs = (
	settings: AdminTelegramBotSettings
): TelegramTopicInputs => ({
	supportThreadId: settings.supportThreadId?.toString() ?? '',
	databaseBackupThreadId:
		settings.databaseBackupThreadId?.toString() ?? '',
	paymentsThreadId: settings.paymentsThreadId?.toString() ?? '',
	reportsThreadId: settings.reportsThreadId?.toString() ?? ''
})

const parseTelegramTopicId = (value: string) => {
	const normalizedValue = value.trim()

	if (!normalizedValue) return null

	const topicId = Number(normalizedValue)
	return Number.isSafeInteger(topicId) &&
		topicId > 0 &&
		topicId <= MAX_TELEGRAM_TOPIC_ID
		? topicId
		: undefined
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

const getTimeMinutes = (value: string) => {
	const [hour, minute] = value.split(':').map(Number)

	if (
		!Number.isInteger(hour) ||
		!Number.isInteger(minute) ||
		hour < 0 ||
		hour > 23 ||
		minute < 0 ||
		minute > 59
	) {
		return null
	}

	return hour * 60 + minute
}

const getTaskTimeGapMinutes = (first: string, second: string) => {
	const firstMinutes = getTimeMinutes(first)
	const secondMinutes = getTimeMinutes(second)

	if (firstMinutes === null || secondMinutes === null) return null

	const directGap = Math.abs(firstMinutes - secondMinutes)
	return Math.min(directGap, 24 * 60 - directGap)
}

const AdminTelegramBot: NextPage = () => {
	const queryClient = useQueryClient()
	const { user } = useUser()
	const [chatId, setChatId] = useState('')
	const [topicIds, setTopicIds] = useState<TelegramTopicInputs>(
		EMPTY_TELEGRAM_TOPIC_INPUTS
	)
	const [summaryTime, setSummaryTime] = useState('')
	const [backupTime, setBackupTime] = useState('')
	const [databaseBackupJobId, setDatabaseBackupJobId] = useState<
		string | null
	>(null)
	const isTelegramRoutingDraftDirty = useRef(false)
	const isScheduleDraftDirty = useRef(false)
	const notifiedDatabaseBackupJob = useRef<string | null>(null)
	const checkedStaleDatabaseBackupJob = useRef<string | null>(null)
	const databaseBackupStorageKey = user.id
		? `${DATABASE_BACKUP_STORAGE_KEY_PREFIX}:${user.id}`
		: null

	const { data: settings, isLoading } = useQuery({
		queryKey: SETTINGS_QUERY_KEY,
		queryFn: adminTelegramBotService.get
	})

	const {
		data: webhookStatuses,
		isLoading: isWebhookStatusesLoading,
		refetch: refetchWebhookStatuses
	} = useQuery({
		queryKey: WEBHOOKS_QUERY_KEY,
		queryFn: adminTelegramBotService.getWebhookStatuses
	})

	useEffect(() => {
		if (!settings) return

		if (!isTelegramRoutingDraftDirty.current) {
			setChatId(settings.dailySummaryChatId)
			setTopicIds(getTelegramTopicInputs(settings))
		}

		if (!isScheduleDraftDirty.current) {
			setSummaryTime(settings.dailySummaryTime)
			setBackupTime(settings.databaseBackupTime)
		}
	}, [settings])

	const mutation = useMutation({
		mutationFn: adminTelegramBotService.update,
		onSuccess: async (result, patch) => {
			if (
				'dailySummaryChatId' in patch ||
				TELEGRAM_TOPIC_FIELDS.some(field => field.key in patch)
			) {
				isTelegramRoutingDraftDirty.current = false
				setChatId(result.dailySummaryChatId)
				setTopicIds(getTelegramTopicInputs(result))
			}

			if ('dailySummaryTime' in patch || 'databaseBackupTime' in patch) {
				isScheduleDraftDirty.current = false
				setSummaryTime(result.dailySummaryTime)
				setBackupTime(result.databaseBackupTime)
			}

			await queryClient.invalidateQueries({
				queryKey: SETTINGS_QUERY_KEY
			})
		}
	})

	const webhookMutation = useMutation({
		mutationFn: adminTelegramBotService.reinstallWebhook
	})

	const allWebhooksMutation = useMutation({
		mutationFn: adminTelegramBotService.reinstallWebhooks
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

	const saveWithToast = (
		patch: Parameters<typeof adminTelegramBotService.update>[0],
		loading: string
	) => {
		const promise = mutation.mutateAsync(patch)

		toast.promise(promise, {
			loading,
			success: 'Настройки сохранены',
			error: error => `Ошибка сохранения: ${errorCatch(error)}`
		})
	}

	const handleReinstallWebhook = (bot: TelegramWebhookBot) => {
		const promise = webhookMutation.mutateAsync(bot).then(async result => {
			await queryClient.invalidateQueries({
				queryKey: WEBHOOKS_QUERY_KEY
			})
			return result
		})

		toast.promise(promise, {
			loading:
				bot === 'auth'
					? 'Переустанавливаем webhook Auth_bot...'
					: bot === 'support'
						? 'Переустанавливаем webhook @winwidget_support_bot...'
						: 'Переустанавливаем webhook @winwidget_info_bot...',
			success: result => `Webhook ${result.title} переустановлен`,
			error: error => `Ошибка webhook: ${errorCatch(error)}`
		})
	}

	const handleReinstallAllWebhooks = () => {
		const promise = allWebhooksMutation
			.mutateAsync()
			.then(async result => {
				await queryClient.invalidateQueries({
					queryKey: WEBHOOKS_QUERY_KEY
				})
				return result
			})

		toast.promise(promise, {
			loading: 'Переустанавливаем webhook Telegram-ботов...',
			success: 'Webhook Telegram-ботов переустановлены',
			error: error => `Ошибка webhook: ${errorCatch(error)}`
		})
	}

	const handleToggleSummary = () => {
		if (!settings) return

		if (!settings.dailySummaryEnabled) {
			if (!settings.dailySummaryChatId.trim()) {
				toast.error('Сначала сохраните ID группы Telegram')
				return
			}

			if (!settings.reportsThreadId) {
				toast.error('Сначала сохраните ID топика Reports')
				return
			}
		}

		saveWithToast(
			{ dailySummaryEnabled: !settings.dailySummaryEnabled },
			'Применяем настройку...'
		)
	}

	const handleToggleDatabaseBackup = () => {
		if (!settings) return

		if (!settings.databaseBackupEnabled) {
			if (!settings.dailySummaryChatId.trim()) {
				toast.error('Сначала сохраните ID группы Telegram')
				return
			}

			if (!settings.databaseBackupThreadId) {
				toast.error('Сначала сохраните ID топика Backups')
				return
			}
		}

		saveWithToast(
			{ databaseBackupEnabled: !settings.databaseBackupEnabled },
			'Применяем настройку backup...'
		)
	}

	const handleSaveTelegramRouting = () => {
		if (!settings) return

		const normalizedChatId = chatId.trim()
		const normalizedTopicIds = {} as Record<
			TelegramTopicField,
			number | null
		>

		for (const field of TELEGRAM_TOPIC_FIELDS) {
			const topicId = parseTelegramTopicId(topicIds[field.key])

			if (topicId === undefined) {
				toast.error(
					`ID топика ${field.label} должен быть целым числом от 1 до ${MAX_TELEGRAM_TOPIC_ID}`
				)
				return
			}

			normalizedTopicIds[field.key] = topicId
		}

		if (
			(settings.dailySummaryEnabled || settings.databaseBackupEnabled) &&
			!normalizedChatId
		) {
			toast.error('Укажите ID группы Telegram')
			return
		}

		if (
			!normalizedChatId &&
			Object.values(normalizedTopicIds).some(topicId => topicId !== null)
		) {
			toast.error('Укажите ID Telegram-группы для настроенных топиков')
			return
		}

		if (
			settings.dailySummaryEnabled &&
			normalizedTopicIds.reportsThreadId === null
		) {
			toast.error('Для включённой сводки укажите ID топика Reports')
			return
		}

		if (
			settings.databaseBackupEnabled &&
			normalizedTopicIds.databaseBackupThreadId === null
		) {
			toast.error('Для включённого backup укажите ID топика Backups')
			return
		}

		saveWithToast(
			{
				dailySummaryChatId: normalizedChatId,
				...normalizedTopicIds
			},
			'Сохраняем маршрутизацию Telegram...'
		)
	}

	const handleSaveSchedule = () => {
		if (!settings) return

		if (!summaryTime || !backupTime) {
			toast.error('Укажите время сводки и backup')
			return
		}

		const taskTimeGap = getTaskTimeGapMinutes(summaryTime, backupTime)

		if (taskTimeGap === null || taskTimeGap < MIN_TASK_TIME_GAP_MINUTES) {
			toast.error(
				`Разнесите сводку и backup минимум на ${MIN_TASK_TIME_GAP_MINUTES} минут`
			)
			return
		}

		saveWithToast(
			{
				dailySummaryTime: summaryTime,
				databaseBackupTime: backupTime
			},
			'Сохраняем расписание...'
		)
	}

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

	const lastSentText = settings?.dailySummaryLastSentAt
		? formatDate(settings.dailySummaryLastSentAt)
		: 'Ещё не отправлялась'
	const lastBackupText = settings?.databaseBackupLastSentAt
		? formatDate(settings.databaseBackupLastSentAt)
		: 'Ещё не отправлялся'
	const isWebhookActionPending =
		webhookMutation.isPending || allWebhooksMutation.isPending
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
	const isTelegramRoutingChanged = Boolean(
		settings &&
		(chatId.trim() !== settings.dailySummaryChatId ||
			TELEGRAM_TOPIC_FIELDS.some(
				field =>
					topicIds[field.key].trim() !==
					(settings[field.key]?.toString() ?? '')
			))
	)
	const statusByBot = new Map(
		webhookStatuses?.items.map(status => [status.bot, status]) ?? []
	)
	const isBotTokenConfigured = (bot: TelegramWebhookBot) => {
		if (!settings) return false
		if (bot === 'auth') return settings.authTelegramBotTokenConfigured
		if (bot === 'support')
			return settings.supportTelegramBotTokenConfigured
		return settings.telegramBotTokenConfigured
	}

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Telegram-боты"
				title="Webhook и сообщения в Telegram"
				description="Настраивает webhook Auth_bot, @winwidget_info_bot и @winwidget_support_bot, а также распределение служебных сообщений по топикам Telegram-группы администраторов."
				risk="medium"
				riskText="Группа должна быть супергруппой с включёнными Topics. Если ID группы или нужного топика указан неверно, соответствующие сообщения не отправятся. @winwidget_info_bot и @winwidget_support_bot должны быть добавлены в группу, а токены должны быть настроены на сервере."
			/>

			<div className={styles.card}>
				{isLoading ? (
					<>
						<div className={styles.statusGrid}>
							<SkeletonLoader count={1} className="h-[76px]" />
							<SkeletonLoader count={1} className="h-[76px]" />
							<SkeletonLoader count={1} className="h-[76px]" />
						</div>
						<SkeletonLoader count={1} className="h-[58px]" />
						<SkeletonLoader count={1} className="h-[82px]" />
					</>
				) : settings ? (
					<>
						<div className={styles.statusGrid}>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>
									Токен @winwidget_info_bot
								</p>
								<span
									className={`${styles.badge} ${
										settings.telegramBotTokenConfigured
											? styles.badgeOk
											: styles.badgeWarning
									}`}
								>
									{settings.telegramBotTokenConfigured
										? 'Настроен'
										: 'Не настроен'}
								</span>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>
									Username @winwidget_info_bot
								</p>
								<span
									className={`${styles.badge} ${
										settings.telegramBotUsernameConfigured
											? styles.badgeOk
											: styles.badgeWarning
									}`}
								>
									{settings.telegramBotUsernameConfigured
										? 'Настроен'
										: 'Не настроен'}
								</span>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Токен Auth_bot</p>
								<span
									className={`${styles.badge} ${
										settings.authTelegramBotTokenConfigured
											? styles.badgeOk
											: styles.badgeWarning
									}`}
								>
									{settings.authTelegramBotTokenConfigured
										? 'Настроен'
										: 'Не настроен'}
								</span>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>
									Токен @winwidget_support_bot
								</p>
								<span
									className={`${styles.badge} ${
										settings.supportTelegramBotTokenConfigured
											? styles.badgeOk
											: styles.badgeWarning
									}`}
								>
									{settings.supportTelegramBotTokenConfigured
										? 'Настроен'
										: 'Не настроен'}
								</span>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Username Auth_bot</p>
								<span
									className={`${styles.badge} ${
										settings.authTelegramBotUsernameConfigured
											? styles.badgeOk
											: styles.badgeWarning
									}`}
								>
									{settings.authTelegramBotUsernameConfigured
										? 'Настроен'
										: 'Не настроен'}
								</span>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Webhook host</p>
								<span
									className={`${styles.badge} ${
										settings.telegramWebhookHostConfigured
											? styles.badgeOk
											: styles.badgeWarning
									}`}
								>
									{settings.telegramWebhookHostConfigured
										? 'Настроен'
										: 'Не настроен'}
								</span>
								<p className={styles.statusValue}>
									{settings.telegramWebhookHost ?? '—'}
								</p>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Последняя сводка</p>
								<p className={styles.statusValue}>{lastSentText}</p>
							</div>
						</div>

						<div className={styles.webhookRow}>
							<div>
								<p className={styles.label}>Webhook ботов</p>
								<p className={styles.hint}>
									Переустанавливает webhook с секретом и очищает старую
									очередь Telegram-обновлений
								</p>
							</div>
							<div className={styles.webhookActions}>
								<button
									type="button"
									className={styles.actionBtn}
									onClick={() => handleReinstallWebhook('info')}
									disabled={
										isWebhookActionPending ||
										!settings.telegramBotTokenConfigured ||
										!settings.telegramWebhookHostConfigured
									}
								>
									@winwidget_info_bot
								</button>
								<button
									type="button"
									className={styles.actionBtn}
									onClick={() => handleReinstallWebhook('auth')}
									disabled={
										isWebhookActionPending ||
										!settings.authTelegramBotTokenConfigured ||
										!settings.telegramWebhookHostConfigured
									}
								>
									Auth_bot
								</button>
								<button
									type="button"
									className={styles.actionBtn}
									onClick={() => handleReinstallWebhook('support')}
									disabled={
										isWebhookActionPending ||
										!settings.supportTelegramBotTokenConfigured ||
										!settings.telegramWebhookHostConfigured
									}
								>
									@winwidget_support_bot
								</button>
								<button
									type="button"
									className={styles.saveBtn}
									onClick={handleReinstallAllWebhooks}
									disabled={
										isWebhookActionPending ||
										!settings.telegramBotTokenConfigured ||
										!settings.authTelegramBotTokenConfigured ||
										!settings.supportTelegramBotTokenConfigured ||
										!settings.telegramWebhookHostConfigured
									}
								>
									Переустановить все
								</button>
							</div>
						</div>

						<div className={styles.webhookStatusPanel}>
							<div className={styles.webhookStatusHeader}>
								<div>
									<p className={styles.label}>Статус webhook</p>
									<p className={styles.hint}>
										Показывает текущую очередь Telegram и последнюю ошибку
										доставки
									</p>
								</div>
								<button
									type="button"
									className={styles.actionBtn}
									onClick={() => refetchWebhookStatuses()}
									disabled={isWebhookStatusesLoading}
								>
									Обновить
								</button>
							</div>

							<div className={styles.webhookStatusGrid}>
								{WEBHOOK_BOTS.map(bot => {
									const status = statusByBot.get(bot)
									const pendingCount = status?.pendingUpdateCount ?? null
									const hasProblem = Boolean(
										status &&
										(!status.ok ||
											!status.webhookMatchesExpected ||
											status.usernameMatchesConfigured === false ||
											(pendingCount ?? 0) > 0)
									)

									return (
										<div key={bot} className={styles.webhookStatusItem}>
											<div className={styles.webhookStatusTitleRow}>
												<p className={styles.statusValue}>
													{status?.title ??
														(bot === 'auth'
															? 'Auth_bot'
															: bot === 'support'
																? '@winwidget_support_bot'
																: '@winwidget_info_bot')}
												</p>
												<span
													className={`${styles.badge} ${
														!status
															? styles.badgeWarning
															: hasProblem
																? styles.badgeWarning
																: styles.badgeOk
													}`}
												>
													{!status
														? 'Проверяем'
														: hasProblem
															? 'Внимание'
															: 'OK'}
												</span>
											</div>
											<p className={styles.webhookStatusLine}>
												Очередь: {pendingCount ?? '—'}
											</p>
											<p className={styles.webhookStatusLine}>
												Username: {status?.actualUsername ?? '—'}
											</p>
											<p className={styles.webhookStatusLine}>
												Env:{' '}
												{status?.configuredUsername
													? `@${status.configuredUsername}`
													: '—'}
											</p>
											<p className={styles.webhookStatusLine}>
												URL:{' '}
												{status?.error
													? 'проверить не удалось'
													: status?.webhookMatchesExpected
														? 'актуальный'
														: status?.webhookUrl
															? 'отличается'
															: 'не установлен'}
											</p>
											{status &&
												!status.error &&
												!status.webhookMatchesExpected && (
													<>
														<p className={styles.webhookStatusLine}>
															Ожидаемый: {status.expectedWebhookUrl ?? '—'}
														</p>
														<p className={styles.webhookStatusLine}>
															Фактический: {status.webhookUrl ?? '—'}
														</p>
													</>
												)}
											{status?.lastErrorMessage && (
												<p
													className={
														hasProblem
															? styles.webhookStatusError
															: styles.webhookStatusHistory
													}
												>
													История последней ошибки
													{status.lastErrorAt
														? ` ${formatDate(status.lastErrorAt)}`
														: ''}
													: {status.lastErrorMessage}
												</p>
											)}
											{status?.error && (
												<p className={styles.webhookStatusError}>
													{status.error}
												</p>
											)}
											{status?.usernameMatchesConfigured === false && (
												<p className={styles.webhookStatusError}>
													Username в env не совпадает с токеном
												</p>
											)}
											{!isBotTokenConfigured(bot) && (
												<p className={styles.webhookStatusError}>
													Токен не настроен
												</p>
											)}
										</div>
									)
								})}
							</div>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.label}>Отправка сводки</p>
								<p className={styles.hint}>
									@winwidget_info_bot отправляет сводку каждый день в{' '}
									{settings.dailySummaryTimeLabel} и явно показывает период
									отчёта. Сообщение приходит в топик Reports.
								</p>
							</div>
							<button
								type="button"
								className={`${styles.toggle} ${settings.dailySummaryEnabled ? styles.toggleOn : ''}`}
								onClick={handleToggleSummary}
								disabled={mutation.isPending}
								aria-label={
									settings.dailySummaryEnabled
										? 'Выключить отправку сводки'
										: 'Включить отправку сводки'
								}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.label}>Отправка backup</p>
								<p className={styles.hint}>
									@winwidget_info_bot отправляет backup базы каждый день в{' '}
									{settings.databaseBackupTimeLabel}. Файл приходит в топик
									Backups.
								</p>
							</div>
							<button
								type="button"
								className={`${styles.toggle} ${settings.databaseBackupEnabled ? styles.toggleOn : ''}`}
								onClick={handleToggleDatabaseBackup}
								disabled={mutation.isPending}
								aria-label={
									settings.databaseBackupEnabled
										? 'Выключить отправку backup'
										: 'Включить отправку backup'
								}
							>
								<span className={styles.toggleThumb} />
							</button>
						</div>

						<div className={styles.schedulePanel}>
							<div className={styles.scheduleGrid}>
								<label className={styles.field}>
									<span className={styles.label}>Время сводки</span>
									<input
										type="time"
										className={styles.input}
										value={summaryTime}
										disabled={mutation.isPending}
										onChange={event => {
											isScheduleDraftDirty.current = true
											setSummaryTime(event.target.value)
										}}
									/>
								</label>
								<label className={styles.field}>
									<span className={styles.label}>Время backup</span>
									<input
										type="time"
										className={styles.input}
										value={backupTime}
										disabled={mutation.isPending}
										onChange={event => {
											isScheduleDraftDirty.current = true
											setBackupTime(event.target.value)
										}}
									/>
								</label>
								<button
									type="button"
									className={styles.saveBtn}
									onClick={handleSaveSchedule}
									disabled={
										mutation.isPending ||
										(summaryTime === settings.dailySummaryTime &&
											backupTime === settings.databaseBackupTime)
									}
								>
									Сохранить расписание
								</button>
							</div>
							<p className={styles.hint}>
								Время указывается по Москве. Разница между задачами должна
								быть минимум {MIN_TASK_TIME_GAP_MINUTES} минут.
							</p>
						</div>

						<div className={styles.schedulePanel}>
							<div className={styles.field}>
								<label
									htmlFor="telegram-group-id"
									className={styles.label}
								>
									ID группы Telegram
								</label>
								<input
									id="telegram-group-id"
									className={styles.input}
									value={chatId}
									disabled={mutation.isPending}
									onChange={event => {
										isTelegramRoutingDraftDirty.current = true
										setChatId(event.target.value)
									}}
									placeholder="-1001234567890"
									maxLength={100}
								/>
							</div>

							<div className={styles.statusGrid}>
								{TELEGRAM_TOPIC_FIELDS.map(field => (
									<label key={field.key} className={styles.field}>
										<span className={styles.label}>{field.label}</span>
										<input
											type="number"
											className={styles.input}
											value={topicIds[field.key]}
											disabled={mutation.isPending}
											onChange={event => {
												isTelegramRoutingDraftDirty.current = true
												setTopicIds(current => ({
													...current,
													[field.key]: event.target.value
												}))
											}}
											placeholder="123"
											min={1}
											max={MAX_TELEGRAM_TOPIC_ID}
											step={1}
											inputMode="numeric"
										/>
										<span className={styles.hint}>
											{field.description}
										</span>
									</label>
								))}
							</div>

							<p className={styles.hint}>
								Группа должна быть супергруппой с включёнными Topics. Для
								каждого назначения укажите его message_thread_id. Если ID
								топика не заполнен, сообщения этого типа не отправляются;
								fallback в General не используется.
							</p>

							<button
								type="button"
								className={styles.saveBtn}
								onClick={handleSaveTelegramRouting}
								disabled={mutation.isPending || !isTelegramRoutingChanged}
							>
								Сохранить маршрутизацию
							</button>
						</div>

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
										<p className={styles.statusValue}>
											Проверяем статус...
										</p>
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
					</>
				) : (
					<p className={styles.empty}>Не удалось загрузить настройки</p>
				)}
			</div>
		</section>
	)
}

export default AdminTelegramBot
