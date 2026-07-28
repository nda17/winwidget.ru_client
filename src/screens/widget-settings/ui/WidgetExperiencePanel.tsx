'use client'

import type {
	WidgetConfigVersionsResponse,
	WidgetLifecycleState,
	WidgetRuntimeAnalytics,
	WidgetRuntimeStatus
} from '@/entities/site-widget'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import { useState } from 'react'
import styles from './WidgetExperiencePanel.module.scss'

type Confirmation =
	| { action: 'discard' }
	| { action: 'restore'; version: number }
	| null

interface WidgetExperiencePanelProps {
	lifecycle?: WidgetLifecycleState<unknown>
	runtimeStatus?: WidgetRuntimeStatus
	analytics?: WidgetRuntimeAnalytics
	canUseAnalytics: boolean
	versions?: WidgetConfigVersionsResponse
	isRuntimeStatusError: boolean
	isAnalyticsError: boolean
	isVersionsError: boolean
	versionsPage: number
	isLoading: boolean
	isPublishing: boolean
	isDiscarding: boolean
	isCloning: boolean
	isRestoring: boolean
	isCheckingInstallation: boolean
	hasLocalChanges: boolean
	onPublish: () => void
	onDiscard: () => void
	onClone: () => void
	onRestore: (version: number) => void
	onCheckInstallation: () => void
	onVersionsPageChange: (page: number) => void
}

const STATUS_LABELS: Record<
	WidgetLifecycleState<unknown>['status'],
	string
> = {
	DRAFT_ONLY: 'Не опубликован',
	PUBLISHED: 'Опубликован',
	CHANGES_PENDING: 'Есть изменения',
	INACTIVE: 'Выключен'
}

const INSTALLATION_LABELS: Record<
	WidgetRuntimeStatus['installation']['state'],
	string
> = {
	DOMAIN_REQUIRED: 'Сначала укажите домен',
	NOT_SEEN: 'Сигнал ещё не получен',
	SIGNAL_RECEIVED: 'Сигнал получен'
}

const formatDateTime = (value: string | null) => {
	if (!value) return '—'

	const date = new Date(value)
	if (Number.isNaN(date.getTime())) return '—'

	return new Intl.DateTimeFormat('ru-RU', {
		dateStyle: 'short',
		timeStyle: 'short'
	}).format(date)
}

const formatRate = (value: number | null) =>
	value === null ? '—' : `${Math.round(value * 10) / 10}%`

