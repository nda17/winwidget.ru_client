'use client'

import { UserRole, useAuthStore, useUser } from '@/entities/user'
import {
	messagingService,
	type MessagingFailure,
	type MessagingIntegration
} from '@/features/admin-monitoring'
import { errorCatch } from '@/shared/api'
import AdminNavigation from '@/screens/admin/ui/common/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/screens/admin/ui/common/admin-section-heading/AdminSectionHeading'
import AdminTooltip from '@/screens/admin/ui/common/admin-tooltip/AdminTooltip'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
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
	'amo-crm': 'amoCRM',
	'payment-email': 'Email после оплаты',
	'payment-telegram': 'Telegram после оплаты',
	'mailing-email': 'Email-рассылка',
	'mailing-telegram': 'Telegram-рассылка',
	'limit-email': 'Email о лимите',
	'limit-telegram': 'Telegram о лимите',
	'daily-summary-telegram': 'Ежедневная Telegram-сводка',
	'database-backup': 'Backup PostgreSQL'
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
	const { user } = useUser()
	const isDev = Boolean(user?.rights?.includes(UserRole.DEV))
	const queryClient = useQueryClient()
	const [page, setPage] = useState(1)
	const [integration, setIntegration] = useState('ALL')
	const [status, setStatus] = useState('FAILED')
	const [retryTarget, setRetryTarget] = useState<MessagingFailure | null>(
		null
	)

	const overview = useQuery({
		queryKey: ['admin-messaging-overview'],
		queryFn: messagingService.getOverview,
		enabled: auth && isDev,
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
		enabled: auth && isDev,
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

	const confirmRetry = () => {
		if (!retryTarget || retryMutation.isPending) return

		const failureId = retryTarget.id
		setRetryTarget(null)
		toast.promise(retryMutation.mutateAsync(failureId), {
			loading: 'Ставим событие в очередь...',
			success: 'Событие повторно поставлено в очередь',
			error: error => `Ошибка повтора: ${errorCatch(error)}`
		})
	}

	const totalPages = failures.data?.totalPages || 1
	const pages = Array.from({ length: totalPages }, (_, index) => index + 1)

	if (user && !isDev) {
		return (
			<section className={styles.wrapper}>
				<Heading text="Панель администратора" />
				<AdminNavigation />
				<div className={styles.section}>
					<p className={styles.empty}>
						Раздел доступен только пользователям с ролью DEV.
					</p>
				</div>
			</section>
		)
	}

	return (
		<section className={styles.wrapper}>
			{retryTarget && (
				<ConfirmDialog
					title="Повторить доставку?"
					message={`Повторно отправить ${integrationLabels[retryTarget.integration]} для события ${retryTarget.eventId}? Если внешний сервис уже обработал предыдущий запрос, действие может выполниться повторно.`}
					confirmLabel="Повторить"
					cancelLabel="Назад"
					onConfirm={confirmRetry}
					onCancel={() => setRetryTarget(null)}
				/>
			)}
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminSectionHeading
				text="Очереди"
				title="Интеграции, фоновые задачи и Outbox"
				description="Состояние PostgreSQL Outbox, RabbitMQ, publisher и workers. Здесь можно повторить доставку событий из DLQ."
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
					<>
						<div className={styles.cards}>
							{Array.from({ length: 5 }, (_, index) => (
								<SkeletonLoader
									key={index}
									count={1}
									className="h-[86px]"
								/>
							))}
						</div>
						<div className={styles.heartbeats}>
							<SkeletonLoader count={1} className="h-[32px] w-[180px]" />
							<SkeletonLoader count={1} className="h-[32px] w-[180px]" />
							<SkeletonLoader count={1} className="h-[32px] w-[180px]" />
						</div>
						<SkeletonLoader count={1} className="h-[44px]" />
						<SkeletonLoader count={1} className="h-[44px]" />
					</>
				) : overview.data ? (
					<>
						<div className={styles.cards}>
							<Metric
								title="Outbox ожидает"
								value={overview.data.outbox.PENDING}
								description="События уже сохранены в PostgreSQL, но ещё не опубликованы в RabbitMQ. Кратковременное значение допустимо; постоянный рост означает задержку publisher или недоступность RabbitMQ."
							/>
							<Metric
								title="Outbox ошибок"
								value={overview.data.outbox.FAILED}
								description="События, публикация которых завершилась ошибкой и будет автоматически повторена после задержки. Если значение долго не уменьшается, нужно проверить publisher и RabbitMQ."
							/>
							<Metric
								title="DLQ не решено"
								value={overview.data.unresolvedFailures}
								description="Доставки, исчерпавшие автоматические попытки. Ошибка уже сохранена в PostgreSQL и отображается ниже в блоке «Ошибки доставки» для диагностики и ручного retry."
							/>
							<Metric
								title="Повторяется"
								value={overview.data.retryingFailures}
								description="Ошибки из DLQ, для которых DEV запустил ручную повторную отправку, но успешная доставка ещё не подтверждена."
							/>
							<Metric
								title="Доставлено за 24 часа"
								value={overview.data.deliveredLast24Hours}
								description="Количество успешных обработок отдельными consumers и завершённых backup, а не уникальных бизнес-событий. Например, одна оплата с успешными email и Telegram даст две доставки."
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
							<AdminTooltip
								title="Состояние процессов"
								description="Зелёный индикатор означает, что процесс присылал heartbeat в последние 30 секунд. Число показывает количество активных экземпляров. Heartbeat подтверждает, что publisher, integration-worker или maintenance-worker жив, но не проверяет доступность SMTP, Telegram, CRM или PostgreSQL."
							/>
						</div>
						{overview.data.rabbitMqError && (
							<p className={styles.error}>
								RabbitMQ: {overview.data.rabbitMqError}
							</p>
						)}
						<div className={styles.queueHeading}>
							<span>Очереди RabbitMQ</span>
							<AdminTooltip
								title="Как читать таблицу очередей"
								description="«Готово» — сообщения ожидают обработки. «В работе» — уже переданы consumer, но ещё не подтверждены через ack. «Consumers» — подключённые обработчики. Для retry-v2 значение Consumers = 0 нормально: RabbitMQ сам вернёт сообщение после задержки. Dead-letter хранит окончательные ошибки до переноса в PostgreSQL, а пустые retry.1–3 — старые очереди, которые больше не используются."
							/>
						</div>
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
						Не удалось получить состояние очередей:{' '}
						{errorCatch(overview.error)}
					</p>
				)}
			</div>

			<div className={styles.section}>
				<div className={styles.header}>
					<div>
						<div className={styles.titleWithHelp}>
							<p className={styles.title}>Ошибки доставки</p>
							<AdminTooltip
								title="Ошибки доставки"
								description="Здесь находятся окончательные ошибки, перенесённые consumer из RabbitMQ DLQ в PostgreSQL. После диагностики DEV может запустить повтор только для выбранной интеграции."
								risk="medium"
								riskText="При неопределённом результате внешнего запроса ручной retry теоретически может повторить уже выполненное действие."
							/>
						</div>
						<p className={styles.hint}>
							Сообщения, перенесённые из DLQ в PostgreSQL
						</p>
					</div>
					<div className={styles.filters}>
						<label className={styles.selectWrap}>
							<span className="sr-only">Обработчик</span>
							<select
								value={integration}
								onChange={event => {
									setIntegration(event.target.value)
									setPage(1)
								}}
							>
								<option value="ALL">Все обработчики</option>
								{Object.entries(integrationLabels).map(
									([value, label]) => (
										<option key={value} value={value}>
											{label}
										</option>
									)
								)}
							</select>
						</label>
						<label className={styles.selectWrap}>
							<span className="sr-only">Статус</span>
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
						</label>
					</div>
				</div>
				{failures.isLoading ? (
					<div className={styles.failureSkeletons}>
						<SkeletonLoader count={1} className="h-[46px]" />
						<SkeletonLoader count={1} className="h-[58px]" />
						<SkeletonLoader count={1} className="h-[58px]" />
						<SkeletonLoader count={1} className="h-[58px]" />
					</div>
				) : failures.data?.items.length ? (
					<>
						<div className={styles.tableWrap}>
							<table>
								<thead>
									<tr>
										<th>Обработчик</th>
										<th>Объект</th>
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
													onClick={() => setRetryTarget(item)}
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
				) : failures.isError ? (
					<p className={styles.empty}>
						Не удалось получить ошибки доставки:{' '}
						{errorCatch(failures.error)}
					</p>
				) : (
					<p className={styles.empty}>По выбранным фильтрам ошибок нет</p>
				)}
			</div>
		</section>
	)
}

function Metric({
	title,
	value,
	description
}: {
	title: string
	value: number
	description: string
}) {
	return (
		<div className={styles.metric}>
			<div className={styles.metricTitle}>
				<span>{title}</span>
				<AdminTooltip title={title} description={description} />
			</div>
			<strong>{value}</strong>
		</div>
	)
}
