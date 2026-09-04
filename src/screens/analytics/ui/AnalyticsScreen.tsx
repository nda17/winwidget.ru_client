'use client'

import { getSalesAnalytics, type DealStatus } from '@/entities/sales'
import { useSessionStore } from '@/entities/session'
import { salesMoney, useSalesSession } from '@/features/manage-sales'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import {
	AppIcon,
	Button,
	PageHeader,
	ScreenState,
	StatusBadge,
	type StatusBadgeTone
} from '@/shared/ui'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import toast from 'react-hot-toast'
import styles from './AnalyticsScreen.module.scss'

const statuses: {
	status: DealStatus
	label: string
	tone: StatusBadgeTone
	hint: string
}[] = [
	{
		status: 'OPEN',
		label: 'В работе',
		tone: 'info',
		hint: 'Потенциальная сумма открытых сделок'
	},
	{
		status: 'WON',
		label: 'Успешно закрыты',
		tone: 'success',
		hint: 'Сумма успешных сделок, не поступившая оплата'
	},
	{
		status: 'LOST',
		label: 'Закрыты с отказом',
		tone: 'neutral',
		hint: 'Сумма сделок, завершённых без продажи'
	}
]
const number = new Intl.NumberFormat('ru-RU')

const AnalyticsScreen = () => {
	const context = useSalesSession()
	const client = useQueryClient()
	const permissions = context.permissions
	const canRead =
		!!context.session &&
		!!permissions.data &&
		!permissions.isError &&
		!permissions.isFetching &&
		permissions.data.permissions.includes('sales:analytics')
	const report = useQuery({
		queryKey: [
			'sales',
			'analytics',
			...context.key,
			permissions.data?.role,
			permissions.data?.dataScope,
			permissions.data?.teamIds.join(',')
		],
		enabled: canRead,
		queryFn: async () => {
			const session = context.session!
			try {
				return await getSalesAnalytics(
					session.accessToken,
					context.workspace.workspaceId
				)
			} catch (error) {
				const current = useSessionStore.getState()
				if (
					error instanceof AuthenticatedApiError &&
					error.kind === 'unauthorized' &&
					current.sessionRevision === context.sessionRevision &&
					current.session?.accessToken === session.accessToken
				) {
					current.setAnonymous()
				}
				throw error
			}
		},
		retry: false,
		gcTime: 0
	})
	const reload = async () => {
		const checked = await permissions.refetch()
		if (
			checked.isError ||
			!checked.data?.permissions.includes('sales:analytics')
		) {
			toast.error('Не удалось подтвердить доступ к отчёту')
			return
		}
		// Invalidation reaches the current observer if role/team scope changed.
		await client.invalidateQueries({
			queryKey: ['sales', 'analytics', ...context.key]
		})
		toast('Данные отчёта запрошены заново')
	}
	const data =
		canRead && !report.isFetching && !report.isError
			? report.data
			: undefined
	const total = data?.items.reduce((sum, item) => sum + item.count, 0) ?? 0
	const won = data?.items.find(item => item.status === 'WON')?.count ?? 0
	const lost = data?.items.find(item => item.status === 'LOST')?.count ?? 0
	const scope =
		permissions.data?.dataScope === 'OWN'
			? 'Только ваши сделки'
			: permissions.data?.dataScope === 'TEAM'
				? 'Ваши сделки и сделки доступных команд'
				: 'Все доступные сделки пространства'
	return (
		<div className={styles.screen}>
			<PageHeader
				eyebrow="Контроль продаж"
				title="Аналитика"
				description="Текущее состояние продаж. Все показатели рассчитываются на сервере в границах вашего доступа."
				actions={
					<Button
						variant="secondary"
						disabled={permissions.isFetching || report.isFetching}
						onClick={() => void reload()}
						leadingIcon={<AppIcon name="refresh" size={18} />}
					>
						Обновить
					</Button>
				}
			/>
			{permissions.isError ? (
				<ScreenState
					variant="error"
					title="Не удалось проверить права"
					description="Данные скрыты до успешной проверки доступа."
				/>
			) : permissions.isPending || permissions.isFetching ? (
				<ScreenState
					variant="loading"
					title="Проверяем доступ к аналитике"
				/>
			) : !canRead ? (
				<ScreenState
					variant="permission"
					title="Аналитика недоступна"
					description="Для просмотра отчёта нужна CRM-роль с доступом к аналитике."
				/>
			) : report.isError ? (
				<ScreenState
					variant="error"
					title="Отчёт временно недоступен"
					description="Показатели не подменяются нулями. Обновите страницу отчёта, чтобы повторить запрос."
				/>
			) : !data ? (
				<ScreenState variant="loading" title="Рассчитываем показатели" />
			) : total === 0 ? (
				<ScreenState
					variant="empty"
					title="Пока нет сделок для отчёта"
					description="Показатели появятся после создания первой доступной вам сделки. Архивные сделки в отчёт не включаются."
				/>
			) : (
				<>
					<div className={styles.reportScope}>
						<span>{scope}</span>
						<StatusBadge tone="neutral" showDot={false}>
							Без ограничения по дате
						</StatusBadge>
					</div>
					<section
						className={styles.metricGrid}
						aria-label="Сделки по статусам"
					>
						{statuses.map(({ status, label, tone, hint }) => {
							const item = data.items.find(row => row.status === status)!
							return (
								<article
									key={status}
									className={styles.metricCard}
									aria-label={label}
								>
									<StatusBadge tone={tone}>{label}</StatusBadge>
									<strong>{number.format(item.count)}</strong>
									<span className={styles.metricCaption}>
										Количество сделок
									</span>
									<p className={styles.metricAmount}>
										{salesMoney(item.amountMinor)}
									</p>
									<small>{hint}</small>
								</article>
							)
						})}
					</section>
					<section
						className={styles.summaryPanel}
						aria-labelledby="sales-summary-title"
					>
						<div>
							<h2 id="sales-summary-title">Результат закрытых сделок</h2>
							<p>
								Доля успешных среди успешно закрытых и отказов. Это не
								конверсия по этапам воронки.
							</p>
						</div>
						<div className={styles.summaryValue}>
							<strong>
								{won + lost
									? number.format(Math.round((won / (won + lost)) * 100)) +
										'%'
									: '—'}
							</strong>
							<span>
								{won + lost
									? number.format(won) +
										' успешных из ' +
										number.format(won + lost) +
										' закрытых'
									: 'Закрытых сделок пока нет'}
							</span>
						</div>
					</section>
					<p className={styles.footnote}>
						Всего: {number.format(total)}. Архивные сделки исключены. Суммы
						сделок не являются выручкой или подтверждением оплаты.
					</p>
				</>
			)}
		</div>
	)
}

export default AnalyticsScreen
