'use client'

import { countdownTimerService } from '@/entities/site-widget'
import {
	CountdownTimer,
	CountdownTimerConfig
} from '@/entities/site-widget'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import { ChangeEvent, useId, useState } from 'react'
import toast from 'react-hot-toast'
import DirectLinkQr from '../shared/DirectLinkQr'
import styles from '../shared/WidgetSettingsModal.module.scss'
import WidgetLivePreview from '../shared/WidgetLivePreview'
import type { WidgetSettingsPersistence } from '../shared/WidgetSettingsPersistence'

type Tab = 'main' | 'timer' | 'form' | 'integrations' | 'code' | 'info'
const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024

interface Props {
	timer: CountdownTimer
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: CountdownTimer) => void
	persistence?: WidgetSettingsPersistence<
		CountdownTimer,
		CountdownTimerConfig
	>
}

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Главные' },
	{ id: 'timer', label: 'Таймер' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Код' },
	{ id: 'info', label: 'Инфо' }
]

const getDefaultConfig = (): CountdownTimerConfig => ({
	color: '#4705fb',
	bgColor: '',
	buttonColor: '',
	openButtonColor: '',
	buttonSide: 'right',
	buttonPulse: true,
	buttonBottom: 3,
	buttonOffset: 3,
	buttonSize: 60,
	buttonImageUrl: '',
	autoOpenDelay: null,
	bubbleText: 'Акция',
	title: 'Скидка ограничена по времени',
	subtitle: 'Успейте воспользоваться предложением до окончания таймера',
	timerMode: 'EVERGREEN',
	deadlineAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
	evergreenDurationMinutes: 15,
	expiredBehavior: 'showExpired',
	expiredTitle: 'Акция завершена',
	expiredSubtitle: 'Предложение больше недоступно',
	dataType: 'NONE',
	contactTitle: 'Оставьте контакт, чтобы получить предложение',
	submitButtonText: 'Получить предложение',
	successTitle: 'Спасибо! Заявка отправлена',
	successSubtitle: 'Мы скоро свяжемся с вами',
	actionButtonText: 'Перейти к акции',
	actionButtonUrl: '',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	developInfoActive: true,
	filterDuplicates: false,
	submissionCooldownDays: 0,
	timerResetToken: '',
	integrations: {
		email: '',
		webhookUrl: '',
		telegramChatId: '',
		yandexMetrikaId: '',
		vkPixelId: '',
		bitrix24WebhookUrl: '',
		roistatEnabled: false,
		amoCrmDomain: '',
		amoCrmToken: ''
	}
})

const mergeConfig = (
	config: Partial<CountdownTimerConfig>
): CountdownTimerConfig => {
	const defaults = getDefaultConfig()
	return {
		...defaults,
		...config,
		integrations: {
			...defaults.integrations,
			...(config.integrations || {})
		}
	}
}

const clampNumber = (
	value: number,
	min: number,
	max: number,
	fallback: number
) => {
	const numeric = Number.isFinite(value) ? value : fallback
	return Math.min(max, Math.max(min, numeric))
}

const toOptionalNonNegativeInteger = (value: string) => {
	if (value.trim() === '') return null
	const parsed = parseInt(value)
	if (Number.isNaN(parsed)) return null
	return Math.max(0, parsed)
}

const toDateTimeLocal = (iso?: string) => {
	if (!iso) return ''
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
	return local.toISOString().slice(0, 16)
}

const fromDateTimeLocal = (value: string) =>
	value ? new Date(value).toISOString() : ''

const notifyTimerWidgetUpdated = (publicKey: string) => {
	if (typeof window === 'undefined') return
	window.dispatchEvent(
		new CustomEvent('winwidget:timer:updated', {
			detail: { key: publicKey }
		})
	)
	try {
		window.localStorage.setItem(
			`winwidget:timer:${publicKey}:updated`,
			String(Date.now())
		)
	} catch {}
}

