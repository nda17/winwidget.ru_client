'use client'

import {
	AppIcon,
	Button,
	PageHeader,
	ScreenState,
	StatusBadge,
	type StatusBadgeTone
} from '@/shared/ui'
import {
	funnelSteps,
	metricCards
} from '@/screens/analytics/model/analytics.fixtures'
import toast from 'react-hot-toast'

import styles from './AnalyticsScreen.module.scss'

const metricTone: Record<
	(typeof metricCards)[number]['tone'],
	StatusBadgeTone
> = {
	info: 'info',
	success: 'success',
	warning: 'warning',
	danger: 'danger'
}

const funnelWidthClass: Record<number, string> = {
	100: styles.funnelWidthFull,
	75: styles.funnelWidthThreeQuarters,
	46: styles.funnelWidthFortySix,
	29: styles.funnelWidthTwentyNine
}

const AnalyticsScreen = () => {
	return (
		<div className={styles.screen}>
			<PageHeader
				eyebrow="Контроль процесса"
				title="Аналитика"
				description="Каркас рабочего дашборда без подключения источника данных и расчётов бизнес-метрик."
				actions={
					<Button
						variant="secondary"
						leadingIcon={<AppIcon name="refresh" size={18} />}
						onClick={() =>
							toast('Демо-режим: источник аналитики ещё не подключён')
						}
					>
						Обновить
					</Button>
				}
			/>

			<section
				className={styles.metricGrid}
				aria-label="Ключевые показатели"
			>
				{metricCards.map(metric => (
					<article key={metric.id} className={styles.metricCard}>
						<div className={styles.metricHeader}>
							<span>{metric.label}</span>
							<StatusBadge tone={metricTone[metric.tone]} showDot={false}>
								{metric.change}
							</StatusBadge>
						</div>
						<strong>{metric.value}</strong>
						<small>Синтетический показатель</small>
					</article>
				))}
			</section>

			<div className={styles.dashboardGrid}>
				<section className={styles.panel} aria-labelledby="funnel-title">
					<div className={styles.panelHeader}>
						<div>
							<h2 id="funnel-title" className={styles.panelTitle}>
								Движение по воронке
							</h2>
							<p className={styles.panelDescription}>
								Пропорции нужны только для проверки визуальной плотности.
							</p>
						</div>
						<StatusBadge tone="accent">7 дней · demo</StatusBadge>
					</div>
					<div className={styles.funnel}>
						{funnelSteps.map(step => (
							<div key={step.id} className={styles.funnelRow}>
								<div className={styles.funnelLabel}>
									<span>{step.label}</span>
									<strong>{step.value}</strong>
								</div>
								<div className={styles.funnelTrack} aria-hidden="true">
									<span className={funnelWidthClass[step.percent]} />
								</div>
								<small>{step.percent}% от новых</small>
							</div>
						))}
					</div>
				</section>

				<div className={styles.stateColumn}>
					<section
						className={styles.statePanel}
						aria-label="Состояние загрузки"
					>
						<ScreenState
							variant="loading"
							title="Собираем отчёт по скорости ответа"
							description="Так выглядит локальное состояние загрузки без фиктивного сетевого запроса."
							compact
						/>
					</section>
					<section
						className={styles.statePanel}
						aria-label="Состояние ошибки"
					>
						<ScreenState
							variant="error"
							title="Отчёт временно недоступен"
							description="Ошибка не блокирует остальные рабочие разделы CRM."
							action={
								<Button
									variant="secondary"
									size="sm"
									onClick={() =>
										toast('Демо-режим: повторного запроса пока нет')
									}
								>
									Повторить
								</Button>
							}
							compact
						/>
					</section>
				</div>
			</div>
		</div>
	)
}

export default AnalyticsScreen
