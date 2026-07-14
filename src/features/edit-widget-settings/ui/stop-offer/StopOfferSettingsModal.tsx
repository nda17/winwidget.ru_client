'use client'

import { stopOfferService } from '@/entities/site-widget'
import { StopOffer, StopOfferConfig } from '@/entities/site-widget'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import DirectLinkQr from '../shared/DirectLinkQr'
import styles from '../shared/WidgetSettingsModal.module.scss'
import WidgetLivePreview from '../shared/WidgetLivePreview'

type Tab = 'main' | 'trigger' | 'form' | 'integrations' | 'code' | 'info'

interface Props {
	stopOffer: StopOffer
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: StopOffer) => void
}

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Главные' },
	{ id: 'trigger', label: 'Показ' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Код' },
	{ id: 'info', label: 'Инфо' }
]

const getDefaultConfig = (): StopOfferConfig => ({
	color: '#4705fb',
	bgColor: '',
	buttonColor: '',
	autoOpenDelay: null,
	desktopExitIntent: true,
	mobileAutoOpenDelay: 8,
	scrollPercent: 70,
	showOnce: true,
	displayCooldownDays: 7,
	displayResetToken: '',
	hideIfSubmitted: true,
	badgeText: 'Подождите',
	title: 'Персональное предложение',
	subtitle: 'Оставьте контакт или перейдите к предложению прямо сейчас',
	offerText: 'Скидка 10%',
	dataType: 'PHONE',
	contactTitle: 'Куда отправить скидку?',
	submitButtonText: 'Забрать скидку',
	successTitle: 'Спасибо! Скидка закреплена',
	successSubtitle: 'Мы скоро свяжемся с вами',
	actionButtonEnabled: false,
	actionButtonText: 'Перейти к акции',
	actionButtonUrl: '',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	developInfoActive: true,
	filterDuplicates: true,
	submissionCooldownDays: 0,
	submissionResetToken: '',
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

const HEX_COLOR_REGEXP = /^#[0-9a-fA-F]{6}$/

const getColorPickerValue = (value: string, fallback: string) =>
	HEX_COLOR_REGEXP.test(value) ? value : fallback

const mergeConfig = (
	config: Partial<StopOfferConfig>
): StopOfferConfig => {
	const defaults = getDefaultConfig()
	const nextConfig = { ...config } as Partial<StopOfferConfig> & {
		resetToken?: string
	}
	delete nextConfig.resetToken
	return {
		...defaults,
		...nextConfig,
		integrations: {
			...defaults.integrations,
			...(nextConfig.integrations || {})
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

const toOptionalNumber = (
	value: string,
	min = Number.NEGATIVE_INFINITY,
	max = Number.POSITIVE_INFINITY
) => {
	if (value.trim() === '') return null
	const numeric = Number(value)
	if (!Number.isFinite(numeric)) return null
	return Math.min(max, Math.max(min, numeric))
}

const createResetToken = () =>
	`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const notifyStopOfferUpdated = (publicKey: string) => {
	if (typeof window === 'undefined') return
	window.dispatchEvent(
		new CustomEvent('winwidget:stop-offer:updated', {
			detail: { key: publicKey }
		})
	)
	try {
		window.localStorage.setItem(
			`winwidget:stop-offer:${publicKey}:updated`,
			String(Date.now())
		)
	} catch {}
}

const StopOfferSettingsModal = ({
	stopOffer,
	canUseCustomButtonImage,
	onClose,
	onSaved
}: Props) => {
	const titleId = useId()
	const [tab, setTab] = useState<Tab>('main')
	const [cfg, setCfg] = useState<StopOfferConfig>(
		mergeConfig(stopOffer.config)
	)
	const [name, setName] = useState(stopOffer.name)
	const [installDomain, setInstallDomain] = useState(
		stopOffer.installDomain ?? ''
	)
	const [confirmResetShows, setConfirmResetShows] = useState(false)
	const [confirmResetSubmissions, setConfirmResetSubmissions] =
		useState(false)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [savedSnapshot, setSavedSnapshot] = useState(
		JSON.stringify({
			name: stopOffer.name,
			installDomain: stopOffer.installDomain ?? '',
			config: mergeConfig(stopOffer.config)
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
			config: StopOfferConfig
		}) =>
			stopOfferService.updateStopOffer(stopOffer.id, {
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
			notifyStopOfferUpdated(stopOffer.publicKey)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сохранения', {
				id: toastId
			})
		}
	})
	const isDangerActionPending = mutation.isPending

	const set = (patch: Partial<StopOfferConfig>) =>
		setCfg(prev => ({ ...prev, ...patch }))

	const setIntegration = (
		key: keyof StopOfferConfig['integrations'],
		value: string | boolean
	) =>
		setCfg(prev => ({
			...prev,
			integrations: {
				...prev.integrations,
				[key]: value
			}
		}))

	const publicSiteUrl = (
		process.env.NEXT_PUBLIC_SITE_URL ||
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? 'https://winwidget.ru'
			: 'http://localhost:3000')
	).replace(/\/$/, '')
	const apiUrl = (
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'https://winwidget.ru'
	).replace(/\/$/, '')
	const embedCode = `<script src="${apiUrl}/widgets/stop-offer.js" data-key="${stopOffer.publicKey}" async></script>`
	const previewUrl = `${publicSiteUrl}/page-stop-offer/${stopOffer.publicKey}`

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			toast.success('Скопировано')
		} catch {
			toast.error('Не удалось скопировать')
		}
	}

	const save = () => {
		const sanitizedConfig: StopOfferConfig = {
			...cfg,
			autoOpenDelay:
				cfg.autoOpenDelay !== null && cfg.autoOpenDelay < 0
					? null
					: cfg.autoOpenDelay,
			mobileAutoOpenDelay: Math.max(
				1,
				Number(cfg.mobileAutoOpenDelay) || 8
			),
			scrollPercent: Math.min(
				100,
				Math.max(1, Number(cfg.scrollPercent) || 70)
			),
			displayCooldownDays: Math.max(
				0,
				Math.min(365, Number(cfg.displayCooldownDays) || 0)
			),
			submissionCooldownDays: Math.max(
				0,
				Math.min(365, Number(cfg.submissionCooldownDays) || 0)
			)
		}
		mutation.mutate({ name, installDomain, config: sanitizedConfig })
	}

	const handleResetShows = () => {
		const nextConfig = {
			...cfg,
			displayResetToken: createResetToken()
		}
		setCfg(nextConfig)
		setConfirmResetShows(false)
		mutation.mutate({ name, installDomain, config: nextConfig })
	}

	const handleResetSubmissions = () => {
		const nextConfig = {
			...cfg,
			submissionResetToken: createResetToken()
		}
		setCfg(nextConfig)
		setConfirmResetSubmissions(false)
		mutation.mutate({ name, installDomain, config: nextConfig })
	}

	const handleResetDefaults = () => {
		const nextConfig = getDefaultConfig()
		setCfg(nextConfig)
		setConfirmResetDefaults(false)
		mutation.mutate({ name, installDomain, config: nextConfig })
	}

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть настройки стоп-оффера"
			/>
			<div className={styles.modal} role="dialog" aria-modal="true">
				<button
					type="button"
					className={styles.closeBtn}
					onClick={onClose}
					aria-label="Закрыть"
				>
					✕
				</button>
				<h2 id={titleId} className={styles.modalTitle}>
					Настройки стоп-оффера
				</h2>

				<div className={styles.tabs}>
					{TABS.map(t => (
						<button
							type="button"
							key={t.id}
							className={`${styles.tab} ${
								tab === t.id ? styles.tabActive : ''
							}`}
							onClick={() => setTab(t.id)}
						>
							{t.label}
						</button>
					))}
				</div>

				<WidgetLivePreview
					type="stopOffer"
					config={cfg}
					isHardPlan={canUseCustomButtonImage}
				/>

				<div className={styles.tabContent}>
					{tab === 'main' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Основное</h3>
								<div className={styles.field}>
									<p className={styles.label}>Название</p>
									<input
										className={styles.input}
										value={name}
										onChange={e => setName(e.target.value)}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Домен установки виджета</p>
									<input
										className={styles.input}
										value={installDomain}
										placeholder="example.com"
										onChange={e => setInstallDomain(e.target.value)}
									/>
									<p className={styles.domainHint}>
										Стоп-оффер будет работать только на этом домене.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Акцентный цвет</p>
									<div className={styles.colorRow}>
										<input
											className={styles.colorPicker}
											type="color"
											value={cfg.color}
											onChange={e => set({ color: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.color}
											onChange={e => set({ color: e.target.value })}
										/>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Цвет кнопки</p>
									<div className={styles.colorRow}>
										<input
											className={styles.colorPicker}
											type="color"
											value={cfg.buttonColor || cfg.color}
											onChange={e => set({ buttonColor: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.buttonColor}
											placeholder="По умолчанию акцентный цвет"
											onChange={e => set({ buttonColor: e.target.value })}
										/>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Фон попапа</p>
									<div className={styles.colorRow}>
										<input
											className={styles.colorPicker}
											type="color"
											value={getColorPickerValue(cfg.bgColor, '#ffffff')}
											onChange={e => set({ bgColor: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.bgColor}
											placeholder="#ffffff"
											onChange={e => set({ bgColor: e.target.value })}
										/>
									</div>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Тексты</h3>
								<div className={styles.field}>
									<p className={styles.label}>Бейдж</p>
									<input
										className={styles.input}
										value={cfg.badgeText}
										onChange={e => set({ badgeText: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Оффер</p>
									<input
										className={styles.input}
										value={cfg.offerText}
										onChange={e => set({ offerText: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок</p>
									<input
										className={styles.input}
										value={cfg.title}
										onChange={e => set({ title: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок</p>
									<textarea
										className={styles.textarea}
										value={cfg.subtitle}
										onChange={e => set({ subtitle: e.target.value })}
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
												Все настройки стоп-оффера будут заменены на
												стандартные. Название и домен установки останутся
												без изменений.
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
													onClick={() => setConfirmResetDefaults(false)}
													disabled={isDangerActionPending}
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
								</div>
							</div>
						</div>
					)}

					{tab === 'trigger' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Условия показа
								</h3>
								<div className={styles.field}>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={cfg.desktopExitIntent}
											onChange={e =>
												set({ desktopExitIntent: e.target.checked })
											}
										/>
										<span className={styles.checkLabel}>
											Показывать при попытке ухода с сайта
										</span>
									</label>
									<p className={styles.hint}>
										На компьютерах стоп-оффер откроется, когда посетитель
										ведёт курсор к верхнему краю страницы, как перед
										закрытием вкладки.
									</p>
								</div>
								<div className={styles.field}>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={cfg.showOnce}
											onChange={e => set({ showOnce: e.target.checked })}
										/>
										<span className={styles.checkLabel}>
											Ограничивать повторный показ
										</span>
									</label>
									<p className={styles.hint}>
										Если включено, виджет запомнит показ в браузере и не
										будет появляться снова указанное количество дней.
									</p>
								</div>
								{cfg.showOnce && (
									<div className={styles.field}>
										<p className={styles.label}>
											Показывать повторно через N дней
										</p>
										<input
											className={styles.input}
											type="number"
											min={0}
											max={365}
											value={cfg.displayCooldownDays}
											onChange={e =>
												set({
													displayCooldownDays: clampNumber(
														Number(e.target.value),
														0,
														365,
														0
													)
												})
											}
										/>
										<p className={styles.hint}>
											Через сколько дней после показа можно снова показать
											оффер тому же посетителю. 0 — не показывать снова до
											сброса истории показов.
										</p>
									</div>
								)}
								<div className={styles.field}>
									<p className={styles.label}>Автопоказ через, сек</p>
									<input
										className={styles.input}
										type="number"
										min={0}
										placeholder="Отключено"
										value={cfg.autoOpenDelay ?? ''}
										onChange={e =>
											set({
												autoOpenDelay: toOptionalNumber(e.target.value, 0)
											})
										}
									/>
									<p className={styles.hint}>
										Через сколько секунд после загрузки страницы открыть
										стоп-оффер автоматически. Пусто — автопоказ по таймеру
										выключен.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Мобильный показ через, сек
									</p>
									<input
										className={styles.input}
										type="number"
										min={1}
										value={cfg.mobileAutoOpenDelay}
										onChange={e =>
											set({
												mobileAutoOpenDelay: Math.max(
													1,
													Number(e.target.value) || 1
												)
											})
										}
									/>
									<p className={styles.hint}>
										На телефонах попытку ухода определить нельзя, поэтому
										стоп-оффер открывается по таймеру.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Показ после скролла, %</p>
									<input
										className={styles.input}
										type="number"
										min={1}
										max={100}
										value={cfg.scrollPercent}
										onChange={e =>
											set({
												scrollPercent: clampNumber(
													Number(e.target.value),
													1,
													100,
													70
												)
											})
										}
									/>
									<p className={styles.hint}>
										Стоп-оффер откроется, когда посетитель прокрутит
										страницу до указанного процента. Например, 70 —
										примерно две трети страницы.
									</p>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Сброс показов
								</h3>
								<p className={styles.hint}>
									Сброс нужен, если оффер изменился и его нужно снова
									показать посетителям, которые уже видели старую версию.
								</p>
								{confirmResetShows ? (
									<div className={styles.dangerItem}>
										<p className={styles.hint}>
											После подтверждения оффер снова сможет показаться
											посетителям, которые уже видели его раньше.
										</p>
										<div className={styles.footerActions}>
											<button
												type="button"
												className={styles.resetAttemptsBtn}
												onClick={handleResetShows}
												disabled={isDangerActionPending}
											>
												Подтвердить сброс
											</button>
											<button
												type="button"
												className={styles.cancelBtn}
												onClick={() => setConfirmResetShows(false)}
												disabled={isDangerActionPending}
											>
												Отмена
											</button>
										</div>
									</div>
								) : (
									<button
										type="button"
										className={styles.resetAttemptsBtn}
										onClick={() => setConfirmResetShows(true)}
										disabled={isDangerActionPending}
									>
										Сбросить историю показов
									</button>
								)}
							</div>
						</div>
					)}

					{tab === 'form' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Форма</h3>
								<div className={styles.field}>
									<p className={styles.label}>Тип сбора данных</p>
									<select
										className={styles.input}
										value={cfg.dataType}
										onChange={e =>
											set({
												dataType: e.target
													.value as StopOfferConfig['dataType']
											})
										}
									>
										<option value="PHONE">Телефон</option>
										<option value="EMAIL">Email</option>
										<option value="PHONE_AND_EMAIL">
											Телефон и email
										</option>
										<option value="NONE">Без сбора контактов</option>
									</select>
								</div>
								{cfg.dataType !== 'NONE' ? (
									<>
										<div className={styles.field}>
											<p className={styles.label}>Заголовок формы</p>
											<input
												className={styles.input}
												value={cfg.contactTitle}
												onChange={e =>
													set({ contactTitle: e.target.value })
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Текст кнопки</p>
											<input
												className={styles.input}
												value={cfg.submitButtonText}
												onChange={e =>
													set({
														submitButtonText: e.target.value
													})
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Заголовок успеха</p>
											<input
												className={styles.input}
												value={cfg.successTitle}
												onChange={e =>
													set({ successTitle: e.target.value })
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Текст успеха</p>
											<textarea
												className={styles.textarea}
												value={cfg.successSubtitle}
												onChange={e =>
													set({
														successSubtitle: e.target.value
													})
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Ссылка на политику</p>
											<input
												className={styles.input}
												value={cfg.privacyUrl}
												onChange={e => set({ privacyUrl: e.target.value })}
											/>
										</div>
									</>
								) : (
									<p className={styles.hint}>
										Форма контактов отключена. Посетитель увидит оффер и
										кнопку перехода, если она заполнена.
									</p>
								)}
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Кнопка перехода
								</h3>
								<div className={styles.field}>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={cfg.actionButtonEnabled}
											onChange={e =>
												set({
													actionButtonEnabled: e.target.checked
												})
											}
										/>
										<span className={styles.checkLabel}>
											Показывать кнопку перехода
										</span>
									</label>
									<p className={styles.hint}>
										Если выключить, кнопка не появится в попапе и после
										отправки формы. Текст и ссылка останутся в настройках.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Текст кнопки</p>
									<input
										className={styles.input}
										value={cfg.actionButtonText}
										onChange={e =>
											set({
												actionButtonText: e.target.value
											})
										}
									/>
									<p className={styles.hint}>
										Подпись кнопки, которая ведёт посетителя на страницу
										акции или предложения.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Ссылка</p>
									<input
										className={styles.input}
										value={cfg.actionButtonUrl}
										placeholder="https://example.com/sale"
										onChange={e =>
											set({
												actionButtonUrl: e.target.value
											})
										}
									/>
									<p className={styles.hint}>
										Без ссылки кнопка не будет показана, даже если
										переключатель включён.
									</p>
								</div>
							</div>
							{cfg.dataType !== 'NONE' && (
								<div className={styles.settingsGroup}>
									<h3 className={styles.settingsGroupTitle}>
										Повторные заявки
									</h3>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={cfg.hideIfSubmitted}
											onChange={e =>
												set({ hideIfSubmitted: e.target.checked })
											}
										/>
										<span className={styles.checkLabel}>
											Не показывать виджет, если заявка уже была
										</span>
									</label>
									<p className={styles.hint}>
										После успешной заявки виджет ставит метку в браузере.
										При следующем открытии сервер также проверяет, была ли
										заявка с этого IP.
									</p>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={cfg.filterDuplicates}
											onChange={e =>
												set({ filterDuplicates: e.target.checked })
											}
										/>
										<span className={styles.checkLabel}>
											Не принимать повторные заявки
										</span>
									</label>
									<p className={styles.hint}>
										При отправке заявки сервер ищет совпадение по телефону,
										email или IP за указанный ниже период.
									</p>
									{cfg.filterDuplicates && (
										<div className={styles.field}>
											<p className={styles.label}>
												Повторная заявка через N дней
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
															Number(e.target.value),
															0,
															365,
															0
														)
													})
												}
											/>
											<p className={styles.hint}>
												0 — повторная заявка запрещена до сброса. Для
												скидочного оффера это рекомендуемое значение.
											</p>
										</div>
									)}
									{confirmResetSubmissions ? (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												После подтверждения посетители снова смогут
												оставить заявку по этому стоп-офферу.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													onClick={handleResetSubmissions}
													disabled={isDangerActionPending}
												>
													Подтвердить сброс
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													onClick={() => setConfirmResetSubmissions(false)}
													disabled={isDangerActionPending}
												>
													Отмена
												</button>
											</div>
										</div>
									) : (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmResetSubmissions(true)}
											disabled={isDangerActionPending}
										>
											Сбросить историю заявок
										</button>
									)}
								</div>
							)}
						</div>
					)}

					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Уведомления</h3>
								<div className={styles.field}>
									<p className={styles.label}>Email для заявок</p>
									<input
										className={styles.input}
										value={cfg.integrations.email || ''}
										onChange={e => setIntegration('email', e.target.value)}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Telegram chat ID</p>
									<input
										className={styles.input}
										value={cfg.integrations.telegramChatId || ''}
										onChange={e =>
											setIntegration('telegramChatId', e.target.value)
										}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Webhook URL</p>
									<input
										className={styles.input}
										value={cfg.integrations.webhookUrl || ''}
										onChange={e =>
											setIntegration('webhookUrl', e.target.value)
										}
									/>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>CRM</h3>
								<div className={styles.field}>
									<p className={styles.label}>Bitrix24 webhook</p>
									<input
										className={styles.input}
										value={cfg.integrations.bitrix24WebhookUrl || ''}
										onChange={e =>
											setIntegration('bitrix24WebhookUrl', e.target.value)
										}
										placeholder="https://example.bitrix24.ru/rest/..."
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>amoCRM — домен аккаунта</p>
									<input
										className={styles.input}
										value={cfg.integrations.amoCrmDomain || ''}
										onChange={e =>
											setIntegration('amoCrmDomain', e.target.value)
										}
										placeholder="mycompany.amocrm.ru"
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>amoCRM — токен доступа</p>
									<input
										className={styles.input}
										value={cfg.integrations.amoCrmToken || ''}
										onChange={e =>
											setIntegration('amoCrmToken', e.target.value)
										}
										placeholder="Долгосрочный access token"
									/>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Аналитика</h3>
								<div className={styles.field}>
									<p className={styles.label}>Яндекс.Метрика ID</p>
									<input
										className={styles.input}
										value={cfg.integrations.yandexMetrikaId || ''}
										onChange={e =>
											setIntegration('yandexMetrikaId', e.target.value)
										}
									/>
									<p className={styles.hint}>
										При открытии стоп-оффера отправляется цель{' '}
										<b>wso_open</b>, при отправке заявки — <b>wso_send</b>.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>VK Pixel ID</p>
									<input
										className={styles.input}
										value={cfg.integrations.vkPixelId || ''}
										onChange={e =>
											setIntegration('vkPixelId', e.target.value)
										}
									/>
									<p className={styles.hint}>
										Пиксель VK должен быть установлен на странице сайта.
										События: <b>wso_open</b> и <b>wso_send</b>.
									</p>
								</div>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={cfg.integrations.roistatEnabled === true}
										onChange={e =>
											setIntegration('roistatEnabled', e.target.checked)
										}
									/>
									<span className={styles.checkLabel}>Roistat</span>
								</label>
								<p className={styles.hint}>
									Код Roistat должен быть установлен на сайте. События:
									<b> wso_open</b> и <b>wso_send</b>.
								</p>
							</div>
						</div>
					)}

					{tab === 'code' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Код установки
								</h3>
								<div className={styles.field}>
									<textarea
										className={styles.textarea}
										value={embedCode}
										readOnly
										rows={4}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() => handleCopy(embedCode)}
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
									<input
										className={styles.input}
										value={previewUrl}
										readOnly
									/>
									<a
										className={styles.openLink}
										href={previewUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										Открыть страницу
									</a>
									<DirectLinkQr
										value={previewUrl}
										downloadName={`winwidget-stop-offer-${stopOffer.publicKey}.png`}
									/>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Как работает стоп-оффер
								</h3>
								<p className={styles.infoText}>
									Виджет показывает попап, когда посетитель собирается уйти
									со страницы. На телефонах вместо ухода мыши используется
									задержка и глубина скролла.
								</p>
								<ul className={styles.infoList}>
									<li>
										Добавьте домен установки, иначе публичный виджет не
										покажется на сайте.
									</li>
									<li>
										Для скидочного сценария оставьте повторный показ через
										7 дней: посетитель не будет видеть оффер слишком часто.
									</li>
									<li>
										Если заявка уже была, виджет можно скрывать для этого
										посетителя и отдельно запрещать повторную заявку.
									</li>
									<li>
										0 дней в повторных заявках означает запрет до ручного
										сброса истории заявок.
									</li>
									<li>
										Укажите текст оффера и ссылку на акцию, если посетитель
										может перейти без заявки.
									</li>
									<li>
										Если включён сбор контактов, заявки попадают в раздел
										заявок и учитываются в лимитах тарифа.
									</li>
								</ul>
							</div>
						</div>
					)}
				</div>

				<div className={styles.stickyFooter}>
					<div className={styles.footerActions}>
						<button
							type="button"
							className={styles.cancelBtn}
							onClick={onClose}
						>
							Закрыть
						</button>
						<button
							type="button"
							className={styles.saveBtn}
							onClick={save}
							disabled={mutation.isPending || !hasUnsavedChanges}
						>
							{mutation.isPending ? 'Сохраняем...' : 'Сохранить'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default StopOfferSettingsModal
