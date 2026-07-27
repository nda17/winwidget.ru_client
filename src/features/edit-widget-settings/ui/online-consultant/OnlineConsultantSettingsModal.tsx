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
import useWidgetSettingsCloseGuard from '../shared/useWidgetSettingsCloseGuard'
import WidgetLivePreview from '../shared/WidgetLivePreview'
import type {
	WidgetSettingsPersistence,
	WidgetSettingsPresentationProps
} from '../shared/WidgetSettingsPersistence'
import WidgetSettingsPreviewPortal from '../shared/WidgetSettingsPreviewPortal'

type Tab = 'main' | 'actions' | 'form' | 'integrations' | 'code' | 'info'
const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024
const MIN_QUICK_ACTIONS = 2
const MAX_QUICK_ACTIONS = 10

interface Props extends WidgetSettingsPresentationProps {
	onlineConsultant: OnlineConsultant
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: OnlineConsultant) => void
	persistence?: WidgetSettingsPersistence<
		OnlineConsultant,
		OnlineConsultantConfig
	>
}

type ValidationIssue = {
	tab: Tab
	fieldId: string
	message: string
}

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Главные' },
	{ id: 'actions', label: 'Вопросы' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Установка' },
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

const isHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
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
	onSaved,
	persistence,
	presentation = 'modal',
	previewPortalTarget
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
	const [validationIssue, setValidationIssue] =
		useState<ValidationIssue | null>(null)
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
			(
				persistence?.update ??
				(payload =>
					onlineConsultantService.updateOnlineConsultant(
						onlineConsultant.id,
						payload
					))
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
			setValidationIssue(null)
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
			return persistence?.uploadButtonImage
				? persistence.uploadButtonImage(formData)
				: onlineConsultantService.uploadButtonImage(
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
			setValidationIssue(null)
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
	const { requestClose, closeGuardDialog } = useWidgetSettingsCloseGuard({
		hasUnsavedChanges,
		isBusy: isDangerActionPending,
		onClose
	})
	const isPagePresentation = presentation === 'page'
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

	const set = (patch: Partial<OnlineConsultantConfig>) => {
		setValidationIssue(null)
		setCfg(prev => ({ ...prev, ...patch }))
	}

	const setIntegration = (
		key: keyof OnlineConsultantConfig['integrations'],
		value: string | boolean
	) => {
		setValidationIssue(null)
		setCfg(prev => ({
			...prev,
			integrations: {
				...prev.integrations,
				[key]: value
			}
		}))
	}

	const setAction = (
		index: number,
		patch: Partial<OnlineConsultantQuickAction>
	) => {
		setValidationIssue(null)
		setCfg(prev => ({
			...prev,
			quickActions: prev.quickActions.map((action, actionIndex) =>
				actionIndex === index ? { ...action, ...patch } : action
			)
		}))
	}

	const reportValidationIssue = (issue: ValidationIssue) => {
		setValidationIssue(issue)
		setTab(issue.tab)
		window.requestAnimationFrame(() => {
			const field = document.getElementById(issue.fieldId)
			field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
			field?.focus({ preventScroll: true })
		})
		toast.error(issue.message)
	}

	const inputClassName = (fieldId: string) =>
		`${styles.input} ${
			validationIssue?.fieldId === fieldId ? styles.inputError : ''
		}`

	const textareaClassName = (fieldId: string) =>
		`${styles.textarea} ${
			validationIssue?.fieldId === fieldId ? styles.inputError : ''
		}`

	const fieldError = (fieldId: string) =>
		validationIssue?.fieldId === fieldId ? (
			<p className={styles.fieldError} role="alert">
				{validationIssue.message}
			</p>
		) : null

	const addAction = () => {
		setValidationIssue(null)
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
		setValidationIssue(null)
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
	const savedInstallDomain = (
		JSON.parse(savedSnapshot) as { installDomain: string }
	).installDomain
	const hasUnsavedInstallDomain =
		installDomain.trim() !== savedInstallDomain.trim()

	const handleCopy = async (
		text: string,
		successMessage: string,
		requireSavedDomain = false
	) => {
		if (requireSavedDomain && hasUnsavedInstallDomain) {
			setTab('code')
			toast.error('Сначала сохраните домен установки')
			return
		}

		try {
			await navigator.clipboard.writeText(text)
			toast.success(successMessage)
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
		if (hasUnsavedChanges) {
			toast.error('Сначала сохраните текущие настройки виджета')
			return
		}

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
		if (!name.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-name`,
				message: 'Укажите название виджета'
			})
			return
		}

		for (let index = 0; index < cfg.quickActions.length; index += 1) {
			const action = cfg.quickActions[index]
			if (!action.label.trim()) {
				reportValidationIssue({
					tab: 'actions',
					fieldId: `${titleId}-action-${action.id}-label`,
					message: `Вопрос ${index + 1}: укажите текст вопроса`
				})
				return
			}
			if (!action.answer.trim()) {
				reportValidationIssue({
					tab: 'actions',
					fieldId: `${titleId}-action-${action.id}-answer`,
					message: `Вопрос ${index + 1}: укажите быстрый ответ`
				})
				return
			}

			const hasButtonText = Boolean(action.buttonText.trim())
			const hasButtonUrl = Boolean(action.buttonUrl.trim())
			if (hasButtonText !== hasButtonUrl) {
				reportValidationIssue({
					tab: 'actions',
					fieldId: hasButtonText
						? `${titleId}-action-${action.id}-url`
						: `${titleId}-action-${action.id}-button`,
					message: `Вопрос ${index + 1}: заполните текст и ссылку кнопки вместе`
				})
				return
			}
			if (hasButtonUrl && !isHttpUrl(action.buttonUrl)) {
				reportValidationIssue({
					tab: 'actions',
					fieldId: `${titleId}-action-${action.id}-url`,
					message: `Вопрос ${index + 1}: укажите полную ссылку с http:// или https://`
				})
				return
			}
		}

		if (!cfg.title.trim()) {
			reportValidationIssue({
				tab: 'form',
				fieldId: `${titleId}-form-title`,
				message: 'Укажите заголовок виджета'
			})
			return
		}

		if (cfg.dataType !== 'NONE') {
			if (!cfg.contactTitle.trim()) {
				reportValidationIssue({
					tab: 'form',
					fieldId: `${titleId}-contact-title`,
					message: 'Укажите заголовок формы'
				})
				return
			}
			if (!cfg.submitButtonText.trim()) {
				reportValidationIssue({
					tab: 'form',
					fieldId: `${titleId}-submit-text`,
					message: 'Укажите текст кнопки отправки'
				})
				return
			}
			if (!cfg.privacyUrl.trim() || !isHttpUrl(cfg.privacyUrl)) {
				reportValidationIssue({
					tab: 'form',
					fieldId: `${titleId}-privacy-url`,
					message:
						'Укажите полную ссылку на политику с http:// или https://'
				})
				return
			}
		}

		const sanitizedName = name.trim()
		const normalizedActions = normalizeQuickActions(cfg.quickActions).map(
			action => ({
				...action,
				label: action.label.trim(),
				answer: action.answer.trim(),
				buttonText: action.buttonText.trim(),
				buttonUrl: action.buttonUrl.trim()
			})
		)
		const sanitizedConfig: OnlineConsultantConfig = {
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
			quickActions: normalizedActions
		}
		setName(sanitizedName)
		setCfg(sanitizedConfig)
		mutation.mutate({
			name: sanitizedName,
			installDomain,
			config: sanitizedConfig
		})
	}

	return (
		<div
			className={isPagePresentation ? styles.pageEditor : styles.overlay}
		>
			{!isPagePresentation && (
				<button
					type="button"
					className={styles.backdrop}
					onClick={requestClose}
					aria-label="Закрыть настройки онлайн-консультанта"
				/>
			)}
			<div
				className={isPagePresentation ? styles.pagePanel : styles.modal}
				role={isPagePresentation ? 'region' : 'dialog'}
				aria-modal={isPagePresentation ? undefined : true}
			>
				{!isPagePresentation && (
					<button
						type="button"
						className={styles.closeBtn}
						onClick={requestClose}
						aria-label="Закрыть настройки"
					>
						✕
					</button>
				)}
				<h2 id={titleId} className={styles.modalTitle}>
					Настройки онлайн-консультанта
				</h2>

				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек онлайн-консультанта"
				>
					{TABS.map(item => (
						<button
							type="button"
							key={item.id}
							id={`${titleId}-tab-${item.id}`}
							role="tab"
							aria-selected={tab === item.id}
							aria-controls={`${titleId}-panel-${item.id}`}
							tabIndex={tab === item.id ? 0 : -1}
							className={`${styles.tab} ${
								tab === item.id ? styles.tabActive : ''
							}`}
							onClick={() => setTab(item.id)}
						>
							{item.label}
						</button>
					))}
				</div>

				<WidgetSettingsPreviewPortal
					inline={!isPagePresentation}
					target={previewPortalTarget}
				>
					<WidgetLivePreview
						type="onlineConsultant"
						config={cfg}
						isHardPlan={canUseCustomButtonImage}
						autoCollapse={
							!isPagePresentation &&
							['integrations', 'code', 'info'].includes(tab)
						}
					/>
				</WidgetSettingsPreviewPortal>

				<div
					id={`${titleId}-panel-${tab}`}
					className={styles.tabContent}
					role="tabpanel"
					aria-labelledby={`${titleId}-tab-${tab}`}
				>
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
										id={`${titleId}-name`}
										className={inputClassName(`${titleId}-name`)}
										value={name}
										onChange={e => {
											setValidationIssue(null)
											setName(e.target.value)
										}}
										maxLength={50}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-name`
										}
									/>
									{fieldError(`${titleId}-name`)}
									<p className={styles.hint}>
										Отображается только в вашем кабинете.
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
											maxLength={7}
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
									<div className={styles.rangeHeader}>
										<p className={styles.label}>
											Высота кнопки от низа экрана:
										</p>
										<span className={styles.rangeValue}>
											{cfg.buttonBottom ?? 3}%
										</span>
									</div>
									<input
										type="range"
										aria-label="Высота кнопки от низа экрана"
										min={1}
										max={50}
										value={cfg.buttonBottom ?? 3}
										onChange={e =>
											set({ buttonBottom: Number(e.target.value) })
										}
										className={styles.rangeInput}
									/>
									<p className={styles.hint}>
										Отступ от нижнего края экрана в процентах. 3 — почти
										внизу, 50 — по центру.
									</p>
								</div>

								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>
											Отступ кнопки от края экрана:
										</p>
										<span className={styles.rangeValue}>
											{cfg.buttonOffset ?? 3}%
										</span>
									</div>
									<input
										type="range"
										aria-label="Отступ кнопки от края экрана"
										min={1}
										max={50}
										value={cfg.buttonOffset ?? 3}
										onChange={e =>
											set({ buttonOffset: Number(e.target.value) })
										}
										className={styles.rangeInput}
									/>
									<p className={styles.hint}>
										Отступ кнопки от левого или правого края экрана в
										процентах. 3 — почти у края, 50 — по центру.
									</p>
								</div>

								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>Размер кнопки открытия:</p>
										<span className={styles.rangeValue}>
											{cfg.buttonSize ?? 60}px
										</span>
									</div>
									<input
										type="range"
										aria-label="Размер кнопки открытия"
										min={40}
										max={100}
										value={cfg.buttonSize ?? 60}
										onChange={e =>
											set({ buttonSize: Number(e.target.value) })
										}
										className={styles.rangeInput}
									/>
									<p className={styles.hint}>
										Размер иконки плавающей кнопки в пикселях. По умолчанию
										60px.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Автооткрытие:</p>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={cfg.autoOpenDelay != null}
											onChange={e =>
												set({
													autoOpenDelay: e.target.checked ? 5 : null
												})
											}
										/>
										<span className={styles.checkLabel}>
											Открывать виджет автоматически
										</span>
									</label>
									{cfg.autoOpenDelay != null && (
										<>
											<div className={styles.rangeHeader}>
												<p className={styles.label}>Автооткрытие через:</p>
												<span className={styles.rangeValue}>
													{cfg.autoOpenDelay} сек.
												</span>
											</div>
											<input
												className={styles.rangeInput}
												type="range"
												aria-label="Автооткрытие через"
												min={1}
												max={60}
												value={cfg.autoOpenDelay}
												onChange={e =>
													set({
														autoOpenDelay: Number(e.target.value)
													})
												}
											/>
										</>
									)}
									<p className={styles.hint}>
										Время отсчитывается после загрузки страницы сайта.
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
									<div className={styles.field}>
										<p className={styles.label}>Текст вопроса:</p>
										<input
											id={`${titleId}-action-${action.id}-label`}
											className={inputClassName(
												`${titleId}-action-${action.id}-label`
											)}
											value={action.label}
											onChange={e =>
												setAction(index, {
													label: e.target.value
												})
											}
											aria-invalid={
												validationIssue?.fieldId ===
												`${titleId}-action-${action.id}-label`
											}
										/>
										{fieldError(`${titleId}-action-${action.id}-label`)}
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Быстрый ответ:</p>
										<textarea
											id={`${titleId}-action-${action.id}-answer`}
											className={textareaClassName(
												`${titleId}-action-${action.id}-answer`
											)}
											value={action.answer}
											onChange={e =>
												setAction(index, {
													answer: e.target.value
												})
											}
											aria-invalid={
												validationIssue?.fieldId ===
												`${titleId}-action-${action.id}-answer`
											}
										/>
										{fieldError(`${titleId}-action-${action.id}-answer`)}
									</div>
									<details
										className={styles.optionalDetails}
										open={Boolean(action.buttonText || action.buttonUrl)}
									>
										<summary className={styles.optionalSummary}>
											Кнопка перехода — необязательно
										</summary>
										<div className={styles.optionalContent}>
											<div className={styles.field}>
												<p className={styles.label}>Текст кнопки:</p>
												<input
													id={`${titleId}-action-${action.id}-button`}
													className={inputClassName(
														`${titleId}-action-${action.id}-button`
													)}
													value={action.buttonText}
													placeholder="Например: Подробнее"
													onChange={e =>
														setAction(index, {
															buttonText: e.target.value
														})
													}
													aria-invalid={
														validationIssue?.fieldId ===
														`${titleId}-action-${action.id}-button`
													}
												/>
												{fieldError(
													`${titleId}-action-${action.id}-button`
												)}
											</div>
											<div className={styles.field}>
												<p className={styles.label}>Ссылка кнопки:</p>
												<input
													id={`${titleId}-action-${action.id}-url`}
													className={inputClassName(
														`${titleId}-action-${action.id}-url`
													)}
													value={action.buttonUrl}
													placeholder="https://example.com/page"
													onChange={e =>
														setAction(index, {
															buttonUrl: e.target.value
														})
													}
													aria-invalid={
														validationIssue?.fieldId ===
														`${titleId}-action-${action.id}-url`
													}
												/>
												{fieldError(`${titleId}-action-${action.id}-url`)}
											</div>
											<p className={styles.hint}>
												Заполните текст и ссылку вместе. Ссылка откроется в
												новой вкладке.
											</p>
										</div>
									</details>
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
										Тексты виджета
									</h3>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок виджета:</p>
									<input
										id={`${titleId}-form-title`}
										className={inputClassName(`${titleId}-form-title`)}
										value={cfg.title}
										onChange={e => set({ title: e.target.value })}
										placeholder="Онлайн-консультант"
										maxLength={80}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-form-title`
										}
									/>
									{fieldError(`${titleId}-form-title`)}
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
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Сбор данных клиента
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
										Если выбрать «Ничего не собираем», консультант
										останется справочным блоком без формы заявки.
									</p>
								</div>
								{cfg.dataType !== 'NONE' && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>Заголовок формы:</p>
											<input
												id={`${titleId}-contact-title`}
												className={inputClassName(
													`${titleId}-contact-title`
												)}
												value={cfg.contactTitle}
												onChange={e =>
													set({ contactTitle: e.target.value })
												}
												aria-invalid={
													validationIssue?.fieldId ===
													`${titleId}-contact-title`
												}
											/>
											{fieldError(`${titleId}-contact-title`)}
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Текст кнопки отправки:
											</p>
											<input
												id={`${titleId}-submit-text`}
												className={inputClassName(
													`${titleId}-submit-text`
												)}
												value={cfg.submitButtonText}
												onChange={e =>
													set({ submitButtonText: e.target.value })
												}
												aria-invalid={
													validationIssue?.fieldId ===
													`${titleId}-submit-text`
												}
											/>
											{fieldError(`${titleId}-submit-text`)}
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Ссылка на политику конфиденциальности:
											</p>
											<input
												id={`${titleId}-privacy-url`}
												className={inputClassName(
													`${titleId}-privacy-url`
												)}
												value={cfg.privacyUrl}
												onChange={e => set({ privacyUrl: e.target.value })}
												placeholder="https://winwidget.ru/legal-documentation/consent-processing"
												maxLength={500}
												aria-invalid={
													validationIssue?.fieldId ===
													`${titleId}-privacy-url`
												}
											/>
											{fieldError(`${titleId}-privacy-url`)}
										</div>
									</>
								)}
							</div>

							{cfg.dataType !== 'NONE' && (
								<>
									<div className={styles.settingsGroup}>
										<div className={styles.settingsGroupHeader}>
											<h3 className={styles.settingsGroupTitle}>
												После отправки
											</h3>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Заголовок после отправки:
											</p>
											<input
												className={styles.input}
												value={cfg.successTitle}
												onChange={e =>
													set({ successTitle: e.target.value })
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Сообщение после отправки:
											</p>
											<input
												className={styles.input}
												value={cfg.successSubtitle}
												onChange={e =>
													set({ successSubtitle: e.target.value })
												}
											/>
										</div>
									</div>

									<div className={styles.settingsGroup}>
										<div className={styles.settingsGroupHeader}>
											<h3 className={styles.settingsGroupTitle}>
												Повторные заявки
											</h3>
										</div>
										<div className={styles.field}>
											<div className={styles.checkRow}>
												<input
													type="checkbox"
													id="onlineConsultantFilterDuplicates"
													checked={cfg.filterDuplicates}
													onChange={e =>
														set({
															filterDuplicates: e.target.checked
														})
													}
												/>
												<label
													htmlFor="onlineConsultantFilterDuplicates"
													className={styles.checkLabel}
												>
													Не принимать повторный контакт
												</label>
											</div>
											<p className={styles.hint}>
												Повторная заявка с тем же телефоном или Email не
												будет сохранена.
											</p>
										</div>
									</div>
								</>
							)}
						</div>
					)}

					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Уведомления</h3>
								{[
									['email', 'Отправка заявок на Email'],
									['telegramChatId', 'Отправка заявок в Telegram']
								].map(([key, label]) => (
									<div className={styles.field} key={key}>
										<p className={styles.label}>{label}</p>
										<input
											className={styles.input}
											type={key === 'email' ? 'email' : 'text'}
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
								<h3 className={styles.settingsGroupTitle}>
									Webhooks и CRM
								</h3>
								{[
									['webhookUrl', 'Внешний URL (Webhook)'],
									['bitrix24WebhookUrl', 'Отправка заявок в Битрикс24'],
									['amoCrmDomain', 'amoCRM — домен аккаунта'],
									['amoCrmToken', 'amoCRM — токен доступа']
								].map(([key, label]) => (
									<div className={styles.field} key={key}>
										<p className={styles.label}>{label}</p>
										<input
											className={styles.input}
											type={
												key === 'amoCrmToken'
													? 'password'
													: key.endsWith('Url')
														? 'url'
														: 'text'
											}
											autoComplete={
												key === 'amoCrmToken' ? 'off' : undefined
											}
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
									['yandexMetrikaId', 'Яндекс Метрика — ID счётчика'],
									['vkPixelId', 'Ретаргетинг ВКонтакте — ID пикселя']
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
										<p className={styles.hint}>
											При открытии консультанта отправляется событие{' '}
											<b>woc_open</b>, при отправке заявки —{' '}
											<b>woc_send</b>.
										</p>
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
										Передавать события в Roistat
									</span>
								</label>
								<p className={styles.hint}>
									Код Roistat должен быть установлен на сайте. События:
									<b> woc_open</b> и <b>woc_send</b>.
								</p>
							</div>
						</div>
					)}

					{tab === 'code' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Установка на сайт
								</h3>
								<div className={styles.field}>
									<p className={styles.label}>Домен установки виджета:</p>
									<input
										className={styles.input}
										value={installDomain}
										placeholder="example.com"
										onChange={e => {
											setValidationIssue(null)
											setInstallDomain(e.target.value)
										}}
									/>
									<p className={styles.domainHint}>
										Без сохранённого домена консультант не появится на
										сайте. Прямая ссылка работает без домена.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Код виджета:</p>
									<p className={styles.hint}>
										Вставьте код перед закрывающим тегом &lt;/body&gt;.
									</p>
									<textarea
										className={`${styles.textarea} ${styles.codeArea}`}
										readOnly
										value={embedCode}
										rows={4}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() =>
											handleCopy(embedCode, 'Код скопирован', true)
										}
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
									<p className={styles.label}>Прямая ссылка:</p>
									<p className={styles.hint}>
										Работает без установки кода и сохранённого домена.
									</p>
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
										onClick={() =>
											handleCopy(previewUrl, 'Ссылка скопирована')
										}
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
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Что проверить перед запуском
								</h3>
								<ul className={styles.infoList}>
									<li>
										Откройте каждый вопрос и проверьте текст быстрого
										ответа.
									</li>
									<li>
										Если добавлена кнопка перехода, проверьте её текст и
										ссылку.
									</li>
									<li>
										Сохраните домен, установите код и отправьте тестовую
										заявку.
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
							onClick={requestClose}
							disabled={isDangerActionPending}
						>
							{isPagePresentation ? 'К виджетам' : 'Отмена'}
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
				{closeGuardDialog}
			</div>
		</div>
	)
}

export default OnlineConsultantSettingsModal
