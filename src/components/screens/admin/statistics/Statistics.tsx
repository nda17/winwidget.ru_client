import styles from '@/components/screens/admin/statistics/Statistics.module.scss'
import OverviewDistributionChart from '@/components/screens/admin/statistics/charts/OverviewDistributionChart/OverviewDistributionChart'
import RegistrationByMonthBarChart from '@/components/screens/admin/statistics/charts/RegistrationByMonthBarChart/RegistrationByMonthBarChart'
import RegistrationByMonthChart from '@/components/screens/admin/statistics/charts/RegistrationByMonthChart/RegistrationByMonthChart'
import StatisticsInsights from '@/components/screens/admin/statistics/insights/StatisticsInsights'
import { FC } from 'react'

const Statistics: FC = () => {
	return (
		<div className={styles.wrapper}>
			<section className={styles.section}>
				<div className={styles['section-head']}>
					<h3 className={styles['section-title']}>Ключевые показатели</h3>
					<p className={styles['section-subtitle']}>
						Основные KPI по пользователям, активности и ролям команды.
					</p>
				</div>
				<StatisticsInsights />
			</section>

			<section className={styles.section}>
				<div className={styles['section-head']}>
					<h3 className={styles['section-title']}>Графики и динамика</h3>
					<p className={styles['section-subtitle']}>
						Визуализация тренда регистраций и структуры текущих
						показателей.
					</p>
				</div>
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
						<h3 className={styles['chart-title']}>
							Регистрации по месяцам
						</h3>
						<p className={styles['chart-subtitle']}>
							Столбцы удобны для сравнения объёма между периодами.
						</p>
						<div className={styles['chart-wrapper']}>
							<RegistrationByMonthBarChart />
						</div>
					</div>
					<div className={styles['chart-card']}>
						<h3 className={styles['chart-title']}>
							Структура ключевых показателей
						</h3>
						<p className={styles['chart-subtitle']}>
							Показывает распределение текущих агрегированных показателей.
						</p>
						<div className={styles['chart-wrapper']}>
							<OverviewDistributionChart />
						</div>
					</div>
				</div>
			</section>
		</div>
	)
}

export default Statistics
