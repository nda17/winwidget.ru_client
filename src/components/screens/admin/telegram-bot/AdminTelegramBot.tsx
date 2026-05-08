'use client'

import { errorCatch } from '@/api/api.helper'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import Heading from '@/components/ui/heading/Heading'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import adminTelegramBotService from '@/services/admin-telegram-bot/admin-telegram-bot.service'
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

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />

			<AdminSectionHeading
				text="Info_bot"
				title="Ежедневная сводка"
				description="Настраивает отправку ежедневной операционной сводки в Telegram-группу администраторов."
				risk="medium"
				riskText="Если указать неверный ID группы, сводка не уйдёт. Info_bot должен быть добавлен в группу, а токен должен быть настроен на сервере."
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
								<p className={styles.statusLabel}>Токен Info_bot</p>
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
								<p className={styles.statusLabel}>Расписание</p>
								<p className={styles.statusValue}>01:50 МСК</p>
							</div>
							<div className={styles.statusItem}>
								<p className={styles.statusLabel}>Последняя отправка</p>
								<p className={styles.statusValue}>{lastSentText}</p>
							</div>
						</div>

						<div className={styles.toggleRow}>
							<div>
								<p className={styles.label}>Отправка сводки</p>
								<p className={styles.hint}>
									Info_bot отправляет сводку каждый день в 01:50 МСК и явно
									показывает период отчёта
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
								Укажите chat_id группы, куда Info_bot будет отправлять
								ежедневную сводку
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
