import styles from '@/screens/admin/ui/statistics/insights/StatisticsInsights.module.scss'
import { useStatisticsOverview } from '@/screens/admin/model/statistics/useStatisticsOverview'
import {
	formatPercentage,
	formatMoney,
	formatStatValue
} from '@/screens/admin/model/statistics/statistics.utils'
import SkeletonLoader from '@/shared/ui/skeleton-loader/SkeletonLoader'
import { FC } from 'react'

const StatisticsInsights: FC = () => {
	const { data: dashboard, isPending } = useStatisticsOverview()

	if (isPending) {
		return (
			<div className={styles.wrapper}>
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
				<SkeletonLoader count={1} className="h-[130px]" />
			</div>
		)
	}

	if (!dashboard) {
		return null
	}

	return (
		<div className={styles.wrapper}>
			<div className={styles.card}>
				<p className={styles.label}>Выручка за 30 дней</p>
				<p className={styles.value}>
					{formatMoney(dashboard.finance.revenue30d)}
				</p>
				<p className={styles.caption}>
					Текущий месяц:{' '}
					{formatMoney(dashboard.finance.revenueCurrentMonth)}, всего:{' '}
					{formatMoney(dashboard.finance.revenueAllTime)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Успешные оплаты</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.finance.succeededPayments30d)}
				</p>
				<p className={styles.caption}>
					За 30 дней, уникальных плательщиков:{' '}
					{formatStatValue(dashboard.finance.payingUsers30d)}, всего:{' '}
					{formatStatValue(dashboard.finance.payingUsersTotal)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Средний чек</p>
				<p className={styles.value}>
					{formatMoney(dashboard.finance.averageCheck30d)}
				</p>
				<p className={styles.caption}>По успешным оплатам за 30 дней</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Pending сейчас</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.finance.pendingPaymentsCurrent)}
				</p>
				<p className={styles.caption}>
					Отменённых за 30 дней:{' '}
					{formatStatValue(dashboard.finance.cancelledPayments30d)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Активные подписки</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.subscriptions.active)}
				</p>
				<p className={styles.caption}>
					Оплаченных: {formatStatValue(dashboard.subscriptions.paidActive)}
					, trial: {formatStatValue(dashboard.subscriptions.trialActive)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Истекают скоро</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.subscriptions.expiring7d)}
				</p>
				<p className={styles.caption}>
					Сегодня: {formatStatValue(dashboard.subscriptions.expiringToday)}
					, за 3 дня: {formatStatValue(dashboard.subscriptions.expiring3d)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Истекли, но ACTIVE</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.subscriptions.expiredActive)}
				</p>
				<p className={styles.caption}>Требуют проверки статуса подписки</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Заявки за 30 дней</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.leads.total30d)}
				</p>
				<p className={styles.caption}>
					К прошлым 30 дням: {formatPercentage(dashboard.leads.growth30d)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Заявки сегодня</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.leads.today)}
				</p>
				<p className={styles.caption}>
					Всего за всё время: {formatStatValue(dashboard.leads.allTime)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Активные виджеты</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.widgets.active)}
				</p>
				<p className={styles.caption}>
					Всего: {formatStatValue(dashboard.widgets.total)}, новых за 30
					дней: {formatStatValue(dashboard.widgets.new30d)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Виджеты без домена</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.widgets.withoutDomain)}
				</p>
				<p className={styles.caption}>
					Активных без домена:{' '}
					{formatStatValue(dashboard.widgets.activeWithoutDomain)}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Пользователи без контактов</p>
				<p className={styles.value}>
					{formatStatValue(dashboard.users.withoutContacts)}
				</p>
				<p className={styles.caption}>
					Без email: {formatStatValue(dashboard.users.withoutEmail)}, без
					телефона: {formatStatValue(dashboard.users.withoutPhone)}
				</p>
			</div>
		</div>
	)
}

export default StatisticsInsights
