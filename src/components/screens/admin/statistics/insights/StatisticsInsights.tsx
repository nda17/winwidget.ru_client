import styles from '@/components/screens/admin/statistics/insights/StatisticsInsights.module.scss'
import { useRegistrationsByMonth } from '@/components/screens/admin/statistics/hooks/useRegistrationsByMonth'
import {
	formatPercentage,
	formatStatValue,
	getSortedRegistrations
} from '@/components/screens/admin/statistics/statistics.utils'
import { useCounters } from '@/components/screens/admin/statistics/counters/useCounters'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import { FC } from 'react'

const StatisticsInsights: FC = () => {
	const { data: counters, isPending: isCountersPending } = useCounters()
	const { data: registrations, isPending: isRegistrationsPending } =
		useRegistrationsByMonth()

	if (isCountersPending || isRegistrationsPending) {
		return (
			<div className={styles.wrapper}>
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

	const premiumCounter = counters?.find((item) =>
		item.name.toLowerCase().includes('premium')
	)
	const usersCounter = counters?.find((item) =>
		/(user|польз)/i.test(item.name)
	)

	return (
		<div className={styles.wrapper}>
			<div className={styles.card}>
				<p className={styles.label}>Регистрации за весь период</p>
				<p className={styles.value}>{formatStatValue(totalRegistrations)}</p>
				<p className={styles.caption}>Сумма по всем доступным месяцам</p>
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
				<p className={styles.value}>{usersCounter?.value ?? '0'}</p>
				<p className={styles.caption}>Основной счётчик аудитории</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Премиум-доступ</p>
				<p className={styles.value}>{premiumCounter?.value ?? '0'}</p>
				<p className={styles.caption}>Текущее значение по premium</p>
			</div>
			<div className={styles.card}>
				<p className={styles.label}>Карточек статистики</p>
				<p className={styles.value}>{formatStatValue(counters?.length ?? 0)}</p>
				<p className={styles.caption}>Сколько счётчиков пришло с сервера</p>
			</div>
		</div>
	)
}

export default StatisticsInsights
