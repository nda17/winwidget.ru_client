'use client'

import { countdownTimerService } from '@/entities/site-widget'
import {
	CountdownTimer,
	CountdownTimerConfig
} from '@/entities/site-widget'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import { ChangeEvent, useEffect, useId, useRef, useState } from 'react'
import toast from 'react-hot-toast'
import ActionTooltip from '../shared/ActionTooltip'
import DirectLinkQr from '../shared/DirectLinkQr'
import {
	findInvalidWidgetColor,
	getWidgetColorPreview,
	isWidgetHexColor
} from '../shared/widgetColor'
import styles from '../shared/WidgetSettingsModal.module.scss'
import useWidgetSettingsCloseGuard from '../shared/useWidgetSettingsCloseGuard'
import WidgetLivePreview from '../shared/WidgetLivePreview'
import WidgetPresetButtons from '../shared/WidgetPresetButtons'
import type {
	WidgetSettingsPersistence,
	WidgetSettingsPresentationProps
} from '../shared/WidgetSettingsPersistence'
import WidgetSettingsPreviewPortal from '../shared/WidgetSettingsPreviewPortal'

type Tab = 'main' | 'timer' | 'form' | 'integrations' | 'code' | 'info'
const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024

interface Props extends WidgetSettingsPresentationProps {
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
	{ id: 'main', label: 'Основные' },
	{ id: 'timer', label: 'Таймер' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Установка' },
	{ id: 'info', label: 'Проверка' }
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

const toDateTimeLocal = (iso?: string) => {
	if (!iso) return ''
	const date = new Date(iso)
	if (Number.isNaN(date.getTime())) return ''
	const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
	return local.toISOString().slice(0, 16)
}

const fromDateTimeLocal = (value: string) =>
	value ? new Date(value).toISOString() : ''

const isValidHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const isValidActionUrl = (value: string) => {
	try {
		const url = new URL(value, 'https://example.com')
		return ['http:', 'https:', 'tel:', 'mailto:'].includes(url.protocol)
	} catch {
		return false
	}
}

const formatDuration = (minutes: number) => {
	if (minutes >= 1440 && minutes % 1440 === 0) {
		return `${minutes / 1440} дн.`
	}
	if (minutes >= 60 && minutes % 60 === 0) {
		return `${minutes / 60} ч.`
	}
	return `${minutes} мин.`
}

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
	persistence,
	presentation = 'modal',
	previewPortalTarget,
	onDirtyChange,
	onRevisionConflict,
	lifecycleActions,
	onPreviewDeviceChange,
	onPreviewConfigChange
}: Props) => {
	const settingsPanelRef = useRef<HTMLDivElement | null>(null)
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
	const draftRevisionRef = useRef(timer.draftRevision)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [confirmResetTimers, setConfirmResetTimers] = useState(false)
	const [confirmResetSection, setConfirmResetSection] = useState<Exclude<
		Tab,
		'code' | 'info'
	> | null>(null)
	const [fieldErrors, setFieldErrors] = useState<Record<string, string>>(
		{}
	)
	const fieldRefs = useRef<Record<string, HTMLElement | null>>({})
	const pendingFocusFieldRef = useRef<string | null>(null)
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
			config: CountdownTimerConfig
		}) =>
			(
				persistence?.update ??
				(payload =>
					countdownTimerService.updateCountdownTimer(timer.id, payload))
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
			const nextConfig = mergeConfig(updated.config)
			toast.success('Сохранено', { id: toastId })
			setFieldErrors({})
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
				: countdownTimerService.uploadButtonImage(timer.id, formData)
		},
		onMutate: () =>
			toast.loading('Загружаем картинку кнопки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
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

	const set = (patch: Partial<CountdownTimerConfig>) =>
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

	const getFieldError = (field: string): string | undefined => {
		if (field === 'color' && !isWidgetHexColor(cfg.color)) {
			return 'Введите цвет в формате #RRGGBB'
		}
		if (
			field === 'bgColor' &&
			cfg.bgColor &&
			!isWidgetHexColor(cfg.bgColor)
		) {
			return 'Введите цвет в формате #RRGGBB'
		}
		if (
			field === 'openButtonColor' &&
			cfg.openButtonColor &&
			!isWidgetHexColor(cfg.openButtonColor)
		) {
			return 'Введите цвет в формате #RRGGBB'
		}
		if (
			field === 'buttonColor' &&
			cfg.buttonColor &&
			!isWidgetHexColor(cfg.buttonColor)
		) {
			return 'Введите цвет в формате #RRGGBB'
		}
		if (field === 'name' && !name.trim()) {
			return 'Укажите название виджета'
		}
		if (field === 'bubbleText' && !cfg.bubbleText.trim()) {
			return 'Укажите текст облачка'
		}
		if (field === 'title' && !cfg.title.trim()) {
			return 'Укажите заголовок предложения'
		}
		if (field === 'deadlineAt' && cfg.timerMode === 'FIXED_DATE') {
			if (!cfg.deadlineAt) return 'Укажите дату окончания таймера'
			if (
				!Number.isFinite(new Date(cfg.deadlineAt).getTime()) ||
				new Date(cfg.deadlineAt).getTime() <= Date.now()
			) {
				return 'Дата окончания должна быть в будущем'
			}
		}
		if (
			field === 'evergreenDurationMinutes' &&
			cfg.timerMode === 'EVERGREEN' &&
			(cfg.evergreenDurationMinutes < 1 ||
				cfg.evergreenDurationMinutes > 10080)
		) {
			return 'Длительность таймера: от 1 минуты до 7 дней'
		}
		if (
			field === 'expiredTitle' &&
			cfg.expiredBehavior !== 'hide' &&
			!cfg.expiredTitle.trim()
		) {
			return 'Укажите заголовок после окончания таймера'
		}
		if (field === 'actionButtonUrl') {
			const actionButtonUrl = cfg.actionButtonUrl.trim()
			if (cfg.expiredBehavior === 'disableForm' && !actionButtonUrl) {
				return 'Для этого сценария укажите ссылку, которая останется после окончания'
			}
			if (actionButtonUrl && !isValidActionUrl(actionButtonUrl)) {
				return 'Укажите корректную ссылку для перехода'
			}
		}
		if (
			field === 'actionButtonText' &&
			cfg.actionButtonUrl.trim() &&
			!cfg.actionButtonText.trim()
		) {
			return 'Укажите текст кнопки перехода'
		}
		if (
			field === 'submissionCooldownDays' &&
			cfg.dataType !== 'NONE' &&
			cfg.filterDuplicates &&
			(cfg.submissionCooldownDays < 0 || cfg.submissionCooldownDays > 365)
		) {
			return 'Период повторной заявки: от 0 до 365 дней'
		}
		if (cfg.dataType !== 'NONE') {
			if (field === 'contactTitle' && !cfg.contactTitle.trim()) {
				return 'Укажите заголовок формы контактов'
			}
			if (field === 'submitButtonText' && !cfg.submitButtonText.trim()) {
				return 'Укажите текст кнопки отправки'
			}
			if (field === 'successTitle' && !cfg.successTitle.trim()) {
				return 'Укажите заголовок после отправки'
			}
			if (field === 'privacyUrl') {
				const privacyUrl = cfg.privacyUrl.trim()
				if (!privacyUrl) {
					return 'Укажите ссылку на политику конфиденциальности'
				}
				if (!isValidHttpUrl(privacyUrl)) {
					return 'Укажите полную ссылку с протоколом http:// или https://'
				}
			}
		}
		return undefined
	}

	const validateFieldOnBlur = (field: string) => {
		const message = getFieldError(field)
		setFieldErrors(previous => {
			const next = { ...previous }
			if (message) next[field] = message
			else delete next[field]
			return next
		})
	}

	const getFieldTab = (field: string): Tab => {
		if (
			field === 'name' ||
			field === 'bubbleText' ||
			field === 'color' ||
			field === 'bgColor' ||
			field === 'openButtonColor'
		) {
			return 'main'
		}
		if (
			field === 'deadlineAt' ||
			field === 'evergreenDurationMinutes' ||
			field === 'expiredTitle'
		) {
			return 'timer'
		}
		return 'form'
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
		setTab(getFieldTab(firstField))
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
	const embedCode = `<script src="${apiUrl}/widgets/timer.js" data-key="${timer.publicKey}" async></script>`
	const previewUrl = `${publicSiteUrl}/page-timer/${timer.publicKey}`
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
	const defaultButtonImageUrl = `${apiUrl}/widgets/timer-button.png`
	const buttonImagePreviewUrl = cfg.buttonImageUrl || defaultButtonImageUrl
	const buttonImageUploadDisabled =
		!canUseCustomButtonImage ||
		hasUnsavedChanges ||
		buttonImageMutation.isPending
	const autoOpenEnabled =
		cfg.autoOpenDelay !== null &&
		cfg.autoOpenDelay !== undefined &&
		cfg.autoOpenDelay > 0
	const autoOpenDelay = Math.min(60, Math.max(1, cfg.autoOpenDelay ?? 5))

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
			name: name.trim() || 'Таймер',
			config: nextConfig
		})
	}

	const handleSave = () => {
		const invalidColor = !isWidgetHexColor(cfg.color)
			? 'color'
			: findInvalidWidgetColor(cfg)
		if (invalidColor) {
			const colorField = invalidColor.split('.').pop() || 'color'
			showValidationErrors(
				{ [colorField]: 'Введите цвет в формате #RRGGBB' },
				[colorField]
			)
			return
		}

		const sanitizedName = name.trim()
		const actionButtonUrl = cfg.actionButtonUrl.trim()
		const actionButtonText = cfg.actionButtonText.trim()
		const privacyUrl = cfg.privacyUrl.trim()
		const errors: Record<string, string> = {}

		if (!sanitizedName) {
			errors.name = 'Укажите название виджета'
		}
		if (!cfg.bubbleText.trim()) {
			errors.bubbleText = 'Укажите текст облачка'
		}
		if (!cfg.title.trim()) {
			errors.title = 'Укажите заголовок предложения'
		}
		if (cfg.timerMode === 'FIXED_DATE' && !cfg.deadlineAt) {
			errors.deadlineAt = 'Укажите дату окончания таймера'
		} else if (
			cfg.timerMode === 'FIXED_DATE' &&
			(!Number.isFinite(new Date(cfg.deadlineAt).getTime()) ||
				new Date(cfg.deadlineAt).getTime() <= Date.now())
		) {
			errors.deadlineAt = 'Дата окончания должна быть в будущем'
		}
		if (
			cfg.timerMode === 'EVERGREEN' &&
			(cfg.evergreenDurationMinutes < 1 ||
				cfg.evergreenDurationMinutes > 10080)
		) {
			errors.evergreenDurationMinutes =
				'Длительность таймера: от 1 минуты до 7 дней'
		}
		if (cfg.expiredBehavior !== 'hide' && !cfg.expiredTitle.trim()) {
			errors.expiredTitle = 'Укажите заголовок после окончания таймера'
		}
		if (cfg.expiredBehavior === 'disableForm' && !actionButtonUrl) {
			errors.actionButtonUrl =
				'Для этого сценария укажите ссылку, которая останется после окончания'
		} else if (actionButtonUrl && !isValidActionUrl(actionButtonUrl)) {
			errors.actionButtonUrl = 'Укажите корректную ссылку для перехода'
		}
		if (actionButtonUrl && !actionButtonText) {
			errors.actionButtonText = 'Укажите текст кнопки перехода'
		}
		if (
			cfg.dataType !== 'NONE' &&
			cfg.filterDuplicates &&
			(cfg.submissionCooldownDays < 0 || cfg.submissionCooldownDays > 365)
		) {
			errors.submissionCooldownDays =
				'Период повторной заявки: от 0 до 365 дней'
		}
		if (cfg.dataType !== 'NONE') {
			if (!cfg.contactTitle.trim()) {
				errors.contactTitle = 'Укажите заголовок формы контактов'
			}
			if (!cfg.submitButtonText.trim()) {
				errors.submitButtonText = 'Укажите текст кнопки отправки'
			}
			if (!cfg.successTitle.trim()) {
				errors.successTitle = 'Укажите заголовок после отправки'
			}
			if (!privacyUrl) {
				errors.privacyUrl = 'Укажите ссылку на политику конфиденциальности'
			} else if (!isValidHttpUrl(privacyUrl)) {
				errors.privacyUrl =
					'Укажите полную ссылку с протоколом http:// или https://'
			}
		}

		const validationOrder = [
			'name',
			'bubbleText',
			'deadlineAt',
			'evergreenDurationMinutes',
			'expiredTitle',
			'title',
			'actionButtonUrl',
			'actionButtonText',
			'contactTitle',
			'submitButtonText',
			'submissionCooldownDays',
			'successTitle',
			'privacyUrl'
		]
		if (showValidationErrors(errors, validationOrder)) return

		const sanitizedConfig: CountdownTimerConfig = {
			...cfg,
			bubbleText: cfg.bubbleText.trim(),
			title: cfg.title.trim(),
			subtitle: cfg.subtitle.trim(),
			expiredTitle: cfg.expiredTitle.trim(),
			expiredSubtitle: cfg.expiredSubtitle.trim(),
			contactTitle: cfg.contactTitle.trim(),
			submitButtonText: cfg.submitButtonText.trim(),
			successTitle: cfg.successTitle.trim(),
			successSubtitle: cfg.successSubtitle.trim(),
			submissionCooldownDays: Math.max(
				0,
				Math.min(365, cfg.submissionCooldownDays || 0)
			),
			actionButtonUrl,
			actionButtonText: actionButtonText || 'Перейти к акции',
			privacyUrl,
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

	const handleResetDefaults = () => {
		const resetConfig = {
			...getDefaultConfig(),
			integrations: { ...cfg.integrations },
			buttonImageUrl: cfg.buttonImageUrl,
			timerResetToken: cfg.timerResetToken
		}
		setFieldErrors({})
		setCfg(resetConfig)
		setConfirmResetDefaults(false)
		toast.success('Стандартные настройки применены. Сохраните черновик')
	}

	const handleResetTimers = () => {
		const token =
			typeof crypto !== 'undefined' && 'randomUUID' in crypto
				? crypto.randomUUID()
				: String(Date.now())
		const nextConfig = { ...cfg, timerResetToken: token }
		setCfg(nextConfig)
		setConfirmResetTimers(false)
		toast.success(
			'Сброс добавлен в черновик. Сохраните черновик и опубликуйте; затем сброс вступит в силу'
		)
	}

	const handleResetSection = (section: Exclude<Tab, 'code' | 'info'>) => {
		const defaults = getDefaultConfig()
		setCfg(previous => {
			if (section === 'main') {
				return {
					...previous,
					color: defaults.color,
					bgColor: defaults.bgColor,
					openButtonColor: defaults.openButtonColor,
					buttonSide: defaults.buttonSide,
					buttonPulse: defaults.buttonPulse,
					buttonBottom: defaults.buttonBottom,
					buttonOffset: defaults.buttonOffset,
					buttonSize: defaults.buttonSize,
					buttonImageUrl: defaults.buttonImageUrl,
					autoOpenDelay: defaults.autoOpenDelay,
					bubbleText: defaults.bubbleText
				}
			}
			if (section === 'timer') {
				return {
					...previous,
					timerMode: defaults.timerMode,
					deadlineAt: defaults.deadlineAt,
					evergreenDurationMinutes: defaults.evergreenDurationMinutes,
					expiredBehavior: defaults.expiredBehavior,
					expiredTitle: defaults.expiredTitle,
					expiredSubtitle: defaults.expiredSubtitle
				}
			}
			if (section === 'form') {
				return {
					...previous,
					title: defaults.title,
					subtitle: defaults.subtitle,
					buttonColor: defaults.buttonColor,
					dataType: defaults.dataType,
					contactTitle: defaults.contactTitle,
					submitButtonText: defaults.submitButtonText,
					successTitle: defaults.successTitle,
					successSubtitle: defaults.successSubtitle,
					actionButtonText: defaults.actionButtonText,
					actionButtonUrl: defaults.actionButtonUrl,
					privacyUrl: defaults.privacyUrl,
					developInfoActive: defaults.developInfoActive,
					filterDuplicates: defaults.filterDuplicates,
					submissionCooldownDays: defaults.submissionCooldownDays
				}
			}
			return {
				...previous,
				integrations: { ...defaults.integrations }
			}
		})
		setFieldErrors({})
		setConfirmResetSection(null)
		toast.success('Раздел сброшен в черновике. Сохраните черновик')
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
					aria-label="Закрыть"
				/>
			)}
			<div
				ref={settingsPanelRef}
				className={isPagePresentation ? styles.pagePanel : styles.modal}
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
					Настройки таймера
				</h2>
				{lifecycleActions}
				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек таймера"
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
						type="timer"
						config={cfg}
						isHardPlan={canUseCustomButtonImage}
						onDeviceChange={onPreviewDeviceChange}
						onConfigChange={onPreviewConfigChange}
						scrollTargetRef={settingsPanelRef}
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
							<WidgetPresetButtons
								presets={[
									{
										id: 'flash',
										label: 'Флеш-акция',
										description: '15 минут для быстрого решения.'
									},
									{
										id: 'day',
										label: 'Акция на сутки',
										description: 'Персональный таймер на 24 часа.'
									},
									{
										id: 'deadline',
										label: 'Общий дедлайн',
										description:
											'Одна дата окончания для всех посетителей.'
									}
								]}
								onApply={preset => {
									setFieldErrors({})
									setCfg(previous => {
										if (preset === 'deadline') {
											const endOfWeek = new Date()
											endOfWeek.setDate(
												endOfWeek.getDate() +
													((7 - endOfWeek.getDay()) % 7)
											)
											endOfWeek.setHours(23, 59, 59, 999)

											return {
												...previous,
												timerMode: 'FIXED_DATE',
												deadlineAt: endOfWeek.toISOString(),
												title: 'Предложение действует до конца недели',
												subtitle:
													'Успейте воспользоваться специальными условиями',
												bubbleText: 'До конца акции'
											}
										}

										const isDay = preset === 'day'
										return {
											...previous,
											timerMode: 'EVERGREEN',
											evergreenDurationMinutes: isDay ? 1440 : 15,
											title: isDay
												? 'Персональная скидка на 24 часа'
												: 'Скидка сгорит через 15 минут',
											subtitle:
												'Воспользуйтесь предложением до окончания таймера',
											bubbleText: isDay
												? 'Ваша скидка активна'
												: 'Успейте забрать скидку'
										}
									})
									toast.success('Сценарий применён. Сохраните черновик')
								}}
							/>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Внешний вид</h3>
								<div className={styles.field}>
									<p className={styles.label}>Название виджета:</p>
									<input
										ref={setFieldRef('name')}
										className={`${styles.input} ${
											fieldErrors.name ? styles.inputError : ''
										}`}
										value={name}
										onChange={e => {
											clearFieldError('name')
											setName(e.target.value)
										}}
										onBlur={() => validateFieldOnBlur('name')}
										maxLength={50}
										aria-invalid={Boolean(fieldErrors.name)}
									/>
									{fieldErrors.name ? (
										<p className={styles.fieldError}>{fieldErrors.name}</p>
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
												fieldErrors.color ? styles.inputError : ''
											}`}
											value={cfg.color}
											onChange={e => {
												clearFieldError('color')
												set({ color: e.target.value })
											}}
											onBlur={() => validateFieldOnBlur('color')}
											maxLength={7}
											aria-invalid={Boolean(fieldErrors.color)}
										/>
									</div>
									{fieldErrors.color && (
										<p className={styles.fieldError}>
											{fieldErrors.color}
										</p>
									)}
									<p className={styles.hint}>
										Цвет акцентов, таймера и элементов формы.
									</p>
								</div>
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.optionalContent}>
										<div className={styles.field}>
											<p className={styles.label}>Цвет фона окна</p>
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
														fieldErrors.bgColor ? styles.inputError : ''
													}`}
													value={cfg.bgColor || ''}
													onChange={e => {
														clearFieldError('bgColor')
														set({ bgColor: e.target.value })
													}}
													onBlur={() => validateFieldOnBlur('bgColor')}
													placeholder="По умолчанию — белый"
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
														title="Использовать белый фон"
													>
														✕
													</button>
												)}
											</div>
											{fieldErrors.bgColor && (
												<p className={styles.fieldError}>
													{fieldErrors.bgColor}
												</p>
											)}
											<p className={styles.hint}>
												Оставьте пустым, чтобы использовать стандартный
												белый фон.
											</p>
										</div>
									</div>
								</details>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Кнопка открытия
								</h3>
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.optionalContent}>
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
															? styles.inputError
															: ''
													}`}
													value={cfg.openButtonColor || ''}
													onChange={e => {
														clearFieldError('openButtonColor')
														set({ openButtonColor: e.target.value })
													}}
													onBlur={() =>
														validateFieldOnBlur('openButtonColor')
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
														className={styles.clearColorBtn}
														onClick={() => {
															clearFieldError('openButtonColor')
															set({ openButtonColor: '' })
														}}
														title="Вернуть цвет акцентов"
														aria-label="Вернуть цвет акцентов"
													>
														✕
													</button>
												)}
											</div>
											{fieldErrors.openButtonColor && (
												<p className={styles.fieldError}>
													{fieldErrors.openButtonColor}
												</p>
											)}
										</div>
									</div>
								</details>
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Расширенные настройки
									</summary>
									<div className={styles.optionalContent}>
										<div className={styles.field}>
											<p className={styles.label}>
												Картинка кнопки открытия:
											</p>
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
														PNG с прозрачным фоном, до 320x320 px и до 200
														КБ.
													</p>
													<p className={styles.hint}>
														После загрузки обновите страницу с
														установленным виджетом. Если кнопка осталась
														старой, выполните жёсткое обновление: Ctrl+F5
														или Cmd+Shift+R.
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
															Своя картинка кнопки доступна только на
															активном тарифе Hard.
														</p>
													)}
													{canUseCustomButtonImage &&
														hasUnsavedChanges && (
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
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Текст облачка:</p>
											<input
												ref={setFieldRef('bubbleText')}
												className={`${styles.input} ${
													fieldErrors.bubbleText ? styles.inputError : ''
												}`}
												value={cfg.bubbleText}
												onChange={e => {
													clearFieldError('bubbleText')
													set({ bubbleText: e.target.value })
												}}
												onBlur={() => validateFieldOnBlur('bubbleText')}
												placeholder="Акция"
												maxLength={60}
												aria-invalid={Boolean(fieldErrors.bubbleText)}
											/>
											{fieldErrors.bubbleText ? (
												<p className={styles.fieldError}>
													{fieldErrors.bubbleText}
												</p>
											) : (
												<p className={styles.hint}>
													Короткая подсказка объясняет, что откроется по
													клику.
												</p>
											)}
										</div>

										<div className={styles.field}>
											<div className={styles.rangeHeader}>
												<p className={styles.label}>Отступ снизу:</p>
												<span className={styles.rangeValue}>
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
													set({ buttonBottom: Number(e.target.value) })
												}
												className={styles.rangeInput}
											/>
											<p className={styles.hint}>
												Отступ от нижнего края экрана в процентах. 3 —
												почти внизу, 50 — по центру.
											</p>
										</div>

										<div className={styles.field}>
											<div className={styles.rangeHeader}>
												<p className={styles.label}>Отступ сбоку:</p>
												<span className={styles.rangeValue}>
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
												<p className={styles.label}>
													Размер кнопки открытия:
												</p>
												<span className={styles.rangeValue}>
													{cfg.buttonSize}px
												</span>
											</div>
											<input
												type="range"
												aria-label="Размер кнопки открытия"
												min={40}
												max={100}
												value={cfg.buttonSize}
												onChange={e =>
													set({
														buttonSize: parseInt(e.target.value) || 60
													})
												}
												className={styles.rangeInput}
											/>
											<p className={styles.hint}>
												Размер плавающей кнопки в пикселях. По умолчанию
												60px.
											</p>
										</div>
									</div>
								</details>

								<div className={styles.field}>
									<div className={styles.checkRow}>
										<input
											id="timer-auto-open"
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
											htmlFor="timer-auto-open"
											className={styles.checkLabel}
										>
											Автоматически показывать
										</label>
									</div>
									{autoOpenEnabled && (
										<>
											<div className={styles.rangeHeader}>
												<p className={styles.label}>Автооткрытие через:</p>
												<span className={styles.rangeValue}>
													{autoOpenDelay} сек.
												</span>
											</div>
											<input
												className={styles.rangeInput}
												type="range"
												aria-label="Автооткрытие через"
												min={1}
												max={60}
												step={1}
												value={autoOpenDelay}
												onChange={e =>
													set({
														autoOpenDelay: Number(e.target.value)
													})
												}
											/>
											<p className={styles.hint}>
												Таймер откроется через 1–60 секунд после загрузки
												страницы.
											</p>
										</>
									)}
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
												Оформление, тексты, таймер и параметры показа будут
												заменены на стандартные. Название, домен,
												интеграции, своя картинка и история персональных
												таймеров сохранятся.
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
												Сброс будет добавлен в черновик. Сохраните черновик
												и опубликуйте его; затем персональный отсчёт
												начнётся заново у всех посетителей.
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
									<p className={styles.label}>Режим таймера</p>
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
										<p className={styles.label}>Дата окончания</p>
										<input
											ref={setFieldRef('deadlineAt')}
											className={`${styles.input} ${
												fieldErrors.deadlineAt ? styles.inputError : ''
											}`}
											type="datetime-local"
											value={toDateTimeLocal(cfg.deadlineAt)}
											onChange={e => {
												clearFieldError('deadlineAt')
												set({
													deadlineAt: fromDateTimeLocal(e.target.value)
												})
											}}
											onBlur={() => validateFieldOnBlur('deadlineAt')}
											aria-invalid={Boolean(fieldErrors.deadlineAt)}
										/>
										{fieldErrors.deadlineAt ? (
											<p className={styles.fieldError}>
												{fieldErrors.deadlineAt}
											</p>
										) : (
											<p className={styles.hint}>
												Дата задаётся в вашем часовом поясе и должна быть
												позже текущего времени.
											</p>
										)}
									</div>
								) : (
									<div className={styles.field}>
										<p className={styles.label}>
											Длительность персонального таймера, минут
										</p>
										<input
											ref={setFieldRef('evergreenDurationMinutes')}
											className={`${styles.input} ${
												fieldErrors.evergreenDurationMinutes
													? styles.inputError
													: ''
											}`}
											type="number"
											aria-label="Длительность персонального таймера"
											min={1}
											max={10080}
											step={1}
											value={cfg.evergreenDurationMinutes}
											onChange={e => {
												clearFieldError('evergreenDurationMinutes')
												set({
													evergreenDurationMinutes: clampNumber(
														Number(e.target.value),
														1,
														10080,
														15
													)
												})
											}}
											onBlur={() =>
												validateFieldOnBlur('evergreenDurationMinutes')
											}
											aria-invalid={Boolean(
												fieldErrors.evergreenDurationMinutes
											)}
										/>
										<div
											className={styles.presetRow}
											aria-label="Быстрый выбор длительности"
										>
											{[
												{ label: '15 минут', value: 15 },
												{ label: '1 час', value: 60 },
												{ label: '24 часа', value: 1440 },
												{ label: '7 дней', value: 10080 }
											].map(preset => (
												<button
													key={preset.value}
													type="button"
													className={`${styles.presetButton} ${
														cfg.evergreenDurationMinutes === preset.value
															? styles.presetButtonActive
															: ''
													}`}
													onClick={() => {
														clearFieldError('evergreenDurationMinutes')
														set({
															evergreenDurationMinutes: preset.value
														})
													}}
												>
													{preset.label}
												</button>
											))}
										</div>
										{fieldErrors.evergreenDurationMinutes ? (
											<p className={styles.fieldError}>
												{fieldErrors.evergreenDurationMinutes}
											</p>
										) : (
											<p className={styles.hint}>
												Сейчас:{' '}
												{formatDuration(cfg.evergreenDurationMinutes)}.
												Допустимо от 1 минуты до 7 дней; отсчёт начинается
												отдельно для каждого посетителя.
											</p>
										)}
									</div>
								)}
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									После окончания
								</h3>
								<div className={styles.field}>
									<p className={styles.label}>Поведение виджета</p>
									<select
										className={styles.input}
										value={cfg.expiredBehavior}
										onChange={e => {
											const expiredBehavior = e.target
												.value as CountdownTimerConfig['expiredBehavior']
											if (expiredBehavior === 'hide') {
												clearFieldError('expiredTitle')
											}
											set({
												expiredBehavior
											})
										}}
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
								{cfg.expiredBehavior !== 'hide' && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>
												Заголовок после окончания
											</p>
											<input
												ref={setFieldRef('expiredTitle')}
												className={`${styles.input} ${
													fieldErrors.expiredTitle ? styles.inputError : ''
												}`}
												value={cfg.expiredTitle}
												onChange={e => {
													clearFieldError('expiredTitle')
													set({ expiredTitle: e.target.value })
												}}
												onBlur={() => validateFieldOnBlur('expiredTitle')}
												aria-invalid={Boolean(fieldErrors.expiredTitle)}
											/>
											{fieldErrors.expiredTitle && (
												<p className={styles.fieldError}>
													{fieldErrors.expiredTitle}
												</p>
											)}
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Описание после окончания
											</p>
											<textarea
												className={styles.textarea}
												value={cfg.expiredSubtitle}
												onChange={e =>
													set({ expiredSubtitle: e.target.value })
												}
											/>
										</div>
										{cfg.expiredBehavior === 'disableForm' && (
											<p className={styles.hint}>
												После завершения посетитель увидит этот текст и
												кнопку перехода из вкладки «Форма».
											</p>
										)}
									</>
								)}
							</div>
						</div>
					)}

					{tab === 'form' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Предложение</h3>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок предложения</p>
									<input
										ref={setFieldRef('title')}
										className={`${styles.input} ${
											fieldErrors.title ? styles.inputError : ''
										}`}
										value={cfg.title}
										onChange={e => {
											clearFieldError('title')
											set({ title: e.target.value })
										}}
										onBlur={() => validateFieldOnBlur('title')}
										aria-invalid={Boolean(fieldErrors.title)}
									/>
									{fieldErrors.title && (
										<p className={styles.fieldError}>
											{fieldErrors.title}
										</p>
									)}
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Описание предложения</p>
									<textarea
										className={styles.textarea}
										value={cfg.subtitle}
										onChange={e => set({ subtitle: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Ссылка кнопки перехода</p>
									<input
										ref={setFieldRef('actionButtonUrl')}
										className={`${styles.input} ${
											fieldErrors.actionButtonUrl ? styles.inputError : ''
										}`}
										value={cfg.actionButtonUrl}
										onChange={e => {
											clearFieldError('actionButtonUrl')
											set({ actionButtonUrl: e.target.value })
										}}
										onBlur={() => validateFieldOnBlur('actionButtonUrl')}
										placeholder="https://example.ru/product"
										aria-invalid={Boolean(fieldErrors.actionButtonUrl)}
									/>
									{fieldErrors.actionButtonUrl ? (
										<p className={styles.fieldError}>
											{fieldErrors.actionButtonUrl}
										</p>
									) : (
										<p className={styles.hint}>
											Необязательно. Поддерживаются обычные ссылки, tel: и
											mailto:.
										</p>
									)}
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Текст кнопки перехода</p>
									<input
										ref={setFieldRef('actionButtonText')}
										className={`${styles.input} ${
											fieldErrors.actionButtonText ? styles.inputError : ''
										}`}
										value={cfg.actionButtonText}
										onChange={e => {
											clearFieldError('actionButtonText')
											set({ actionButtonText: e.target.value })
										}}
										onBlur={() => validateFieldOnBlur('actionButtonText')}
										aria-invalid={Boolean(fieldErrors.actionButtonText)}
									/>
									{fieldErrors.actionButtonText && (
										<p className={styles.fieldError}>
											{fieldErrors.actionButtonText}
										</p>
									)}
								</div>
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.optionalContent}>
										<div className={styles.field}>
											<p className={styles.label}>
												Цвет кнопок внутри окна
											</p>
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
															? styles.inputError
															: ''
													}`}
													value={cfg.buttonColor || ''}
													onChange={e => {
														clearFieldError('buttonColor')
														set({ buttonColor: e.target.value })
													}}
													onBlur={() => validateFieldOnBlur('buttonColor')}
													placeholder="Как цвет акцентов"
													maxLength={7}
													aria-invalid={Boolean(fieldErrors.buttonColor)}
												/>
												{cfg.buttonColor && (
													<button
														type="button"
														className={styles.clearColorBtn}
														onClick={() => {
															clearFieldError('buttonColor')
															set({ buttonColor: '' })
														}}
														title="Вернуть цвет акцентов"
														aria-label="Вернуть цвет акцентов"
													>
														✕
													</button>
												)}
											</div>
											{fieldErrors.buttonColor && (
												<p className={styles.fieldError}>
													{fieldErrors.buttonColor}
												</p>
											)}
											<p className={styles.hint}>
												Применяется к отправке формы и кнопке перехода.
											</p>
										</div>
									</div>
								</details>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Сбор данных клиента
								</h3>
								<div className={styles.field}>
									<p className={styles.label}>Сбор данных клиента:</p>
									<select
										className={styles.input}
										value={cfg.dataType}
										onChange={e => {
											const dataType = e.target
												.value as CountdownTimerConfig['dataType']
											if (dataType === 'NONE') {
												clearFieldError(
													'contactTitle',
													'submitButtonText',
													'submissionCooldownDays',
													'successTitle',
													'privacyUrl'
												)
											}
											set({
												dataType
											})
										}}
									>
										<option value="PHONE">Номер телефона</option>
										<option value="EMAIL">Email</option>
										<option value="PHONE_AND_EMAIL">
											Номер телефона и Email
										</option>
										<option value="NONE">Не собирать контакты</option>
									</select>
								</div>
								{cfg.dataType !== 'NONE' && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>Заголовок формы</p>
											<input
												ref={setFieldRef('contactTitle')}
												className={`${styles.input} ${
													fieldErrors.contactTitle ? styles.inputError : ''
												}`}
												value={cfg.contactTitle}
												onChange={e => {
													clearFieldError('contactTitle')
													set({ contactTitle: e.target.value })
												}}
												onBlur={() => validateFieldOnBlur('contactTitle')}
												aria-invalid={Boolean(fieldErrors.contactTitle)}
											/>
											{fieldErrors.contactTitle && (
												<p className={styles.fieldError}>
													{fieldErrors.contactTitle}
												</p>
											)}
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Текст кнопки отправки</p>
											<input
												ref={setFieldRef('submitButtonText')}
												className={`${styles.input} ${
													fieldErrors.submitButtonText
														? styles.inputError
														: ''
												}`}
												value={cfg.submitButtonText}
												onChange={e => {
													clearFieldError('submitButtonText')
													set({ submitButtonText: e.target.value })
												}}
												onBlur={() =>
													validateFieldOnBlur('submitButtonText')
												}
												aria-invalid={Boolean(
													fieldErrors.submitButtonText
												)}
											/>
											{fieldErrors.submitButtonText && (
												<p className={styles.fieldError}>
													{fieldErrors.submitButtonText}
												</p>
											)}
										</div>
										<div className={styles.field}>
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
											<p className={styles.hint}>
												Ограничивает повторные заявки одного посетителя на
												выбранный срок.
											</p>
										</div>
										{cfg.filterDuplicates && (
											<div className={styles.field}>
												<div className={styles.rangeHeader}>
													<p className={styles.label}>
														Период блокировки повторной заявки
													</p>
													<span className={styles.rangeValue}>
														{cfg.submissionCooldownDays === 0
															? 'До сброса'
															: `${cfg.submissionCooldownDays} дн.`}
													</span>
												</div>
												<input
													ref={setFieldRef('submissionCooldownDays')}
													className={styles.rangeInput}
													type="range"
													aria-label="Период блокировки повторной заявки"
													min={0}
													max={365}
													step={1}
													value={cfg.submissionCooldownDays}
													onChange={e => {
														clearFieldError('submissionCooldownDays')
														set({
															submissionCooldownDays: clampNumber(
																Number(e.target.value),
																0,
																365,
																0
															)
														})
													}}
													aria-invalid={Boolean(
														fieldErrors.submissionCooldownDays
													)}
												/>
												{fieldErrors.submissionCooldownDays ? (
													<p className={styles.fieldError}>
														{fieldErrors.submissionCooldownDays}
													</p>
												) : (
													<p className={styles.hint}>
														0 — повторная заявка запрещена до сброса
														персональных таймеров.
													</p>
												)}
											</div>
										)}
										<div className={styles.field}>
											<p className={styles.label}>
												Ссылка на согласие обработки данных
											</p>
											<input
												ref={setFieldRef('privacyUrl')}
												className={`${styles.input} ${
													fieldErrors.privacyUrl ? styles.inputError : ''
												}`}
												value={cfg.privacyUrl}
												onChange={e => {
													clearFieldError('privacyUrl')
													set({ privacyUrl: e.target.value })
												}}
												onBlur={() => validateFieldOnBlur('privacyUrl')}
												placeholder="https://example.ru/privacy"
												aria-invalid={Boolean(fieldErrors.privacyUrl)}
											/>
											{fieldErrors.privacyUrl ? (
												<p className={styles.fieldError}>
													{fieldErrors.privacyUrl}
												</p>
											) : (
												<p className={styles.hint}>
													Полная ссылка с протоколом http:// или https://.
												</p>
											)}
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
										<p className={styles.label}>Заголовок успеха</p>
										<input
											ref={setFieldRef('successTitle')}
											className={`${styles.input} ${
												fieldErrors.successTitle ? styles.inputError : ''
											}`}
											value={cfg.successTitle}
											onChange={e => {
												clearFieldError('successTitle')
												set({ successTitle: e.target.value })
											}}
											onBlur={() => validateFieldOnBlur('successTitle')}
											aria-invalid={Boolean(fieldErrors.successTitle)}
										/>
										{fieldErrors.successTitle && (
											<p className={styles.fieldError}>
												{fieldErrors.successTitle}
											</p>
										)}
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Описание успеха</p>
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
							{cfg.dataType === 'NONE' && (
								<div className={styles.settingsGroup}>
									<h3 className={styles.settingsGroupTitle}>
										Контакты отключены
									</h3>
									<p className={styles.hint}>
										Уведомления, webhook и CRM не используются без заявок.
										Аналитика открытия остаётся доступной.
									</p>
								</div>
							)}
							{cfg.dataType !== 'NONE' && (
								<>
									<div className={styles.settingsGroup}>
										<h3 className={styles.settingsGroupTitle}>
											Уведомления
										</h3>
										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок на Email
											</p>
											<input
												type="email"
												className={styles.input}
												value={cfg.integrations.email || ''}
												onChange={e =>
													setIntegration('email', e.target.value)
												}
												placeholder="you@example.com"
											/>
											<p className={styles.hint}>
												Уведомление о каждой новой заявке придёт на этот
												email.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок в Telegram
											</p>
											<input
												className={styles.input}
												value={cfg.integrations.telegramChatId || ''}
												onChange={e =>
													setIntegration('telegramChatId', e.target.value)
												}
												placeholder="-100xxxxxxxxxx"
											/>
											<p className={styles.hint}>
												Напишите боту <b>@winwidget_info_bot</b> команду
												/start, затем укажите Telegram ID. Узнать его можно
												через <b>@getmyid_bot</b>.
											</p>
										</div>
									</div>

									<div className={styles.settingsGroup}>
										<h3 className={styles.settingsGroupTitle}>
											Webhooks и CRM
										</h3>
										<div className={styles.field}>
											<p className={styles.label}>Внешний URL (Webhook)</p>
											<input
												className={styles.input}
												type="url"
												value={cfg.integrations.webhookUrl || ''}
												onChange={e =>
													setIntegration('webhookUrl', e.target.value)
												}
												placeholder="https://example.com/webhook"
											/>
											<p className={styles.hint}>
												На указанный адрес отправляется POST-запрос с
												данными новой заявки.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок в Битрикс24
											</p>
											<input
												className={styles.input}
												type="url"
												value={cfg.integrations.bitrix24WebhookUrl || ''}
												onChange={e =>
													setIntegration(
														'bitrix24WebhookUrl',
														e.target.value
													)
												}
												placeholder="https://b24-xxxxx.bitrix24.ru/rest/1/key/"
											/>
											<p className={styles.hint}>
												Новые заявки будут создаваться как лиды в
												Битрикс24.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												amoCRM — домен аккаунта
											</p>
											<input
												className={styles.input}
												value={cfg.integrations.amoCrmDomain || ''}
												onChange={e =>
													setIntegration('amoCrmDomain', e.target.value)
												}
												placeholder="example.amocrm.ru"
											/>
											<p className={styles.hint}>
												Домен вашего аккаунта amoCRM без протокола.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												amoCRM — токен доступа
											</p>
											<input
												type="password"
												className={styles.input}
												value={cfg.integrations.amoCrmToken || ''}
												onChange={e =>
													setIntegration('amoCrmToken', e.target.value)
												}
												placeholder="Долгосрочный токен из настроек API"
											/>
											<p className={styles.hint}>
												Используйте долгосрочный токен из настроек
												интеграции amoCRM.
											</p>
										</div>
									</div>
								</>
							)}

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Аналитика</h3>
								<div className={styles.field}>
									<p className={styles.label}>
										Яндекс Метрика — ID счётчика
									</p>
									<input
										className={styles.input}
										value={cfg.integrations.yandexMetrikaId || ''}
										onChange={e =>
											setIntegration('yandexMetrikaId', e.target.value)
										}
										placeholder="12345678"
									/>
									<p className={styles.hint}>
										При открытии таймера отправляется цель <b>wt_open</b>,
										при отправке заявки — <b>wt_send</b>. Счётчик должен
										быть установлен на странице сайта.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Ретаргетинг ВКонтакте — ID пикселя
									</p>
									<input
										className={styles.input}
										value={cfg.integrations.vkPixelId || ''}
										onChange={e =>
											setIntegration('vkPixelId', e.target.value)
										}
										placeholder="VK-RTRG-000000-xxxxx"
									/>
									<p className={styles.hint}>
										Пиксель VK должен быть установлен на странице сайта.
										События: <b>wt_open</b> и <b>wt_send</b>.
									</p>
								</div>
								<div className={styles.field}>
									<div className={styles.checkRow}>
										<input
											id="timer-roistat"
											type="checkbox"
											checked={cfg.integrations.roistatEnabled === true}
											onChange={e =>
												setIntegration('roistatEnabled', e.target.checked)
											}
										/>
										<label
											htmlFor="timer-roistat"
											className={styles.checkLabel}
										>
											Включить отправку целей в Roistat
										</label>
									</div>
									<p className={styles.hint}>
										Код Roistat должен быть установлен на сайте. События:
										<b> wt_open</b> и <b> wt_send</b>.
									</p>
								</div>
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
									<textarea
										className={`${styles.textarea} ${styles.codeArea}`}
										readOnly
										value={embedCode}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() =>
											copyToClipboard(embedCode, 'Код скопирован', true)
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
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() =>
											copyToClipboard(previewUrl, 'Ссылка скопирована')
										}
									>
										Скопировать ссылку
									</button>
									<p className={styles.hint}>
										Подходит для рассылок, рекламы и мессенджеров без
										установки кода на сайт.
									</p>
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
									фиксированную дату окончания или персональный отсчёт для
									каждого посетителя. Если включён сбор контактов, заявки
									сохраняются в кабинете и отправляются в подключённые
									интеграции.
								</p>
								<ul className={styles.infoList}>
									<li>
										В «Главных» настройте внешний вид и кнопку открытия.
									</li>
									<li>
										В «Таймере» выберите режим, длительность и поведение
										после окончания.
									</li>
									<li>
										В «Форме» задайте предложение, кнопку перехода и при
										необходимости включите сбор контактов.
									</li>
									<li>
										В «Интеграциях» подключите уведомления, CRM, webhook и
										аналитику.
									</li>
									<li>
										В «Установке» скопируйте скрипт на сайт или откройте
										прямую ссылку.
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

					{tab !== 'code' && tab !== 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Сброс раздела
								</h3>
								{confirmResetSection === tab ? (
									<div className={styles.dangerItem}>
										<p className={styles.hint}>
											{tab === 'integrations'
												? 'Только настройки интеграций вернутся к стандартным значениям. Остальные разделы и домен сохранятся.'
												: 'Только настройки текущего раздела вернутся к стандартным значениям. Другие разделы, домен и интеграции сохранятся.'}
										</p>
										<div className={styles.footerActions}>
											<button
												type="button"
												className={styles.resetAttemptsBtn}
												onClick={() => handleResetSection(tab)}
											>
												Да, сбросить раздел
											</button>
											<button
												type="button"
												className={styles.cancelBtn}
												onClick={() => setConfirmResetSection(null)}
											>
												Отмена
											</button>
										</div>
									</div>
								) : (
									<button
										type="button"
										className={styles.resetAttemptsBtn}
										onClick={() => setConfirmResetSection(tab)}
									>
										Сбросить раздел
									</button>
								)}
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
								onClick={handleSave}
								disabled={mutation.isPending || !hasUnsavedChanges}
							>
								{mutation.isPending
									? 'Сохранение...'
									: 'Сохранить черновик'}
							</button>
						</ActionTooltip>
					</div>
				</div>
				{closeGuardDialog}
			</div>
		</div>
	)
}

export default CountdownTimerSettingsModal
