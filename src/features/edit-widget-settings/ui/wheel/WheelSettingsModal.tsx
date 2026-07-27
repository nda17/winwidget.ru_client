'use client'

import { widgetService } from '@/entities/site-widget'
import { Widget, WidgetConfig } from '@/entities/site-widget'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import { ChangeEvent, useId, useState } from 'react'
import toast from 'react-hot-toast'
import DirectLinkQr from '../shared/DirectLinkQr'
import useWidgetSettingsCloseGuard from '../shared/useWidgetSettingsCloseGuard'
import WidgetLivePreview from '../shared/WidgetLivePreview'
import pageStyles from '../shared/WidgetSettingsModal.module.scss'
import type {
	WidgetSettingsPersistence,
	WidgetSettingsPresentationProps
} from '../shared/WidgetSettingsPersistence'
import WidgetSettingsPreviewPortal from '../shared/WidgetSettingsPreviewPortal'
import styles from './WheelSettingsModal.module.scss'

type Tab = 'main' | 'bonuses' | 'integrations' | 'code' | 'info'
const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024
const WHEEL_RADIUS = 150
const WHEEL_TEXT_RADIUS = WHEEL_RADIUS * 0.59
const WHEEL_TEXT_LINE_WIDTH = 102
const WHEEL_TEXT_MIN_FONT_SIZE = 9
const WHEEL_TEXT_MAX_LINES = 3
const WHEEL_TEXT_AVERAGE_CHAR_WIDTH = 0.72
const WHEEL_TEXT_TANGENT_PADDING = 18
const WHEEL_BONUS_NAME_MAX_LENGTH = 50
const WHEEL_BONUS_WORD_MAX_LENGTH = 16

const getWheelSectorTextMaxLines = (sectorCount: number) =>
	sectorCount >= 7 ? 2 : WHEEL_TEXT_MAX_LINES

const getWheelSectorLabelMaxLength = (sectorCount: number) => {
	const normalizedSectorCount = Math.max(2, Math.min(8, sectorCount || 8))
	const sectorAngle = (2 * Math.PI) / normalizedSectorCount
	const tangentSpace =
		2 * WHEEL_TEXT_RADIUS * Math.sin(sectorAngle / 2) -
		WHEEL_TEXT_TANGENT_PADDING
	const maxLines = Math.max(
		1,
		Math.min(
			getWheelSectorTextMaxLines(normalizedSectorCount),
			Math.floor(tangentSpace / (WHEEL_TEXT_MIN_FONT_SIZE * 1.2))
		)
	)
	const charsPerLine = Math.floor(
		WHEEL_TEXT_LINE_WIDTH /
			(WHEEL_TEXT_MIN_FONT_SIZE * WHEEL_TEXT_AVERAGE_CHAR_WIDTH)
	)

	return Math.max(
		12,
		Math.min(WHEEL_BONUS_NAME_MAX_LENGTH, charsPerLine * maxLines)
	)
}

const hasTooLongWheelSectorWord = (value: string) =>
	value
		.trim()
		.split(/\s+/)
		.some(word => word.length > WHEEL_BONUS_WORD_MAX_LENGTH)

const isHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const getReadableTextColor = (color: string) => {
	const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(
		color.trim()
	)

	if (!match) return '#ffffff'

	const red = parseInt(match[1], 16)
	const green = parseInt(match[2], 16)
	const blue = parseInt(match[3], 16)
	const brightness = (red * 299 + green * 587 + blue * 114) / 1000

	return brightness > 170 ? '#000000' : '#ffffff'
}

interface Props extends WidgetSettingsPresentationProps {
	widget: Widget
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: Widget) => void
	persistence?: WidgetSettingsPersistence<Widget, WidgetConfig>
}

type ValidationIssue = {
	tab: Tab
	fieldId: string
	message: string
}

