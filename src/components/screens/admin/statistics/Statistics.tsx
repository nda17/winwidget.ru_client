import styles from '@/components/screens/admin/statistics/Statistics.module.scss'
import CountersDistributionChart from '@/components/screens/admin/statistics/charts/CountersDistributionChart/CountersDistributionChart'
import RegistrationByMonthBarChart from '@/components/screens/admin/statistics/charts/RegistrationByMonthBarChart/RegistrationByMonthBarChart'
import RegistrationByMonthChart from '@/components/screens/admin/statistics/charts/RegistrationByMonthChart/RegistrationByMonthChart'
import Counters from '@/components/screens/admin/statistics/counters/Counters'
import StatisticsInsights from '@/components/screens/admin/statistics/insights/StatisticsInsights'
import { FC } from 'react'

const Statistics: FC = () => {
	return (
		<div className={styles.wrapper}>
			<Counters />
			<StatisticsInsights />
			<div className={styles['charts-grid']}>
				<div className={styles['chart-card']}>
					<h3 className={styles['chart-title']}>Динамика регистраций</h3>
					<p className={styles['chart-subtitle']}>
						Помесячный тренд помогает быстро увидеть рост и провалы.
					</p>
					<div className={styles['chart-wrapper']}>
						<RegistrationByMonthChart />
					</div>
				</div>
				<div className={styles['chart-card']}>
					<h3 className={styles['chart-title']}>Регистрации по месяцам</h3>
					<p className={styles['chart-subtitle']}>
						Столбцы удобны для сравнения объёма между периодами.
					</p>
					<div className={styles['chart-wrapper']}>
						<RegistrationByMonthBarChart />
					</div>
				</div>
				<div className={styles['chart-card']}>
					<h3 className={styles['chart-title']}>Распределение счётчиков</h3>
					<p className={styles['chart-subtitle']}>
						Показывает структуру текущих агрегированных показателей.
					</p>
					<div className={styles['chart-wrapper']}>
						<CountersDistributionChart />
					</div>
				</div>
			</div>
		</div>
	)
}

export default Statistics