const WidgetExperiencePanel = ({
	lifecycle,
	runtimeStatus,
	analytics,
	canUseAnalytics,
	versions,
	isRuntimeStatusError,
	isAnalyticsError,
	isVersionsError,
	versionsPage,
	isLoading,
	isPublishing,
	isDiscarding,
	isCloning,
	isRestoring,
	isCheckingInstallation,
	hasLocalChanges,
	onPublish,
	onDiscard,
	onClone,
	onRestore,
	onCheckInstallation,
	onVersionsPageChange
}: WidgetExperiencePanelProps) => {
	const [confirmation, setConfirmation] = useState<Confirmation>(null)

	if (isLoading && !lifecycle) {
		return (
			<section className={styles.panel} aria-label="Состояние виджета">
				<p className={styles.loading}>Проверяем состояние виджета…</p>
			</section>
		)
	}

	if (!lifecycle) {
		return (
			<section className={styles.panel} aria-label="Состояние виджета">
				<p className={styles.error}>
					Не удалось загрузить публикацию и диагностику. Настройки можно
					редактировать, но публиковать их пока нельзя.
				</p>
			</section>
		)
	}

	const isBusy =
		isLoading ||
		isPublishing ||
		isDiscarding ||
		isCloning ||
		isRestoring ||
		hasLocalChanges
	const publishedAt = formatDateTime(lifecycle.publishedAt)
	const blockers = lifecycle.readiness.blockers
	const warnings = lifecycle.readiness.warnings
	const installation = runtimeStatus?.installation

	return (
		<>
			<section className={styles.panel} aria-label="Публикация виджета">
				<div className={styles.summary}>
					<div>
						<div className={styles.statusRow}>
							<span
								className={`${styles.statusBadge} ${
									lifecycle.status === 'PUBLISHED'
										? styles.statusReady
										: lifecycle.status === 'CHANGES_PENDING'
											? styles.statusPending
											: styles.statusMuted
								}`}
							>
								{STATUS_LABELS[lifecycle.status]}
							</span>
							<span className={styles.version}>
								{lifecycle.publishedVersion > 0
									? `Версия ${lifecycle.publishedVersion}`
									: 'Без публикаций'}
							</span>
						</div>
						<p className={styles.summaryText}>
							Сохранение формы создаёт черновик. Посетители увидят
							изменения только после публикации.
						</p>
						{hasLocalChanges && (
							<p className={styles.notice}>
								Сначала сохраните изменения формы в черновик.
							</p>
						)}
						{lifecycle.publishedVersion > 0 && (
							<p className={styles.meta}>
								Последняя публикация: {publishedAt}
							</p>
						)}
					</div>

					<div className={styles.primaryActions}>
						<button
							type="button"
							className={styles.publishButton}
							onClick={onPublish}
							disabled={
								isBusy ||
								!lifecycle.hasUnpublishedChanges ||
								!lifecycle.readiness.ready
							}
						>
							{isPublishing ? 'Публикуем…' : 'Опубликовать'}
						</button>
						<button
							type="button"
							className={styles.secondaryButton}
							onClick={onClone}
							disabled={isBusy}
						>
							{isCloning ? 'Создаём копию…' : 'Создать копию'}
						</button>
					</div>
				</div>

				{(blockers.length > 0 || warnings.length > 0) && (
					<div className={styles.readiness}>
						<p className={styles.sectionTitle}>Перед публикацией</p>
						<ul className={styles.issueList}>
							{blockers.map(issue => (
								<li
									key={`blocker-${issue.code}`}
									className={styles.blocker}
								>
									{issue.message}
								</li>
							))}
							{warnings.map(issue => (
								<li
									key={`warning-${issue.code}`}
									className={styles.warning}
								>
									{issue.message}
								</li>
							))}
						</ul>
					</div>
				)}

				{lifecycle.hasUnpublishedChanges &&
					lifecycle.publishedVersion > 0 && (
						<button
							type="button"
							className={styles.textButton}
							onClick={() => setConfirmation({ action: 'discard' })}
							disabled={isBusy}
						>
							Отменить изменения черновика
						</button>
					)}

				<div className={styles.detailsGrid}>
					<details className={styles.details}>
						<summary className={styles.detailsSummary}>
							Проверка установки
							{installation && (
								<span
									className={
										installation.state === 'SIGNAL_RECEIVED'
											? styles.inlineReady
											: styles.inlineMuted
									}
								>
									{INSTALLATION_LABELS[installation.state]}
								</span>
							)}
						</summary>
						<div className={styles.detailsContent}>
							{isRuntimeStatusError ? (
								<p className={styles.error}>
									Не удалось загрузить диагностику установки. Проверьте
									соединение и обновите страницу.
								</p>
							) : installation ? (
								<>
									<dl className={styles.definitionList}>
										<div>
											<dt>Домен</dt>
											<dd>{installation.domain || 'не указан'}</dd>
										</div>
										<div>
											<dt>Последний сигнал</dt>
											<dd>{formatDateTime(installation.lastSeenAt)}</dd>
										</div>
										<div>
											<dt>Версия скрипта</dt>
											<dd>{installation.runtimeVersion || '—'}</dd>
										</div>
									</dl>
									<p className={styles.helpText}>
										Запустите проверку, затем откройте или перезагрузите
										страницу сайта с виджетом. Отсутствие свежего сигнала
										не означает, что код удалён: на странице могло не быть
										посетителей.
									</p>
									<button
										type="button"
										className={styles.secondaryButton}
										onClick={onCheckInstallation}
										disabled={
											isCheckingInstallation ||
											installation.state === 'DOMAIN_REQUIRED'
										}
									>
										{isCheckingInstallation
											? 'Ждём сигнал…'
											: 'Проверить установку'}
									</button>
								</>
							) : (
								<p className={styles.helpText}>
									Диагностика пока недоступна.
								</p>
							)}
						</div>
					</details>

					<details className={styles.details}>
						<summary className={styles.detailsSummary}>
							Воронка за 30 дней
						</summary>
						<div className={styles.detailsContent}>
							{!canUseAnalytics ? (
								<p className={styles.helpText}>
									Воронка доступна на активном тарифе Hard.
								</p>
							) : isAnalyticsError ? (
								<p className={styles.error}>
									Не удалось загрузить воронку. Проверьте соединение и
									обновите страницу.
								</p>
							) : analytics ? (
								<>
									<div className={styles.funnel}>
										<FunnelMetric
											label="Загрузки"
											value={analytics.totals.impressions}
										/>
										<FunnelMetric
											label="Открытия"
											value={analytics.totals.opens}
											rate={analytics.conversion.openRate}
										/>
										<FunnelMetric
											label="Начали"
											value={analytics.totals.starts}
											rate={analytics.conversion.startRate}
										/>
										<FunnelMetric
											label="Заявки"
											value={analytics.totals.submits}
											rate={analytics.conversion.submitRate}
										/>
									</div>
									<p className={styles.helpText}>
										Воронка ориентировочная: считаются загрузки и действия,
										а не уникальные посетители. Персональные данные в
										аналитику не записываются.
									</p>
									{analytics.isPartialPeriod && (
										<p className={styles.notice}>
											{analytics.trackingStartedAt
												? `Наблюдение началось ${formatDateTime(
														analytics.trackingStartedAt
													)}. Более ранние заявки в эту воронку не включены.`
												: 'Сбор данных ещё не начался. Воронка заполнится после первого сигнала с сайта.'}
										</p>
									)}
									{!analytics.submitAvailable && (
										<p className={styles.notice}>
											Сейчас сбор контактов отключён. Воронка сохраняет
											фактические заявки за период, в том числе из прежних
											настроек.
										</p>
									)}
								</>
							) : (
								<p className={styles.helpText}>
									Аналитика появится после первых загрузок виджета.
								</p>
							)}
						</div>
					</details>

					<details className={styles.details}>
						<summary className={styles.detailsSummary}>
							История публикаций
						</summary>
						<div className={styles.detailsContent}>
							{isVersionsError ? (
								<p className={styles.error}>
									Не удалось загрузить историю публикаций. Проверьте
									соединение и обновите страницу.
								</p>
							) : versions?.items.length ? (
								<>
									<ul className={styles.versionList}>
										{versions.items.map(version => (
											<li key={version.version}>
												<div>
													<strong>Версия {version.version}</strong>
													<span>{formatDateTime(version.createdAt)}</span>
												</div>
												<button
													type="button"
													className={styles.textButton}
													onClick={() =>
														setConfirmation({
															action: 'restore',
															version: version.version
														})
													}
													disabled={
														isBusy ||
														version.version === lifecycle.publishedVersion
													}
												>
													В черновик
												</button>
											</li>
										))}
									</ul>
									{versions.totalPages > 1 && (
										<div className={styles.pagination}>
											<button
												type="button"
												className={styles.secondaryButton}
												onClick={() =>
													onVersionsPageChange(versionsPage - 1)
												}
												disabled={versionsPage <= 1}
											>
												Назад
											</button>
											<span>
												{versionsPage} из {versions.totalPages}
											</span>
											<button
												type="button"
												className={styles.secondaryButton}
												onClick={() =>
													onVersionsPageChange(versionsPage + 1)
												}
												disabled={versionsPage >= versions.totalPages}
											>
												Дальше
											</button>
										</div>
									)}
								</>
							) : (
								<p className={styles.helpText}>Публикаций пока не было.</p>
							)}
						</div>
					</details>
				</div>
			</section>

			{confirmation?.action === 'discard' && (
				<ConfirmDialog
					title="Отменить изменения?"
					message="Черновик будет заменён последней опубликованной версией. Это действие нельзя отменить."
					confirmLabel="Отменить изменения"
					onCancel={() => setConfirmation(null)}
					onConfirm={() => {
						setConfirmation(null)
						onDiscard()
					}}
				/>
			)}

			{confirmation?.action === 'restore' && (
				<ConfirmDialog
					title={`Восстановить версию ${confirmation.version}?`}
					message="Настройки выбранной версии попадут в черновик. Рабочий виджет не изменится до новой публикации."
					confirmLabel="Восстановить в черновик"
					onCancel={() => setConfirmation(null)}
					onConfirm={() => {
						const version = confirmation.version
						setConfirmation(null)
						onRestore(version)
					}}
				/>
			)}
		</>
	)
}

const FunnelMetric = ({
	label,
	value,
	rate
}: {
	label: string
	value: number | null
	rate?: number | null
}) => (
	<div className={styles.funnelItem}>
		<span>{label}</span>
		<strong>{value === null ? '—' : value.toLocaleString('ru-RU')}</strong>
		{rate !== undefined && (
			<small>{rate === null ? 'недоступно' : formatRate(rate)}</small>
		)}
	</div>
)

export default WidgetExperiencePanel
