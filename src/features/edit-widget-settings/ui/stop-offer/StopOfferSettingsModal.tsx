'use client'

import { stopOfferService } from '@/entities/site-widget'
import { StopOffer, StopOfferConfig } from '@/entities/site-widget'
import { useMutation } from '@tanstack/react-query'
import { useEffect, useId, useRef, useState } from 'react'
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

type Tab = 'main' | 'trigger' | 'form' | 'integrations' | 'code' | 'info'

interface Props extends WidgetSettingsPresentationProps {
	stopOffer: StopOffer
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: StopOffer) => void
	persistence?: WidgetSettingsPersistence<StopOffer, StopOfferConfig>
}

type ValidationIssue = {
	tab: Tab
	fieldId: string
	message: string
}

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Основные' },
	{ id: 'trigger', label: 'Показ' },
	{ id: 'form', label: 'Форма' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Установка' },
	{ id: 'info', label: 'Проверка' }
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

const createResetToken = () =>
	`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

const isHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

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
	const [tab, setTab] = useState<Tab>('main')
	const [cfg, setCfg] = useState<StopOfferConfig>(
		mergeConfig(stopOffer.config)
	)
	const [name, setName] = useState(stopOffer.name)
	const [installDomain, setInstallDomain] = useState(
		stopOffer.installDomain ?? ''
	)
	const draftRevisionRef = useRef(stopOffer.draftRevision)
	const [confirmResetShows, setConfirmResetShows] = useState(false)
	const [confirmResetSubmissions, setConfirmResetSubmissions] =
		useState(false)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [confirmResetSection, setConfirmResetSection] = useState<Exclude<
		Tab,
		'code' | 'info'
	> | null>(null)
	const [validationIssue, setValidationIssue] =
		useState<ValidationIssue | null>(null)
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
			config: StopOfferConfig
		}) =>
			(
				persistence?.update ??
				(payload =>
					stopOfferService.updateStopOffer(stopOffer.id, payload))
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
			notifyStopOfferUpdated(stopOffer.publicKey)
		},
		onError: (error: any, _, toastId) =>
			reportMutationError(error, 'Ошибка сохранения', toastId)
	})
	const isDangerActionPending = mutation.isPending
	const { requestClose, closeGuardDialog } = useWidgetSettingsCloseGuard({
		hasUnsavedChanges,
		isBusy: isDangerActionPending,
		onClose
	})
	const isPagePresentation = presentation === 'page'

	const set = (patch: Partial<StopOfferConfig>) => {
		setValidationIssue(null)
		setCfg(prev => ({ ...prev, ...patch }))
	}

	const setIntegration = (
		key: keyof StopOfferConfig['integrations'],
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

	const reportValidationIssue = (issue: ValidationIssue) => {
		setValidationIssue(issue)
		setTab(issue.tab)
		window.requestAnimationFrame(() => {
			const field = document.getElementById(issue.fieldId)
			field?.closest('details')?.setAttribute('open', '')
			field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
			field?.focus({ preventScroll: true })
		})
		toast.error(issue.message)
	}

	const inputClassName = (fieldId: string) =>
		`${styles.input} ${
			validationIssue?.fieldId === fieldId ? styles.inputError : ''
		}`

	const fieldError = (fieldId: string) =>
		validationIssue?.fieldId === fieldId ? (
			<p className={styles.fieldError} role="alert">
				{validationIssue.message}
			</p>
		) : null

	const setInlineValidationIssue = (
		tabId: Tab,
		fieldId: string,
		message?: string
	) => {
		setValidationIssue(current => {
			if (message) return { tab: tabId, fieldId, message }
			return current?.fieldId === fieldId ? null : current
		})
	}

	const validateFieldOnBlur = (field: string) => {
		if (field === 'color') {
			setInlineValidationIssue(
				'main',
				`${titleId}-color`,
				isWidgetHexColor(cfg.color)
					? undefined
					: 'Введите цвет в формате #RRGGBB'
			)
			return
		}
		if (field === 'bgColor') {
			setInlineValidationIssue(
				'main',
				`${titleId}-bg-color`,
				!cfg.bgColor || isWidgetHexColor(cfg.bgColor)
					? undefined
					: 'Введите цвет в формате #RRGGBB'
			)
			return
		}
		if (field === 'buttonColor') {
			setInlineValidationIssue(
				'main',
				`${titleId}-button-color`,
				!cfg.buttonColor || isWidgetHexColor(cfg.buttonColor)
					? undefined
					: 'Введите цвет в формате #RRGGBB'
			)
			return
		}
		if (field === 'name') {
			setInlineValidationIssue(
				'main',
				`${titleId}-name`,
				name.trim() ? undefined : 'Укажите название виджета'
			)
			return
		}
		if (field === 'offerText') {
			setInlineValidationIssue(
				'main',
				`${titleId}-offer`,
				cfg.offerText.trim() ? undefined : 'Укажите текст предложения'
			)
			return
		}
		if (field === 'title') {
			setInlineValidationIssue(
				'main',
				`${titleId}-title`,
				cfg.title.trim() ? undefined : 'Укажите заголовок виджета'
			)
			return
		}
		if (field === 'contactTitle') {
			setInlineValidationIssue(
				'form',
				`${titleId}-contact-title`,
				cfg.dataType === 'NONE' || cfg.contactTitle.trim()
					? undefined
					: 'Укажите заголовок формы'
			)
			return
		}
		if (field === 'submitButtonText') {
			setInlineValidationIssue(
				'form',
				`${titleId}-submit-text`,
				cfg.dataType === 'NONE' || cfg.submitButtonText.trim()
					? undefined
					: 'Укажите текст кнопки отправки'
			)
			return
		}
		if (field === 'privacyUrl') {
			setInlineValidationIssue(
				'form',
				`${titleId}-privacy-url`,
				cfg.dataType === 'NONE' ||
					(cfg.privacyUrl.trim() && isHttpUrl(cfg.privacyUrl))
					? undefined
					: 'Укажите полную ссылку на политику с http:// или https://'
			)
			return
		}
		if (field === 'actionButtonText') {
			setInlineValidationIssue(
				'form',
				`${titleId}-action-text`,
				!cfg.actionButtonEnabled || cfg.actionButtonText.trim()
					? undefined
					: 'Укажите текст кнопки перехода'
			)
			return
		}
		if (field === 'actionButtonUrl') {
			setInlineValidationIssue(
				'form',
				`${titleId}-action-url`,
				!cfg.actionButtonEnabled || isHttpUrl(cfg.actionButtonUrl)
					? undefined
					: 'Укажите полную ссылку кнопки с http:// или https://'
			)
		}
	}

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

	const save = () => {
		const invalidColor = !isWidgetHexColor(cfg.color)
			? 'color'
			: findInvalidWidgetColor(cfg)
		if (invalidColor) {
			const colorField = invalidColor.split('.').pop() || 'color'
			const fieldId =
				colorField === 'bgColor'
					? `${titleId}-bg-color`
					: colorField === 'buttonColor'
						? `${titleId}-button-color`
						: `${titleId}-color`
			reportValidationIssue({
				tab: 'main',
				fieldId,
				message: 'Введите цвет в формате #RRGGBB'
			})
			return
		}

		if (!name.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-name`,
				message: 'Укажите название виджета'
			})
			return
		}
		if (!cfg.offerText.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-offer`,
				message: 'Укажите текст предложения'
			})
			return
		}
		if (!cfg.title.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-title`,
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
		if (
			cfg.actionButtonEnabled &&
			(!cfg.actionButtonText.trim() || !isHttpUrl(cfg.actionButtonUrl))
		) {
			const missingText = !cfg.actionButtonText.trim()
			reportValidationIssue({
				tab: 'form',
				fieldId: missingText
					? `${titleId}-action-text`
					: `${titleId}-action-url`,
				message: missingText
					? 'Укажите текст кнопки перехода'
					: 'Укажите полную ссылку кнопки с http:// или https://'
			})
			return
		}

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
		const sanitizedName = name.trim()
		setName(sanitizedName)
		setCfg(sanitizedConfig)
		mutation.mutate({
			name: sanitizedName,
			installDomain,
			config: sanitizedConfig
		})
	}

	const handleResetShows = () => {
		const nextConfig = {
			...cfg,
			displayResetToken: createResetToken()
		}
		setCfg(nextConfig)
		setConfirmResetShows(false)
		toast.success(
			'Сброс добавлен в черновик. Сохраните черновик и опубликуйте; затем сброс вступит в силу'
		)
	}

	const handleResetSubmissions = () => {
		const nextConfig = {
			...cfg,
			submissionResetToken: createResetToken()
		}
		setCfg(nextConfig)
		setConfirmResetSubmissions(false)
		toast.success(
			'Сброс добавлен в черновик. Сохраните черновик и опубликуйте; затем сброс вступит в силу'
		)
	}

	const handleResetDefaults = () => {
		const nextConfig = {
			...getDefaultConfig(),
			integrations: { ...cfg.integrations },
			displayResetToken: cfg.displayResetToken,
			submissionResetToken: cfg.submissionResetToken
		}
		setCfg(nextConfig)
		setConfirmResetDefaults(false)
		toast.success('Стандартные настройки применены. Сохраните черновик')
	}

	const handleResetSection = (section: Exclude<Tab, 'code' | 'info'>) => {
		const defaults = getDefaultConfig()
		setCfg(previous => {
			if (section === 'main') {
				return {
					...previous,
					color: defaults.color,
					bgColor: defaults.bgColor,
					buttonColor: defaults.buttonColor,
					badgeText: defaults.badgeText,
					title: defaults.title,
					subtitle: defaults.subtitle,
					offerText: defaults.offerText
				}
			}
			if (section === 'trigger') {
				return {
					...previous,
					autoOpenDelay: defaults.autoOpenDelay,
					desktopExitIntent: defaults.desktopExitIntent,
					mobileAutoOpenDelay: defaults.mobileAutoOpenDelay,
					scrollPercent: defaults.scrollPercent,
					showOnce: defaults.showOnce,
					displayCooldownDays: defaults.displayCooldownDays
				}
			}
			if (section === 'form') {
				return {
					...previous,
					dataType: defaults.dataType,
					contactTitle: defaults.contactTitle,
					submitButtonText: defaults.submitButtonText,
					successTitle: defaults.successTitle,
					successSubtitle: defaults.successSubtitle,
					actionButtonEnabled: defaults.actionButtonEnabled,
					actionButtonText: defaults.actionButtonText,
					actionButtonUrl: defaults.actionButtonUrl,
					privacyUrl: defaults.privacyUrl,
					developInfoActive: defaults.developInfoActive,
					filterDuplicates: defaults.filterDuplicates,
					hideIfSubmitted: defaults.hideIfSubmitted,
					submissionCooldownDays: defaults.submissionCooldownDays
				}
			}
			return {
				...previous,
				integrations: { ...defaults.integrations }
			}
		})
		setValidationIssue(null)
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
					aria-label="Закрыть настройки стоп-оффера"
				/>
			)}
			<div
				ref={settingsPanelRef}
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
					Настройки стоп-оффера
				</h2>
				{lifecycleActions}

				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек стоп-оффера"
				>
					{TABS.map(t => (
						<button
							type="button"
							key={t.id}
							id={`${titleId}-tab-${t.id}`}
							role="tab"
							aria-selected={tab === t.id}
							aria-controls={`${titleId}-panel-${t.id}`}
							tabIndex={tab === t.id ? 0 : -1}
							className={`${styles.tab} ${
								tab === t.id ? styles.tabActive : ''
							}`}
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
						type="stopOffer"
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
										id: 'discount',
										label: 'Скидка при уходе',
										description: 'Собрать телефон и закрепить скидку.'
									},
									{
										id: 'link',
										label: 'Перейти к акции',
										description: 'Кнопка без формы сбора контактов.'
									},
									{
										id: 'consultation',
										label: 'Помощь с выбором',
										description:
											'Остановить уход предложением консультации.'
									}
								]}
								onApply={preset => {
									setValidationIssue(null)
									setCfg(previous => {
										if (preset === 'link') {
											return {
												...previous,
												dataType: 'NONE',
												badgeText: 'Не уходите',
												title: 'Для вас есть специальное предложение',
												subtitle:
													'Перейдите к акции, пока предложение доступно',
												offerText: 'Только сейчас',
												actionButtonEnabled: true,
												actionButtonText: 'Посмотреть предложение'
											}
										}

										if (preset === 'consultation') {
											return {
												...previous,
												dataType: 'PHONE',
												badgeText: 'Подождите',
												title: 'Поможем сделать правильный выбор',
												subtitle:
													'Оставьте номер — специалист бесплатно проконсультирует',
												offerText: 'Бесплатная консультация',
												contactTitle: 'Куда вам перезвонить?',
												submitButtonText: 'Получить консультацию',
												actionButtonEnabled: false
											}
										}

										return {
											...previous,
											dataType: 'PHONE',
											badgeText: 'Не уходите',
											title: 'Заберите персональную скидку',
											subtitle:
												'Оставьте номер, и мы закрепим предложение за вами',
											offerText: 'Скидка 10%',
											contactTitle: 'Куда отправить скидку?',
											submitButtonText: 'Забрать скидку',
											actionButtonEnabled: false
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
										id={`${titleId}-name`}
										className={inputClassName(`${titleId}-name`)}
										value={name}
										onChange={e => {
											setValidationIssue(null)
											setName(e.target.value)
										}}
										onBlur={() => validateFieldOnBlur('name')}
										maxLength={50}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-name`
										}
									/>
									{fieldError(`${titleId}-name`)}
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Цвет акцентов:</p>
									<div className={styles.colorRow}>
										<input
											className={styles.colorPicker}
											type="color"
											value={getWidgetColorPreview(cfg.color, '#4705fb')}
											onChange={e => set({ color: e.target.value })}
										/>
										<input
											id={`${titleId}-color`}
											className={inputClassName(`${titleId}-color`)}
											value={cfg.color}
											onChange={e => set({ color: e.target.value })}
											onBlur={() => validateFieldOnBlur('color')}
											maxLength={7}
											aria-invalid={
												validationIssue?.fieldId === `${titleId}-color`
											}
										/>
										{cfg.color !== '#4705fb' && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => set({ color: '#4705fb' })}
												title="Вернуть стандартный цвет"
											>
												✕
											</button>
										)}
									</div>
									{fieldError(`${titleId}-color`)}
									<p className={styles.hint}>
										Используется для акцентов и элементов предложения.
									</p>
								</div>
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.optionalContent}>
										<div className={styles.field}>
											<p className={styles.label}>Цвет фона виджета</p>
											<div className={styles.colorRow}>
												<input
													className={styles.colorPicker}
													type="color"
													value={getColorPickerValue(
														cfg.bgColor,
														'#ffffff'
													)}
													onChange={e => set({ bgColor: e.target.value })}
												/>
												<input
													id={`${titleId}-bg-color`}
													className={inputClassName(`${titleId}-bg-color`)}
													value={cfg.bgColor}
													placeholder="#ffffff"
													onChange={e => set({ bgColor: e.target.value })}
													onBlur={() => validateFieldOnBlur('bgColor')}
													maxLength={7}
													aria-invalid={
														validationIssue?.fieldId ===
														`${titleId}-bg-color`
													}
												/>
												{cfg.bgColor && (
													<button
														type="button"
														className={styles.clearColorBtn}
														onClick={() => set({ bgColor: '' })}
														title="Вернуть белый фон"
													>
														✕
													</button>
												)}
											</div>
											{fieldError(`${titleId}-bg-color`)}
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Цвет кнопки действия:</p>
											<div className={styles.colorRow}>
												<input
													className={styles.colorPicker}
													type="color"
													value={getColorPickerValue(
														cfg.buttonColor,
														getColorPickerValue(cfg.color, '#4705fb')
													)}
													onChange={e =>
														set({ buttonColor: e.target.value })
													}
												/>
												<input
													id={`${titleId}-button-color`}
													className={inputClassName(
														`${titleId}-button-color`
													)}
													value={cfg.buttonColor}
													placeholder="Как цвет акцентов"
													onChange={e =>
														set({ buttonColor: e.target.value })
													}
													onBlur={() => validateFieldOnBlur('buttonColor')}
													maxLength={7}
													aria-invalid={
														validationIssue?.fieldId ===
														`${titleId}-button-color`
													}
												/>
												{cfg.buttonColor && (
													<button
														type="button"
														className={styles.clearColorBtn}
														onClick={() => set({ buttonColor: '' })}
														title="Вернуть цвет акцентов"
														aria-label="Вернуть цвет акцентов"
													>
														✕
													</button>
												)}
											</div>
											{fieldError(`${titleId}-button-color`)}
										</div>
									</div>
								</details>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Тексты виджета
								</h3>
								<div className={styles.field}>
									<p className={styles.label}>Текст бейджа:</p>
									<input
										className={styles.input}
										value={cfg.badgeText}
										onChange={e => set({ badgeText: e.target.value })}
									/>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Текст предложения:</p>
									<input
										id={`${titleId}-offer`}
										className={inputClassName(`${titleId}-offer`)}
										value={cfg.offerText}
										onChange={e => set({ offerText: e.target.value })}
										onBlur={() => validateFieldOnBlur('offerText')}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-offer`
										}
									/>
									{fieldError(`${titleId}-offer`)}
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Заголовок виджета:</p>
									<input
										id={`${titleId}-title`}
										className={inputClassName(`${titleId}-title`)}
										value={cfg.title}
										onChange={e => set({ title: e.target.value })}
										onBlur={() => validateFieldOnBlur('title')}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-title`
										}
									/>
									{fieldError(`${titleId}-title`)}
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок виджета:</p>
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
												стандартные. Название, домен, интеграции и история
												показов и заявок останутся без изменений.
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
								<p className={styles.infoText}>
									Условия работают по логике «ИЛИ»: стоп-оффер откроется,
									как только выполнится любое из них.
								</p>
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
										<div className={styles.rangeHeader}>
											<p className={styles.label}>
												Повторный показ через:
											</p>
											<span className={styles.rangeValue}>
												{cfg.displayCooldownDays
													? `${cfg.displayCooldownDays} дн.`
													: 'Только после сброса'}
											</span>
										</div>
										<input
											className={styles.rangeInput}
											type="range"
											aria-label="Повторный показ через"
											min={0}
											max={365}
											value={cfg.displayCooldownDays}
											onChange={e =>
												set({
													displayCooldownDays: Number(e.target.value)
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
									<p className={styles.label}>Автопоказ по времени:</p>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={cfg.autoOpenDelay != null}
											onChange={e =>
												set({
													autoOpenDelay: e.target.checked ? 8 : null
												})
											}
										/>
										<span className={styles.checkLabel}>
											Открывать автоматически на компьютере
										</span>
									</label>
									{cfg.autoOpenDelay != null && (
										<>
											<div className={styles.rangeHeader}>
												<p className={styles.label}>Автопоказ через:</p>
												<span className={styles.rangeValue}>
													{cfg.autoOpenDelay} сек.
												</span>
											</div>
											<input
												className={styles.rangeInput}
												type="range"
												aria-label="Автопоказ через"
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
										Дополнительное условие для компьютеров. Можно выключить
										и оставить только уход/скролл.
									</p>
								</div>
								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>Мобильный показ через:</p>
										<span className={styles.rangeValue}>
											{cfg.mobileAutoOpenDelay} сек.
										</span>
									</div>
									<input
										className={styles.rangeInput}
										type="range"
										aria-label="Мобильный показ через"
										min={1}
										max={60}
										value={cfg.mobileAutoOpenDelay}
										onChange={e =>
											set({
												mobileAutoOpenDelay: Number(e.target.value)
											})
										}
									/>
									<p className={styles.hint}>
										На телефонах попытку ухода определить нельзя, поэтому
										стоп-оффер открывается по таймеру.
									</p>
								</div>
								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>Показ после прокрутки:</p>
										<span className={styles.rangeValue}>
											{cfg.scrollPercent}%
										</span>
									</div>
									<input
										className={styles.rangeInput}
										type="range"
										aria-label="Показ после прокрутки"
										min={1}
										max={100}
										value={cfg.scrollPercent}
										onChange={e =>
											set({
												scrollPercent: Number(e.target.value)
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
											Сброс будет добавлен в черновик. Сохраните черновик и
											опубликуйте его; затем оффер снова сможет показаться
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
								<h3 className={styles.settingsGroupTitle}>
									Сбор данных клиента
								</h3>
								<div className={styles.field}>
									<p className={styles.label}>Сбор данных клиента:</p>
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
										<option value="PHONE">Номер телефона</option>
										<option value="EMAIL">Email</option>
										<option value="PHONE_AND_EMAIL">
											Номер телефона и Email
										</option>
										<option value="NONE">Не собирать контакты</option>
									</select>
								</div>
								{cfg.dataType !== 'NONE' ? (
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
												onBlur={() => validateFieldOnBlur('contactTitle')}
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
													set({
														submitButtonText: e.target.value
													})
												}
												onBlur={() =>
													validateFieldOnBlur('submitButtonText')
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
												onBlur={() => validateFieldOnBlur('privacyUrl')}
												aria-invalid={
													validationIssue?.fieldId ===
													`${titleId}-privacy-url`
												}
											/>
											{fieldError(`${titleId}-privacy-url`)}
										</div>
									</>
								) : (
									<p className={styles.hint}>
										Форма контактов отключена. Посетитель увидит оффер и
										кнопку перехода, если она заполнена.
									</p>
								)}
							</div>
							{cfg.dataType !== 'NONE' && (
								<div className={styles.settingsGroup}>
									<h3 className={styles.settingsGroupTitle}>
										После отправки
									</h3>
									<div className={styles.field}>
										<p className={styles.label}>
											Заголовок после отправки:
										</p>
										<input
											className={styles.input}
											value={cfg.successTitle}
											onChange={e => set({ successTitle: e.target.value })}
										/>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>
											Сообщение после отправки:
										</p>
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
								</div>
							)}
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
								{cfg.actionButtonEnabled && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>Текст кнопки:</p>
											<input
												id={`${titleId}-action-text`}
												className={inputClassName(
													`${titleId}-action-text`
												)}
												value={cfg.actionButtonText}
												onChange={e =>
													set({
														actionButtonText: e.target.value
													})
												}
												onBlur={() =>
													validateFieldOnBlur('actionButtonText')
												}
												aria-invalid={
													validationIssue?.fieldId ===
													`${titleId}-action-text`
												}
											/>
											{fieldError(`${titleId}-action-text`)}
											<p className={styles.hint}>
												Подпись кнопки, ведущей на страницу акции.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Ссылка кнопки:</p>
											<input
												id={`${titleId}-action-url`}
												className={inputClassName(`${titleId}-action-url`)}
												value={cfg.actionButtonUrl}
												placeholder="https://example.com/sale"
												onChange={e =>
													set({
														actionButtonUrl: e.target.value
													})
												}
												onBlur={() =>
													validateFieldOnBlur('actionButtonUrl')
												}
												aria-invalid={
													validationIssue?.fieldId ===
													`${titleId}-action-url`
												}
											/>
											{fieldError(`${titleId}-action-url`)}
										</div>
									</>
								)}
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
											<div className={styles.rangeHeader}>
												<p className={styles.label}>
													Повторная заявка через:
												</p>
												<span className={styles.rangeValue}>
													{cfg.submissionCooldownDays
														? `${cfg.submissionCooldownDays} дн.`
														: 'Только после сброса'}
												</span>
											</div>
											<input
												className={styles.rangeInput}
												type="range"
												aria-label="Повторная заявка через"
												min={0}
												max={365}
												value={cfg.submissionCooldownDays}
												onChange={e =>
													set({
														submissionCooldownDays: Number(e.target.value)
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
												Сброс будет добавлен в черновик. Сохраните черновик
												и опубликуйте его; затем посетители снова смогут
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
												className={styles.input}
												type="email"
												value={cfg.integrations.email || ''}
												onChange={e =>
													setIntegration('email', e.target.value)
												}
											/>
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
											/>
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
												placeholder="https://example.bitrix24.ru/rest/..."
											/>
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
												placeholder="mycompany.amocrm.ru"
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												amoCRM — токен доступа
											</p>
											<input
												className={styles.input}
												type="password"
												autoComplete="off"
												value={cfg.integrations.amoCrmToken || ''}
												onChange={e =>
													setIntegration('amoCrmToken', e.target.value)
												}
												placeholder="Долгосрочный access token"
											/>
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
									/>
									<p className={styles.hint}>
										При открытии стоп-оффера отправляется цель{' '}
										<b>wso_open</b>, при отправке заявки — <b>wso_send</b>.
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
										Без сохранённого домена стоп-оффер не появится на
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
										value={embedCode}
										readOnly
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
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Что проверить перед запуском
								</h3>
								<ul className={styles.infoList}>
									<li>
										Проверьте условия показа на компьютере и телефоне:
										достаточно срабатывания любого активного условия.
									</li>
									<li>
										Если включена кнопка перехода, откройте ссылку из
										предпросмотра.
									</li>
									<li>
										Сохраните домен, установите код и отправьте тестовую
										заявку.
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
							disabled={isDangerActionPending}
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
								onClick={save}
								disabled={mutation.isPending || !hasUnsavedChanges}
							>
								{mutation.isPending
									? 'Сохраняем...'
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

export default StopOfferSettingsModal
