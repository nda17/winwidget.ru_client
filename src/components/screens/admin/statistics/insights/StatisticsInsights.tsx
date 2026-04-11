import styles from '@/components/screens/admin/statistics/insights/StatisticsInsights.module.scss'
import { useStatisticsOverview } from '@/components/screens/admin/statistics/hooks/useStatisticsOverview'
import { useRegistrationsByMonth } from '@/components/screens/admin/statistics/hooks/useRegistrationsByMonth'
import {
	formatPercentage,
	formatStatValue,
	getSortedRegistrations
} from '@/components/screens/admin/statistics/statistics.utils'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import { FC } from 'react'

const StatisticsInsights: FC = () => {
	const { data: overview, isPending: isOverviewPending } =
		useStatisticsOverview()
	const { data: registrations, isPending: isRegistrationsPending } =
		useRegistrationsByMonth()

	if (isOverviewPending || isRegistrationsPending) {
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
			</div>
		)
	}

	const sortedRegistrations = getSortedRegistrations(registrations)
	const totalRegistrations = sortedRegistrations.reduce(
		(sum, item) => sum + item.count,
		0
	)
	const averageRegistrations = sortedRegistrations.length
		? totalRegistrations / sortedRegistrations.length
		: 0
	const latestMonth = sortedRegistrations.at(-1)
	const previousMonth = sortedRegistrations.at(-2)
	const peakMonth = sortedRegistrations.reduce(
		(topItem, currentItem) =>
			!topItem || currentItem.count > topItem.count ? currentItem : topItem,
		undefined as (typeof sortedRegistrations)[number] | undefined
	)
	const monthOverMonthGrowth =
		latestMonth && previousMonth && previousMonth.count > 0
			? ((latestMonth.count - previousMonth.count) / previousMonth.count) * 100
			: 0
	const publicRegistrations = Math.max(
		(overview?.totalUsers ?? 0) -
			(overview?.adminUsers ?? 0) -
			(overview?.managerUsers ?? 0),
		0
	)

	return (
		<div className={styles.wrapper}>
			<div className={styles.card}>
				<p className={styles.label}>Регистрации за весь период</p>
				<p className={styles.value}>{formatStatValue(publicRegistrations)}</p>
				<p className={styles.caption}>
					Без учёта администраторов и менеджеров
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Последний месяц</p>
				<p className={styles.value}>
					{formatStatValue(latestMonth?.count ?? 0)}
				</p>
				<p className={styles.caption}>
					{latestMonth
						? `${latestMonth.month} ${latestMonth.year}`
						: 'Данные недоступны'}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Среднее в месяц</p>
				<p className={styles.value}>
					{formatStatValue(Math.round(averageRegistrations))}
				</p>
				<p className={styles.caption}>
					Динамика за {sortedRegistrations.length || 0} мес.
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Рост к прошлому месяцу</p>
				<p className={styles.value}>{formatPercentage(monthOverMonthGrowth)}</p>
				<p className={styles.caption}>
					{previousMonth
						? `Сравнение с ${previousMonth.month} ${previousMonth.year}`
						: 'Недостаточно данных для сравнения'}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Пиковый месяц</p>
				<p className={styles.value}>
					{peakMonth ? formatStatValue(peakMonth.count) : '0'}
				</p>
				<p className={styles.caption}>
					{peakMonth
						? `${peakMonth.month} ${peakMonth.year}`
						: 'Данные недоступны'}
				</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Пользователи</p>
				<p className={styles.value}>
					{formatStatValue(overview?.totalUsers ?? 0)}
				</p>
				<p className={styles.caption}>Основной счётчик аудитории</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Активные за 30 дней</p>
				<p className={styles.value}>
					{formatStatValue(overview?.activeUsers30d ?? 0)}
				</p>
				<p className={styles.caption}>Живая аудитория за последний месяц</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Новые за 30 дней</p>
				<p className={styles.value}>
					{formatStatValue(overview?.newUsers30d ?? 0)}
				</p>
				<p className={styles.caption}>Новые пользователи за последний месяц</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Премиум-пользователи</p>
				<p className={styles.value}>
					{formatStatValue(overview?.premiumUsers ?? 0)}
				</p>
				<p className={styles.caption}>Пользователи с premium-доступом</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Без подтверждения email</p>
				<p className={styles.value}>
					{formatStatValue(overview?.unconfirmedUsers ?? 0)}
				</p>
				<p className={styles.caption}>Пользователи, не завершившие подтверждение</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Роли команды</p>
				<p className={styles.value}>
					{formatStatValue(
						(overview?.adminUsers ?? 0) + (overview?.managerUsers ?? 0)
					)}
				</p>
				<p className={styles.caption}>
					Админы: {formatStatValue(overview?.adminUsers ?? 0)} | Менеджеры:{' '}
					{formatStatValue(overview?.managerUsers ?? 0)}
				</p>
			</div>
		</div>
	)
}

export default StatisticsInsights
