'use client'

import styles from '@/components/screens/admin/statistics/Statistics.module.scss'
import OverviewDistributionChart from '@/components/screens/admin/statistics/charts/OverviewDistributionChart/OverviewDistributionChart'
import RegistrationByMonthBarChart from '@/components/screens/admin/statistics/charts/RegistrationByMonthBarChart/RegistrationByMonthBarChart'
import RegistrationByMonthChart from '@/components/screens/admin/statistics/charts/RegistrationByMonthChart/RegistrationByMonthChart'
import StatisticsInsights from '@/components/screens/admin/statistics/insights/StatisticsInsights'
import AdminTooltip from '@/components/ui/admin/admin-tooltip/AdminTooltip'
import { FC } from 'react'

const Statistics: FC = () => {
	return (
		<section className={styles.wrapper}>
			<section className={styles.section}>
				<div className={styles['section-head']}>
					<div className={styles['title-with-help']}>
						<h3 className={styles['section-title']}>
							Ключевые показатели
						</h3>
						<AdminTooltip
							title="Ключевые показатели"
							description="Сводные метрики по аудитории, регистрациям, активности и администраторам."
							risk="low"
							riskText="Блок ничего не меняет. Используй цифры как ориентир, а не как единственный источник решения."
						/>
					</div>
					<p className={styles['section-subtitle']}>
						Основные KPI по пользователям, активности и ролям команды.
					</p>
				</div>
				<StatisticsInsights />
			</section>

			<section className={styles.section}>
				<div className={styles['section-head']}>
					<div className={styles['title-with-help']}>
						<h3 className={styles['section-title']}>Графики и динамика</h3>
						<AdminTooltip
							title="Графики и динамика"
							description="Визуальные отчёты помогают увидеть тренд регистраций и распределение текущих показателей."
							risk="low"
							riskText="Экран только показывает аналитику. Проверяй период и источник метрики перед выводами."
						/>
					</div>
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
		</section>
	)
}

export default Statistics
