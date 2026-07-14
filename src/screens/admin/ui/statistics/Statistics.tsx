'use client'

import styles from '@/screens/admin/ui/statistics/Statistics.module.scss'
import LeadsByDayChart from '@/screens/admin/ui/statistics/charts/LeadsByDayChart/LeadsByDayChart'
import LeadsByTypeChart from '@/screens/admin/ui/statistics/charts/LeadsByTypeChart/LeadsByTypeChart'
import RevenueByMonthChart from '@/screens/admin/ui/statistics/charts/RevenueByMonthChart/RevenueByMonthChart'
import StatisticsInsights from '@/screens/admin/ui/statistics/insights/StatisticsInsights'
import AdminTooltip from '@/screens/admin/ui/common/admin-tooltip/AdminTooltip'
import { FC } from 'react'

const Statistics: FC = () => {
	return (
		<section className={styles.wrapper}>
			<section className={styles.section}>
				<div className={styles['section-head']}>
					<div className={styles['title-with-help']}>
						<h3 className={styles['section-title']}>
							Коммерческие показатели
						</h3>
						<AdminTooltip
							title="Коммерческие показатели"
							description="Сводные метрики по оплатам, подпискам, заявкам, виджетам и готовности пользователей к оплате."
							risk="low"
							riskText="Блок ничего не меняет. Используй цифры как ориентир, а не как единственный источник решения."
						/>
					</div>
					<p className={styles['section-subtitle']}>
						Деньги, подписки, заявки и операционные сигналы по проекту.
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
							description="Визуальные отчёты помогают увидеть тренд выручки, поток заявок и распределение заявок по типам виджетов."
							risk="low"
							riskText="Экран только показывает аналитику. Проверяй период и источник метрики перед выводами."
						/>
					</div>
					<p className={styles['section-subtitle']}>
						Визуализация выручки, заявок и распределения нагрузки между
						типами виджетов.
					</p>
				</div>
				<div className={styles['charts-grid']}>
					<div className={styles['chart-card']}>
						<h3 className={styles['chart-title']}>Выручка по месяцам</h3>
						<p className={styles['chart-subtitle']}>
							Сумма успешных оплат за последние 12 месяцев.
						</p>
						<div className={styles['chart-wrapper']}>
							<RevenueByMonthChart />
						</div>
					</div>
					<div className={styles['chart-card']}>
						<h3 className={styles['chart-title']}>Заявки по дням</h3>
						<p className={styles['chart-subtitle']}>
							Динамика заявок за 30 дней по каждому типу виджета.
						</p>
						<div className={styles['chart-wrapper']}>
							<LeadsByDayChart />
						</div>
					</div>
					<div className={styles['chart-card']}>
						<h3 className={styles['chart-title']}>Заявки по типам</h3>
						<p className={styles['chart-subtitle']}>
							Распределение заявок за 30 дней между виджетами.
						</p>
						<div className={styles['chart-wrapper']}>
							<LeadsByTypeChart />
						</div>
					</div>
				</div>
			</section>
		</section>
	)
}

export default Statistics