const WheelSettingsModal = ({
	widget,
	canUseCustomButtonImage,
	onClose,
	onSaved,
	persistence,
	presentation = 'modal',
	previewPortalTarget
}: Props) => {
	const [tab, setTab] = useState<Tab>('main')
	const [config, setConfig] = useState<WidgetConfig>({ ...widget.config })
	const [name, setName] = useState(widget.name)
	const [installDomain, setInstallDomain] = useState(
		widget.installDomain ?? ''
	)
	const titleId = useId()
	const buttonImageInputId = useId()
	const [validationIssue, setValidationIssue] =
		useState<ValidationIssue | null>(null)
	const [confirmReset, setConfirmReset] = useState(false)
	const [confirmResetAttempts, setConfirmResetAttempts] = useState(false)
	const [savedSnapshot, setSavedSnapshot] = useState(() =>
		JSON.stringify({
			name: widget.name,
			installDomain: widget.installDomain ?? '',
			config: widget.config
		})
	)
	const currentSnapshot = JSON.stringify({ name, installDomain, config })
	const hasUnsavedChanges = currentSnapshot !== savedSnapshot
	const activeBonusCount = Math.max(
		2,
		config.bonuses.filter(bonus => bonus.active).length
	)
	const wheelLabelMaxLength =
		getWheelSectorLabelMaxLength(activeBonusCount)

	const DEFAULT_CONFIG: WidgetConfig = {
		color: '#4705fb',
		bgColor: '',
		glassEffect: false,
		wheelBorderColor: '',
		autoOpenDelay: null,
		spinDuration: 5,
		buttonSide: 'right',
		buttonPulse: true,
		buttonBottom: 3,
		buttonOffset: 3,
		buttonSize: 60,
		buttonImageUrl: '',
		bubbleEnabled: true,
		bubbleText: 'Испытайте удачу!',
		alreadyPlayedTitle: '🎉 Вы уже участвовали!',
		alreadyPlayedSubtitle:
			'Каждый посетитель может крутить колесо только один раз',
		hideIfPlayed: false,
		dataType: 'PHONE',
		title: 'Крутите колесо!',
		subtitle: '',
		winMessage: 'Поздравляем! Не пропустите звонок, мы скоро свяжемся',
		privacyUrl:
			'https://winwidget.ru/legal-documentation/consent-processing',
		developInfoActive: true,
		buttonText: 'Крутить!',
		filterDuplicates: false,
		buttonColor: '',
		textColor: '',
		centerColor: '#ffffff',
		arrowColor: '#ffcc00',
		spinCooldownDays: 0,
		spinResetToken: '',
		actionButton: null,
		bonuses: [
			{
				name: 'Бонус #1',
				wheelLabel: 'Бонус #1',
				active: true,
				probability: 1
			},
			{
				name: 'Бонус #2',
				wheelLabel: 'Бонус #2',
				active: true,
				probability: 1
			},
			{
				name: 'Бонус #3',
				wheelLabel: 'Бонус #3',
				active: true,
				probability: 1
			},
			{
				name: 'Бонус #4',
				wheelLabel: 'Бонус #4',
				active: true,
				probability: 1
			},
			{
				name: 'Бонус #5',
				wheelLabel: 'Бонус #5',
				active: true,
				probability: 1
			},
			{
				name: 'Бонус #6',
				wheelLabel: 'Бонус #6',
				active: true,
				probability: 1
			},
			{
				name: 'Бонус #7',
				wheelLabel: 'Бонус #7',
				active: true,
				probability: 1
			},
			{
				name: 'Бонус #8',
				wheelLabel: 'Бонус #8',
				active: true,
				probability: 1
			}
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

	const saveMutation = useMutation({
		mutationFn: (data: {
			name: string
			installDomain?: string
			config: WidgetConfig
		}) =>
			(
				persistence?.update ??
				(payload => widgetService.updateWidget(widget.id, payload))
			)({
				...data,
				installDomain: data.installDomain ?? installDomain
			}),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Сохранено', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setConfig(updated.config)
			setValidationIssue(null)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: updated.config
				})
			)
			onSaved(updated)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сохранения', {
				id: toastId
			})
		}
	})

	const resetAttemptsMutation = useMutation({
		mutationFn: (newToken: string) =>
			(
				persistence?.update ??
				(payload => widgetService.updateWidget(widget.id, payload))
			)({
				name,
				config: { ...config, spinResetToken: newToken }
			}),
		onMutate: () =>
			toast.loading('Сбрасываем попытки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Попытки всех посетителей сброшены', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setConfig(updated.config)
			setValidationIssue(null)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: updated.config
				})
			)
			onSaved(updated)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сброса', {
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
				: widgetService.uploadButtonImage(widget.id, formData)
		},
		onMutate: () =>
			toast.loading('Загружаем картинку кнопки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Картинка кнопки обновлена', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setConfig(updated.config)
			setValidationIssue(null)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: updated.config
				})
			)
			onSaved(updated)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка загрузки', {
				id: toastId
			})
		}
	})
	const isDangerActionPending =
		saveMutation.isPending ||
		resetAttemptsMutation.isPending ||
		buttonImageMutation.isPending
	const { requestClose, closeGuardDialog } = useWidgetSettingsCloseGuard({
		hasUnsavedChanges,
		isBusy: isDangerActionPending,
		onClose
	})
	const isPagePresentation = presentation === 'page'

	const setField = <K extends keyof WidgetConfig>(
		key: K,
		value: WidgetConfig[K]
	) => {
		setValidationIssue(null)
		setConfig(prev => ({ ...prev, [key]: value }))
	}

	const setBonus = (
		index: number,
		field:
			| 'name'
			| 'wheelLabel'
			| 'active'
			| 'probability'
			| 'color'
			| 'textColor'
			| 'neverWin',
		value: string | boolean | number | undefined
	) => {
		setValidationIssue(null)
		setConfig(prev => {
			const bonuses = [...prev.bonuses]
			bonuses[index] = { ...bonuses[index], [field]: value }
			return { ...prev, bonuses }
		})
	}

	const reportValidationIssue = (issue: ValidationIssue) => {
		setValidationIssue(issue)
		setTab(issue.tab)
		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				const field = document.getElementById(issue.fieldId)
				field?.scrollIntoView({ behavior: 'smooth', block: 'center' })
				field?.focus({ preventScroll: true })
			})
		})
		toast.error(issue.message)
	}

	const inputClassName = (fieldId: string) =>
		`${styles.input} ${
			validationIssue?.fieldId === fieldId ? pageStyles.inputError : ''
		}`

	const fieldError = (fieldId: string) =>
		validationIssue?.fieldId === fieldId ? (
			<p
				id={`${fieldId}-error`}
				className={pageStyles.fieldError}
				role="alert"
			>
				{validationIssue.message}
			</p>
		) : null

	const apiUrl =
		process.env.NEXT_PUBLIC_MODE === 'production'
			? process.env.NEXT_PUBLIC_PRODUCTION_HOST || 'https://winwidget.ru'
			: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'
	const publicSiteUrl = (
		process.env.NEXT_PUBLIC_SITE_URL ||
		(process.env.NEXT_PUBLIC_MODE === 'production'
			? 'https://winwidget.ru'
			: '')
	).replace(/\/$/, '')
	const scriptCode = `<script src="${apiUrl}/widgets/wheel.js" data-key="${widget.publicKey}" async></script>`
	const directLink = `${publicSiteUrl}/page-wheel/${widget.publicKey}`
	const savedInstallDomain = (
		JSON.parse(savedSnapshot) as { installDomain: string }
	).installDomain
	const hasUnsavedInstallDomain =
		installDomain.trim() !== savedInstallDomain.trim()
	const defaultButtonImageUrl = `${apiUrl}/widgets/gift-button.png`
	const buttonImagePreviewUrl =
		config.buttonImageUrl || defaultButtonImageUrl
	const buttonImageUploadDisabled =
		!canUseCustomButtonImage ||
		hasUnsavedChanges ||
		buttonImageMutation.isPending

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

		const nextConfig = { ...config, buttonImageUrl: '' }
		setConfig(nextConfig)
		saveMutation.mutate({
			name: name.trim() || 'Колесо',
			config: nextConfig
		})
	}

	const handleSave = () => {
		if (!name.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-name`,
				message: 'Укажите название виджета'
			})
			return
		}
		if (
			(config.bubbleEnabled ?? true) &&
			!(config.bubbleText ?? '').trim()
		) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-bubble-text`,
				message: 'Укажите текст облачка или отключите его'
			})
			return
		}
		if (!config.title.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-title`,
				message: 'Укажите заголовок виджета'
			})
			return
		}
		if (!config.buttonText.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-button-text`,
				message: 'Укажите текст кнопки запуска'
			})
			return
		}
		const activeCount = config.bonuses.filter(b => b.active).length
		const canWinCount = config.bonuses.filter(
			b => b.active && !b.neverWin
		).length
		if (activeCount < 2) {
			const firstInactiveIndex = config.bonuses.findIndex(
				bonus => !bonus.active
			)
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${Math.max(firstInactiveIndex, 0)}-active`,
				message: 'Минимум 2 бонуса должны участвовать в розыгрыше'
			})
			return
		}
		if (activeCount > 8) {
			const ninthActiveIndex = config.bonuses.reduce(
				(foundIndex, bonus, index) => {
					if (foundIndex !== -1 || !bonus.active) return foundIndex

					const activeBefore = config.bonuses
						.slice(0, index + 1)
						.filter(item => item.active).length

					return activeBefore === 9 ? index : -1
				},
				-1
			)
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${Math.max(ninthActiveIndex, 0)}-active`,
				message: 'Максимум 8 бонусов могут участвовать в розыгрыше'
			})
			return
		}
		if (canWinCount === 0) {
			const neverWinIndex = config.bonuses.findIndex(
				bonus => bonus.active && bonus.neverWin
			)
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${Math.max(neverWinIndex, 0)}-never-win`,
				message: 'Хотя бы один сектор должен иметь возможность выиграть'
			})
			return
		}
		const invalidBonusNameLength = config.bonuses.findIndex(
			b => b.active && b.name.trim().length > WHEEL_BONUS_NAME_MAX_LENGTH
		)
		if (invalidBonusNameLength !== -1) {
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${invalidBonusNameLength}-name`,
				message: `Бонус #${invalidBonusNameLength + 1}: полное название не должно быть длиннее ${WHEEL_BONUS_NAME_MAX_LENGTH} символов`
			})
			return
		}
		const invalidWheelLabel = config.bonuses.findIndex(
			b => b.active && !b.wheelLabel?.trim().length
		)
		if (invalidWheelLabel !== -1) {
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${invalidWheelLabel}-label`,
				message: `Бонус #${invalidWheelLabel + 1}: заполните текст на колесе`
			})
			return
		}
		const invalidWheelLabelLength = config.bonuses.findIndex(
			b => b.active && b.wheelLabel.trim().length > wheelLabelMaxLength
		)
		if (invalidWheelLabelLength !== -1) {
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${invalidWheelLabelLength}-label`,
				message: `Бонус #${invalidWheelLabelLength + 1}: текст на колесе не должен быть длиннее ${wheelLabelMaxLength} символов`
			})
			return
		}
		const invalidWheelLabelWord = config.bonuses.findIndex(
			b => b.active && hasTooLongWheelSectorWord(b.wheelLabel)
		)
		if (invalidWheelLabelWord !== -1) {
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${invalidWheelLabelWord}-label`,
				message: `Бонус #${invalidWheelLabelWord + 1}: слишком длинное слово в тексте на колесе, добавьте пробел или сократите текст`
			})
			return
		}
		const spin = config.spinDuration ?? 5
		if (spin < 4 || spin > 10) {
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-spin-duration`,
				message: 'Длительность анимации должна быть от 4 до 10 секунд'
			})
			return
		}
		const bottom = config.buttonBottom
		if (!bottom || bottom < 1 || bottom > 50) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-button-bottom`,
				message: 'Высота кнопки должна быть от 1 до 50%'
			})
			return
		}
		const cooldown = config.spinCooldownDays ?? 0
		if (cooldown > 365) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-spin-cooldown`,
				message: 'Повторное участие должно быть от 0 до 365 дней'
			})
			return
		}
		if (
			config.dataType !== 'NONE' &&
			(!config.privacyUrl.trim() || !isHttpUrl(config.privacyUrl))
		) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-privacy-url`,
				message: 'Укажите полную ссылку на политику с http:// или https://'
			})
			return
		}
		const invalidBonus = config.bonuses.findIndex(b => {
			const p = b.probability ?? 1
			return p < 1 || p > 100
		})
		if (invalidBonus !== -1) {
			reportValidationIssue({
				tab: 'bonuses',
				fieldId: `${titleId}-bonus-${invalidBonus}-weight`,
				message: `Бонус #${invalidBonus + 1}: вес должен быть от 1 до 100`
			})
			return
		}
		const sanitizedConfig: WidgetConfig = {
			...config,
			bonuses: config.bonuses.map((b, i) => ({
				...b,
				name: b.name.trim() || `Бонус #${i + 1}`,
				wheelLabel: (b.wheelLabel || '').trim(),
				probability: b.probability ?? 1
			}))
		}
		const sanitizedName = name.trim()
		setName(sanitizedName)
		setConfig(sanitizedConfig)
		saveMutation.mutate({
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
					aria-label="Закрыть настройки виджета"
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
					Настройки колеса
				</h2>

				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек колеса"
				>
					{(
						['main', 'bonuses', 'integrations', 'code', 'info'] as Tab[]
					).map(t => (
						<button
							key={t}
							type="button"
							id={`${titleId}-tab-${t}`}
							role="tab"
							aria-selected={tab === t}
							aria-controls={`${titleId}-panel-${t}`}
							tabIndex={tab === t ? 0 : -1}
							className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
							onClick={() => setTab(t)}
						>
							{t === 'main' && 'Главные'}
							{t === 'bonuses' && 'Бонусы'}
							{t === 'integrations' && 'Интеграции'}
							{t === 'code' && 'Установка'}
							{t === 'info' && 'Инфо'}
						</button>
					))}
				</div>

				<WidgetSettingsPreviewPortal
					inline={!isPagePresentation}
					target={previewPortalTarget}
				>
					<WidgetLivePreview
						type="wheel"
						config={config}
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
										placeholder="Виджет"
										maxLength={50}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-name`
										}
										aria-describedby={
											validationIssue?.fieldId === `${titleId}-name`
												? `${titleId}-name-error`
												: undefined
										}
									/>
									{fieldError(`${titleId}-name`)}
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Основной цвет:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.color}
											onChange={e => setField('color', e.target.value)}
										/>
										<input
											className={styles.input}
											value={config.color}
											onChange={e => setField('color', e.target.value)}
											placeholder="#4705fb"
											maxLength={7}
										/>
										{config.color && config.color !== '#4705fb' && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('color', '#4705fb')}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет фона карточки и секторов по умолчанию (если не
										задан свой цвет сектора).
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет обода колеса:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.wheelBorderColor || config.color}
											onChange={e =>
												setField('wheelBorderColor', e.target.value)
											}
										/>
										<input
											className={styles.input}
											value={config.wheelBorderColor || ''}
											onChange={e =>
												setField('wheelBorderColor', e.target.value)
											}
											placeholder="Как основной цвет"
											maxLength={7}
										/>
										{config.wheelBorderColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('wheelBorderColor', '')}
												title="Вернуть основной цвет"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Отдельный цвет внешнего кольца колеса. Оставьте пустым,
										чтобы использовать основной цвет.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет фона виджета</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.bgColor || '#4705fb'}
											onChange={e => setField('bgColor', e.target.value)}
										/>
										<input
											className={styles.input}
											value={config.bgColor || ''}
											onChange={e => setField('bgColor', e.target.value)}
											placeholder="#4705fb"
											maxLength={7}
										/>
										{config.bgColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('bgColor', '')}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Цвет фона карточки (фон под колесом). Оставьте пустым
										для стандартного градиента.
									</p>
								</div>

								<div className={styles.field}>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={config.glassEffect}
											onChange={e =>
												setField('glassEffect', e.target.checked)
											}
										/>
										<span className={styles.checkLabel}>
											Стеклянный эффект фона
										</span>
									</label>
									<p className={styles.hint}>
										Делает фон карточки полупрозрачным, с мягким бликом и
										размытием подложки.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет текста виджета</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={
												config.textColor ||
												getReadableTextColor(
													config.bgColor || config.color
												)
											}
											onChange={e => setField('textColor', e.target.value)}
										/>
										<input
											className={styles.input}
											value={config.textColor || ''}
											onChange={e => setField('textColor', e.target.value)}
											placeholder="Авто по фону"
											maxLength={7}
										/>
										{config.textColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('textColor', '')}
												title="Вернуть автоцвет"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										По умолчанию подбирается автоматически под цвет фона.
										Можно задать вручную для брендового оформления.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет кнопки «Крутить»:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.buttonColor || '#6a11cb'}
											onChange={e =>
												setField('buttonColor', e.target.value)
											}
										/>
										<input
											className={styles.input}
											value={config.buttonColor || ''}
											onChange={e =>
												setField('buttonColor', e.target.value)
											}
											placeholder="По умолчанию (градиент)"
											maxLength={7}
										/>
										{config.buttonColor && (
											<button
												type="button"
												className={styles.clearColorBtn}
												onClick={() => setField('buttonColor', '')}
												title="Сбросить к стандартному"
											>
												✕
											</button>
										)}
									</div>
									<p className={styles.hint}>
										Оставьте пустым для стандартного градиента
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Цвет волчка (центральный круг колеса):
									</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.centerColor || '#ffffff'}
											onChange={e =>
												setField('centerColor', e.target.value)
											}
										/>
										<input
											className={styles.input}
											value={config.centerColor || ''}
											onChange={e =>
												setField('centerColor', e.target.value)
											}
											placeholder="#ffffff"
											maxLength={7}
										/>
										{config.centerColor &&
											config.centerColor !== '#ffffff' && (
												<button
													type="button"
													className={styles.clearColorBtn}
													onClick={() =>
														setField('centerColor', '#ffffff')
													}
													title="Сбросить к белому"
												>
													✕
												</button>
											)}
									</div>
									<p className={styles.hint}>
										Цвет круглого элемента в центре колеса фортуны.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет стрелки:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={config.arrowColor || '#ffcc00'}
											onChange={e =>
												setField('arrowColor', e.target.value)
											}
										/>
										<input
											className={styles.input}
											value={config.arrowColor || ''}
											onChange={e =>
												setField('arrowColor', e.target.value)
											}
											placeholder="#ffcc00"
											maxLength={7}
										/>
										{config.arrowColor &&
											config.arrowColor !== '#ffcc00' && (
												<button
													type="button"
													className={styles.clearColorBtn}
													onClick={() => setField('arrowColor', '#ffcc00')}
													title="Сбросить к стандартному"
												>
													✕
												</button>
											)}
									</div>
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
													onChange={handleButtonImageUpload}
												/>
												{config.buttonImageUrl && (
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
									<p className={styles.label}>
										Кнопка открытия — пульсация
									</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="buttonPulse"
											checked={config.buttonPulse ?? true}
											onChange={e =>
												setField('buttonPulse', e.target.checked)
											}
										/>
										<label
											htmlFor="buttonPulse"
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
										value={config.buttonSide ?? 'right'}
										onChange={e =>
											setField(
												'buttonSide',
												e.target.value as 'left' | 'right'
											)
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
									<p className={styles.label}>Отображение облачка</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="wheelBubbleEnabled"
											checked={config.bubbleEnabled ?? true}
											onChange={e =>
												setField('bubbleEnabled', e.target.checked)
											}
										/>
										<label
											htmlFor="wheelBubbleEnabled"
											className={styles.checkLabel}
										>
											Показывать облачко рядом с кнопкой
										</label>
									</div>
									<p className={styles.hint}>
										Если выключить, останется только плавающая кнопка.
									</p>
								</div>

								{config.bubbleEnabled && (
									<div className={styles.field}>
										<p className={styles.label}>Текст облачка:</p>
										<input
											id={`${titleId}-bubble-text`}
											className={inputClassName(`${titleId}-bubble-text`)}
											value={config.bubbleText ?? ''}
											onChange={e =>
												setField('bubbleText', e.target.value)
											}
											placeholder="Испытайте удачу!"
											maxLength={80}
											aria-invalid={
												validationIssue?.fieldId ===
												`${titleId}-bubble-text`
											}
											aria-describedby={
												validationIssue?.fieldId ===
												`${titleId}-bubble-text`
													? `${titleId}-bubble-text-error`
													: undefined
											}
										/>
										{fieldError(`${titleId}-bubble-text`)}
										<p className={styles.hint}>
											Короткая подсказка рядом с плавающей кнопкой.
										</p>
									</div>
								)}

								<div className={styles.field}>
									<div className={pageStyles.rangeHeader}>
										<p className={styles.label}>
											Высота кнопки от низа экрана:
										</p>
										<span className={pageStyles.rangeValue}>
											{config.buttonBottom ?? 3}%
										</span>
									</div>
									<input
										id={`${titleId}-button-bottom`}
										type="range"
										aria-label="Высота кнопки от низа экрана"
										min={1}
										max={50}
										value={config.buttonBottom ?? 3}
										onChange={e =>
											setField('buttonBottom', Number(e.target.value))
										}
										className={pageStyles.rangeInput}
										aria-invalid={
											validationIssue?.fieldId ===
											`${titleId}-button-bottom`
										}
									/>
									{fieldError(`${titleId}-button-bottom`)}
									<p className={styles.hint}>
										Отступ от нижнего края экрана в процентах. 3 — почти
										внизу, 50 — по центру.
									</p>
								</div>

								<div className={styles.field}>
									<div className={pageStyles.rangeHeader}>
										<p className={styles.label}>
											Отступ кнопки от края экрана:
										</p>
										<span className={pageStyles.rangeValue}>
											{config.buttonOffset ?? 3}%
										</span>
									</div>
									<input
										type="range"
										aria-label="Отступ кнопки от края экрана"
										min={1}
										max={50}
										value={config.buttonOffset ?? 3}
										onChange={e =>
											setField('buttonOffset', Number(e.target.value))
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
										<p className={styles.label}>Размер кнопки открытия:</p>
										<span className={pageStyles.rangeValue}>
											{config.buttonSize ?? 60}px
										</span>
									</div>
									<input
										type="range"
										aria-label="Размер кнопки открытия"
										min={40}
										max={100}
										value={config.buttonSize ?? 60}
										onChange={e =>
											setField('buttonSize', Number(e.target.value))
										}
										className={pageStyles.rangeInput}
									/>
									<p className={styles.hint}>
										Размер иконки плавающей кнопки в пикселях. По умолчанию
										60px.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Автооткрытие:</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id={`${titleId}-auto-open-enabled`}
											checked={config.autoOpenDelay != null}
											onChange={e =>
												setField(
													'autoOpenDelay',
													e.target.checked ? 5 : null
												)
											}
										/>
										<label
											htmlFor={`${titleId}-auto-open-enabled`}
											className={styles.checkLabel}
										>
											Открывать виджет автоматически
										</label>
									</div>
									{config.autoOpenDelay != null && (
										<>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>Автооткрытие через:</p>
												<span className={pageStyles.rangeValue}>
													{config.autoOpenDelay} сек.
												</span>
											</div>
											<input
												type="range"
												aria-label="Автооткрытие через"
												min={1}
												max={60}
												value={config.autoOpenDelay}
												onChange={e =>
													setField('autoOpenDelay', Number(e.target.value))
												}
												className={pageStyles.rangeInput}
											/>
										</>
									)}
									<p className={styles.hint}>
										Если посетитель уже участвовал, автооткрытие не
										сработает.
									</p>
								</div>
							</div>

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
										value={config.dataType}
										onChange={e =>
											setField(
												'dataType',
												e.target.value as WidgetConfig['dataType']
											)
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
										Какие данные клиента нужно собрать в обмен на попытку
										покрутить барабан.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Заголовок виджета:</p>
									<input
										id={`${titleId}-title`}
										className={inputClassName(`${titleId}-title`)}
										value={config.title}
										onChange={e => setField('title', e.target.value)}
										placeholder="Крутите колесо!"
										maxLength={80}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-title`
										}
										aria-describedby={
											validationIssue?.fieldId === `${titleId}-title`
												? `${titleId}-title-error`
												: undefined
										}
									/>
									{fieldError(`${titleId}-title`)}
									<p className={styles.hint}>Информация для посетителя.</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок виджета:</p>
									<input
										className={styles.input}
										value={config.subtitle}
										onChange={e => setField('subtitle', e.target.value)}
										placeholder={
											config.dataType === 'EMAIL'
												? 'Введите свою почту, чтобы выиграть приз'
												: config.dataType === 'PHONE_AND_EMAIL'
													? 'Введите свой номер телефона и почту, чтобы выиграть приз'
													: config.dataType === 'NONE'
														? 'Крутите барабан, чтобы выиграть приз'
														: 'Введите свой номер телефона, чтобы выиграть приз'
										}
										maxLength={150}
									/>
									<p className={styles.hint}>Информация для посетителя.</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Текст кнопки запуска:</p>
									<input
										id={`${titleId}-button-text`}
										className={inputClassName(`${titleId}-button-text`)}
										value={config.buttonText}
										onChange={e => setField('buttonText', e.target.value)}
										placeholder="Крутить!"
										maxLength={40}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-button-text`
										}
										aria-describedby={
											validationIssue?.fieldId === `${titleId}-button-text`
												? `${titleId}-button-text-error`
												: undefined
										}
									/>
									{fieldError(`${titleId}-button-text`)}
									<p className={styles.hint}>
										Текст кнопки, которая запускает вращение колеса.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Сообщение после выигрыша:</p>
									<input
										className={styles.input}
										value={config.winMessage}
										onChange={e => setField('winMessage', e.target.value)}
										placeholder="Поздравляем! Не пропустите звонок, мы скоро свяжемся"
										maxLength={150}
									/>
									<p className={styles.hint}>
										Текст для посетителя после остановки колеса и
										определения выигрыша.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ссылка на политику конфиденциальности:
									</p>
									<input
										id={`${titleId}-privacy-url`}
										type="url"
										className={inputClassName(`${titleId}-privacy-url`)}
										value={config.privacyUrl}
										onChange={e => setField('privacyUrl', e.target.value)}
										placeholder="https://winwidget.ru/legal-documentation/consent-processing"
										maxLength={500}
										aria-invalid={
											validationIssue?.fieldId === `${titleId}-privacy-url`
										}
										aria-describedby={
											validationIssue?.fieldId === `${titleId}-privacy-url`
												? `${titleId}-privacy-url-error`
												: undefined
										}
									/>
									{fieldError(`${titleId}-privacy-url`)}
									<p className={styles.hint}>
										По умолчанию ссылка ведёт на политику нашего сервиса.
										Можно оставить как есть или добавить свою ссылку.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Повторное участие
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Скрыть виджет после участия:
									</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="hideIfPlayed"
											checked={config.hideIfPlayed ?? false}
											onChange={e =>
												setField('hideIfPlayed', e.target.checked)
											}
										/>
										<label
											htmlFor="hideIfPlayed"
											className={styles.checkLabel}
										>
											Скрывать кнопку и виджет, если посетитель уже крутил
										</label>
									</div>
									<p className={styles.hint}>
										Виджет и кнопка полностью исчезнут для тех, кто уже
										участвовал
									</p>
								</div>

								{!config.hideIfPlayed && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>
												Заголовок для повторного посетителя:
											</p>
											<input
												className={styles.input}
												value={config.alreadyPlayedTitle ?? ''}
												onChange={e =>
													setField('alreadyPlayedTitle', e.target.value)
												}
												placeholder="🎉 Вы уже участвовали!"
												maxLength={80}
											/>
											<p className={styles.hint}>
												Показывается вместо колеса, если повторное участие
												пока недоступно.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>
												Сообщение для повторного посетителя:
											</p>
											<input
												className={styles.input}
												value={config.alreadyPlayedSubtitle ?? ''}
												onChange={e =>
													setField('alreadyPlayedSubtitle', e.target.value)
												}
												placeholder="Каждый посетитель может крутить колесо только один раз"
												maxLength={150}
											/>
										</div>
									</>
								)}

								<div className={styles.field}>
									<div className={pageStyles.rangeHeader}>
										<p className={styles.label}>
											Повторное участие через:
										</p>
										<span className={pageStyles.rangeValue}>
											{config.spinCooldownDays
												? `${config.spinCooldownDays} дн.`
												: 'Один раз'}
										</span>
									</div>
									<input
										id={`${titleId}-spin-cooldown`}
										className={pageStyles.rangeInput}
										type="range"
										aria-label="Повторное участие через"
										min={0}
										max={365}
										value={config.spinCooldownDays ?? 0}
										onChange={e =>
											setField('spinCooldownDays', Number(e.target.value))
										}
										aria-invalid={
											validationIssue?.fieldId ===
											`${titleId}-spin-cooldown`
										}
									/>
									{fieldError(`${titleId}-spin-cooldown`)}
									<p className={styles.hint}>
										0 — только одно участие. Другое значение разрешит новую
										попытку через выбранное число дней.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Фильтр заявок:</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="filterDuplicates"
											checked={config.filterDuplicates}
											onChange={e =>
												setField('filterDuplicates', e.target.checked)
											}
										/>
										<label
											htmlFor="filterDuplicates"
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

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Опасные действия
									</h3>
								</div>

								<div className={styles.dangerActions}>
									{!confirmResetAttempts ? (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => {
												if (hasUnsavedChanges) {
													toast.error(
														'Сначала сохраните текущие настройки виджета'
													)
													return
												}
												setConfirmResetAttempts(true)
											}}
											disabled={isDangerActionPending}
										>
											Сбросить попытки всех посетителей
										</button>
									) : (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все посетители смогут крутить колесо заново.
												Действие необратимо.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													onClick={() => {
														if (hasUnsavedChanges) {
															toast.error(
																'Сначала сохраните текущие настройки виджета'
															)
															return
														}
														resetAttemptsMutation.mutate(
															crypto.randomUUID()
														)
														setConfirmResetAttempts(false)
													}}
													disabled={isDangerActionPending}
												>
													{resetAttemptsMutation.isPending
														? 'Сброс...'
														: 'Да, сбросить'}
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													disabled={isDangerActionPending}
													onClick={() => setConfirmResetAttempts(false)}
												>
													Отмена
												</button>
											</div>
										</div>
									)}

									{!confirmReset ? (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmReset(true)}
											disabled={isDangerActionPending}
										>
											Сбросить все настройки до значений по умолчанию
										</button>
									) : (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Все настройки виджета будут заменены на
												стандартные. Действие необратимо после сохранения.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													disabled={isDangerActionPending}
													onClick={() => {
														setConfig(DEFAULT_CONFIG)
														setConfirmReset(false)
														saveMutation.mutate({
															name: name.trim() || 'Колесо',
															config: DEFAULT_CONFIG
														})
													}}
												>
													Да, сбросить
												</button>
												<button
													type="button"
													className={styles.cancelBtn}
													disabled={isDangerActionPending}
													onClick={() => setConfirmReset(false)}
												>
													Отмена
												</button>
											</div>
										</div>
									)}
								</div>
							</div>
						</div>
					)}

					{tab === 'bonuses' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Поведение колеса
									</h3>
								</div>

								<div className={styles.field}>
									<div className={pageStyles.rangeHeader}>
										<p className={styles.label}>Длительность вращения:</p>
										<span className={pageStyles.rangeValue}>
											{config.spinDuration ?? 5} сек.
										</span>
									</div>
									<input
										id={`${titleId}-spin-duration`}
										type="range"
										aria-label="Длительность вращения"
										min={4}
										max={10}
										value={config.spinDuration ?? 5}
										onChange={e =>
											setField('spinDuration', Number(e.target.value))
										}
										className={pageStyles.rangeInput}
										aria-invalid={
											validationIssue?.fieldId ===
											`${titleId}-spin-duration`
										}
									/>
									{fieldError(`${titleId}-spin-duration`)}
									<p className={styles.hint}>
										Рекомендуем 5–7 секунд: посетитель успеет заметить
										анимацию, но не будет ждать слишком долго.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Правила выпадения
									</h3>
								</div>
								<p className={styles.hint}>
									Укажите от 2 до 8 бонусов. У каждого бонуса есть полное
									название приза и короткая подпись на колесе. В секторе
									мало места, поэтому длинные фразы лучше оставлять в
									названии приза.
									<br />
									<br />
									<b>Вес (от 1 до 100)</b>
									<br />
									<br /> управляет частотой выпадения сектора: чем больше
									вес, тем чаще он выпадает.
									<br />
									Все веса суммируются, и каждый сектор получает долю
									пропорционально своему весу.
									<br />
									<br />
									Пример: колесо из 3х секторов с весами 1, 1, 8 — третий
									выпадет в 80% случаев.
									<br />
									<br />
									Галочка <b>«никогда не выигрывает»</b> показывает сектор
									на колесе, но исключает его из розыгрыша — вес при этом
									игнорируется.
								</p>
							</div>
							{config.bonuses.map((bonus, i) => (
								<div key={i} className={styles.bonusBlock}>
									<p className={styles.label}>Бонус #{i + 1}</p>
									<p className={styles.label}>Название приза</p>
									<p className={styles.hint}>
										Полное название увидит победитель. Оно попадет в
										заявку, уведомления и интеграции.
									</p>
									<input
										id={`${titleId}-bonus-${i}-name`}
										className={inputClassName(
											`${titleId}-bonus-${i}-name`
										)}
										value={bonus.name}
										onChange={e => setBonus(i, 'name', e.target.value)}
										placeholder={`Например: Скидка до 60 000 рублей`}
										maxLength={WHEEL_BONUS_NAME_MAX_LENGTH}
										aria-invalid={
											validationIssue?.fieldId ===
											`${titleId}-bonus-${i}-name`
										}
									/>
									{fieldError(`${titleId}-bonus-${i}-name`)}
									<p className={styles.hint}>
										До {WHEEL_BONUS_NAME_MAX_LENGTH} символов. Здесь можно
										писать подробнее, чем на секторе.
									</p>
									<p className={styles.label}>Текст на секторе</p>
									<p className={styles.hint}>
										Короткая подпись внутри колеса. Пишите 1-3 слова, без
										длинных фраз, чтобы текст не обрезался.
									</p>
									<input
										id={`${titleId}-bonus-${i}-label`}
										className={inputClassName(
											`${titleId}-bonus-${i}-label`
										)}
										value={bonus.wheelLabel || ''}
										onChange={e =>
											setBonus(i, 'wheelLabel', e.target.value)
										}
										placeholder="Короткий текст на колесе"
										maxLength={wheelLabelMaxLength}
										aria-invalid={
											validationIssue?.fieldId ===
											`${titleId}-bonus-${i}-label`
										}
									/>
									{fieldError(`${titleId}-bonus-${i}-label`)}
									<p className={styles.hint}>
										До {wheelLabelMaxLength} символов. Одно слово — до{' '}
										{WHEEL_BONUS_WORD_MAX_LENGTH} символов.
									</p>
									<div className={styles.colorRow}>
										<div className={styles.colorRowField}>
											<span className={styles.colorRowLabel}>Цвет</span>
											<div className={styles.colorInputs}>
												<input
													type="color"
													className={styles.colorPicker}
													value={bonus.color || '#4705fb'}
													onChange={e =>
														setBonus(i, 'color', e.target.value)
													}
												/>
												<input
													className={styles.input}
													value={bonus.color || ''}
													onChange={e =>
														setBonus(i, 'color', e.target.value)
													}
													placeholder="#4705fb"
													maxLength={7}
												/>
											</div>
										</div>
										<div className={styles.colorRowField}>
											<span className={styles.colorRowLabel}>
												Цвет текста
											</span>
											<div className={styles.colorInputs}>
												<input
													type="color"
													className={styles.colorPicker}
													value={
														bonus.textColor ||
														getReadableTextColor(
															bonus.color ||
																(i % 2 === 0 ? config.color : '#ffffff')
														)
													}
													onChange={e =>
														setBonus(i, 'textColor', e.target.value)
													}
												/>
												<input
													className={styles.input}
													value={bonus.textColor || ''}
													onChange={e =>
														setBonus(i, 'textColor', e.target.value)
													}
													placeholder="Авто"
													maxLength={7}
												/>
												{bonus.textColor && (
													<button
														type="button"
														className={styles.clearColorBtn}
														onClick={() => setBonus(i, 'textColor', '')}
														title="Вернуть автоцвет"
													>
														✕
													</button>
												)}
											</div>
										</div>
									</div>
									<div className={styles.field}>
										<div className={pageStyles.rangeHeader}>
											<span className={styles.label}>Вес бонуса:</span>
											<span className={pageStyles.rangeValue}>
												{bonus.probability ?? 1} из 100
											</span>
										</div>
										<input
											id={`${titleId}-bonus-${i}-weight`}
											className={pageStyles.rangeInput}
											type="range"
											aria-label={`Вес бонуса «${bonus.name || i + 1}»`}
											min={1}
											max={100}
											value={bonus.probability ?? 1}
											onChange={e =>
												setBonus(i, 'probability', Number(e.target.value))
											}
											aria-invalid={
												validationIssue?.fieldId ===
												`${titleId}-bonus-${i}-weight`
											}
										/>
										{fieldError(`${titleId}-bonus-${i}-weight`)}
									</div>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id={`${titleId}-bonus-${i}-active`}
											checked={bonus.active}
											onChange={e =>
												setBonus(i, 'active', e.target.checked)
											}
										/>
										<label
											htmlFor={`${titleId}-bonus-${i}-active`}
											className={styles.checkLabel}
										>
											участвует в розыгрыше
										</label>
									</div>
									{fieldError(`${titleId}-bonus-${i}-active`)}
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id={`${titleId}-bonus-${i}-never-win`}
											checked={bonus.neverWin ?? false}
											onChange={e =>
												setBonus(i, 'neverWin', e.target.checked)
											}
											aria-invalid={
												validationIssue?.fieldId ===
												`${titleId}-bonus-${i}-never-win`
											}
										/>
										<label
											htmlFor={`${titleId}-bonus-${i}-never-win`}
											className={styles.checkLabel}
										>
											никогда не выигрывает
										</label>
									</div>
									{fieldError(`${titleId}-bonus-${i}-never-win`)}
								</div>
							))}
						</div>
					)}

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
										className={styles.input}
										type="email"
										value={config.integrations.email || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												email: e.target.value
											})
										}
										placeholder="your@email.com"
										maxLength={200}
									/>
									<p className={styles.hint}>
										Новые заявки будут отправляться на этот email
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отправка заявок в Telegram
									</p>
									<input
										className={styles.input}
										value={config.integrations.telegramChatId || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												telegramChatId: e.target.value
											})
										}
										placeholder="-1234567890"
										maxLength={50}
									/>
									<p className={styles.hint}>
										Напишите боту <b>@winwidget_info_bot</b> команду
										/start, затем укажите сюда ваш Telegram ID. Узнать ID
										можно через бот <b>@getmyid_bot</b>
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
										className={styles.input}
										type="url"
										value={config.integrations.webhookUrl || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												webhookUrl: e.target.value
											})
										}
										placeholder="https://example.com/webhook"
										maxLength={500}
									/>
									<p className={styles.hint}>
										На указанный URL придёт POST-запрос с данными:{' '}
										<b>name</b> — название виджета, <b>lead</b> — контакт,{' '}
										<b>phone</b>, <b>email</b>, <b>bonus</b> — выигранный
										приз, <b>time</b> — время выигрыша
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Отправка заявок в Битрикс24
									</p>
									<input
										className={styles.input}
										type="url"
										value={config.integrations.bitrix24WebhookUrl || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												bitrix24WebhookUrl: e.target.value
											})
										}
										placeholder="https://name.bitrix24.ru/rest/1/ключ/"
										maxLength={500}
									/>
									<p className={styles.hint}>
										Укажите URL вашего входящего вебхука из Битрикс24.
										Перейдите в Битрикс24 → Приложения → Вебхуки → Входящий
										вебхук → скопируйте «Пример URL для вызова REST». Новые
										заявки будут создаваться как лиды в CRM
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — домен аккаунта</p>
									<input
										className={styles.input}
										value={config.integrations.amoCrmDomain || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												amoCrmDomain: e.target.value
											})
										}
										placeholder="mycompany.amocrm.ru"
										maxLength={100}
									/>
									<p className={styles.hint}>
										Домен вашего аккаунта amoCRM, например{' '}
										<b>mycompany.amocrm.ru</b>
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>amoCRM — токен доступа</p>
									<input
										className={styles.input}
										type="password"
										value={config.integrations.amoCrmToken || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												amoCrmToken: e.target.value
											})
										}
										placeholder="Долгосрочный токен из настроек API"
										maxLength={500}
									/>
									<p className={styles.hint}>
										Перейдите в amoCRM → Настройки → Интеграции → API →
										скопируйте долгосрочный токен. При каждой заявке будут
										создаваться сделка и контакт
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
										value={config.integrations.yandexMetrikaId || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												yandexMetrikaId: e.target.value
											})
										}
										placeholder="12345678"
										maxLength={20}
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>ip3_open</b>,
										при отправке заявки — <b>ip3_send</b>. Счётчик метрики
										должен быть установлен на странице сайта
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ретаргетинг ВКонтакте — ID пикселя
									</p>
									<input
										className={styles.input}
										value={config.integrations.vkPixelId || ''}
										onChange={e =>
											setField('integrations', {
												...config.integrations,
												vkPixelId: e.target.value
											})
										}
										placeholder="VK-RTRG-12345-ABCDEF"
										maxLength={50}
									/>
									<p className={styles.hint}>
										При открытии виджета отправляется событие{' '}
										<b>ip3_open</b>, при отправке заявки — <b>ip3_send</b>.
										Пиксель VK должен быть установлен на странице сайта
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Roistat</p>
									<div className={styles.checkRow}>
										<input
											type="checkbox"
											id="roistatEnabled"
											checked={config.integrations.roistatEnabled ?? false}
											onChange={e =>
												setField('integrations', {
													...config.integrations,
													roistatEnabled: e.target.checked
												})
											}
										/>
										<label
											htmlFor="roistatEnabled"
											className={styles.checkLabel}
										>
											Включить отправку целей в Roistat
										</label>
									</div>
									<p className={styles.hint}>
										При открытии виджета отправляется цель <b>ip3_open</b>,
										при отправке заявки — <b>ip3_send</b>. Код Roistat
										должен быть подключён на странице сайта
									</p>
								</div>
							</div>
						</div>
					)}

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
									<p className={styles.label}>Код виджета:</p>
									<p className={styles.hint}>
										Вставьте этот код перед закрывающим тегом &lt;/body&gt;
									</p>
									<textarea
										className={`${styles.input} ${styles.codeArea}`}
										readOnly
										value={scriptCode}
										onClick={e =>
											(e.target as HTMLTextAreaElement).select()
										}
									/>
									<button
										type="button"
										className={styles.copyBtn}
										onClick={() =>
											copyToClipboard(scriptCode, 'Код скопирован', true)
										}
									>
										Скопировать
									</button>
									<DirectLinkQr
										value={directLink}
										downloadName={`winwidget-wheel-${widget.publicKey}.png`}
									/>
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
									<p className={styles.hint}>
										Если не требуется подключение виджета к сайту
									</p>
									<div className={styles.directLink}>
										<input
											className={styles.input}
											readOnly
											value={directLink}
											onClick={e =>
												(e.target as HTMLInputElement).select()
											}
										/>
										<a
											href={directLink}
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
											copyToClipboard(directLink, 'Ссылка скопирована')
										}
									>
										Скопировать
									</button>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Как работает колесо
									</h3>
								</div>
								<p className={styles.infoText}>
									Посетитель открывает колесо, оставляет контакт и крутит
									барабан. После выигрыша заявка сохраняется в кабинете и
									отправляется в подключённые интеграции.
								</p>
								<ul className={styles.infoList}>
									<li>
										В разделе «Главные» настройте внешний вид, кнопку
										открытия и тексты формы.
									</li>
									<li>
										В «Бонусах» задайте секторы колеса, вероятность и
										активность призов.
									</li>
									<li>
										В «Интеграциях» подключите email, Telegram, webhook,
										CRM и аналитику.
									</li>
									<li>
										В «Установке» скопируйте скрипт на сайт или используйте
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
										Укажите понятные названия бонусов и отключите лишние
										сектора.
									</li>
									<li>
										Выберите тип контакта: телефон, email или оба поля.
									</li>
									<li>
										Настройте ограничение повторной игры, если один
										посетитель не должен крутить колесо несколько раз.
									</li>
									<li>
										После установки откройте сайт в новом окне и отправьте
										тестовую заявку.
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
							disabled={saveMutation.isPending}
						>
							{isPagePresentation ? 'К виджетам' : 'Отмена'}
						</button>
						<button
							type="button"
							className={styles.saveBtn}
							onClick={handleSave}
							disabled={saveMutation.isPending || !hasUnsavedChanges}
						>
							{saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
						</button>
					</div>
				</div>
				{closeGuardDialog}
			</div>
		</div>
	)
}

export default WheelSettingsModal