const CountdownTimerSettingsModal = ({
	timer,
	canUseCustomButtonImage,
	onClose,
	onSaved,
	persistence
}: Props) => {
	const titleId = useId()
	const buttonImageInputId = useId()
	const [tab, setTab] = useState<Tab>('main')
	const [cfg, setCfg] = useState<CountdownTimerConfig>(
		mergeConfig(timer.config)
	)
	const [name, setName] = useState(timer.name)
	const [installDomain, setInstallDomain] = useState(
		timer.installDomain ?? ''
	)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [confirmResetTimers, setConfirmResetTimers] = useState(false)
	const [savedSnapshot, setSavedSnapshot] = useState(
		JSON.stringify({
			name: timer.name,
			installDomain: timer.installDomain ?? '',
			config: mergeConfig(timer.config)
		})
	)
	const currentSnapshot = JSON.stringify({
		name,
		installDomain,
		config: cfg
	})
	const hasUnsavedChanges = currentSnapshot !== savedSnapshot

	const mutation = useMutation({
		mutationFn: (data?: {
			name: string
			installDomain?: string
			config: CountdownTimerConfig
		}) =>
			(
				persistence?.update ??
				(payload =>
					countdownTimerService.updateCountdownTimer(timer.id, payload))
			)({
				name: data?.name ?? name,
				installDomain: data?.installDomain ?? installDomain,
				config: data?.config ?? cfg
			}),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			const nextConfig = mergeConfig(updated.config)
			toast.success('Сохранено', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setCfg(nextConfig)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: nextConfig
				})
			)
			onSaved({ ...updated, config: nextConfig })
			notifyTimerWidgetUpdated(timer.publicKey)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сохранения', {
				id: toastId
			})
		}
	})
	const buttonImageMutation = useMutation({
		mutationFn: (file: File) => {
			const formData = new FormData()
			formData.append('file', file)
			return persistence?.uploadButtonImage
				? persistence.uploadButtonImage(formData)
				: countdownTimerService.uploadButtonImage(timer.id, formData)
		},
		onMutate: () =>
			toast.loading('Загружаем картинку кнопки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			const nextConfig = mergeConfig(updated.config)
			toast.success('Картинка кнопки обновлена', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setCfg(nextConfig)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: nextConfig
				})
			)
			onSaved({ ...updated, config: nextConfig })
			notifyTimerWidgetUpdated(timer.publicKey)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка загрузки', {
				id: toastId
			})
		}
	})
	const isDangerActionPending =
		mutation.isPending || buttonImageMutation.isPending

	const set = (patch: Partial<CountdownTimerConfig>) =>
		setCfg(prev => ({ ...prev, ...patch }))

	const setIntegration = (key: string, value: string | boolean) =>
		setCfg(prev => ({
			...prev,
			integrations: { ...(prev.integrations || {}), [key]: value }
		}))

	const apiUrl =
		process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST ||
				'https://api.winwidget.ru'
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'
	const publicSiteUrl = (
		process.env.NEXT_PUBLIC_SITE_URL ||
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? 'https://winwidget.ru'
			: '')
	).replace(/\/$/, '')
	const embedCode = `<script src="${apiUrl}/widgets/timer.js" data-key="${timer.publicKey}" async></script>`
	const previewUrl = `${publicSiteUrl}/page-timer/${timer.publicKey}`
	const defaultButtonImageUrl = `${apiUrl}/widgets/timer-button.png`
	const buttonImagePreviewUrl = cfg.buttonImageUrl || defaultButtonImageUrl
	const buttonImageUploadDisabled =
		!canUseCustomButtonImage ||
		hasUnsavedChanges ||
		buttonImageMutation.isPending

	const handleButtonImageUpload = (
		event: ChangeEvent<HTMLInputElement>
	) => {
		const file = event.target.files?.[0]
		event.target.value = ''

		if (!file) return

		if (!canUseCustomButtonImage) {
			toast.error('Своя картинка кнопки доступна только на тарифе Hard')
			return
		}

		if (hasUnsavedChanges) {
			toast.error('Сначала сохраните текущие настройки виджета')
			return
		}

		if (file.type !== 'image/png') {
			toast.error('Загрузите картинку в формате PNG')
			return
		}

		if (file.size > BUTTON_IMAGE_MAX_SIZE_BYTES) {
			toast.error('Картинка кнопки должна быть не больше 200 КБ')
			return
		}

		buttonImageMutation.mutate(file)
	}

	const handleResetButtonImage = () => {
		const nextConfig = { ...cfg, buttonImageUrl: '' }
		setCfg(nextConfig)
		mutation.mutate({
			name: name.trim() || 'Таймер',
			config: nextConfig
		})
	}

	const handleSave = () => {
		const sanitizedName = name.trim() || 'Таймер'
		if (cfg.timerMode === 'FIXED_DATE' && !cfg.deadlineAt) {
			toast.error('Укажите дату окончания таймера')
			return
		}
		if (
			cfg.timerMode === 'EVERGREEN' &&
			(cfg.evergreenDurationMinutes < 1 ||
				cfg.evergreenDurationMinutes > 10080)
		) {
			toast.error(
				'Длительность персонального таймера: от 1 до 10080 минут'
			)
			return
		}
		if (
			cfg.submissionCooldownDays < 0 ||
			cfg.submissionCooldownDays > 365
		) {
			toast.error('Повторная заявка: введите число от 0 до 365')
			return
		}
		const sanitizedConfig: CountdownTimerConfig = {
			...cfg,
			submissionCooldownDays: Math.max(
				0,
				Math.min(365, cfg.submissionCooldownDays || 0)
			),
			actionButtonUrl: cfg.actionButtonUrl.trim(),
			actionButtonText: cfg.actionButtonText.trim() || 'Перейти к акции'
		}
		setName(sanitizedName)
		setCfg(sanitizedConfig)
		mutation.mutate({
			name: sanitizedName,
			installDomain,
			config: sanitizedConfig
		})
	}

	const handleResetDefaults = () => {
		const resetConfig = getDefaultConfig()
		setCfg(resetConfig)
		setConfirmResetDefaults(false)
		mutation.mutate({ name, config: resetConfig })
	}

	const handleResetTimers = () => {
		const token =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: String(Date.now())
		const nextConfig = { ...cfg, timerResetToken: token }
		setCfg(nextConfig)
		setConfirmResetTimers(false)
		mutation.mutate({ name, config: nextConfig })
	}

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть"
			/>
			<div
				className={styles.modal}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
			>
				<button
					type="button"
					className={styles.closeBtn}
					onClick={onClose}
					aria-label="Закрыть"
				>
					✕
				</button>
				<h2 id={titleId} className={styles.modalTitle}>
					Настройки
				</h2>
				<div className={styles.tabs} role="tablist">
					{TABS.map(t => (
						<button
							key={t.id}
							role="tab"
							aria-selected={tab === t.id}
							className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
							onClick={() => setTab(t.id)}
						>
							{t.label}
						</button>
					))}
				</div>

				<WidgetLivePreview
					type="timer"
					config={cfg}
					isHardPlan={canUseCustomButtonImage}
				/>

				<div className={styles.tabContent}>
					{tab === 'main' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Внешний вид</h3>
								<div className={styles.field}>
									<p className={styles.label}>Название виджета:</p>
									<input
										className={styles.input}
										value={name}
										onChange={e => setName(e.target.value)}
										maxLength={50}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Основной цвет:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={cfg.color || '#4705fb'}
											onChange={e => set({ color: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.color || '#4705fb'}
											onChange={e => set({ color: e.target.value })}
										/>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Цвет кнопки открытия:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={cfg.openButtonColor || cfg.color || '#4705fb'}
											onChange={e =>
												set({ openButtonColor: e.target.value })
											}
										/>
										<input
											className={styles.input}
											value={cfg.openButtonColor || ''}
											onChange={e =>
												set({ openButtonColor: e.target.value })
											}
											placeholder="Как основной цвет"
										/>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Картинка кнопки открытия:</p>
									<div className={styles.buttonImageBox}>
										<div className={styles.buttonImagePreview}>
											<Image
												src={buttonImagePreviewUrl}
												alt="Картинка кнопки открытия"
												width={80}
												height={80}
												unoptimized
											/>
										</div>
										<div className={styles.buttonImageContent}>
											<p className={styles.hint}>
												PNG с прозрачным фоном, до 320x320 px и до 200 КБ.
											</p>
											<p className={styles.hint}>
												После загрузки обновите страницу с установленным
												виджетом. Если кнопка осталась старой, выполните
												жёсткое обновление: Ctrl+F5 или Cmd+Shift+R.
											</p>
											<div className={styles.buttonImageActions}>
												<label
													htmlFor={buttonImageInputId}
													className={`${styles.copyBtn} ${
														buttonImageUploadDisabled
															? styles.buttonImageUploadDisabled
															: ''
													}`}
												>
													Загрузить PNG
												</label>
												<input
													id={buttonImageInputId}
													type="file"
													accept="image/png"
													className={styles.fileInput}
													disabled={buttonImageUploadDisabled}
													onChange={handleButtonImageUpload}
												/>
												{cfg.buttonImageUrl && (
													<button
														type="button"
														className={styles.resetAttemptsBtn}
														disabled={isDangerActionPending}
														onClick={handleResetButtonImage}
													>
														Вернуть стандартную
													</button>
												)}
											</div>
											{!canUseCustomButtonImage && (
												<p className={styles.domainHint}>
													Своя картинка кнопки доступна только на активном
													тарифе Hard.
												</p>
											)}
											{canUseCustomButtonImage && hasUnsavedChanges && (
												<p className={styles.hint}>
													Перед загрузкой картинки сохраните текущие
													настройки.
												</p>
											)}
										</div>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Цвет фона окна:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={cfg.bgColor || '#ffffff'}
											onChange={e => set({ bgColor: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.bgColor || ''}
											onChange={e => set({ bgColor: e.target.value })}
											placeholder="По умолчанию"
										/>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Сторона экрана:</p>
									<select
										className={styles.input}
										value={cfg.buttonSide}
										onChange={e =>
											set({
												buttonSide: e.target.value as 'left' | 'right'
											})
										}
									>
										<option value="right">Справа</option>
										<option value="left">Слева</option>
									</select>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Высота кнопки от низа экрана:{' '}
										<strong>{cfg.buttonBottom ?? 3}%</strong>
									</p>
									<input
										type="range"
										min={1}
										max={50}
										value={cfg.buttonBottom ?? 3}
										onChange={e =>
											set({ buttonBottom: Number(e.target.value) })
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Отступ от нижнего края экрана в процентах. 3 — почти
										внизу, 50 — по центру.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отступ кнопки от края экрана:{' '}
										<strong>{cfg.buttonOffset ?? 3}%</strong>
									</p>
									<input
										type="range"
										min={1}
										max={50}
										value={cfg.buttonOffset ?? 3}
										onChange={e =>
											set({ buttonOffset: Number(e.target.value) })
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Отступ кнопки от левого или правого края экрана в
										процентах. 3 — почти у края, 50 — по центру.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Размер кнопки открытия:{' '}
										<strong>{cfg.buttonSize}px</strong>
									</p>
									<input
										type="range"
										min={40}
										max={100}
										value={cfg.buttonSize}
										onChange={e =>
											set({ buttonSize: parseInt(e.target.value) || 60 })
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Размер плавающей кнопки в пикселях. По умолчанию 60px.
									</p>
								</div>

								<div className={styles.field}>
									<div className={styles.checkRow}>
										<input
											id="timer-button-pulse"
											type="checkbox"
											checked={cfg.buttonPulse !== false}
											onChange={e =>
												set({ buttonPulse: e.target.checked })
											}
										/>
										<label
											htmlFor="timer-button-pulse"
											className={styles.checkLabel}
										>
											Пульсация кнопки
										</label>
									</div>
									<p className={styles.hint}>
										Дополнительный эффект свечения на плавающей кнопке.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Появление</h3>
								<div className={styles.field}>
									<p className={styles.label}>Автооткрытие, секунд:</p>
									<input
										className={styles.input}
										type="number"
										min={0}
										value={cfg.autoOpenDelay ?? ''}
										placeholder="Не открывать автоматически"
										onChange={e =>
											set({
												autoOpenDelay: toOptionalNonNegativeInteger(
													e.target.value
												)
											})
										}
									/>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Опасные действия
								</h3>
								<div className={styles.dangerActions}>
									{confirmResetDefaults ? (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все настройки будут заменены на стандартные.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													onClick={handleResetDefaults}
													disabled={isDangerActionPending}
												>
													Да, сбросить
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													disabled={isDangerActionPending}
													onClick={() => setConfirmResetDefaults(false)}
												>
													Отмена
												</button>
											</div>
										</div>
									) : (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmResetDefaults(true)}
											disabled={isDangerActionPending}
										>
											Сбросить все настройки до значений по умолчанию
										</button>
									)}

									{confirmResetTimers ? (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Персональный отсчёт начнётся заново у всех
												посетителей.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													onClick={handleResetTimers}
													disabled={isDangerActionPending}
												>
													Подтвердить сброс
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													disabled={isDangerActionPending}
													onClick={() => setConfirmResetTimers(false)}
												>
													Отмена
												</button>
											</div>
										</div>
									) : (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmResetTimers(true)}
											disabled={isDangerActionPending}
										>
											Сбросить персональные таймеры для всех посетителей
										</button>
									)}
								</div>
							</div>
						</div>
					)}

					{tab === 'timer' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Сценарий отсчёта
								</h3>
								<div className={styles.field}>
									<p className={styles.label}>Режим таймера:</p>
									<select
										className={styles.input}
										value={cfg.timerMode}
										onChange={e =>
											set({
												timerMode: e.target
													.value as CountdownTimerConfig['timerMode']
											})
										}
									>
										<option value="EVERGREEN">
											Персональный для каждого посетителя
										</option>
										<option value="FIXED_DATE">
											Общий дедлайн по дате
										</option>
									</select>
									<p className={styles.hint}>
										{cfg.timerMode === 'EVERGREEN'
											? 'Персональный режим запускает отдельный отсчёт для каждого нового посетителя. Например, если указать 15 минут, каждый человек увидит свои 15 минут с момента первого открытия виджета.'
											: 'Общий дедлайн показывает одну дату окончания для всех посетителей. Таймер закончится одновременно у всех, независимо от того, когда человек открыл сайт.'}
									</p>
								</div>
								{cfg.timerMode === 'FIXED_DATE' ? (
									<div className={styles.field}>
										<p className={styles.label}>Дата окончания:</p>
										<input
											className={styles.input}
											type="datetime-local"
											value={toDateTimeLocal(cfg.deadlineAt)}
											onChange={e =>
												set({
													deadlineAt: fromDateTimeLocal(e.target.value)
												})
											}
										/>
										<p className={styles.hint}>
											Подходит для акции, вебинара или запуска, у которых
											есть точная дата завершения.
											<br />
											Дата указывается по вашему текущему часовому поясу и
											становится единым моментом окончания для всех
											посетителей.
										</p>
									</div>
								) : (
									<div className={styles.field}>
										<p className={styles.label}>
											Длительность таймера, минут:
										</p>
										<input
											className={styles.input}
											type="number"
											min={1}
											max={10080}
											value={cfg.evergreenDurationMinutes}
											onChange={e =>
												set({
													evergreenDurationMinutes: clampNumber(
														Number(e.target.value),
														1,
														10080,
														15
													)
												})
											}
										/>
										<p className={styles.hint}>
											Подходит для персонального предложения: отсчёт
											начинается заново для каждого посетителя.
										</p>
									</div>
								)}
								<div className={styles.field}>
									<p className={styles.label}>После окончания:</p>
									<select
										className={styles.input}
										value={cfg.expiredBehavior}
										onChange={e =>
											set({
												expiredBehavior: e.target
													.value as CountdownTimerConfig['expiredBehavior']
											})
										}
									>
										<option value="showExpired">
											Показать сообщение о завершении
										</option>
										<option value="hide">Скрыть виджет</option>
										<option value="disableForm">
											Отключить форму, оставить ссылку
										</option>
									</select>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок завершения:</p>
									<input
										className={styles.input}
										value={cfg.expiredTitle}
										onChange={e => set({ expiredTitle: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Текст завершения:</p>
									<textarea
										className={styles.textarea}
										value={cfg.expiredSubtitle}
										onChange={e =>
											set({ expiredSubtitle: e.target.value })
										}
									/>
								</div>
							</div>
						</div>
					)}

					{tab === 'form' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Тексты</h3>
								<div className={styles.field}>
									<p className={styles.label}>Текст у кнопки:</p>
									<input
										className={styles.input}
										value={cfg.bubbleText}
										onChange={e => set({ bubbleText: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок:</p>
									<input
										className={styles.input}
										value={cfg.title}
										onChange={e => set({ title: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Описание:</p>
									<textarea
										className={styles.textarea}
										value={cfg.subtitle}
										onChange={e => set({ subtitle: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Ссылка на товар или акцию:
									</p>
									<input
										className={styles.input}
										value={cfg.actionButtonUrl}
										onChange={e =>
											set({ actionButtonUrl: e.target.value })
										}
										placeholder="https://example.ru/product"
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Текст кнопки ссылки:</p>
									<input
										className={styles.input}
										value={cfg.actionButtonText}
										onChange={e =>
											set({ actionButtonText: e.target.value })
										}
									/>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Сбор контактов
								</h3>
								<div className={styles.field}>
									<p className={styles.label}>Что запрашивать:</p>
									<select
										className={styles.input}
										value={cfg.dataType}
										onChange={e =>
											set({
												dataType: e.target
													.value as CountdownTimerConfig['dataType']
											})
										}
									>
										<option value="NONE">Не собирать контакты</option>
										<option value="PHONE">Телефон</option>
										<option value="EMAIL">Email</option>
										<option value="PHONE_AND_EMAIL">
											Телефон и email
										</option>
									</select>
								</div>
								{cfg.dataType !== 'NONE' && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>Заголовок формы:</p>
											<input
												className={styles.input}
												value={cfg.contactTitle}
												onChange={e =>
													set({ contactTitle: e.target.value })
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Текст кнопки отправки:
											</p>
											<input
												className={styles.input}
												value={cfg.submitButtonText}
												onChange={e =>
													set({ submitButtonText: e.target.value })
												}
											/>
										</div>
										<div className={styles.checkRow}>
											<input
												id="timer-filter-duplicates"
												type="checkbox"
												checked={cfg.filterDuplicates}
												onChange={e =>
													set({ filterDuplicates: e.target.checked })
												}
											/>
											<label
												htmlFor="timer-filter-duplicates"
												className={styles.checkLabel}
											>
												Не принимать повторные заявки
											</label>
										</div>
										{cfg.filterDuplicates && (
											<div className={styles.field}>
												<p className={styles.label}>
													Повторная заявка — раз в N дней:
												</p>
												<input
													className={styles.input}
													type="number"
													min={0}
													max={365}
													value={cfg.submissionCooldownDays}
													onChange={e =>
														set({
															submissionCooldownDays: clampNumber(
																parseInt(e.target.value) || 0,
																0,
																365,
																0
															)
														})
													}
												/>
												<p className={styles.hint}>
													0 — повторная заявка запрещена до сброса
													персональных таймеров.
												</p>
											</div>
										)}
										<div className={styles.field}>
											<p className={styles.label}>
												Ссылка на согласие обработки данных:
											</p>
											<input
												className={styles.input}
												value={cfg.privacyUrl}
												onChange={e => set({ privacyUrl: e.target.value })}
											/>
										</div>
									</>
								)}
							</div>

							{cfg.dataType !== 'NONE' && (
								<div className={styles.settingsGroup}>
									<h3 className={styles.settingsGroupTitle}>
										После отправки
									</h3>
									<div className={styles.field}>
										<p className={styles.label}>Заголовок:</p>
										<input
											className={styles.input}
											value={cfg.successTitle}
											onChange={e => set({ successTitle: e.target.value })}
										/>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Подзаголовок:</p>
										<textarea
											className={styles.textarea}
											value={cfg.successSubtitle}
											onChange={e =>
												set({ successSubtitle: e.target.value })
											}
										/>
									</div>
								</div>
							)}
						</div>
					)}

					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Уведомления</h3>
								<div className={styles.field}>
									<p className={styles.label}>Email для заявок:</p>
									<input
										className={styles.input}
										value={cfg.integrations.email || ''}
										onChange={e => setIntegration('email', e.target.value)}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Webhook:</p>
									<input
										className={styles.input}
										value={cfg.integrations.webhookUrl || ''}
										onChange={e =>
											setIntegration('webhookUrl', e.target.value)
										}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Telegram chat ID:</p>
									<input
										className={styles.input}
										value={cfg.integrations.telegramChatId || ''}
										onChange={e =>
											setIntegration('telegramChatId', e.target.value)
										}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Яндекс.Метрика ID:</p>
									<input
										className={styles.input}
										value={cfg.integrations.yandexMetrikaId || ''}
										onChange={e =>
											setIntegration('yandexMetrikaId', e.target.value)
										}
									/>
								</div>
							</div>
						</div>
					)}

					{tab === 'code' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Код виджета</h3>
								<div className={styles.field}>
									<label
										className={styles.label}
										htmlFor={`${titleId}-install-domain`}
									>
										Домен установки виджета
									</label>
									<input
										id={`${titleId}-install-domain`}
										className={styles.input}
										value={installDomain}
										placeholder="site.ru"
										onChange={e => setInstallDomain(e.target.value)}
									/>
									<p className={styles.domainHint}>
										Указанный домен сайта и сайт, на который фактически
										будет добавлен код виджета, должны совпадать, иначе
										виджет не появится после добавления кода. Прямая ссылка
										и QR-код работают без указания домена. Формат
										добавления домена: https://page.example.ru,
										https://example.ru, www.example.ru, example.ru
									</p>
								</div>
								<div className={styles.field}>
									<textarea
										className={`${styles.textarea} ${styles.codeArea}`}
										readOnly
										value={embedCode}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() => {
											navigator.clipboard.writeText(embedCode)
											toast.success('Код скопирован')
										}}
									>
										Скопировать код
									</button>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Прямая ссылка
								</h3>
								<div className={styles.field}>
									<div className={styles.directLink}>
										<input
											className={styles.input}
											readOnly
											value={previewUrl}
										/>
										<a
											className={styles.openLink}
											href={previewUrl}
											target="_blank"
											rel="noopener noreferrer"
										>
											Открыть
										</a>
									</div>
									<DirectLinkQr
										value={previewUrl}
										downloadName={`winwidget-timer-${timer.publicKey}.png`}
									/>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Как работает таймер
								</h3>
								<p className={styles.infoText}>
									Таймер показывает ограниченное по времени предложение:
									фиксированную дату окончания или персональный
									evergreen-отсчёт для каждого посетителя. После заявки
									данные сохраняются в кабинете и отправляются в
									интеграции.
								</p>
								<ul className={styles.infoList}>
									<li>
										В «Главных» настройте внешний вид, кнопку открытия и
										текст предложения.
									</li>
									<li>
										В «Таймере» выберите режим, длительность и поведение
										после окончания.
									</li>
									<li>
										В «Форме» включите сбор контактов или оставьте только
										кнопку перехода.
									</li>
									<li>
										В «Коде» скопируйте скрипт на сайт или откройте прямую
										ссылку.
									</li>
								</ul>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Что проверить перед запуском
								</h3>
								<ul className={styles.infoList}>
									<li>
										Убедитесь, что срок акции и часовой пояс соответствуют
										реальному предложению.
									</li>
									<li>
										Проверьте текст состояния после окончания таймера.
									</li>
									<li>
										Если собираете контакты, отправьте тестовую заявку.
									</li>
									<li>
										Откройте виджет на мобильном и проверьте, что кнопка не
										перекрывает важные элементы сайта.
									</li>
								</ul>
							</div>
						</div>
					)}
				</div>

				<div className={styles.stickyFooter}>
					<p
						className={`${styles.saveStatus} ${
							hasUnsavedChanges ? styles.saveStatusDirty : ''
						}`}
					>
						{hasUnsavedChanges
							? 'Есть несохранённые изменения'
							: 'Изменений нет'}
					</p>
					<div className={styles.footerActions}>
						<button
							type="button"
							className={styles.cancelBtn}
							onClick={onClose}
							disabled={mutation.isPending}
						>
							Отмена
						</button>
						<button
							type="button"
							className={styles.saveBtn}
							onClick={handleSave}
							disabled={mutation.isPending || !hasUnsavedChanges}
						>
							{mutation.isPending ? 'Сохранение...' : 'Сохранить'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default CountdownTimerSettingsModal
