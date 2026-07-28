'use client'

import type {
	WidgetConfigVersionsResponse,
	WidgetLifecycleState,
	WidgetRuntimeAnalytics,
	WidgetRuntimeStatus
} from '@/entities/site-widget'
import ActionTooltip from '@/features/edit-widget-settings/ui/shared/ActionTooltip'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import { useEffect, useState } from 'react'
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
	analyticsUnavailableMessage: string
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
	hasReviewedMobilePreview: boolean
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

const INSTALLATION_SIGNAL_FRESHNESS_MS = 15 * 60 * 1000

const hasFreshInstallationSignal = (
	status: WidgetRuntimeStatus | undefined,
	elapsedSinceResponse: number
) => {
	const lastSeenAt = status?.installation.lastSeenAt
	if (!lastSeenAt || !status) return false

	const serverTimestamp = Date.parse(status.serverTime)
	const lastSeenTimestamp = Date.parse(lastSeenAt)
	if (
		!Number.isFinite(serverTimestamp) ||
		!Number.isFinite(lastSeenTimestamp)
	) {
		return false
	}

	const signalAge =
		serverTimestamp + Math.max(0, elapsedSinceResponse) - lastSeenTimestamp
	return signalAge >= 0 && signalAge <= INSTALLATION_SIGNAL_FRESHNESS_MS
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

interface ReadinessCheck {
	code: string
	label: string
	ready: boolean
}

const asConfig = (value: unknown): Record<string, unknown> =>
	value && typeof value === 'object' && !Array.isArray(value)
		? (value as Record<string, unknown>)
		: {}

const hasText = (value: unknown) =>
	typeof value === 'string' && value.trim().length > 0

const isHttpUrl = (value: unknown) => {
	if (!hasText(value)) return false

	try {
		const url = new URL(value as string)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const getReadinessChecks = (
	lifecycle: WidgetLifecycleState<unknown>,
	hasReviewedMobilePreview: boolean
): ReadinessCheck[] => {
	const config = asConfig(lifecycle.config)
	const dataType =
		typeof config.dataType === 'string'
			? config.dataType.trim().toUpperCase()
			: lifecycle.type === 'callback'
				? 'PHONE'
				: ''
	const collectsContacts = dataType !== '' && dataType !== 'NONE'
	const contactMethodReady =
		lifecycle.type === 'callback' ||
		['PHONE', 'EMAIL', 'PHONE_AND_EMAIL', 'NONE'].includes(dataType)
	const successMessageReady =
		!collectsContacts ||
		(lifecycle.type === 'wheel'
			? hasText(config.winMessage)
			: lifecycle.type === 'quiz'
				? Array.isArray(config.results) && config.results.length > 0
				: lifecycle.type === 'calculator'
					? hasText(config.resultTitle)
					: hasText(config.successTitle))
	const consentReady = !collectsContacts || isHttpUrl(config.privacyUrl)
	const displayScenarioReady =
		lifecycle.type === 'stop-offer'
			? config.desktopExitIntent === true ||
				Number(config.mobileAutoOpenDelay) > 0 ||
				Number(config.scrollPercent) > 0
			: config.buttonSide === 'left' ||
				config.buttonSide === 'right' ||
				Number(config.autoOpenDelay) > 0

	return [
		{
			code: 'CONTACT_METHOD',
			label:
				dataType === 'NONE'
					? 'Сбор контактов осознанно отключён'
					: 'Способ связи с клиентом выбран',
			ready: contactMethodReady
		},
		{
			code: 'SUCCESS_MESSAGE',
			label: collectsContacts
				? 'Сообщение после отправки заполнено'
				: 'Сообщение после отправки не требуется',
			ready: successMessageReady
		},
		{
			code: 'CONSENT',
			label: collectsContacts
				? 'Согласие на обработку данных настроено'
				: 'Согласие не требуется без сбора контактов',
			ready: consentReady
		},
		{
			code: 'DISPLAY_SCENARIO',
			label: 'Сценарий показа настроен',
			ready: displayScenarioReady
		},
		{
			code: 'MOBILE_PREVIEW',
			label: 'Мобильная версия просмотрена',
			ready: hasReviewedMobilePreview
		}
	]
}

const WidgetExperiencePanel = ({
	lifecycle,
	runtimeStatus,
	analytics,
	canUseAnalytics,
	analyticsUnavailableMessage,
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
	hasReviewedMobilePreview,
	onPublish,
	onDiscard,
	onClone,
	onRestore,
	onCheckInstallation,
	onVersionsPageChange
}: WidgetExperiencePanelProps) => {
	const [confirmation, setConfirmation] = useState<Confirmation>(null)
	const [runtimeStatusElapsedMs, setRuntimeStatusElapsedMs] = useState(0)

	useEffect(() => {
		setRuntimeStatusElapsedMs(0)
		if (!runtimeStatus?.serverTime) return

		const receivedAt = Date.now()
		const intervalId = window.setInterval(() => {
			setRuntimeStatusElapsedMs(Date.now() - receivedAt)
		}, 30_000)

		return () => window.clearInterval(intervalId)
	}, [runtimeStatus?.serverTime])

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
	const installationSignalIsFresh = hasFreshInstallationSignal(
		runtimeStatus,
		runtimeStatusElapsedMs
	)
	const installationLabel =
		installation?.state === 'SIGNAL_RECEIVED' && !installationSignalIsFresh
			? 'Последний сигнал устарел'
			: installation
				? INSTALLATION_LABELS[installation.state]
				: null
	const readinessChecks = getReadinessChecks(
		lifecycle,
		hasReviewedMobilePreview
	)
	const busyReason = hasLocalChanges
		? 'Сначала сохраните изменения формы в черновик.'
		: isPublishing
			? 'Публикация уже выполняется.'
			: isDiscarding
				? 'Изменения черновика уже отменяются.'
				: isCloning
					? 'Копия уже создаётся.'
					: isRestoring
						? 'Публикация уже переносится в черновик.'
						: 'Дождитесь завершения текущей операции.'
	const publishDisabled =
		isBusy ||
		!lifecycle.hasUnpublishedChanges ||
		!lifecycle.readiness.ready
	const publishDisabledReason = isBusy
		? busyReason
		: !lifecycle.hasUnpublishedChanges
			? 'В черновике нет новых изменений для публикации.'
			: blockers[0]?.message ||
				'Сначала завершите обязательные настройки виджета.'
	const installationCheckDisabled =
		isCheckingInstallation || installation?.state === 'DOMAIN_REQUIRED'
	const installationCheckDisabledReason = isCheckingInstallation
		? 'Проверка уже запущена — откройте или обновите страницу с виджетом.'
		: 'Сначала укажите домен установки виджета.'

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
						<ActionTooltip
							content="Публикует сохранённый черновик — после этого новые настройки появятся на сайте."
							disabled={publishDisabled}
							disabledContent={publishDisabledReason}
							placement="bottom"
							align="end"
							responsiveFill
						>
							<button
								type="button"
								className={styles.publishButton}
								onClick={onPublish}
								disabled={publishDisabled}
							>
								{isPublishing ? 'Публикуем…' : 'Опубликовать'}
							</button>
						</ActionTooltip>
						<ActionTooltip
							content="Создаёт независимую копию виджета с собственными настройками и публикацией."
							disabled={isBusy}
							disabledContent={busyReason}
							placement="bottom"
							align="end"
							responsiveFill
						>
							<button
								type="button"
								className={styles.secondaryButton}
								onClick={onClone}
								disabled={isBusy}
							>
								{isCloning ? 'Создаём копию…' : 'Создать копию'}
							</button>
						</ActionTooltip>
					</div>
				</div>

				<div className={styles.readiness}>
					<p className={styles.sectionTitle}>Перед публикацией</p>
					<ul className={styles.checkList}>
						{readinessChecks.map(check => (
							<li
								key={check.code}
								className={
									check.ready ? styles.checkReady : styles.checkPending
								}
							>
								{check.label}
							</li>
						))}
					</ul>
					{(blockers.length > 0 || warnings.length > 0) && (
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
					)}
				</div>

				{lifecycle.hasUnpublishedChanges &&
					lifecycle.publishedVersion > 0 && (
						<ActionTooltip
							content="Заменяет черновик последней опубликованной конфигурацией. Виджет на сайте не изменится."
							disabled={isBusy}
							disabledContent={busyReason}
							align="start"
						>
							<button
								type="button"
								className={styles.textButton}
								onClick={() => setConfirmation({ action: 'discard' })}
								disabled={isBusy}
							>
								Отменить изменения черновика
							</button>
						</ActionTooltip>
					)}

				<div className={styles.detailsGrid}>
					<details className={styles.details}>
						<summary className={styles.detailsSummary}>
							Проверка установки
							{installation && (
								<span
									className={
										installationSignalIsFresh
											? styles.inlineReady
											: styles.inlineMuted
									}
								>
									{installationLabel}
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
									<ul className={styles.diagnosticList}>
										<DiagnosticStatus
											label="Код установлен"
											ready={installationSignalIsFresh}
										/>
										<DiagnosticStatus
											label="Виджет активен"
											ready={lifecycle.isActive}
										/>
										<DiagnosticStatus
											label="Свежий сигнал получен"
											ready={installationSignalIsFresh}
										/>
										<DiagnosticStatus
											label={
												lifecycle.hasUnpublishedChanges
													? 'Настройки опубликованы, есть новый черновик'
													: 'Настройки опубликованы'
											}
											ready={lifecycle.publishedVersion > 0}
										/>
									</ul>
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
									<ActionTooltip
										content="Запускает ожидание нового сигнала со страницы, на которой установлен виджет."
										disabled={installationCheckDisabled}
										disabledContent={installationCheckDisabledReason}
										align="start"
										className={styles.detailsActionTooltip}
									>
										<button
											type="button"
											className={styles.secondaryButton}
											onClick={onCheckInstallation}
											disabled={installationCheckDisabled}
										>
											{isCheckingInstallation
												? 'Ждём сигнал…'
												: 'Проверить установку'}
										</button>
									</ActionTooltip>
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
									{analyticsUnavailableMessage}
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
											label={analytics.completionLabel}
											value={analytics.totals.submits}
											rate={analytics.conversion.submitRate}
										/>
									</div>
									{analytics.steps.length > 0 && (
										<div className={styles.stepFunnel}>
											<p className={styles.stepFunnelTitle}>
												{analytics.stepRateBasis === 'START'
													? 'Вовлечение в поля'
													: 'Прохождение по шагам'}
											</p>
											<ol className={styles.stepList}>
												{analytics.steps.map((step, index) => (
													<li key={step.key} className={styles.stepItem}>
														<div className={styles.stepName}>
															<span>{index + 1}</span>
															<strong>{step.label}</strong>
														</div>
														<div className={styles.stepValue}>
															<strong>{step.count}</strong>
															<small>
																{formatRate(step.conversionRate)} от
																{analytics.stepRateBasis === 'START'
																	? ' начавших расчёт'
																	: ' предыдущего этапа'}
															</small>
														</div>
													</li>
												))}
											</ol>
										</div>
									)}
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
													)}. Более ранние ${analytics.completionLabel.toLowerCase()} в эту воронку не включены.`
												: 'Сбор данных ещё не начался. Воронка заполнится после первого сигнала с сайта.'}
										</p>
									)}
									{!analytics.submitAvailable && (
										<p className={styles.notice}>
											Сейчас сбор контактов отключён. Последний этап
											воронки показывает завершения сценария, а не заявки.
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
													<strong>
														Публикация от{' '}
														{formatDateTime(version.createdAt)}
													</strong>
												</div>
												<ActionTooltip
													content="Копирует эту публикацию в черновик. На сайте ничего не изменится до новой публикации."
													disabled={
														isBusy ||
														version.version === lifecycle.publishedVersion
													}
													disabledContent={
														version.version === lifecycle.publishedVersion
															? 'Эта версия уже опубликована.'
															: busyReason
													}
													align="end"
												>
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
															version.version ===
																lifecycle.publishedVersion
														}
													>
														В черновик
													</button>
												</ActionTooltip>
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
					title="Восстановить выбранную публикацию?"
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

const DiagnosticStatus = ({
	label,
	ready
}: {
	label: string
	ready: boolean
}) => (
	<li className={ready ? styles.checkReady : styles.checkPending}>
		{label}
	</li>
)

export default WidgetExperiencePanel
