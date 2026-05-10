'use client'

import { errorCatch } from '@/api/api.helper'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import adminTelegramBotService, {
	type TelegramWebhookBot
} from '@/services/admin-telegram-bot/admin-telegram-bot.service'
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

const formatDate = (value: string) =>
	new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'medium'
	}).format(new Date(value))

const AdminTelegramBot: NextPage = () => {
	const queryClient = useQueryClient()
	const [chatId, setChatId] = useState('')

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
		if (settings) setChatId(settings.dailySummaryChatId)
	}, [settings])

	const mutation = useMutation({
		mutationFn: adminTelegramBotService.update,
		onSuccess: async result => {
			setChatId(result.dailySummaryChatId)
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

	const handleToggle = () => {
		if (!settings) return

		if (!settings.dailySummaryEnabled && !chatId.trim()) {
			toast.error('Сначала укажите ID группы Telegram')
			return
		}

		saveWithToast(
			{ dailySummaryEnabled: !settings.dailySummaryEnabled },
			'Применяем настройку...'
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

	const lastSentText = settings?.dailySummaryLastSentAt
		? formatDate(settings.dailySummaryLastSentAt)
		: 'Ещё не отправлялась'
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
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Расписание</p>
								<p className={styles.statusValue}>01:50 МСК</p>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Последняя отправка</p>
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
											(pendingCount ?? 0) > 0 ||
											status.lastErrorMessage)
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
											{status?.configuredUsername && (
												<p className={styles.webhookStatusLine}>
													Env: @{status.configuredUsername}
												</p>
											)}
											<p className={styles.webhookStatusLine}>
												URL:{' '}
												{status?.webhookMatchesExpected
													? 'актуальный'
													: status?.webhookUrl
														? 'отличается'
														: 'не установлен'}
											</p>
											{status?.lastErrorMessage && (
												<p className={styles.webhookStatusError}>
													{status.lastErrorMessage}
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
									@winwidget_info_bot отправляет сводку каждый день в 01:50
									МСК и явно показывает период отчёта
								</p>
							</div>
							<button
								type="button"
								className={`${styles.toggle} ${settings.dailySummaryEnabled ? styles.toggleOn : ''}`}
								onClick={handleToggle}
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
					</>
				) : (
					<p className={styles.empty}>Не удалось загрузить настройки</p>
				)}
			</div>
		</section>
	)
}

export default AdminTelegramBot
