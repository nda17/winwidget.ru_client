'use client'

import { useAuthStore } from '@/entities/user'
import {
	adminMailingsService,
	type AdminMailingAudience,
	type AdminMailingCampaignStatus,
	type AdminMailingChannel,
	type IAdminMailingCampaign
} from '@/features/send-mailing'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import { errorCatch } from '@/shared/api'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import Heading from '@/shared/ui/heading/Heading'
import Pagination from '@/shared/ui/pagination/Pagination'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { NextPage } from 'next'
import { FormEvent, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminMailings.module.scss'

const AUDIENCE_LABELS: Record<AdminMailingAudience, string> = {
	ACTIVE_SUBSCRIPTION:
		'активным подписчикам с контактом для выбранного канала',
	ALL: 'всем активным аккаунтам с контактом для выбранного канала'
}

const CHANNEL_LABELS: Record<AdminMailingChannel, string> = {
	EMAIL: 'Email',
	TELEGRAM: 'Telegram',
	BOTH: 'Email + Telegram'
}

const STATUS_LABELS: Record<AdminMailingCampaignStatus, string> = {
	QUEUED: 'В очереди',
	RUNNING: 'Выполняется',
	COMPLETED: 'Завершена',
	PARTIAL_FAILED: 'Завершена с ошибками',
	CANCELLED: 'Отменена'
}

const TERMINAL_STATUSES: AdminMailingCampaignStatus[] = [
	'COMPLETED',
	'PARTIAL_FAILED',
	'CANCELLED'
]

const formatDate = (value: string | null) =>
	value
		? new Intl.DateTimeFormat('ru-RU', {
				dateStyle: 'short',
				timeStyle: 'medium'
			}).format(new Date(value))
		: '—'

const AdminMailings: NextPage = () => {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [subject, setSubject] = useState('')
	const [message, setMessage] = useState('')
	const [audience, setAudience] = useState<AdminMailingAudience>(
		'ACTIVE_SUBSCRIPTION'
	)
	const [channel, setChannel] = useState<AdminMailingChannel>('EMAIL')
	const [confirmOpened, setConfirmOpened] = useState(false)
	const [cancelCampaign, setCancelCampaign] =
		useState<IAdminMailingCampaign | null>(null)
	const [page, setPage] = useState(1)
	const limit = 10

	const campaigns = useQuery({
		queryKey: ['admin-mailing-campaigns', page, limit],
		queryFn: () => adminMailingsService.getCampaigns(page, limit),
		enabled: auth,
		refetchInterval: query =>
			query.state.data?.items.some(item =>
				['QUEUED', 'RUNNING'].includes(item.status)
			)
				? 2000
				: 10000
	})

	const createMutation = useMutation({
		mutationFn: adminMailingsService.sendBroadcast,
		onSuccess: async campaign => {
			setConfirmOpened(false)
			setPage(1)
			await queryClient.invalidateQueries({
				queryKey: ['admin-mailing-campaigns']
			})
		}
	})

	const cancelMutation = useMutation({
		mutationFn: adminMailingsService.cancelCampaign,
		onSuccess: async () => {
			setCancelCampaign(null)
			await queryClient.invalidateQueries({
				queryKey: ['admin-mailing-campaigns']
			})
		}
	})

	const trimmedSubject = subject.trim()
	const trimmedMessage = message.trim()
	const totalPages = campaigns.data?.totalPages || 1
	const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

	const submit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		if (trimmedSubject.length < 3) {
			toast.error('Введите тему рассылки')
			return
		}
		if (trimmedMessage.length < 10) {
			toast.error('Введите текст оповещения')
			return
		}
		setConfirmOpened(true)
	}

	const startCampaign = () => {
		if (createMutation.isPending) return
		setConfirmOpened(false)
		toast.promise(
			createMutation.mutateAsync({
				subject: trimmedSubject,
				message: trimmedMessage,
				audience,
				channel
			}),
			{
				loading: 'Создаём рассылку...',
				success: campaign =>
					`Рассылка поставлена в очередь. Получателей: ${campaign.recipientCount}`,
				error: error => `Ошибка запуска: ${errorCatch(error)}`
			}
		)
	}

	const confirmCancel = () => {
		if (!cancelCampaign || cancelMutation.isPending) return
		toast.promise(cancelMutation.mutateAsync(cancelCampaign.id), {
			loading: 'Отменяем рассылку...',
			success: 'Рассылка отменена',
			error: error => `Ошибка отмены: ${errorCatch(error)}`
		})
	}

	return (
		<section className={styles.wrapper}>
			{confirmOpened && (
				<ConfirmDialog
					title="Запустить рассылку?"
					message={`${CHANNEL_LABELS[channel]}-рассылка будет поставлена в очередь и отправлена ${AUDIENCE_LABELS[audience]}. После запуска её можно остановить, но уже отправленные сообщения отозвать нельзя.`}
					confirmLabel="Запустить"
					cancelLabel="Назад"
					onConfirm={startCampaign}
					onCancel={() => setConfirmOpened(false)}
				/>
			)}
			{cancelCampaign && (
				<ConfirmDialog
					title="Остановить рассылку?"
					message={`Новые сообщения кампании «${cancelCampaign.subject}» отправляться не будут. Уже отправленные сообщения отозвать нельзя.`}
					confirmLabel="Остановить"
					cancelLabel="Назад"
					onConfirm={confirmCancel}
					onCancel={() => setCancelCampaign(null)}
				/>
			)}

			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Рассылки"
				title="Массовая рассылка"
				description="Создаёт фоновую email/Telegram-кампанию через PostgreSQL Outbox и RabbitMQ. Прогресс сохраняется и продолжается после перезапуска."
				risk="high"
				riskText="Проверь канал, аудиторию и текст. Отмена останавливает только ещё не начатые доставки."
			/>

			<form className={styles.card} onSubmit={submit}>
				<div className={styles.field}>
					<label htmlFor="mailing-subject" className={styles.label}>
						Тема
					</label>
					<input
						id="mailing-subject"
						className={styles.input}
						value={subject}
						onChange={event => setSubject(event.target.value)}
						maxLength={120}
					/>
					<p className={styles.counter}>{subject.length}/120</p>
				</div>
				<div className={styles.channelBlock}>
					<p className={styles.label}>Канал</p>
					<div className={styles.channelOptions}>
						{(['EMAIL', 'TELEGRAM', 'BOTH'] as const).map(value => (
							<button
								key={value}
								type="button"
								className={`${styles.optionBtn} ${channel === value ? styles.optionBtnActive : ''}`}
								onClick={() => setChannel(value)}
							>
								{CHANNEL_LABELS[value]}
							</button>
						))}
					</div>
				</div>
				<div className={styles.field}>
					<label htmlFor="mailing-message" className={styles.label}>
						Текст оповещения
					</label>
					<textarea
						id="mailing-message"
						className={styles.textarea}
						value={message}
						onChange={event => setMessage(event.target.value)}
						maxLength={5000}
						rows={9}
					/>
					<p className={styles.counter}>{message.length}/5000</p>
				</div>
				<div className={styles.audienceOptions}>
					{(['ACTIVE_SUBSCRIPTION', 'ALL'] as const).map(value => (
						<button
							key={value}
							type="button"
							className={`${styles.optionBtn} ${audience === value ? styles.optionBtnActive : ''}`}
							onClick={() => setAudience(value)}
						>
							{value === 'ACTIVE_SUBSCRIPTION'
								? 'Активные подписчики'
								: 'Все без фильтра подписки'}
						</button>
					))}
				</div>
				<p className={styles.hint}>{AUDIENCE_LABELS[audience]}</p>
				<button
					type="submit"
					className={styles.sendBtn}
					disabled={createMutation.isPending}
				>
					{createMutation.isPending ? 'Создаём...' : 'Запустить рассылку'}
				</button>
			</form>

			<div className={styles.historyCard}>
				<div className={styles.historyHeader}>
					<div>
						<p className={styles.resultTitle}>Кампании</p>
						<p className={styles.hint}>
							Текущий прогресс, ошибки и отменённые доставки.
						</p>
					</div>
					{campaigns.isFetching && (
						<span className={styles.historyStatus}>Обновляем...</span>
					)}
				</div>
				{campaigns.isLoading ? (
					<p className={styles.historyEmpty}>Загружаем кампании...</p>
				) : campaigns.data?.items.length ? (
					<>
						<div className={styles.historyList}>
							{campaigns.data.items.map(campaign => {
								const processed =
									campaign.sentCount +
									campaign.failedCount +
									campaign.cancelledCount
								const progress = campaign.recipientCount
									? Math.round((processed / campaign.recipientCount) * 100)
									: 100
								return (
									<div className={styles.historyItem} key={campaign.id}>
										<div>
											<span className={styles.resultLabel}>Тема</span>
											<span className={styles.resultValue}>
												{campaign.subject}
											</span>
										</div>
										<div>
											<span className={styles.resultLabel}>Статус</span>
											<span className={styles.resultValue}>
												{STATUS_LABELS[campaign.status]}
											</span>
										</div>
										<div>
											<span className={styles.resultLabel}>Прогресс</span>
											<span className={styles.resultValue}>
												{processed}/{campaign.recipientCount} ({progress}%)
											</span>
										</div>
										<div>
											<span className={styles.resultLabel}>Результат</span>
											<span className={styles.resultValue}>
												{campaign.sentCount} отправлено ·{' '}
												{campaign.failedCount} ошибок ·{' '}
												{campaign.cancelledCount} отменено
											</span>
										</div>
										<div>
											<span className={styles.resultLabel}>Канал</span>
											<span className={styles.resultValue}>
												{CHANNEL_LABELS[campaign.requestedChannel]}
											</span>
										</div>
										<div>
											<span className={styles.resultLabel}>Создана</span>
											<span className={styles.resultValue}>
												{formatDate(campaign.createdAt)}
											</span>
										</div>
										{!TERMINAL_STATUSES.includes(campaign.status) && (
											<div>
												<button
													type="button"
													className={styles.cancelBtn}
													onClick={() => setCancelCampaign(campaign)}
												>
													Остановить
												</button>
											</div>
										)}
									</div>
								)
							})}
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
					<p className={styles.historyEmpty}>Кампаний пока нет.</p>
				)}
			</div>
		</section>
	)
}

export default AdminMailings
