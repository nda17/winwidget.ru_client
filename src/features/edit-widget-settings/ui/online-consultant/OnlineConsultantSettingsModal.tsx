'use client'

import { onlineConsultantService } from '@/entities/site-widget'
import {
	OnlineConsultant,
	OnlineConsultantConfig,
	OnlineConsultantQuickAction
} from '@/entities/site-widget'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import { ChangeEvent, useId, useState } from 'react'
import toast from 'react-hot-toast'
import DirectLinkQr from '../shared/DirectLinkQr'
import styles from '../shared/WidgetSettingsModal.module.scss'
import WidgetLivePreview from '../shared/WidgetLivePreview'

type Tab = 'main' | 'actions' | 'form' | 'integrations' | 'code' | 'info'
const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024
const MIN_QUICK_ACTIONS = 2
const MAX_QUICK_ACTIONS = 10

interface Props {
	onlineConsultant: OnlineConsultant
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: OnlineConsultant) => void
}

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Главные' },
	{ id: 'actions', label: 'Вопросы' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Код' },
	{ id: 'info', label: 'Инфо' }
]

const getDefaultActions = (): OnlineConsultantQuickAction[] => [
	{
		id: 'price',
		label: 'Цена',
		answer:
			'Стоимость зависит от задачи и комплектации. Оставьте контакт, и мы быстро подскажем актуальный вариант.',
		buttonText: '',
		buttonUrl: ''
	},
	{
		id: 'delivery',
		label: 'Доставка',
		answer:
			'Доставка рассчитывается по адресу и способу получения. Мы уточним детали и предложим удобный вариант.',
		buttonText: '',
		buttonUrl: ''
	},
	{
		id: 'terms',
		label: 'Сроки',
		answer:
			'Сроки зависят от наличия и региона. Обычно мы можем подсказать ориентир сразу после заявки.',
		buttonText: '',
		buttonUrl: ''
	},
	{
		id: 'selection',
		label: 'Подбор',
		answer:
			'Опишите задачу, и мы поможем подобрать подходящий вариант без полноценного чата.',
		buttonText: '',
		buttonUrl: ''
	}
]

