'use client'

import { useAuthStore } from '@/entities/user'
import {
	messagingService,
	type MessagingFailure,
	type MessagingIntegration
} from '@/features/admin-monitoring'
import { errorCatch } from '@/shared/api'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import Heading from '@/shared/ui/heading/Heading'
import Pagination from '@/shared/ui/pagination/Pagination'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useState } from 'react'
import toast from 'react-hot-toast'
import styles from './AdminMessaging.module.scss'

const LIMIT = 20
const integrationLabels: Record<MessagingIntegration, string> = {
	email: 'Email',
	webhook: 'Webhook',
	telegram: 'Telegram',
	bitrix24: 'Битрикс24',
	'amo-crm': 'amoCRM'
}

const formatDate = (value: string | null) =>
	value
		? new Intl.DateTimeFormat('ru-RU', {
				dateStyle: 'short',
				timeStyle: 'medium'
			}).format(new Date(value))
		: '—'

export default function AdminMessaging() {
	const auth = useAuthStore(state => state.auth)
	const queryClient = useQueryClient()
	const [page, setPage] = useState(1)
	const [integration, setIntegration] = useState('ALL')
	const [status, setStatus] = useState('FAILED')

	const overview = useQuery({
		queryKey: ['admin-messaging-overview'],
		queryFn: messagingService.getOverview,
		enabled: auth,
		refetchInterval: 15000
	})
	const failures = useQuery({
		queryKey: ['admin-messaging-failures', page, integration, status],
		queryFn: () =>
			messagingService.getFailures({
				page,
				limit: LIMIT,
				integration: integration === 'ALL' ? undefined : integration,
				status
			}),
		enabled: auth,
		refetchInterval: 15000
	})
	const retryMutation = useMutation({
		mutationFn: messagingService.retryFailure,
		onSuccess: async () => {
			await Promise.all([
				queryClient.invalidateQueries({
					queryKey: ['admin-messaging-overview']
				}),
				queryClient.invalidateQueries({
					queryKey: ['admin-messaging-failures']
				})
			])
		}
	})

	const retry = (failure: MessagingFailure) => {
		if (
			!window.confirm(
				`Повторно отправить ${integrationLabels[failure.integration]} для события ${failure.eventId}?`
			)
		) {
			return
		}
		toast.promise(retryMutation.mutateAsync(failure.id), {
			loading: 'Ставим событие в очередь...',
			success: 'Событие повторно поставлено в очередь',
			error: error => `Ошибка повтора: ${errorCatch(error)}`
		})
	}

	const totalPages = failures.data?.totalPages || 1
	const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

	return (
		<section className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Очереди"
				title="Интеграции и Outbox"
				description="Состояние PostgreSQL Outbox, RabbitMQ, publisher и worker. Здесь можно повторить доставку событий из DLQ."
				risk="medium"
				riskText="Повторная отправка может повторно вызвать внешнюю интеграцию, если она обработала прошлый запрос, но не вернула успешный ответ."
			/>

			<div className={styles.section}>
				<div className={styles.header}>
					<div>
						<p className={styles.title}>Текущее состояние</p>
						<p className={styles.hint}>Автообновление каждые 15 секунд</p>
					</div>
					<button
						className={styles.button}
						onClick={() => overview.refetch()}
						disabled={overview.isFetching}
					>
						Обновить
					</button>
				</div>
				{overview.isLoading ? (
					<SkeletonLoader count={1} className="h-[150px]" />
				) : overview.data ? (
					<>
						<div className={styles.cards}>
							<Metric
								title="Outbox ожидает"
								value={overview.data.outbox.PENDING}
							/>
							<Metric
								title="Outbox ошибок"
								value={overview.data.outbox.FAILED}
							/>
							<Metric
								title="DLQ не решено"
								value={overview.data.unresolvedFailures}
							/>
							<Metric
								title="Повторяется"
								value={overview.data.retryingFailures}
							/>
							<Metric
								title="Доставлено за 24 часа"
								value={overview.data.deliveredLast24Hours}
							/>
						</div>
						<div className={styles.heartbeats}>
							{overview.data.heartbeats.map(item => (
								<span key={item.service} className={styles.heartbeat}>
									<i
										className={
											item.status === 'ok' ? styles.ok : styles.down
										}
									/>
									{item.service}: {item.activeInstances}
								</span>
							))}
						</div>
						{overview.data.rabbitMqError && (
							<p className={styles.error}>
								RabbitMQ: {overview.data.rabbitMqError}
							</p>
						)}
						<div className={styles.tableWrap}>
							<table>
								<thead>
									<tr>
										<th>Очередь</th>
										<th>Готово</th>
										<th>В работе</th>
										<th>Consumers</th>
									</tr>
								</thead>
								<tbody>
									{overview.data.queues.map(queue => (
										<tr key={queue.name}>
											<td>{queue.name}</td>
											<td>{queue.ready}</td>
											<td>{queue.unacknowledged}</td>
											<td>{queue.consumers}</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					</>
				) : (
					<p className={styles.empty}>
						Не удалось получить состояние очередей
					</p>
				)}
			</div>

			<div className={styles.section}>
				<div className={styles.header}>
					<div>
						<p className={styles.title}>Ошибки доставки</p>
						<p className={styles.hint}>
							Сообщения, перенесённые из DLQ в PostgreSQL
						</p>
					</div>
					<div className={styles.filters}>
						<select
							value={integration}
							onChange={event => {
								setIntegration(event.target.value)
								setPage(1)
							}}
						>
							<option value="ALL">Все интеграции</option>
							{Object.entries(integrationLabels).map(([value, label]) => (
								<option key={value} value={value}>
									{label}
								</option>
							))}
						</select>
						<select
							value={status}
							onChange={event => {
								setStatus(event.target.value)
								setPage(1)
							}}
						>
							<option value="FAILED">Требуют внимания</option>
							<option value="RETRYING">Повторяются</option>
							<option value="RESOLVED">Решённые</option>
							<option value="ALL">Все</option>
						</select>
					</div>
				</div>
				{failures.isLoading ? (
					<SkeletonLoader count={1} className="h-[220px]" />
				) : failures.data?.items.length ? (
					<>
						<div className={styles.tableWrap}>
							<table>
								<thead>
									<tr>
										<th>Интеграция</th>
										<th>Заявка</th>
										<th>Ошибка</th>
										<th>Попытки</th>
										<th>Дата</th>
										<th>Действие</th>
									</tr>
								</thead>
								<tbody>
									{failures.data.items.map(item => (
										<tr key={item.id}>
											<td>{integrationLabels[item.integration]}</td>
											<td>{item.entity?.name || item.lead?.id || '—'}</td>
											<td className={styles.error}>{item.lastError}</td>
											<td>{item.attempts}</td>
											<td>{formatDate(item.failedAt)}</td>
											<td>
												<button
													className={styles.retry}
													onClick={() => retry(item)}
													disabled={
														Boolean(item.resolvedAt || item.retryingAt) ||
														retryMutation.isPending
													}
												>
													Повторить
												</button>
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
					<p className={styles.empty}>По выбранным фильтрам ошибок нет</p>
				)}
			</div>
		</section>
	)
}

function Metric({ title, value }: { title: string; value: number }) {
	return (
		<div className={styles.metric}>
			<span>{title}</span>
			<strong>{value}</strong>
		</div>
	)
}
