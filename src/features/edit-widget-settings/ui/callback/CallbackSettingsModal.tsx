'use client'

import { callbackService } from '@/entities/site-widget'
import { Callback, CallbackConfig } from '@/entities/site-widget'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import { ChangeEvent, useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import ActionTooltip from '../shared/ActionTooltip'
import styles from './CallbackSettingsModal.module.scss'
import DirectLinkQr from '../shared/DirectLinkQr'
import {
	findInvalidWidgetColor,
	getWidgetColorPreview,
	isWidgetHexColor
} from '../shared/widgetColor'
import useWidgetSettingsCloseGuard from '../shared/useWidgetSettingsCloseGuard'
import WidgetLivePreview from '../shared/WidgetLivePreview'
import WidgetPresetButtons from '../shared/WidgetPresetButtons'
import pageStyles from '../shared/WidgetSettingsModal.module.scss'
import type {
	WidgetSettingsPersistence,
	WidgetSettingsPresentationProps
} from '../shared/WidgetSettingsPersistence'
import WidgetSettingsPreviewPortal from '../shared/WidgetSettingsPreviewPortal'

type Tab = 'main' | 'form' | 'integrations' | 'code' | 'info'
type EditableTab = Exclude<Tab, 'code' | 'info'>
const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024
const MAX_TIME_SLOTS = 12

interface Props extends WidgetSettingsPresentationProps {
	callback: Callback
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: Callback) => void
	persistence?: WidgetSettingsPersistence<Callback, CallbackConfig>
}

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Основные' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Установка' },
	{ id: 'info', label: 'Проверка' }
]

const DEFAULT_CONFIG: CallbackConfig = {
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
	bubbleEnabled: true,
	bubbleText: 'Перезвоним!',
	title: 'Заказать звонок',
	subtitle: 'Оставьте номер телефона — мы перезвоним в удобное время',
	submitButtonText: 'Заказать звонок',
	successTitle: 'Спасибо! Мы перезвоним',
	successSubtitle: 'Ожидайте звонка в выбранное время',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	developInfoActive: true,
	filterDuplicates: false,
	timeSlots: [
		'9:00–11:00',
		'11:00–13:00',
		'13:00–15:00',
		'15:00–17:00',
		'17:00–19:00'
	],
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
}

const getDefaultConfig = (): CallbackConfig => ({
	...DEFAULT_CONFIG,
	timeSlots: [...DEFAULT_CONFIG.timeSlots],
	integrations: { ...DEFAULT_CONFIG.integrations }
})

const isValidHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const CallbackSettingsModal = ({
	callback,
	canUseCustomButtonImage,
	onClose,
	onSaved,
	persistence,
	presentation = 'modal',
	previewPortalTarget,
	onPreviewDeviceChange,
	onPreviewConfigChange,
	previewCollapsed,
	onPreviewCollapsedChange,
	onDirtyChange,
	onRevisionConflict,
	lifecycleActions
}: Props) => {
	const titleId = useId()
	const buttonImageInputId = useId()
	const [tab, setTab] = useState<Tab>('main')
	const [cfg, setCfg] = useState<CallbackConfig>({ ...callback.config })
	const [name, setName] = useState(callback.name)
	const [installDomain, setInstallDomain] = useState(
		callback.installDomain ?? ''
	)
	const draftRevisionRef = useRef(callback.draftRevision)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [confirmResetSection, setConfirmResetSection] =
		useState<EditableTab | null>(null)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(
		{}
	)
	const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
	const pendingFocusFieldRef = useRef<string | null>(null)
	const [savedSnapshot, setSavedSnapshot] = useState(
		JSON.stringify({
			name: callback.name,
			installDomain: callback.installDomain ?? '',
			config: callback.config
		})
	)
	const currentSnapshot = JSON.stringify({
		name,
		installDomain,
		config: cfg
	})
	const hasUnsavedChanges = currentSnapshot !== savedSnapshot
	useEffect(() => {
		onDirtyChange?.(hasUnsavedChanges)
	}, [hasUnsavedChanges, onDirtyChange])
	const reportMutationError = (
		error: any,
		fallback: string,
		toastId: string
	) => {
		if (error?.response?.status === 409) {
			const conflictRefresh = onRevisionConflict?.()
			void conflictRefresh
				?.then(latestRevision => {
					if (typeof latestRevision === 'number') {
						draftRevisionRef.current = latestRevision
					}
				})
				.catch(() =>
					toast.error(
						'Не удалось обновить ревизию черновика. Проверьте соединение и повторите.',
						{ id: toastId, duration: 6000 }
					)
				)
			toast.error(
				'Черновик изменился в другой вкладке. Ваши поля сохранены — после обновления повторите действие.',
				{ id: toastId, duration: 6000 }
			)
			return
		}
		toast.error(error?.response?.data?.message || fallback, {
			id: toastId
		})
	}

	const mutation = useMutation({
		mutationFn: (data?: {
			name: string
			installDomain?: string
			config: CallbackConfig
		}) =>
			(
				persistence?.update ??
				(payload => callbackService.updateCallback(callback.id, payload))
			)({
				name: data?.name ?? name,
				installDomain: data?.installDomain ?? installDomain,
				config: data?.config ?? cfg,
				expectedDraftRevision: draftRevisionRef.current
			}),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			toast.success('Сохранено', { id: toastId })
			setFieldErrors({})
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setCfg(updated.config)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: updated.config
				})
			)
			onSaved(updated)
		},
		onError: (error: any, _, toastId) =>
			reportMutationError(error, 'Ошибка сохранения', toastId)
	})
	const buttonImageMutation = useMutation({
		mutationFn: (file: File) => {
			const formData = new FormData()
			formData.append('file', file)
			formData.append(
				'expectedDraftRevision',
				String(draftRevisionRef.current)
			)
			return persistence?.uploadButtonImage
				? persistence.uploadButtonImage(formData)
				: callbackService.uploadButtonImage(callback.id, formData)
		},
		onMutate: () =>
			toast.loading('Загружаем картинку кнопки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			toast.success('Картинка кнопки обновлена', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setCfg(updated.config)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: updated.config
				})
			)
			onSaved(updated)
		},
		onError: (error: any, _, toastId) =>
			reportMutationError(error, 'Ошибка загрузки', toastId)
	})
	const isDangerActionPending =
		mutation.isPending || buttonImageMutation.isPending
	const { requestClose, closeGuardDialog } = useWidgetSettingsCloseGuard({
		hasUnsavedChanges,
		isBusy: isDangerActionPending,
		onClose
	})
	const isPagePresentation = presentation === 'page'

	useEffect(() => {
		const field = pendingFocusFieldRef.current
		if (!field) return

		const frameId = window.requestAnimationFrame(() => {
			const element = fieldRefs.current[field]
			if (!element) return
			element.closest('details')?.setAttribute('open', '')
			element.scrollIntoView({ behavior: 'smooth', block: 'center' })
			element.focus({ preventScroll: true })
			pendingFocusFieldRef.current = null
		})

		return () => window.cancelAnimationFrame(frameId)
	}, [fieldErrors, tab])

	const set = (patch: Partial<CallbackConfig>) =>
		setCfg(prev => ({ ...prev, ...patch }))

	const setFieldRef = (field: string) => (element: HTMLElement | null) => {
		fieldRefs.current[field] = element
	}

	const clearFieldError = (...fields: string[]) => {
		setFieldErrors(previous => {
			if (!fields.some(field => previous[field])) return previous
			const next = { ...previous }
			fields.forEach(field => delete next[field])
			return next
		})
	}

	const setBlurFieldError = (field: string, message: string | null) => {
		if (!message) {
			clearFieldError(field)
			return
		}
		setFieldErrors(previous => ({ ...previous, [field]: message }))
	}

	const showValidationErrors = (
		errors: Record<string, string>,
		order: string[]
	) => {
		const firstField =
			order.find(field => errors[field]) ?? Object.keys(errors)[0]
		if (!firstField) return false

		setFieldErrors(errors)
		pendingFocusFieldRef.current = firstField
		setTab(
			firstField.startsWith('integrations.')
				? 'integrations'
				: firstField === 'name' ||
					  firstField === 'bubbleText' ||
					  firstField === 'color' ||
					  firstField === 'bgColor' ||
					  firstField === 'openButtonColor'
					? 'main'
					: 'form'
		)
		toast.error(errors[firstField])
		return true
	}

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

	const embedCode = `<script src="${apiUrl}/widgets/callback.js" data-key="${callback.publicKey}" async></script>`
	const previewUrl = `${publicSiteUrl}/page-callback/${callback.publicKey}`
	const savedInstallDomain = (
		JSON.parse(savedSnapshot) as { installDomain: string }
	).installDomain
	const hasUnsavedInstallDomain =
		installDomain.trim() !== savedInstallDomain.trim()
	const copyToClipboard = async (
		value: string,
		successMessage: string,
		requireSavedDomain = false
	) => {
		if (requireSavedDomain && hasUnsavedInstallDomain) {
			setTab('code')
			toast.error('Сначала сохраните домен установки')
			return
		}
		try {
			await navigator.clipboard.writeText(value)
			toast.success(successMessage)
		} catch {
			toast.error('Не удалось скопировать')
		}
	}
	const defaultButtonImageUrl = `${apiUrl}/widgets/callback-button.png`
	const buttonImagePreviewUrl = cfg.buttonImageUrl || defaultButtonImageUrl
	const buttonImageUploadDisabled =
		!canUseCustomButtonImage ||
		hasUnsavedChanges ||
		buttonImageMutation.isPending
	const bubbleText = cfg.bubbleText ?? DEFAULT_CONFIG.bubbleText
	const autoOpenEnabled =
		cfg.autoOpenDelay !== null &&
		cfg.autoOpenDelay !== undefined &&
		cfg.autoOpenDelay > 0
	const autoOpenDelay = Math.min(
		60,
		Math.max(1, cfg.autoOpenDelay ?? DEFAULT_CONFIG.autoOpenDelay ?? 5)
	)

	const addSlot = () => {
		if ((cfg.timeSlots || []).length >= MAX_TIME_SLOTS) {
			toast.error(`Можно добавить не больше ${MAX_TIME_SLOTS} слотов`)
			return
		}
		clearFieldError('timeSlots')
		set({ timeSlots: [...(cfg.timeSlots || []), ''] })
	}

	const updateSlot = (i: number, val: string) => {
		const slots = [...(cfg.timeSlots || [])]
		slots[i] = val
		clearFieldError('timeSlots', `timeSlots.${i}`)
		set({ timeSlots: slots })
	}

	const removeSlot = (i: number) => {
		const slots = [...(cfg.timeSlots || [])]
		slots.splice(i, 1)
		setFieldErrors(previous =>
			Object.fromEntries(
				Object.entries(previous).filter(
					([field]) => !field.startsWith('timeSlots')
				)
			)
		)
		set({ timeSlots: slots })
	}

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
		if (hasUnsavedChanges) {
			toast.error('Сначала сохраните текущие настройки виджета')
			return
		}

		const nextConfig = { ...cfg, buttonImageUrl: '' }
		setCfg(nextConfig)
		mutation.mutate({
			name: name.trim() || 'Обратный звонок',
			config: nextConfig
		})
	}

	const handleResetDefaults = () => {
		const resetConfig = {
			...getDefaultConfig(),
			integrations: { ...cfg.integrations },
			buttonImageUrl: cfg.buttonImageUrl
		}
		setFieldErrors({})
		setCfg(resetConfig)
		setConfirmResetDefaults(false)
		toast.success('Стандартные настройки применены. Сохраните черновик')
	}

	const handleResetSection = () => {
		if (!confirmResetSection) return

		setCfg(previous => {
			if (confirmResetSection === 'integrations') {
				return {
					...previous,
					integrations: { ...DEFAULT_CONFIG.integrations }
				}
			}

			if (confirmResetSection === 'form') {
				return {
					...previous,
					buttonColor: DEFAULT_CONFIG.buttonColor,
					title: DEFAULT_CONFIG.title,
					subtitle: DEFAULT_CONFIG.subtitle,
					submitButtonText: DEFAULT_CONFIG.submitButtonText,
					successTitle: DEFAULT_CONFIG.successTitle,
					successSubtitle: DEFAULT_CONFIG.successSubtitle,
					privacyUrl: DEFAULT_CONFIG.privacyUrl,
					developInfoActive: DEFAULT_CONFIG.developInfoActive,
					filterDuplicates: DEFAULT_CONFIG.filterDuplicates,
					timeSlots: [...DEFAULT_CONFIG.timeSlots]
				}
			}

			return {
				...previous,
				color: DEFAULT_CONFIG.color,
				bgColor: DEFAULT_CONFIG.bgColor,
				openButtonColor: DEFAULT_CONFIG.openButtonColor,
				buttonSide: DEFAULT_CONFIG.buttonSide,
				buttonPulse: DEFAULT_CONFIG.buttonPulse,
				buttonBottom: DEFAULT_CONFIG.buttonBottom,
				buttonOffset: DEFAULT_CONFIG.buttonOffset,
				buttonSize: DEFAULT_CONFIG.buttonSize,
				buttonImageUrl: DEFAULT_CONFIG.buttonImageUrl,
				autoOpenDelay: DEFAULT_CONFIG.autoOpenDelay,
				bubbleEnabled: DEFAULT_CONFIG.bubbleEnabled,
				bubbleText: DEFAULT_CONFIG.bubbleText
			}
		})
		setFieldErrors({})
		setConfirmResetSection(null)
		toast.success('Раздел сброшен в черновике; сохраните черновик')
	}

	const handleSave = () => {
		const sanitizedName = name.trim()
		const sanitizedSlots = (cfg.timeSlots || []).map(slot => slot.trim())
		const firstEmptySlot = sanitizedSlots.findIndex(slot => !slot)
		const errors: Record<string, string> = {}
		const invalidColor = !isWidgetHexColor(cfg.color)
			? 'color'
			: findInvalidWidgetColor(cfg)

		if (invalidColor) {
			errors[invalidColor] = 'Введите цвет в формате #RRGGBB'
		}

		if (!sanitizedName) {
			errors.name = 'Укажите название виджета'
		}
		if (cfg.bubbleEnabled !== false && !bubbleText.trim()) {
			errors.bubbleText = 'Укажите текст облачка или отключите его'
		}
		if (!cfg.title.trim()) {
			errors.title = 'Укажите заголовок формы'
		}
		if (!cfg.submitButtonText.trim()) {
			errors.submitButtonText = 'Укажите текст кнопки отправки'
		}
		if (!cfg.successTitle.trim()) {
			errors.successTitle = 'Укажите заголовок экрана успеха'
		}
		if (sanitizedSlots.length === 0) {
			errors.timeSlots = 'Добавьте хотя бы один вариант времени звонка'
		} else if (sanitizedSlots.length > MAX_TIME_SLOTS) {
			errors.timeSlots = `Оставьте не больше ${MAX_TIME_SLOTS} слотов`
		} else if (firstEmptySlot >= 0) {
			errors.timeSlots = 'Заполните или удалите пустой слот времени'
			errors[`timeSlots.${firstEmptySlot}`] = errors.timeSlots
		}

		const privacyUrl = cfg.privacyUrl.trim()
		if (!privacyUrl) {
			errors.privacyUrl = 'Укажите ссылку на политику конфиденциальности'
		} else if (!isValidHttpUrl(privacyUrl)) {
			errors.privacyUrl =
				'Укажите полную ссылку с протоколом http:// или https://'
		}

		const webhookUrl = cfg.integrations?.webhookUrl?.trim() || ''
		if (webhookUrl && !isValidHttpUrl(webhookUrl)) {
			errors['integrations.webhookUrl'] =
				'Укажите полный URL webhook с http:// или https://'
		}
		const bitrix24WebhookUrl =
			cfg.integrations?.bitrix24WebhookUrl?.trim() || ''
		if (bitrix24WebhookUrl && !isValidHttpUrl(bitrix24WebhookUrl)) {
			errors['integrations.bitrix24WebhookUrl'] =
				'Укажите полный URL Bitrix24 с http:// или https://'
		}

		const validationOrder = [
			'color',
			'bgColor',
			'openButtonColor',
			'name',
			'bubbleText',
			'title',
			'submitButtonText',
			'buttonColor',
			'successTitle',
			firstEmptySlot >= 0 ? `timeSlots.${firstEmptySlot}` : 'timeSlots',
			'privacyUrl',
			'integrations.webhookUrl',
			'integrations.bitrix24WebhookUrl'
		]
		if (showValidationErrors(errors, validationOrder)) return

		const sanitizedConfig: CallbackConfig = {
			...cfg,
			bubbleText: bubbleText.trim(),
			title: cfg.title.trim(),
			subtitle: cfg.subtitle.trim(),
			submitButtonText: cfg.submitButtonText.trim(),
			successTitle: cfg.successTitle.trim(),
			successSubtitle: cfg.successSubtitle.trim(),
			privacyUrl,
			timeSlots: sanitizedSlots,
			autoOpenDelay: autoOpenEnabled ? autoOpenDelay : null
		}

		setFieldErrors({})
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
			className={
				isPagePresentation ? pageStyles.pageEditor : styles.overlay
			}
		>
			{!isPagePresentation && (
				<button
					type="button"
					className={styles.backdrop}
					onClick={requestClose}
					aria-label="Закрыть"
				/>
			)}
			<div
				className={
					isPagePresentation ? pageStyles.pagePanel : styles.modal
				}
				role={isPagePresentation ? 'region' : 'dialog'}
				aria-modal={isPagePresentation ? undefined : true}
				aria-labelledby={titleId}
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
					Настройки обратного звонка
				</h2>
				{lifecycleActions}

				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек обратного звонка"
				>
					{TABS.map(t => (
						<button
							key={t.id}
							type="button"
							id={`${titleId}-tab-${t.id}`}
							role="tab"
							aria-selected={tab === t.id}
							aria-controls={`${titleId}-panel-${t.id}`}
							tabIndex={tab === t.id ? 0 : -1}
							className={`${styles.tab} ${tab === t.id ? styles.tabActive : ''}`}
							onClick={() => setTab(t.id)}
						>
							{t.label}
						</button>
					))}
				</div>

				<WidgetSettingsPreviewPortal
					inline={!isPagePresentation}
					target={previewPortalTarget}
				>
					<WidgetLivePreview
						type="callback"
						config={cfg}
						isHardPlan={canUseCustomButtonImage}
						onDeviceChange={onPreviewDeviceChange}
						onConfigChange={onPreviewConfigChange}
						collapsed={previewCollapsed}
						onCollapsedChange={onPreviewCollapsedChange}
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
					{/* ── Основное ── */}
					{tab === 'main' && (
						<div className={styles.fields}>
							<WidgetPresetButtons
								presets={[
									{
										id: 'quick',
										label: 'Быстрый звонок',
										description: 'Перезвонить клиенту как можно скорее.'
									},
									{
										id: 'consultation',
										label: 'Консультация',
										description: 'Запрос на разговор со специалистом.'
									},
									{
										id: 'booking',
										label: 'Запись по времени',
										description: 'Выбор удобного интервала для звонка.'
									}
								]}
								onApply={preset => {
									setFieldErrors({})
									setCfg(previous => {
										if (preset === 'consultation') {
											return {
												...previous,
												title: 'Получите консультацию',
												subtitle:
													'Оставьте номер — специалист ответит на ваши вопросы',
												submitButtonText: 'Заказать консультацию',
												successTitle: 'Заявка принята',
												bubbleText: 'Нужна консультация?'
											}
										}

										if (preset === 'booking') {
											return {
												...previous,
												title: 'Выберите время звонка',
												subtitle: 'Оставьте номер и подходящий интервал',
												submitButtonText: 'Запланировать звонок',
												successTitle: 'Звонок запланирован',
												bubbleText: 'Записаться на звонок',
												timeSlots: [
													'9:00–11:00',
													'11:00–13:00',
													'13:00–15:00',
													'15:00–17:00',
													'17:00–19:00'
												]
											}
										}

										return {
											...previous,
											title: 'Перезвоним за 5 минут',
											subtitle:
												'Оставьте номер телефона — мы уже на связи',
											submitButtonText: 'Жду звонка',
											successTitle: 'Спасибо! Уже набираем',
											bubbleText: 'Перезвонить?'
										}
									})
									toast.success('Сценарий применён. Сохраните черновик')
								}}
							/>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Внешний вид
									</h3>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Название виджета:</p>
									<input
										ref={setFieldRef('name')}
										className={`${styles.input} ${
											fieldErrors.name ? pageStyles.inputError : ''
										}`}
										value={name}
										onChange={e => {
											clearFieldError('name')
											setName(e.target.value)
										}}
										onBlur={() =>
											setBlurFieldError(
												'name',
												name.trim() ? null : 'Укажите название виджета'
											)
										}
										maxLength={50}
										aria-invalid={Boolean(fieldErrors.name)}
									/>
									{fieldErrors.name ? (
										<p className={pageStyles.fieldError}>
											{fieldErrors.name}
										</p>
									) : (
										<p className={styles.hint}>
											Отображается только в вашем кабинете.
										</p>
									)}
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет акцентов:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={getWidgetColorPreview(cfg.color, '#4705fb')}
											onChange={e => {
												clearFieldError('color')
												set({ color: e.target.value })
											}}
										/>
										<input
											ref={setFieldRef('color')}
											className={`${styles.input} ${
												fieldErrors.color ? pageStyles.inputError : ''
											}`}
											value={cfg.color}
											onChange={e => {
												clearFieldError('color')
												set({ color: e.target.value })
											}}
											onBlur={() =>
												setBlurFieldError(
													'color',
													isWidgetHexColor(cfg.color)
														? null
														: 'Введите цвет в формате #RRGGBB'
												)
											}
											placeholder="#4705fb"
											maxLength={7}
											aria-invalid={Boolean(fieldErrors.color)}
										/>
										{cfg.color && cfg.color !== '#4705fb' && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ color: '#4705fb' })}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									{fieldErrors.color && (
										<p className={pageStyles.fieldError}>
											{fieldErrors.color}
										</p>
									)}
									<p className={styles.hint}>
										Цвет плавающей кнопки и акцентов внутри формы.
									</p>
								</div>

								<details className={styles.advancedBlock}>
									<summary className={styles.advancedSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.advancedContent}>
										<div className={styles.field}>
											<p className={styles.label}>Цвет фона формы</p>
											<div className={styles.colorRow}>
												<input
													type="color"
													className={styles.colorPicker}
													value={getWidgetColorPreview(
														cfg.bgColor,
														'#ffffff'
													)}
													onChange={e => {
														clearFieldError('bgColor')
														set({ bgColor: e.target.value })
													}}
												/>
												<input
													ref={setFieldRef('bgColor')}
													className={`${styles.input} ${
														fieldErrors.bgColor
															? pageStyles.inputError
															: ''
													}`}
													value={cfg.bgColor || ''}
													onChange={e => {
														clearFieldError('bgColor')
														set({ bgColor: e.target.value })
													}}
													onBlur={() =>
														setBlurFieldError(
															'bgColor',
															!cfg.bgColor || isWidgetHexColor(cfg.bgColor)
																? null
																: 'Введите цвет в формате #RRGGBB'
														)
													}
													placeholder="#ffffff"
													maxLength={7}
													aria-invalid={Boolean(fieldErrors.bgColor)}
												/>
												{cfg.bgColor && (
													<button
														type="button"
														className={styles.clearColorBtn}
														onClick={() => {
															clearFieldError('bgColor')
															set({ bgColor: '' })
														}}
														title="Вернуть стандартный фон"
													>
														✕
													</button>
												)}
											</div>
											{fieldErrors.bgColor && (
												<p className={pageStyles.fieldError}>
													{fieldErrors.bgColor}
												</p>
											)}
											<p className={styles.hint}>
												Оставьте пустым для стандартного белого фона.
											</p>
										</div>
									</div>
								</details>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Кнопка открытия
									</h3>
								</div>
								<details className={styles.advancedBlock}>
									<summary className={styles.advancedSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.advancedContent}>
										<div className={styles.field}>
											<p className={styles.label}>Цвет кнопки открытия</p>
											<div className={styles.colorRow}>
												<input
													type="color"
													className={styles.colorPicker}
													value={getWidgetColorPreview(
														cfg.openButtonColor,
														getWidgetColorPreview(cfg.color, '#4705fb')
													)}
													onChange={e => {
														clearFieldError('openButtonColor')
														set({ openButtonColor: e.target.value })
													}}
												/>
												<input
													ref={setFieldRef('openButtonColor')}
													className={`${styles.input} ${
														fieldErrors.openButtonColor
															? pageStyles.inputError
															: ''
													}`}
													value={cfg.openButtonColor || ''}
													onChange={e => {
														clearFieldError('openButtonColor')
														set({ openButtonColor: e.target.value })
													}}
													onBlur={() =>
														setBlurFieldError(
															'openButtonColor',
															!cfg.openButtonColor ||
																isWidgetHexColor(cfg.openButtonColor)
																? null
																: 'Введите цвет в формате #RRGGBB'
														)
													}
													placeholder="Как цвет акцентов"
													maxLength={7}
													aria-invalid={Boolean(
														fieldErrors.openButtonColor
													)}
												/>
												{cfg.openButtonColor && (
													<button
														type="button"
														className={styles.inheritColorBtn}
														onClick={() => {
															clearFieldError('openButtonColor')
															set({ openButtonColor: '' })
														}}
													>
														Вернуть цвет акцентов
													</button>
												)}
											</div>
											{fieldErrors.openButtonColor && (
												<p className={pageStyles.fieldError}>
													{fieldErrors.openButtonColor}
												</p>
											)}
											<p className={styles.hint}>
												Оставьте пустым, чтобы использовать цвет акцентов.
											</p>
										</div>
									</div>
								</details>

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

								<details className={styles.advancedBlock}>
									<summary className={styles.advancedSummary}>
										Расширенные настройки
									</summary>
									<div className={styles.advancedContent}>
										<div className={styles.field}>
											<p className={styles.label}>
												Кнопка открытия — пульсация
											</p>
											<div className={styles.checkRow}>
												<input
													id="cbPulse"
													type="checkbox"
													checked={cfg.buttonPulse !== false}
													onChange={e =>
														set({ buttonPulse: e.target.checked })
													}
												/>
												<label
													htmlFor="cbPulse"
													className={styles.checkLabel}
												>
													Включить пульсацию кнопки
												</label>
											</div>
											<p className={styles.hint}>
												Дополнительный эффект свечения на плавающей кнопке.
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
														buttonSide: e.target.value as 'left' | 'right'
													})
												}
											>
												<option value="right">Справа</option>
												<option value="left">Слева</option>
											</select>
											<p className={styles.hint}>
												С какой стороны экрана будет показана кнопка.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>Отображение облачка</p>
											<div className={styles.checkRow}>
												<input
													type="checkbox"
													id="callbackBubbleEnabled"
													checked={cfg.bubbleEnabled ?? true}
													onChange={e => {
														set({ bubbleEnabled: e.target.checked })
														if (!e.target.checked) {
															clearFieldError('bubbleText')
														}
													}}
												/>
												<label
													htmlFor="callbackBubbleEnabled"
													className={styles.checkLabel}
												>
													Показывать облачко рядом с кнопкой
												</label>
											</div>
											<p className={styles.hint}>
												Если выключить, на сайте останется только плавающая
												кнопка.
											</p>
										</div>

										{cfg.bubbleEnabled !== false && (
											<div className={styles.field}>
												<p className={styles.label}>Текст облачка:</p>
												<input
													ref={setFieldRef('bubbleText')}
													className={`${styles.input} ${
														fieldErrors.bubbleText
															? pageStyles.inputError
															: ''
													}`}
													value={bubbleText}
													onChange={e => {
														clearFieldError('bubbleText')
														set({ bubbleText: e.target.value })
													}}
													onBlur={() =>
														setBlurFieldError(
															'bubbleText',
															bubbleText.trim()
																? null
																: 'Укажите текст облачка или отключите его'
														)
													}
													placeholder="Перезвоним!"
													maxLength={60}
													aria-invalid={Boolean(fieldErrors.bubbleText)}
												/>
												{fieldErrors.bubbleText ? (
													<p className={pageStyles.fieldError}>
														{fieldErrors.bubbleText}
													</p>
												) : (
													<p className={styles.hint}>
														Короткая фраза объясняет посетителю назначение
														кнопки.
													</p>
												)}
											</div>
										)}

										<div className={styles.field}>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>Отступ снизу:</p>
												<span className={pageStyles.rangeValue}>
													{cfg.buttonBottom ?? 3}%
												</span>
											</div>
											<input
												type="range"
												aria-label="Отступ снизу"
												min={1}
												max={50}
												value={cfg.buttonBottom ?? 3}
												onChange={e =>
													set({
														buttonBottom: parseFloat(e.target.value) || 3
													})
												}
												className={pageStyles.rangeInput}
											/>
											<p className={styles.hint}>
												Отступ от нижнего края экрана в процентах. 3 —
												почти внизу, 50 — по центру.
											</p>
										</div>

										<div className={styles.field}>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>Отступ сбоку:</p>
												<span className={pageStyles.rangeValue}>
													{cfg.buttonOffset ?? 3}%
												</span>
											</div>
											<input
												type="range"
												aria-label="Отступ сбоку"
												min={1}
												max={50}
												value={cfg.buttonOffset ?? 3}
												onChange={e =>
													set({
														buttonOffset: parseFloat(e.target.value) || 3
													})
												}
												className={pageStyles.rangeInput}
											/>
											<p className={styles.hint}>
												Отступ кнопки от левого или правого края экрана в
												процентах. 3 — почти у края, 50 — по центру.
											</p>
										</div>

										<div className={styles.field}>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>
													Размер кнопки открытия:
												</p>
												<span className={pageStyles.rangeValue}>
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
													set({
														buttonSize: parseInt(e.target.value) || 60
													})
												}
												className={pageStyles.rangeInput}
											/>
											<p className={styles.hint}>
												Размер плавающей кнопки в пикселях. По умолчанию
												60px.
											</p>
										</div>

										<div className={styles.field}>
											<div className={styles.checkRow}>
												<input
													id="callback-auto-open"
													type="checkbox"
													checked={autoOpenEnabled}
													onChange={e =>
														set({
															autoOpenDelay: e.target.checked
																? autoOpenDelay
																: null
														})
													}
												/>
												<label
													htmlFor="callback-auto-open"
													className={styles.checkLabel}
												>
													Автоматически показывать
												</label>
											</div>
											{autoOpenEnabled && (
												<>
													<div className={pageStyles.rangeHeader}>
														<p className={styles.label}>
															Автооткрытие через:
														</p>
														<span className={pageStyles.rangeValue}>
															{autoOpenDelay} сек.
														</span>
													</div>
													<input
														type="range"
														aria-label="Автооткрытие через"
														min={1}
														max={60}
														step={1}
														value={autoOpenDelay}
														className={pageStyles.rangeInput}
														onChange={e =>
															set({
																autoOpenDelay: Number(e.target.value)
															})
														}
													/>
													<p className={styles.hint}>
														Форма откроется через 1–60 секунд после
														загрузки страницы.
													</p>
												</>
											)}
										</div>
									</div>
								</details>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Опасные действия
									</h3>
								</div>

								<div className={styles.dangerActions}>
									{!confirmResetDefaults ? (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmResetDefaults(true)}
											disabled={isDangerActionPending}
										>
											Сбросить все настройки до значений по умолчанию
										</button>
									) : (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все настройки обратного звонка будут заменены на
												стандартные. Действие необратимо после сохранения.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													disabled={isDangerActionPending}
													onClick={handleResetDefaults}
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
									)}
									<p className={styles.hint}>
										Сбросит цвета, тексты, слоты времени, автооткрытие,
										фильтр дублей и остальные параметры показа. Название,
										домен, интеграции и своя картинка сохранятся.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* ── Форма ── */}
					{tab === 'form' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Содержимое формы
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Заголовок формы</p>
									<input
										ref={setFieldRef('title')}
										className={`${styles.input} ${
											fieldErrors.title ? pageStyles.inputError : ''
										}`}
										value={cfg.title}
										onChange={e => {
											clearFieldError('title')
											set({ title: e.target.value })
										}}
										onBlur={() =>
											setBlurFieldError(
												'title',
												cfg.title.trim() ? null : 'Укажите заголовок формы'
											)
										}
										placeholder="Заказать звонок"
										aria-invalid={Boolean(fieldErrors.title)}
									/>
									{fieldErrors.title ? (
										<p className={pageStyles.fieldError}>
											{fieldErrors.title}
										</p>
									) : (
										<p className={styles.hint}>
											Крупный заголовок внутри окна обратного звонка.
										</p>
									)}
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Описание формы</p>
									<textarea
										className={styles.textarea}
										value={cfg.subtitle}
										onChange={e => set({ subtitle: e.target.value })}
										placeholder="Оставьте номер — перезвоним в удобное время"
									/>
									<p className={styles.hint}>
										Описание под заголовком формы.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Текст кнопки отправки</p>
									<input
										ref={setFieldRef('submitButtonText')}
										className={`${styles.input} ${
											fieldErrors.submitButtonText
												? pageStyles.inputError
												: ''
										}`}
										value={cfg.submitButtonText}
										onChange={e => {
											clearFieldError('submitButtonText')
											set({ submitButtonText: e.target.value })
										}}
										onBlur={() =>
											setBlurFieldError(
												'submitButtonText',
												cfg.submitButtonText.trim()
													? null
													: 'Укажите текст кнопки отправки'
											)
										}
										placeholder="Заказать звонок"
										aria-invalid={Boolean(fieldErrors.submitButtonText)}
									/>
									{fieldErrors.submitButtonText ? (
										<p className={pageStyles.fieldError}>
											{fieldErrors.submitButtonText}
										</p>
									) : (
										<p className={styles.hint}>
											Текст кнопки, на которую нажимает посетитель.
										</p>
									)}
								</div>

								<details className={styles.advancedBlock}>
									<summary className={styles.advancedSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.advancedContent}>
										<div className={styles.field}>
											<p className={styles.label}>Цвет кнопки отправки</p>
											<div className={styles.colorRow}>
												<input
													type="color"
													className={styles.colorPicker}
													value={getWidgetColorPreview(
														cfg.buttonColor,
														getWidgetColorPreview(cfg.color, '#4705fb')
													)}
													onChange={e => {
														clearFieldError('buttonColor')
														set({ buttonColor: e.target.value })
													}}
												/>
												<input
													ref={setFieldRef('buttonColor')}
													className={`${styles.input} ${
														fieldErrors.buttonColor
															? pageStyles.inputError
															: ''
													}`}
													value={cfg.buttonColor || ''}
													onChange={e => {
														clearFieldError('buttonColor')
														set({ buttonColor: e.target.value })
													}}
													onBlur={() =>
														setBlurFieldError(
															'buttonColor',
															!cfg.buttonColor ||
																isWidgetHexColor(cfg.buttonColor)
																? null
																: 'Введите цвет в формате #RRGGBB'
														)
													}
													placeholder="Как цвет акцентов"
													maxLength={7}
													aria-invalid={Boolean(fieldErrors.buttonColor)}
												/>
												{cfg.buttonColor && (
													<button
														type="button"
														className={styles.inheritColorBtn}
														onClick={() => {
															clearFieldError('buttonColor')
															set({ buttonColor: '' })
														}}
													>
														Вернуть цвет акцентов
													</button>
												)}
											</div>
											{fieldErrors.buttonColor && (
												<p className={pageStyles.fieldError}>
													{fieldErrors.buttonColor}
												</p>
											)}
											<p className={styles.hint}>
												Оставьте пустым, чтобы использовать цвет акцентов.
											</p>
										</div>
									</div>
								</details>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Экран успеха
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Заголовок</p>
									<input
										ref={setFieldRef('successTitle')}
										className={`${styles.input} ${
											fieldErrors.successTitle ? pageStyles.inputError : ''
										}`}
										value={cfg.successTitle}
										onChange={e => {
											clearFieldError('successTitle')
											set({ successTitle: e.target.value })
										}}
										onBlur={() =>
											setBlurFieldError(
												'successTitle',
												cfg.successTitle.trim()
													? null
													: 'Укажите заголовок экрана успеха'
											)
										}
										placeholder="Спасибо! Мы перезвоним"
										aria-invalid={Boolean(fieldErrors.successTitle)}
									/>
									{fieldErrors.successTitle ? (
										<p className={pageStyles.fieldError}>
											{fieldErrors.successTitle}
										</p>
									) : (
										<p className={styles.hint}>
											Крупный текст на экране подтверждения.
										</p>
									)}
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок</p>
									<textarea
										className={styles.textarea}
										value={cfg.successSubtitle}
										onChange={e =>
											set({ successSubtitle: e.target.value })
										}
										placeholder="Ожидайте звонка в выбранное время"
									/>
									<p className={styles.hint}>
										Дополнительный текст под заголовком экрана успеха.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Время звонка
									</h3>
								</div>
								<p className={styles.hint}>
									Добавьте от 1 до {MAX_TIME_SLOTS} понятных посетителю
									вариантов.
								</p>

								<div
									ref={setFieldRef('timeSlots')}
									className={styles.slotList}
									tabIndex={-1}
								>
									{(cfg.timeSlots || []).map((slot, i) => (
										<div key={i} className={styles.slotItem}>
											<div className={styles.slotRow}>
												<input
													ref={setFieldRef(`timeSlots.${i}`)}
													className={`${styles.slotInput} ${
														fieldErrors[`timeSlots.${i}`]
															? pageStyles.inputError
															: ''
													}`}
													value={slot}
													onChange={e => updateSlot(i, e.target.value)}
													onBlur={() =>
														setBlurFieldError(
															`timeSlots.${i}`,
															slot.trim()
																? null
																: 'Заполните или удалите пустой слот времени'
														)
													}
													placeholder="Например: 10:00–12:00"
													aria-invalid={Boolean(
														fieldErrors[`timeSlots.${i}`]
													)}
												/>
												<button
													type="button"
													className={styles.removeBtn}
													onClick={() => removeSlot(i)}
													aria-label="Удалить слот"
												>
													✕
												</button>
											</div>
											{fieldErrors[`timeSlots.${i}`] && (
												<p className={pageStyles.fieldError}>
													{fieldErrors[`timeSlots.${i}`]}
												</p>
											)}
										</div>
									))}
								</div>
								{fieldErrors.timeSlots && (
									<p className={pageStyles.fieldError}>
										{fieldErrors.timeSlots}
									</p>
								)}

								<button
									type="button"
									className={styles.addBtn}
									onClick={addSlot}
									disabled={(cfg.timeSlots || []).length >= MAX_TIME_SLOTS}
								>
									{(cfg.timeSlots || []).length >= MAX_TIME_SLOTS
										? `Достигнут лимит: ${MAX_TIME_SLOTS}`
										: '+ Добавить время'}
								</button>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Согласие и защита
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ссылка на политику конфиденциальности
									</p>
									<input
										ref={setFieldRef('privacyUrl')}
										className={`${styles.input} ${
											fieldErrors.privacyUrl ? pageStyles.inputError : ''
										}`}
										value={cfg.privacyUrl}
										onChange={e => {
											clearFieldError('privacyUrl')
											set({ privacyUrl: e.target.value })
										}}
										onBlur={() => {
											const value = cfg.privacyUrl.trim()
											setBlurFieldError(
												'privacyUrl',
												!value
													? 'Укажите ссылку на политику конфиденциальности'
													: isValidHttpUrl(value)
														? null
														: 'Укажите полную ссылку с протоколом http:// или https://'
											)
										}}
										placeholder="https://example.com/privacy"
										aria-invalid={Boolean(fieldErrors.privacyUrl)}
									/>
									{fieldErrors.privacyUrl ? (
										<p className={pageStyles.fieldError}>
											{fieldErrors.privacyUrl}
										</p>
									) : (
										<p className={styles.hint}>
											Укажите полную публичную ссылку с протоколом
											https://.
										</p>
									)}
								</div>

								<details className={styles.advancedBlock}>
									<summary className={styles.advancedSummary}>
										Расширенные настройки
									</summary>
									<div className={styles.advancedContent}>
										<div className={styles.field}>
											<div className={styles.checkRow}>
												<input
													id="cbFilterDuplicates"
													type="checkbox"
													checked={cfg.filterDuplicates === true}
													onChange={e =>
														set({ filterDuplicates: e.target.checked })
													}
												/>
												<label
													htmlFor="cbFilterDuplicates"
													className={styles.checkLabel}
												>
													Не принимать повторные заявки
												</label>
											</div>
											<p className={styles.hint}>
												При включении повторная заявка с того же IP будет
												отклоняться. Тот же телефон в течение 30 минут
												блокируется всегда.
											</p>
										</div>
									</div>
								</details>
							</div>
						</div>
					)}

					{/* ── Интеграции ── */}
					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Уведомления
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Отправка заявок на Email</p>
									<input
										type="email"
										className={styles.input}
										value={cfg.integrations?.email || ''}
										onChange={e => setIntegration('email', e.target.value)}
										placeholder="you@example.com"
									/>
									<p className={styles.hint}>
										Уведомление о каждой новой заявке придёт на этот email.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отправка заявок в Telegram
									</p>
									<input
										className={styles.input}
										value={cfg.integrations?.telegramChatId || ''}
										onChange={e =>
											setIntegration('telegramChatId', e.target.value)
										}
										placeholder="-100xxxxxxxxxx"
									/>
									<p className={styles.hint}>
										Напишите боту <b>@winwidget_info_bot</b> команду
										/start, затем укажите сюда ваш Telegram ID. Узнать ID
										можно через бот <b>@getmyid_bot</b>.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Webhooks и CRM
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Внешний URL (Webhook)</p>
									<input
										ref={setFieldRef('integrations.webhookUrl')}
										className={`${styles.input} ${
											fieldErrors['integrations.webhookUrl']
												? pageStyles.inputError
												: ''
										}`}
										type="url"
										value={cfg.integrations?.webhookUrl || ''}
										onChange={e => {
											clearFieldError('integrations.webhookUrl')
											setIntegration('webhookUrl', e.target.value)
										}}
										onBlur={() => {
											const value =
												cfg.integrations?.webhookUrl?.trim() || ''
											setBlurFieldError(
												'integrations.webhookUrl',
												!value || isValidHttpUrl(value)
													? null
													: 'Укажите полный URL webhook с http:// или https://'
											)
										}}
										placeholder="https://example.com/webhook"
										aria-invalid={Boolean(
											fieldErrors['integrations.webhookUrl']
										)}
									/>
									{fieldErrors['integrations.webhookUrl'] && (
										<p className={pageStyles.fieldError}>
											{fieldErrors['integrations.webhookUrl']}
										</p>
									)}
									<p className={styles.hint}>
										POST-запрос с полями: <b>phone</b>, <b>timeSlot</b>,{' '}
										<b>timezone</b>, <b>url</b>, <b>time</b>.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отправка заявок в Битрикс24
									</p>
									<input
										ref={setFieldRef('integrations.bitrix24WebhookUrl')}
										className={`${styles.input} ${
											fieldErrors['integrations.bitrix24WebhookUrl']
												? pageStyles.inputError
												: ''
										}`}
										type="url"
										value={cfg.integrations?.bitrix24WebhookUrl || ''}
										onChange={e => {
											clearFieldError('integrations.bitrix24WebhookUrl')
											setIntegration('bitrix24WebhookUrl', e.target.value)
										}}
										onBlur={() => {
											const value =
												cfg.integrations?.bitrix24WebhookUrl?.trim() || ''
											setBlurFieldError(
												'integrations.bitrix24WebhookUrl',
												!value || isValidHttpUrl(value)
													? null
													: 'Укажите полный URL Bitrix24 с http:// или https://'
											)
										}}
										placeholder="https://b24-xxxxx.bitrix24.ru/rest/1/key/"
										aria-invalid={Boolean(
											fieldErrors['integrations.bitrix24WebhookUrl']
										)}
									/>
									{fieldErrors['integrations.bitrix24WebhookUrl'] && (
										<p className={pageStyles.fieldError}>
											{fieldErrors['integrations.bitrix24WebhookUrl']}
										</p>
									)}
									<p className={styles.hint}>
										Укажите URL входящего вебхука из Битрикс24. Новые
										заявки будут создаваться как лиды в CRM.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — домен аккаунта</p>
									<input
										className={styles.input}
										value={cfg.integrations?.amoCrmDomain || ''}
										onChange={e =>
											setIntegration('amoCrmDomain', e.target.value)
										}
										placeholder="example.amocrm.ru"
									/>
									<p className={styles.hint}>
										Домен вашего аккаунта amoCRM, например{' '}
										<b>mycompany.amocrm.ru</b>.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — токен доступа</p>
									<input
										type="password"
										className={styles.input}
										value={cfg.integrations?.amoCrmToken || ''}
										onChange={e =>
											setIntegration('amoCrmToken', e.target.value)
										}
										placeholder="Долгосрочный токен из настроек API"
									/>
									<p className={styles.hint}>
										Перейдите в amoCRM → Настройки → Интеграции → API →
										скопируйте долгосрочный токен.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>Аналитика</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Яндекс Метрика — ID счётчика
									</p>
									<input
										className={styles.input}
										value={cfg.integrations?.yandexMetrikaId || ''}
										onChange={e =>
											setIntegration('yandexMetrikaId', e.target.value)
										}
										placeholder="12345678"
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>wcb_open</b>,
										при отправке заявки — <b>wcb_send</b>. Счётчик должен
										быть установлен на странице сайта.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ретаргетинг ВКонтакте — ID пикселя
									</p>
									<input
										className={styles.input}
										value={cfg.integrations?.vkPixelId || ''}
										onChange={e =>
											setIntegration('vkPixelId', e.target.value)
										}
										placeholder="VK-RTRG-000000-xxxxx"
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется событие{' '}
										<b>wcb_open</b>, при отправке заявки — <b>wcb_send</b>.
										Пиксель VK должен быть установлен на странице сайта.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Roistat</p>
									<div className={styles.checkRow}>
										<input
											id="cbRoistat"
											type="checkbox"
											checked={cfg.integrations?.roistatEnabled || false}
											onChange={e =>
												setIntegration('roistatEnabled', e.target.checked)
											}
										/>
										<label
											htmlFor="cbRoistat"
											className={styles.checkLabel}
										>
											Включить отправку целей в Roistat
										</label>
									</div>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>wcb_open</b>,
										при отправке заявки — <b>wcb_send</b>. Код Roistat
										должен быть подключён на странице сайта.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* ── Код ── */}
					{tab === 'code' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Установка на сайт
									</h3>
								</div>

								<div className={styles.field}>
									<label
										className={styles.label}
										htmlFor={`${titleId}-install-domain`}
									>
										Домен установки виджета:
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
									<p className={styles.label}>
										Скрипт для вставки на сайт
									</p>
									<textarea
										readOnly
										className={`${styles.input} ${styles.codeArea}`}
										rows={3}
										value={embedCode}
										onClick={e =>
											(e.target as HTMLTextAreaElement).select()
										}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() =>
											copyToClipboard(embedCode, 'Код скопирован', true)
										}
									>
										Копировать код
									</button>
									<p className={styles.hint}>
										Вставьте этот код перед закрывающим тегом &lt;/body&gt;
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Прямая ссылка
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Прямая ссылка:</p>
									<div className={styles.directLink}>
										<input
											className={styles.input}
											readOnly
											value={previewUrl}
											onClick={e =>
												(e.target as HTMLInputElement).select()
											}
										/>
										<a
											href={previewUrl}
											target="_blank"
											rel="noopener noreferrer"
											className={styles.openLink}
										>
											Открыть
										</a>
									</div>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() =>
											copyToClipboard(previewUrl, 'Ссылка скопирована')
										}
									>
										Копировать ссылку
									</button>
									<p className={styles.hint}>
										После публикации работает без установки кода и
										сохранённого домена. Доступ зависит от активности
										виджета, подписки и лимита заявок.
									</p>
									<DirectLinkQr
										value={previewUrl}
										downloadName={`winwidget-callback-${callback.publicKey}.png`}
									/>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Как работает обратный звонок
									</h3>
								</div>
								<p className={styles.infoText}>
									Виджет открывает форму заказа звонка. Посетитель
									оставляет телефон, при необходимости выбирает удобное
									время, а заявка сохраняется в кабинете и отправляется в
									подключённые каналы.
								</p>
								<ul className={styles.infoList}>
									<li>
										В «Главных» настройте внешний вид и кнопку открытия.
									</li>
									<li>
										В «Форме» задайте содержимое, цвет кнопки отправки,
										тексты успеха и варианты времени звонка.
									</li>
									<li>
										В «Интеграциях» подключите уведомления, CRM, webhook и
										аналитику.
									</li>
									<li>
										В «Установке» добавьте виджет на сайт или используйте
										прямую ссылку/QR-код.
									</li>
								</ul>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Что проверить перед запуском
									</h3>
								</div>
								<ul className={styles.infoList}>
									<li>
										Проверьте номер телефона в тестовой заявке и выбранный
										временной слот.
									</li>
									<li>
										Убедитесь, что заявки приходят в нужный email, Telegram
										или CRM.
									</li>
									<li>
										Настройте защиту от дублей, если повторные заявки от
										одного контакта нежелательны.
									</li>
									<li>
										Проверьте мобильную версию: кнопка должна быть заметной
										и не мешать покупке.
									</li>
								</ul>
							</div>
						</div>
					)}
					{tab !== 'code' && tab !== 'info' && (
						<div className={styles.sectionReset}>
							<button
								type="button"
								className={styles.resetAttemptsBtn}
								onClick={() => setConfirmResetSection(tab)}
								disabled={isDangerActionPending}
							>
								Сбросить раздел
							</button>
							<p className={styles.hint}>
								Остальные разделы и домен установки не изменятся.
							</p>
						</div>
					)}
				</div>

				<div className={styles.stickyFooter}>
					<p
						className={`${styles.saveStatus} ${hasUnsavedChanges ? styles.saveStatusDirty : ''}`}
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
							disabled={mutation.isPending}
						>
							{isPagePresentation ? 'К виджетам' : 'Отмена'}
						</button>
						<ActionTooltip
							content="Сохраняет настройки в черновик. На сайте они появятся только после публикации."
							disabled={mutation.isPending || !hasUnsavedChanges}
							disabledContent={
								mutation.isPending
									? 'Черновик уже сохраняется.'
									: 'Нет изменений для сохранения.'
							}
							align="end"
							responsiveFill
						>
							<button
								type="button"
								className={styles.saveBtn}
								disabled={mutation.isPending || !hasUnsavedChanges}
								onClick={handleSave}
							>
								{mutation.isPending
									? 'Сохранение...'
									: 'Сохранить черновик'}
							</button>
						</ActionTooltip>
					</div>
				</div>
				{closeGuardDialog}
				{confirmResetSection && (
					<ConfirmDialog
						title="Сбросить текущий раздел?"
						message="Настройки только этого раздела будут заменены стандартными. Остальные разделы и домен установки сохранятся."
						confirmLabel="Да, сбросить раздел"
						cancelLabel="Отмена"
						confirmDisabled={isDangerActionPending}
						onConfirm={handleResetSection}
						onCancel={() => setConfirmResetSection(null)}
					/>
				)}
			</div>
		</div>
	)
}

export default CallbackSettingsModal