const createActionId = () =>
	`action-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const toOptionalNonNegativeInteger = (value: string) => {
	if (value.trim() === '') return null
	const parsed = parseInt(value)
	if (Number.isNaN(parsed)) return null
	return Math.max(0, parsed)
}

const createQuickAction = (
	index: number
): OnlineConsultantQuickAction => ({
	id: createActionId(),
	label: `Вопрос ${index + 1}`,
	answer: 'Напишите быстрый ответ для посетителя.',
	buttonText: '',
	buttonUrl: ''
})

const normalizeQuickActions = (
	actions?: OnlineConsultantQuickAction[]
): OnlineConsultantQuickAction[] => {
	const defaults = getDefaultActions()
	const source = Array.isArray(actions) ? actions : defaults
	const nextActions = source
		.slice(0, MAX_QUICK_ACTIONS)
		.map((action, index) => {
			const item = action || ({} as OnlineConsultantQuickAction)
			const fallback = defaults[index % defaults.length]

			return {
				id: item.id || fallback.id || createActionId(),
				label: item.label ?? fallback.label,
				answer: item.answer ?? fallback.answer,
				buttonText: item.buttonText ?? fallback.buttonText,
				buttonUrl: item.buttonUrl ?? fallback.buttonUrl
			}
		})

	while (nextActions.length < MIN_QUICK_ACTIONS) {
		const fallback =
			defaults[nextActions.length] || createQuickAction(nextActions.length)
		nextActions.push({
			...fallback,
			id: fallback.id || createActionId()
		})
	}

	return nextActions
}

const getDefaultConfig = (): OnlineConsultantConfig => ({
	color: '#ef2b17',
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
	bubbleEnabled: false,
	bubbleText: '',
	title: 'Онлайн-консультант',
	subtitle: 'Выберите популярный вопрос и получите быстрый ответ.',
	dataType: 'PHONE',
	contactTitle: 'Оставьте контакт, если нужен персональный ответ',
	submitButtonText: 'Отправить',
	successTitle: 'Спасибо! Заявка отправлена',
	successSubtitle: 'Мы скоро свяжемся с вами',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	developInfoActive: true,
	filterDuplicates: false,
	quickActions: getDefaultActions(),
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
	config: Partial<OnlineConsultantConfig>
): OnlineConsultantConfig => {
	const defaults = getDefaultConfig()
	return {
		...defaults,
		...config,
		bubbleEnabled: false,
		bubbleText: '',
		quickActions: normalizeQuickActions(config.quickActions),
		integrations: {
			...defaults.integrations,
			...(config.integrations || {})
		}
	}
}

const notifyOnlineConsultantUpdated = (publicKey: string) => {
	if (typeof window === 'undefined') return
	window.dispatchEvent(
		new CustomEvent('winwidget:online-consultant:updated', {
			detail: { key: publicKey }
		})
	)
}

const OnlineConsultantSettingsModal = ({
	onlineConsultant,
	canUseCustomButtonImage,
	onClose,
	onSaved
}: Props) => {
	const titleId = useId()
	const buttonImageInputId = useId()
	const [tab, setTab] = useState<Tab>('main')
	const [cfg, setCfg] = useState<OnlineConsultantConfig>(
		mergeConfig(onlineConsultant.config)
	)
	const [name, setName] = useState(onlineConsultant.name)
	const [installDomain, setInstallDomain] = useState(
		onlineConsultant.installDomain ?? ''
	)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [savedSnapshot, setSavedSnapshot] = useState(
		JSON.stringify({
			name: onlineConsultant.name,
			installDomain: onlineConsultant.installDomain ?? '',
			config: mergeConfig(onlineConsultant.config)
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
			config: OnlineConsultantConfig
		}) =>
			onlineConsultantService.updateOnlineConsultant(onlineConsultant.id, {
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
			notifyOnlineConsultantUpdated(onlineConsultant.publicKey)
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
			return onlineConsultantService.uploadButtonImage(
				onlineConsultant.id,
				formData
			)
		},
		onMutate: () => toast.loading('Загружаем картинку кнопки...'),
		onSuccess: (updated, _, toastId) => {
			const nextConfig = mergeConfig(updated.config)
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
			toast.success('Картинка кнопки обновлена', { id: toastId })
			notifyOnlineConsultantUpdated(onlineConsultant.publicKey)
		},
		onError: (e: any, _, toastId) => {
			toast.error(
				e?.response?.data?.message || 'Ошибка загрузки картинки',
				{ id: toastId }
			)
		}
	})

	const isDangerActionPending =
		mutation.isPending || buttonImageMutation.isPending
	const defaultButtonImageUrl = `${(
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'https://winwidget.ru'
	).replace(/\/$/, '')}/widgets/online-consultant-button.png`
	const buttonImagePreviewUrl = cfg.buttonImageUrl || defaultButtonImageUrl
	const buttonImageUploadDisabled =
		!canUseCustomButtonImage ||
		hasUnsavedChanges ||
		buttonImageMutation.isPending

	const set = (patch: Partial<OnlineConsultantConfig>) =>
		setCfg(prev => ({ ...prev, ...patch }))

	const setIntegration = (
		key: keyof OnlineConsultantConfig['integrations'],
		value: string | boolean
	) =>
		setCfg(prev => ({
			...prev,
			integrations: {
				...prev.integrations,
				[key]: value
			}
		}))

	const setAction = (
		index: number,
		patch: Partial<OnlineConsultantQuickAction>
	) =>
		setCfg(prev => ({
			...prev,
			quickActions: prev.quickActions.map((action, actionIndex) =>
				actionIndex === index ? { ...action, ...patch } : action
			)
		}))

	const addAction = () => {
		setCfg(prev => {
			if (prev.quickActions.length >= MAX_QUICK_ACTIONS) return prev

			return {
				...prev,
				quickActions: [
					...prev.quickActions,
					createQuickAction(prev.quickActions.length)
				]
			}
		})
	}

	const removeAction = (index: number) => {
		setCfg(prev => {
			if (prev.quickActions.length <= MIN_QUICK_ACTIONS) return prev

			return {
				...prev,
				quickActions: prev.quickActions.filter(
					(_, actionIndex) => actionIndex !== index
				)
			}
		})
	}

	const apiUrl = (
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'https://winwidget.ru'
	).replace(/\/$/, '')
	const publicSiteUrl = (
		process.env.NEXT_PUBLIC_SITE_URL ||
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? 'https://winwidget.ru'
			: 'http://localhost:3000')
	).replace(/\/$/, '')
	const embedCode = `<script src="${apiUrl}/widgets/online-consultant.js" data-key="${onlineConsultant.publicKey}" async></script>`
	const previewUrl = `${publicSiteUrl}/page-online-consultant/${onlineConsultant.publicKey}`

	const handleCopy = async (text: string) => {
		try {
			await navigator.clipboard.writeText(text)
			toast.success('Скопировано')
		} catch {
			toast.error('Не удалось скопировать')
		}
	}

	const handleButtonImageChange = (
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
			toast.error('Сначала сохраните текущие настройки')
			return
		}
		if (file.size > BUTTON_IMAGE_MAX_SIZE_BYTES) {
			toast.error('Картинка должна быть не больше 200 КБ')
			return
		}
		buttonImageMutation.mutate(file)
	}

	const resetButtonImage = () => {
		const nextConfig = { ...cfg, buttonImageUrl: '' }
		setCfg(nextConfig)
		mutation.mutate({ name, installDomain, config: nextConfig })
	}

	const handleResetDefaults = () => {
		const nextConfig = getDefaultConfig()
		setCfg(nextConfig)
		setConfirmResetDefaults(false)
		mutation.mutate({ name, installDomain, config: nextConfig })
	}

	const save = () => {
		const actionWithUrlOnlyIndex = cfg.quickActions.findIndex(
			action => action.buttonUrl.trim() && !action.buttonText.trim()
		)

		if (actionWithUrlOnlyIndex !== -1) {
			toast.error(
				`Вопрос ${actionWithUrlOnlyIndex + 1}: заполните текст кнопки перехода или уберите ссылку`
			)
			return
		}

		mutation.mutate({
			name,
			installDomain,
			config: {
				...cfg,
				buttonBottom: Math.min(
					50,
					Math.max(1, Number(cfg.buttonBottom) || 3)
				),
				buttonOffset: Math.min(
					50,
					Math.max(1, Number(cfg.buttonOffset) || 3)
				),
				buttonSize: Math.min(
					100,
					Math.max(40, Number(cfg.buttonSize) || 60)
				),
				bubbleEnabled: false,
				bubbleText: '',
				quickActions: normalizeQuickActions(cfg.quickActions)
			}
		})
	}

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть настройки онлайн-консультанта"
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
					Настройки онлайн-консультанта
				</h2>

				<div className={styles.tabs}>
					{TABS.map(item => (
						<button
							type="button"
							key={item.id}
							className={`${styles.tab} ${
								tab === item.id ? styles.tabActive : ''
							}`}
							onClick={() => setTab(item.id)}
						>
							{item.label}
						</button>
					))}
				</div>

				<WidgetLivePreview
					type="onlineConsultant"
					config={cfg}
					isHardPlan={canUseCustomButtonImage}
				/>

				<div className={styles.tabContent}>
					{tab === 'main' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Внешний вид
									</h3>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Название виджета:</p>
									<input
										className={styles.input}
										value={name}
										onChange={e => setName(e.target.value)}
									/>
									<p className={styles.hint}>
										Отображается только в вашем кабинете.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Домен установки виджета:</p>
									<input
										className={styles.input}
										value={installDomain}
										placeholder="example.com"
										onChange={e => setInstallDomain(e.target.value)}
									/>
									<p className={styles.domainHint}>
										Виджет будет работать только на этом домене.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Основной цвет:</p>
									<div className={styles.colorRow}>
										<input
											className={styles.colorPicker}
											type="color"
											value={cfg.color || '#ef2b17'}
											onChange={e => set({ color: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.color || '#ef2b17'}
											onChange={e => set({ color: e.target.value })}
											placeholder="#ef2b17"
										/>
										{cfg.color && cfg.color !== '#ef2b17' && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ color: '#ef2b17' })}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет акцентов внутри окна онлайн-консультанта.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет фона виджета</p>
									<div className={styles.colorRow}>
										<input
											className={styles.colorPicker}
											type="color"
											value={cfg.bgColor || '#ffffff'}
											onChange={e => set({ bgColor: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.bgColor || ''}
											onChange={e => set({ bgColor: e.target.value })}
											placeholder="#ffffff"
										/>
										{cfg.bgColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ bgColor: '' })}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет фона окна онлайн-консультанта. Оставьте пустым для
										стандартного белого.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет кнопки «Отправить»:</p>
									<div className={styles.colorRow}>
										<input
											className={styles.colorPicker}
											type="color"
											value={cfg.buttonColor || cfg.color || '#ef2b17'}
											onChange={e => set({ buttonColor: e.target.value })}
										/>
										<input
											className={styles.input}
											value={cfg.buttonColor || ''}
											placeholder="По умолчанию — основной цвет"
											onChange={e => set({ buttonColor: e.target.value })}
										/>
										{cfg.buttonColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ buttonColor: '' })}
												title="Сбросить"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет кнопки «Отправить» внутри формы. Оставьте пустым
										для использования основного цвета.
									</p>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Кнопка открытия
									</h3>
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
													onChange={handleButtonImageChange}
												/>
												{cfg.buttonImageUrl && (
													<button
														type="button"
														className={styles.resetAttemptsBtn}
														onClick={resetButtonImage}
														disabled={isDangerActionPending}
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
									<p className={styles.label}>
										Кнопка открытия — пульсация
									</p>
									<div className={styles.checkRow}>
										<input
											id="onlineConsultantPulse"
											type="checkbox"
											checked={cfg.buttonPulse !== false}
											onChange={e =>
												set({ buttonPulse: e.target.checked })
											}
										/>
										<label
											htmlFor="onlineConsultantPulse"
											className={styles.checkLabel}
										>
											Включить пульсацию кнопки
										</label>
									</div>
									<p className={styles.hint}>
										Дополнительный эффект со свечением на кнопке открытия
										виджета.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Сторона расположения кнопки для открытия виджета на
										вашем сайте:
									</p>
									<select
										className={styles.input}
										value={cfg.buttonSide}
										onChange={e =>
											set({
												buttonSide: e.target
													.value as OnlineConsultantConfig['buttonSide']
											})
										}
									>
										<option value="right">Справа</option>
										<option value="left">Слева</option>
									</select>
									<p className={styles.hint}>
										Можно настроить с какой стороны экрана будет кнопка
										открытия виджета.
									</p>
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
										<strong>{cfg.buttonSize ?? 60}px</strong>
									</p>
									<input
										type="range"
										min={40}
										max={100}
										value={cfg.buttonSize ?? 60}
										onChange={e =>
											set({ buttonSize: Number(e.target.value) })
										}
										className={styles.input}
										style={{
											padding: '8px 0',
											background: 'transparent',
											border: 'none'
										}}
									/>
									<p className={styles.hint}>
										Размер иконки плавающей кнопки в пикселях. По умолчанию
										60px.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Количество секунд до авто-открытия виджета:
									</p>
									<input
										className={styles.input}
										type="number"
										min="0"
										value={cfg.autoOpenDelay ?? ''}
										onChange={e =>
											set({
												autoOpenDelay: toOptionalNonNegativeInteger(
													e.target.value
												)
											})
										}
										placeholder="Оставьте пустым для отключения"
									/>
									<p className={styles.hint}>
										Через сколько секунд виджет откроется автоматически
										после открытия страницы вашего сайта. Оставьте пустым
										для отключения.
									</p>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Опасные действия
									</h3>
								</div>
								<div className={styles.dangerActions}>
									{confirmResetDefaults ? (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все настройки онлайн-консультанта будут заменены на
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

					{tab === 'actions' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Вопросы и ответы
								</h3>
								<p className={styles.hint}>
									Минимум 2 вопроса, максимум 10. Каждый вопрос показывает
									посетителю готовый ответ. Если заполнить текст кнопки и
									ссылку, под быстрым ответом появится кнопка перехода.
								</p>
							</div>
							{cfg.quickActions.map((action, index) => (
								<div className={styles.settingsGroup} key={action.id}>
									<div className={styles.actionHeader}>
										<h3 className={styles.settingsGroupTitle}>
											Вопрос {index + 1} из {cfg.quickActions.length}
										</h3>
										<button
											type="button"
											className={styles.removeBtn}
											onClick={() => removeAction(index)}
											disabled={
												cfg.quickActions.length <= MIN_QUICK_ACTIONS
											}
											title={
												cfg.quickActions.length <= MIN_QUICK_ACTIONS
													? 'Минимум 2 вопроса'
													: 'Удалить вопрос'
											}
											aria-label="Удалить вопрос"
										>
											✕
										</button>
									</div>
									<div className={styles.fields}>
										<div className={styles.field}>
											<p className={styles.label}>Текст вопроса:</p>
											<input
												className={styles.input}
												value={action.label}
												onChange={e =>
													setAction(index, {
														label: e.target.value
													})
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Текст в кнопке перехода:
											</p>
											<input
												className={styles.input}
												value={action.buttonText}
												placeholder="Например: Подробнее"
												onChange={e =>
													setAction(index, {
														buttonText: e.target.value
													})
												}
											/>
											<p className={styles.hint}>
												Текст кнопки с призывом к действию под быстрым
												ответом. Заполните вместе со ссылкой ниже.
											</p>
										</div>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Быстрый ответ:</p>
										<textarea
											className={styles.textarea}
											value={action.answer}
											onChange={e =>
												setAction(index, {
													answer: e.target.value
												})
											}
										/>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Ссылка кнопки перехода:</p>
										<input
											className={styles.input}
											value={action.buttonUrl}
											placeholder="https://example.com/page"
											onChange={e =>
												setAction(index, {
													buttonUrl: e.target.value
												})
											}
										/>
										<p className={styles.hint}>
											Кнопка будет показана только если заполнены и текст,
											и ссылка. По клику ссылка откроется в новой вкладке.
										</p>
									</div>
								</div>
							))}
							<button
								type="button"
								className={styles.addBtn}
								onClick={addAction}
								disabled={cfg.quickActions.length >= MAX_QUICK_ACTIONS}
							>
								{cfg.quickActions.length >= MAX_QUICK_ACTIONS
									? 'Максимум 10 вопросов'
									: '+ Добавить вопрос'}
							</button>
						</div>
					)}

					{tab === 'form' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Форма и сообщения
									</h3>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Сбор данных клиента:</p>
									<select
										className={styles.input}
										value={cfg.dataType}
										onChange={e =>
											set({
												dataType: e.target
													.value as OnlineConsultantConfig['dataType']
											})
										}
									>
										<option value="PHONE">Номер телефона</option>
										<option value="EMAIL">Email</option>
										<option value="PHONE_AND_EMAIL">
											Номер телефона и Email
										</option>
										<option value="NONE">Ничего не собираем</option>
									</select>
									<p className={styles.hint}>
										Какие данные клиента нужно собрать после быстрого
										ответа. Если выбрать «Ничего не собираем», виджет
										останется справочным блоком.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок виджета:</p>
									<input
										className={styles.input}
										value={cfg.title}
										onChange={e => set({ title: e.target.value })}
										placeholder="Онлайн-консультант"
										maxLength={80}
									/>
									<p className={styles.hint}>Информация для посетителя.</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок виджета:</p>
									<input
										className={styles.input}
										value={cfg.subtitle}
										onChange={e => set({ subtitle: e.target.value })}
										placeholder="Выберите популярный вопрос и получите быстрый ответ."
										maxLength={150}
									/>
									<p className={styles.hint}>Информация для посетителя.</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок формы заявки:</p>
									<input
										className={styles.input}
										value={cfg.contactTitle}
										onChange={e => set({ contactTitle: e.target.value })}
									/>
									<p className={styles.hint}>
										Текст перед полями контактов внутри виджета.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Текст в кнопке отправки заявки:
									</p>
									<input
										className={styles.input}
										value={cfg.submitButtonText}
										onChange={e =>
											set({ submitButtonText: e.target.value })
										}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок успеха:</p>
									<input
										className={styles.input}
										value={cfg.successTitle}
										onChange={e => set({ successTitle: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Текст успеха:</p>
									<input
										className={styles.input}
										value={cfg.successSubtitle}
										onChange={e =>
											set({ successSubtitle: e.target.value })
										}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Ссылка на политику конфиденциальности:
									</p>
									<input
										className={styles.input}
										value={cfg.privacyUrl}
										onChange={e => set({ privacyUrl: e.target.value })}
										placeholder="https://winwidget.ru/legal-documentation/consent-processing"
										maxLength={500}
									/>
									<p className={styles.hint}>
										По умолчанию ссылка ведёт на политику нашего сервиса.
										Можно оставить как есть или добавить свою ссылку.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.field}>
									<p className={styles.label}>Фильтр заявок:</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="onlineConsultantFilterDuplicates"
											checked={cfg.filterDuplicates}
											onChange={e =>
												set({ filterDuplicates: e.target.checked })
											}
										/>
										<label
											htmlFor="onlineConsultantFilterDuplicates"
											className={styles.checkLabel}
										>
											Не учитывать повторные контакты
										</label>
									</div>
									<p className={styles.hint}>
										Дополнительный антифрод-фактор. Если посетитель введёт
										номер телефона или email, который уже есть в базе этого
										виджета — повторная заявка не сохранится и уведомления
										о заявках не будут вам отправлены.
									</p>
								</div>
							</div>
						</div>
					)}

					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Уведомления</h3>
								{[
									['email', 'Email для заявок'],
									['telegramChatId', 'Telegram chat ID'],
									['webhookUrl', 'Webhook URL']
								].map(([key, label]) => (
									<div className={styles.field} key={key}>
										<p className={styles.label}>{label}</p>
										<input
											className={styles.input}
											value={String(
												cfg.integrations[
													key as keyof OnlineConsultantConfig['integrations']
												] || ''
											)}
											onChange={e =>
												setIntegration(
													key as keyof OnlineConsultantConfig['integrations'],
													e.target.value
												)
											}
										/>
									</div>
								))}
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>CRM</h3>
								{[
									['bitrix24WebhookUrl', 'Webhook Битрикс24'],
									['amoCrmDomain', 'amoCRM домен'],
									['amoCrmToken', 'amoCRM токен']
								].map(([key, label]) => (
									<div className={styles.field} key={key}>
										<p className={styles.label}>{label}</p>
										<input
											className={styles.input}
											value={String(
												cfg.integrations[
													key as keyof OnlineConsultantConfig['integrations']
												] || ''
											)}
											onChange={e =>
												setIntegration(
													key as keyof OnlineConsultantConfig['integrations'],
													e.target.value
												)
											}
										/>
									</div>
								))}
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Аналитика</h3>
								{[
									['yandexMetrikaId', 'ID Яндекс Метрики'],
									['vkPixelId', 'ID VK пикселя']
								].map(([key, label]) => (
									<div className={styles.field} key={key}>
										<p className={styles.label}>{label}</p>
										<input
											className={styles.input}
											value={String(
												cfg.integrations[
													key as keyof OnlineConsultantConfig['integrations']
												] || ''
											)}
											onChange={e =>
												setIntegration(
													key as keyof OnlineConsultantConfig['integrations'],
													e.target.value
												)
											}
										/>
									</div>
								))}
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={cfg.integrations.roistatEnabled === true}
										onChange={e =>
											setIntegration('roistatEnabled', e.target.checked)
										}
									/>
									<span className={styles.checkLabel}>
										Передавать roistat_visit
									</span>
								</label>
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
										readOnly
										value={embedCode}
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
										readOnly
										value={previewUrl}
									/>
									<a
										className={styles.openLink}
										href={previewUrl}
										target="_blank"
										rel="noopener noreferrer"
									>
										Открыть страницу
									</a>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() => handleCopy(previewUrl)}
									>
										Скопировать ссылку
									</button>
									<DirectLinkQr
										value={previewUrl}
										downloadName={`winwidget-online-consultant-${onlineConsultant.publicKey}.png`}
									/>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Как работает онлайн-консультант
								</h3>
								<p className={styles.infoText}>
									Виджет показывает плавающую кнопку и окно с популярными
									вопросами. Посетитель выбирает вопрос, видит быстрый
									ответ и при необходимости оставляет контакт.
								</p>
								<ul className={styles.infoList}>
									<li>
										Добавьте от 2 до 10 вопросов во вкладке «Вопросы».
									</li>
									<li>
										В ответе можно указать ссылку: она появится как
										отдельная кнопка под текстом ответа.
									</li>
									<li>
										Если выбрать «Не собирать контакты», заявки не
										создаются, а виджет работает как справочный помощник.
									</li>
									<li>
										Укажите домен установки, иначе публичный виджет не
										покажется на сайте.
									</li>
									<li>
										Собранные контакты попадают на страницу заявок
										онлайн-консультанта и учитываются в лимитах тарифа.
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
							disabled={isDangerActionPending || !hasUnsavedChanges}
						>
							{mutation.isPending ? 'Сохраняем...' : 'Сохранить'}
						</button>
					</div>
				</div>
			</div>
		</div>
	)
}

export default OnlineConsultantSettingsModal
