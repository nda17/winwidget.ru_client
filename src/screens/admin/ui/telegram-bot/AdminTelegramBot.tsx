'use client'

import { errorCatch } from '@/shared/api'
import {
	reportingDailySummaryService,
	type UpdateReportingDailySummarySettings
} from '@/features/admin-monitoring'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import Heading from '@/shared/ui/heading/Heading'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	adminTelegramBotService,
	type AdminTelegramBotSettings,
	type TelegramWebhookBot
} from '@/features/manage-telegram-bot'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminTelegramBot.module.scss'

const SETTINGS_QUERY_KEY = ['admin-telegram-bot-settings']
const DAILY_SUMMARY_SETTINGS_QUERY_KEY = [
	'admin-reporting-daily-summary-settings'
]
const WEBHOOKS_QUERY_KEY = ['admin-telegram-bot-webhooks']
const WEBHOOK_BOTS: TelegramWebhookBot[] = ['info', 'auth', 'support']
const MIN_TASK_TIME_GAP_MINUTES = 5
const MAX_TELEGRAM_TOPIC_ID = 2147483647
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
		key: 'operationalAlertsThreadId',
		label: 'Системные уведомления',
		description: 'Ошибки RabbitMQ, workers, Outbox и фоновых задач Core'
	}
] as const

type TelegramTopicField = (typeof TELEGRAM_TOPIC_FIELDS)[number]['key']
type TelegramTopicInputs = Record<TelegramTopicField, string>

const EMPTY_TELEGRAM_TOPIC_INPUTS: TelegramTopicInputs = {
	supportThreadId: '',
	databaseBackupThreadId: '',
	paymentsThreadId: '',
	operationalAlertsThreadId: ''
}

