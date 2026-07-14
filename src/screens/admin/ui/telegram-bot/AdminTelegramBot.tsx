'use client'

import { errorCatch } from '@/shared/api'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import Heading from '@/shared/ui/heading/Heading'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	adminTelegramBotService,
	type TelegramWebhookBot
} from '@/features/manage-telegram-bot'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminTelegramBot.module.scss'

const SETTINGS_QUERY_KEY = ['admin-telegram-bot-settings']
const WEBHOOKS_QUERY_KEY = ['admin-telegram-bot-webhooks']
const WEBHOOK_BOTS: TelegramWebhookBot[] = ['info', 'auth', 'support']
const MIN_TASK_TIME_GAP_MINUTES = 5

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
	const [chatId, setChatId] = useState('')
	const [summaryTime, setSummaryTime] = useState('')
	const [backupTime, setBackupTime] = useState('')

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

		setChatId(settings.dailySummaryChatId)
		setSummaryTime(settings.dailySummaryTime)
		setBackupTime(settings.databaseBackupTime)
	}, [settings])

	const mutation = useMutation({
		mutationFn: adminTelegramBotService.update,
		onSuccess: async result => {
			setChatId(result.dailySummaryChatId)
			setSummaryTime(result.dailySummaryTime)
			setBackupTime(result.databaseBackupTime)
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

	const databaseBackupMutation = useMutation({
		mutationFn: adminTelegramBotService.sendDatabaseBackup,
		onSuccess: async () => {
			await queryClient.invalidateQueries({
				queryKey: SETTINGS_QUERY_KEY
			})
		}
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

	const getChatIdPatch = () => {
		const normalizedChatId = chatId.trim()

		return normalizedChatId === settings?.dailySummaryChatId
			? {}
			: { dailySummaryChatId: normalizedChatId }
	}

	const handleToggleSummary = () => {
		if (!settings) return

		if (!settings.dailySummaryEnabled && !chatId.trim()) {
			toast.error('Сначала укажите ID группы Telegram')
			return
		}

		saveWithToast(
			{
				dailySummaryEnabled: !settings.dailySummaryEnabled,
				...getChatIdPatch()
			},
			'Применяем настройку...'
		)
	}

	const handleToggleDatabaseBackup = () => {
		if (!settings) return

		if (!settings.databaseBackupEnabled && !chatId.trim()) {
			toast.error('Сначала укажите ID группы Telegram')
			return
		}

		saveWithToast(
			{
				databaseBackupEnabled: !settings.databaseBackupEnabled,
				...getChatIdPatch()
			},
			'Применяем настройку backup...'
		)
	}

	const handleSaveChatId = () => {
		if (!settings) return

		const normalizedChatId = chatId.trim()

		if (settings.dailySummaryEnabled && !normalizedChatId) {
			toast.error('Укажите ID группы Telegram')
			return
		}

		saveWithToast(
			{ dailySummaryChatId: normalizedChatId },
			'Сохраняем ID группы...'
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
		const promise = databaseBackupMutation.mutateAsync()

		toast.promise(promise, {
			loading: 'Создаём backup базы данных...',
			success: result =>
				`Backup отправлен в Telegram: ${formatFileSize(result.fileSize)}`,
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
				title="Webhook и ежедневная сводка"
				description="Настраивает webhook Auth_bot, @winwidget_info_bot и @winwidget_support_bot, а также отправку ежедневной операционной сводки в Telegram-группу администраторов."
				risk="medium"
				riskText="Если указать неверный ID группы, сводка и обращения пользователей не уйдут. @winwidget_info_bot и @winwidget_support_bot должны быть добавлены в группу, а токены должны быть настроены на сервере."
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
									отчёта
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
									{settings.databaseBackupTimeLabel}. Файл приходит в ту же
									Telegram-группу, что и сводка.
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
										onChange={event => setSummaryTime(event.target.value)}
									/>
								</label>
								<label className={styles.field}>
									<span className={styles.label}>Время backup</span>
									<input
										type="time"
										className={styles.input}
										value={backupTime}
										onChange={event => setBackupTime(event.target.value)}
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

						<div className={styles.field}>
							<label htmlFor="telegram-group-id" className={styles.label}>
								ID группы Telegram
							</label>
							<input
								id="telegram-group-id"
								className={styles.input}
								value={chatId}
								onChange={event => setChatId(event.target.value)}
								placeholder="-1001234567890"
								maxLength={100}
							/>
							<p className={styles.hint}>
								Укажите chat_id группы, куда @winwidget_info_bot будет
								отправлять ежедневную сводку, а @winwidget_support_bot
								будет пересылать обращения пользователей
							</p>
						</div>

						<button
							type="button"
							className={styles.saveBtn}
							onClick={handleSaveChatId}
							disabled={
								mutation.isPending ||
								chatId.trim() === settings.dailySummaryChatId
							}
						>
							Сохранить ID группы
						</button>

						<div className={styles.backupPanel}>
							<div className={styles.backupHeader}>
								<div>
									<p className={styles.label}>Backup базы данных</p>
									<p className={styles.hint}>
										Можно отправить вне расписания. Файл приходит в ту же
										Telegram-группу, что и сводка.
									</p>
								</div>
								<button
									type="button"
									className={styles.actionBtn}
									onClick={handleSendDatabaseBackup}
									disabled={
										databaseBackupMutation.isPending ||
										!settings.telegramBotTokenConfigured ||
										!settings.dailySummaryChatId.trim()
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