const getTelegramTopicInputs = (
	settings: AdminTelegramBotSettings
): TelegramTopicInputs => ({
	supportThreadId: settings.supportThreadId?.toString() ?? '',
	databaseBackupThreadId:
		settings.databaseBackupThreadId?.toString() ?? '',
	paymentsThreadId: settings.paymentsThreadId?.toString() ?? '',
	operationalAlertsThreadId:
		settings.operationalAlertsThreadId?.toString() ?? ''
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

const addMinutesToTime = (value: string, minutesToAdd: number) => {
	const minutes = getTimeMinutes(value)
	if (minutes === null) return null

	const nextMinutes = (minutes + minutesToAdd) % (24 * 60)
	return `${String(Math.floor(nextMinutes / 60)).padStart(2, '0')}:${String(
		nextMinutes % 60
	).padStart(2, '0')}`
}

const hasMinimumTaskTimeGap = (
	summaryTime: string,
	backupTime: string,
	backupDelayMinutes: number[]
) =>
	[0, ...backupDelayMinutes].every(delayMinutes => {
		const delayedBackupTime = addMinutesToTime(backupTime, delayMinutes)
		if (delayedBackupTime === null) return false

		const taskTimeGap = getTaskTimeGapMinutes(
			summaryTime,
			delayedBackupTime
		)
		return taskTimeGap !== null && taskTimeGap >= MIN_TASK_TIME_GAP_MINUTES
	})

const AdminTelegramBot: NextPage = () => {
	const queryClient = useQueryClient()
	const [chatId, setChatId] = useState('')
	const [topicIds, setTopicIds] = useState<TelegramTopicInputs>(
		EMPTY_TELEGRAM_TOPIC_INPUTS
	)
	const [dailySummaryThreadId, setDailySummaryThreadId] = useState('')
	const [dailySummaryDestinationChatId, setDailySummaryDestinationChatId] =
		useState('')
	const [summaryTime, setSummaryTime] = useState('')
	const [backupTime, setBackupTime] = useState('')
	const isTelegramRoutingDraftDirty = useRef(false)
	const isDailySummaryDraftDirty = useRef(false)
	const isBackupScheduleDraftDirty = useRef(false)

	const { data: settings, isLoading: isTelegramSettingsLoading } =
		useQuery({
			queryKey: SETTINGS_QUERY_KEY,
			queryFn: adminTelegramBotService.get
		})
	const {
		data: dailySummarySettings,
		isLoading: isDailySummarySettingsLoading,
		isError: isDailySummarySettingsError,
		error: dailySummarySettingsError,
		refetch: refetchDailySummarySettings
	} = useQuery({
		queryKey: DAILY_SUMMARY_SETTINGS_QUERY_KEY,
		queryFn: reportingDailySummaryService.get
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

		if (!isBackupScheduleDraftDirty.current) {
			setBackupTime(settings.databaseBackupTime)
		}
	}, [settings])

	useEffect(() => {
		if (!dailySummarySettings || isDailySummaryDraftDirty.current) return

		setDailySummaryThreadId(
			dailySummarySettings.messageThreadId?.toString() ?? ''
		)
		setDailySummaryDestinationChatId(
			dailySummarySettings.destinationChatId ?? ''
		)
		setSummaryTime(dailySummarySettings.scheduleTime)
	}, [dailySummarySettings])

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

			if ('databaseBackupTime' in patch) {
				isBackupScheduleDraftDirty.current = false
				setBackupTime(result.databaseBackupTime)
			}

			await queryClient.invalidateQueries({
				queryKey: SETTINGS_QUERY_KEY
			})
		}
	})

	const dailySummaryMutation = useMutation({
		mutationFn: reportingDailySummaryService.update,
		onSuccess: async result => {
			isDailySummaryDraftDirty.current = false
			setDailySummaryDestinationChatId(result.destinationChatId ?? '')
			setDailySummaryThreadId(result.messageThreadId?.toString() ?? '')
			setSummaryTime(result.scheduleTime)

			await queryClient.invalidateQueries({
				queryKey: DAILY_SUMMARY_SETTINGS_QUERY_KEY
			})
		},
		onError: async () => {
			await queryClient.invalidateQueries({
				queryKey: DAILY_SUMMARY_SETTINGS_QUERY_KEY
			})
		}
	})

	const webhookMutation = useMutation({
		mutationFn: adminTelegramBotService.reinstallWebhook
	})

	const allWebhooksMutation = useMutation({
		mutationFn: adminTelegramBotService.reinstallWebhooks
	})

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

	const saveDailySummaryWithToast = (
		patch: UpdateReportingDailySummarySettings,
		loading: string
	) => {
		const promise = dailySummaryMutation.mutateAsync(patch)

		toast.promise(promise, {
			loading,
			success: 'Настройки Daily Summary сохранены',
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
		if (
			!dailySummarySettings ||
			dailySummarySettings.owner !== 'REPORTING'
		)
			return

		if (!dailySummarySettings.enabled) {
			if (!dailySummarySettings.destinationChatId?.trim()) {
				toast.error('Сначала сохраните ID группы для Daily Summary')
				return
			}

			if (!dailySummarySettings.messageThreadId) {
				toast.error('Сначала сохраните ID топика Reports')
				return
			}

			if (!dailySummarySettings.coreOperationalAlertsThreadId) {
				toast.error('Сначала сохраните ID топика системных уведомлений')
				return
			}

			if (
				dailySummarySettings.messageThreadId ===
				dailySummarySettings.coreOperationalAlertsThreadId
			) {
				toast.error(
					'Daily Summary и системные уведомления должны использовать разные топики'
				)
				return
			}
		}

		saveDailySummaryWithToast(
			{ enabled: !dailySummarySettings.enabled },
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

		if (settings.databaseBackupEnabled && !normalizedChatId) {
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
			settings.databaseBackupEnabled &&
			normalizedTopicIds.databaseBackupThreadId === null
		) {
			toast.error('Для включённого backup укажите ID топика Backups')
			return
		}

		if (
			normalizedChatId === dailySummarySettings?.destinationChatId &&
			normalizedTopicIds.operationalAlertsThreadId !== null &&
			normalizedTopicIds.operationalAlertsThreadId ===
				dailySummarySettings?.messageThreadId
		) {
			toast.error(
				'Daily Summary и системные уведомления должны использовать разные топики'
			)
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

	const handleSaveDailySummary = () => {
		if (
			!settings ||
			!dailySummarySettings ||
			dailySummarySettings.owner !== 'REPORTING'
		)
			return

		if (!summaryTime) {
			toast.error('Укажите время сводки')
			return
		}

		if (
			!hasMinimumTaskTimeGap(summaryTime, settings.databaseBackupTime, [
				settings.notificationDeliveryDatabaseBackupDelayMinutes,
				settings.campaignsDatabaseBackupDelayMinutes,
				settings.reportingDatabaseBackupDelayMinutes,
				settings.widgetsDatabaseBackupDelayMinutes,
				settings.billingDatabaseBackupDelayMinutes
			])
		) {
			toast.error(
				`Разнесите сводку и все backup минимум на ${MIN_TASK_TIME_GAP_MINUTES} минут`
			)
			return
		}

		const messageThreadId = parseTelegramTopicId(dailySummaryThreadId)
		const destinationChatId = dailySummaryDestinationChatId.trim()

		if (messageThreadId === undefined) {
			toast.error(
				`ID топика Reports должен быть целым числом от 1 до ${MAX_TELEGRAM_TOPIC_ID}`
			)
			return
		}

		if (
			dailySummarySettings.enabled &&
			(!destinationChatId || messageThreadId === null)
		) {
			toast.error(
				'Для включённой сводки укажите ID группы и топика Reports'
			)
			return
		}

		if (
			destinationChatId ===
				dailySummarySettings.coreOperationalAlertsDestinationChatId &&
			messageThreadId !== null &&
			messageThreadId ===
				dailySummarySettings.coreOperationalAlertsThreadId
		) {
			toast.error(
				'Daily Summary и системные уведомления должны использовать разные топики'
			)
			return
		}

		const patch: UpdateReportingDailySummarySettings = {}
		if (
			destinationChatId !== (dailySummarySettings.destinationChatId ?? '')
		) {
			patch.destinationChatId = destinationChatId || null
		}
		if (messageThreadId !== dailySummarySettings.messageThreadId) {
			patch.messageThreadId = messageThreadId
		}
		if (
			summaryTime !== dailySummarySettings.scheduleTime ||
			dailySummarySettings.schedulePolicyConfirmationPending
		) {
			patch.scheduleTime = summaryTime
			patch.expectedScheduleGeneration =
				dailySummarySettings.scheduleGeneration
		}

		if (Object.keys(patch).length === 0) return
		saveDailySummaryWithToast(patch, 'Сохраняем Daily Summary...')
	}

	const handleSaveBackupSchedule = () => {
		if (!settings) return

		if (!backupTime) {
			toast.error('Укажите время backup')
			return
		}

		if (
			dailySummarySettings &&
			!hasMinimumTaskTimeGap(
				dailySummarySettings.scheduleTime,
				backupTime,
				[
					settings.notificationDeliveryDatabaseBackupDelayMinutes,
					settings.campaignsDatabaseBackupDelayMinutes,
					settings.reportingDatabaseBackupDelayMinutes,
					settings.widgetsDatabaseBackupDelayMinutes,
					settings.billingDatabaseBackupDelayMinutes
				]
			)
		) {
			toast.error(
				`Разнесите сводку и все backup минимум на ${MIN_TASK_TIME_GAP_MINUTES} минут`
			)
			return
		}
		if (!dailySummarySettings) {
			toast('Reporting недоступен: интервал с Daily Summary не проверен', {
				icon: '⚠️'
			})
		}

		saveWithToast(
			{ databaseBackupTime: backupTime },
			'Сохраняем расписание backup...'
		)
	}

	const lastSentText = dailySummarySettings?.lastSuccessfulDelivery
		? formatDate(dailySummarySettings.lastSuccessfulDelivery.completedAt)
		: 'Ещё не отправлялась'
	const latestDailySummaryFailure =
		dailySummarySettings?.lastFailedDelivery &&
		(!dailySummarySettings.lastSuccessfulDelivery ||
			new Date(
				dailySummarySettings.lastFailedDelivery.failedAt
			).getTime() >
				new Date(
					dailySummarySettings.lastSuccessfulDelivery.completedAt
				).getTime())
			? dailySummarySettings.lastFailedDelivery
			: null
	const isWebhookActionPending =
		webhookMutation.isPending || allWebhooksMutation.isPending
	const notificationDeliveryBackupTime = settings
		? (addMinutesToTime(
				backupTime,
				settings.notificationDeliveryDatabaseBackupDelayMinutes
			) ?? settings.notificationDeliveryDatabaseBackupTime)
		: null
	const campaignsBackupTime = settings
		? (addMinutesToTime(
				backupTime,
				settings.campaignsDatabaseBackupDelayMinutes
			) ?? settings.campaignsDatabaseBackupTime)
		: null
	const reportingBackupTime = settings
		? (addMinutesToTime(
				backupTime,
				settings.reportingDatabaseBackupDelayMinutes
			) ?? settings.reportingDatabaseBackupTime)
		: null
	const widgetsBackupTime = settings
		? (addMinutesToTime(
				backupTime,
				settings.widgetsDatabaseBackupDelayMinutes
			) ?? settings.widgetsDatabaseBackupTime)
		: null
	const billingBackupTime = settings
		? (addMinutesToTime(
				backupTime,
				settings.billingDatabaseBackupDelayMinutes
			) ?? settings.billingDatabaseBackupTime)
		: null
	const isLoading = isTelegramSettingsLoading
	const isDailySummaryReadOnly =
		dailySummarySettings?.owner !== 'REPORTING'
	const isDailySummarySettingsChanged = Boolean(
		dailySummarySettings &&
		(dailySummaryDestinationChatId.trim() !==
			(dailySummarySettings.destinationChatId ?? '') ||
			dailySummaryThreadId.trim() !==
				(dailySummarySettings.messageThreadId?.toString() ?? '') ||
			summaryTime !== dailySummarySettings.scheduleTime ||
			dailySummarySettings.schedulePolicyConfirmationPending)
	)
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
								<p className={styles.statusValue}>
									{isDailySummarySettingsLoading
										? 'Загрузка...'
										: isDailySummarySettingsError
											? 'Reporting недоступен'
											: lastSentText}
								</p>
							</div>
							{latestDailySummaryFailure && (
								<div className={styles.statusItem}>
									<p className={styles.statusLabel}>
										Последняя ошибка Daily Summary
									</p>
									<p className={styles.webhookStatusError}>
										{formatDate(latestDailySummaryFailure.failedAt)}
										{latestDailySummaryFailure.code
											? ` · ${latestDailySummaryFailure.code}`
											: ''}
										{latestDailySummaryFailure.safeReason
											? ` · ${latestDailySummaryFailure.safeReason}`
											: ''}
									</p>
								</div>
							)}
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

						{isDailySummarySettingsLoading ? (
							<div className={styles.schedulePanel}>
								<SkeletonLoader count={1} className="h-[82px]" />
							</div>
						) : dailySummarySettings ? (
							<>
								<div className={styles.toggleRow}>
									<div>
										<p className={styles.label}>Отправка сводки</p>
										<p className={styles.hint}>
											@winwidget_info_bot отправляет сводку каждый день в{' '}
											{dailySummarySettings.scheduleTime} (
											{dailySummarySettings.timezone}) и явно показывает
											период отчёта. Настройками владеет Reporting Service.
										</p>
										{isDailySummaryReadOnly && (
											<p className={styles.hint}>
												Изменение станет доступно после переключения
												владельца Daily Summary на Reporting.
											</p>
										)}
									</div>
									<button
										type="button"
										className={`${styles.toggle} ${dailySummarySettings.enabled ? styles.toggleOn : ''}`}
										onClick={handleToggleSummary}
										disabled={
											dailySummaryMutation.isPending ||
											isDailySummaryReadOnly
										}
										aria-label={
											dailySummarySettings.enabled
												? 'Выключить отправку сводки'
												: 'Включить отправку сводки'
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
												disabled={
													dailySummaryMutation.isPending ||
													isDailySummaryReadOnly
												}
												onChange={event => {
													isDailySummaryDraftDirty.current = true
													setSummaryTime(event.target.value)
												}}
											/>
										</label>
										<label className={styles.field}>
											<span className={styles.label}>
												ID группы Daily Summary
											</span>
											<input
												className={styles.input}
												value={dailySummaryDestinationChatId}
												disabled={
													dailySummaryMutation.isPending ||
													isDailySummaryReadOnly
												}
												onChange={event => {
													isDailySummaryDraftDirty.current = true
													setDailySummaryDestinationChatId(
														event.target.value
													)
												}}
												placeholder="-1001234567890"
												maxLength={255}
											/>
										</label>
										<label className={styles.field}>
											<span className={styles.label}>Топик Reports</span>
											<input
												type="number"
												className={styles.input}
												value={dailySummaryThreadId}
												disabled={
													dailySummaryMutation.isPending ||
													isDailySummaryReadOnly
												}
												onChange={event => {
													isDailySummaryDraftDirty.current = true
													setDailySummaryThreadId(event.target.value)
												}}
												placeholder="123"
												min={1}
												max={MAX_TELEGRAM_TOPIC_ID}
												step={1}
												inputMode="numeric"
											/>
										</label>
										<div className={styles.field}>
											<span className={styles.label}>Часовой пояс</span>
											<p className={styles.derivedTime}>
												{dailySummarySettings.timezone}
											</p>
										</div>
										<button
											type="button"
											className={`${styles.saveBtn} ${styles.scheduleSaveBtn}`}
											onClick={handleSaveDailySummary}
											disabled={
												dailySummaryMutation.isPending ||
												isDailySummaryReadOnly ||
												!isDailySummarySettingsChanged
											}
										>
											Сохранить Daily Summary
										</button>
									</div>
									<p className={styles.hint}>
										Reporting Service хранит назначение, топик и расписание
										сводки как единственный источник истины. Время сводки
										должно быть разнесено с каждым backup минимум на{' '}
										{MIN_TASK_TIME_GAP_MINUTES} минут.
									</p>
									{dailySummarySettings.schedulePolicyConfirmationPending && (
										<p className={styles.webhookStatusError}>
											Настройки сохранены в Reporting, но подтверждение
											policy в Core ещё не завершено. Нажмите сохранить
											повторно.
										</p>
									)}
								</div>
							</>
						) : (
							<div className={styles.schedulePanel}>
								<p className={styles.empty}>
									Настройки Daily Summary временно недоступны
								</p>
								<p className={styles.hint}>
									{dailySummarySettingsError
										? errorCatch(dailySummarySettingsError)
										: 'Reporting Service не вернул настройки'}
								</p>
								<button
									type="button"
									className={styles.actionBtn}
									onClick={() => void refetchDailySummarySettings()}
								>
									Повторить
								</button>
							</div>
						)}

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.label}>Отправка backup</p>
								<p className={styles.hint}>
									@winwidget_info_bot отправляет backup основной БД в{' '}
									{settings.databaseBackupTimeLabel}, а Notification
									Delivery — в{' '}
									{settings.notificationDeliveryDatabaseBackupTimeLabel},
									Campaigns — в {settings.campaignsDatabaseBackupTimeLabel}
									, Reporting — в{' '}
									{settings.reportingDatabaseBackupTimeLabel}, Widgets — в{' '}
									{settings.widgetsDatabaseBackupTimeLabel}, а Billing — в{' '}
									{settings.billingDatabaseBackupTimeLabel}. Все файлы
									приходят отдельно в топик Backups.
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
									<span className={styles.label}>Backup основной БД</span>
									<input
										type="time"
										className={styles.input}
										value={backupTime}
										disabled={mutation.isPending}
										onChange={event => {
											isBackupScheduleDraftDirty.current = true
											setBackupTime(event.target.value)
										}}
									/>
								</label>
								<div className={styles.field}>
									<span className={styles.label}>
										Backup Notification Delivery
									</span>
									<p className={styles.derivedTime}>
										{notificationDeliveryBackupTime
											? `${notificationDeliveryBackupTime} МСК`
											: '—'}
									</p>
								</div>
								<div className={styles.field}>
									<span className={styles.label}>Backup Campaigns</span>
									<p className={styles.derivedTime}>
										{campaignsBackupTime
											? `${campaignsBackupTime} МСК`
											: '—'}
									</p>
								</div>
								<div className={styles.field}>
									<span className={styles.label}>Backup Reporting</span>
									<p className={styles.derivedTime}>
										{reportingBackupTime
											? `${reportingBackupTime} МСК`
											: '—'}
									</p>
								</div>
								<div className={styles.field}>
									<span className={styles.label}>Backup Widgets</span>
									<p className={styles.derivedTime}>
										{widgetsBackupTime ? `${widgetsBackupTime} МСК` : '—'}
									</p>
								</div>
								<div className={styles.field}>
									<span className={styles.label}>Backup Billing</span>
									<p className={styles.derivedTime}>
										{billingBackupTime ? `${billingBackupTime} МСК` : '—'}
									</p>
								</div>
								<button
									type="button"
									className={`${styles.saveBtn} ${styles.scheduleSaveBtn}`}
									onClick={handleSaveBackupSchedule}
									disabled={
										mutation.isPending ||
										backupTime === settings.databaseBackupTime
									}
								>
									Сохранить расписание backup
								</button>
							</div>
							<p className={styles.hint}>
								Время указывается по Москве. Notification Delivery,
								Campaigns, Reporting, Widgets и Billing запускаются через{' '}
								{settings.notificationDeliveryDatabaseBackupDelayMinutes}
								{', '}
								{settings.campaignsDatabaseBackupDelayMinutes}
								{', '}
								{settings.reportingDatabaseBackupDelayMinutes}
								{', '}
								{settings.widgetsDatabaseBackupDelayMinutes}
								{' и '}
								{settings.billingDatabaseBackupDelayMinutes} минут после
								основной БД соответственно. Сводка должна быть разнесена с
								каждым backup минимум на {MIN_TASK_TIME_GAP_MINUTES} минут.
							</p>
						</div>

						<div className={styles.schedulePanel}>
							<div className={styles.field}>
								<label
									htmlFor="telegram-group-id"
									className={styles.label}
								>
									ID группы Core
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
								fallback в General не используется. Маршрут Daily Summary
								настраивается отдельно в Reporting Service выше. После
								переключения владельца Core и Reporting хранят свои ID
								групп независимо.
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
					</>
				) : (
					<p className={styles.empty}>Не удалось загрузить настройки</p>
				)}
			</div>
		</section>
	)
}

export default AdminTelegramBot
