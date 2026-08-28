'use client'

import {
	aiConsultantService,
	type AiConsultant,
	type AiConsultantConfig,
	type AiConsultantMessage,
	type AiConsultantOutcome
} from '@/entities/site-widget'
import { WIDGETS_HOST } from '@/shared/config/api.config'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import {
	type ChangeEvent,
	type FormEvent,
	useEffect,
	useId,
	useRef,
	useState
} from 'react'
import toast from 'react-hot-toast'
import ActionTooltip from '../shared/ActionTooltip'
import useWidgetSettingsCloseGuard from '../shared/useWidgetSettingsCloseGuard'
import {
	findInvalidWidgetColor,
	getWidgetColorPreview,
	isWidgetHexColor
} from '../shared/widgetColor'
import WidgetLivePreview from '../shared/WidgetLivePreview'
import type {
	WidgetSettingsPersistence,
	WidgetSettingsPresentationProps
} from '../shared/WidgetSettingsPersistence'
import WidgetSettingsPreviewPortal from '../shared/WidgetSettingsPreviewPortal'
import testStyles from './AiConsultantSettingsModal.module.scss'
import styles from '../shared/WidgetSettingsModal.module.scss'

type Tab = 'main' | 'ai' | 'dialogue' | 'test' | 'code' | 'info'
type EditableTab = Exclude<Tab, 'test' | 'code' | 'info'>

const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024
const MAX_PROMPT_BYTES = 16_000
const MAX_TEST_HISTORY_MESSAGES = 12

const DEFAULT_GREETING =
	'Здравствуйте! Я Alex, AI-оператор.\nГотов помочь и ответить на ваши вопросы о товарах, услугах и условиях компании.'
const DEFAULT_FAREWELL =
	'Я не дождался ответа. Если у вас появятся вопросы, напишите снова — я обязательно помогу.'
const DEFAULT_PRIVACY_URL =
	'https://winwidget.ru/legal-documentation/consent-processing'

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Основные' },
	{ id: 'ai', label: 'AI и инструкции' },
	{ id: 'dialogue', label: 'Диалог' },
	{ id: 'test', label: 'Тест' },
	{ id: 'code', label: 'Установка' },
	{ id: 'info', label: 'Проверка' }
]

interface Props extends WidgetSettingsPresentationProps {
	aiConsultant: AiConsultant
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: AiConsultant) => void
	persistence?: WidgetSettingsPersistence<AiConsultant, AiConsultantConfig>
}

type ValidationIssue = {
	tab: EditableTab
	fieldId: string
	message: string
}

type TestMessage = AiConsultantMessage & {
	outcome?: AiConsultantOutcome
}

const getDefaultConfig = (): AiConsultantConfig => ({
	color: '#4705fb',
	bgColor: '#ffffff',
	textColor: '#1f2937',
	buttonColor: '',
	openButtonColor: '',
	buttonSide: 'right',
	buttonPulse: true,
	buttonBottom: 3,
	buttonOffset: 3,
	buttonSize: 60,
	buttonImageUrl: '',
	autoOpenDelay: null,
	operatorName: 'Alex',
	greeting: DEFAULT_GREETING,
	instructionsPrompt: '',
	inactivityTimeoutMinutes: 10,
	farewellMessage: DEFAULT_FAREWELL,
	inputPlaceholder: 'Задайте вопрос...',
	privacyUrl: DEFAULT_PRIVACY_URL,
	developInfoActive: true
})

const isValidHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const mergeConfig = (
	config: Partial<AiConsultantConfig>
): AiConsultantConfig => ({
	...getDefaultConfig(),
	...config
})

const outcomeLabel: Record<AiConsultantOutcome, string> = {
	ANSWER: 'Ответ по инструкции',
	OFF_TOPIC: 'Вопрос не по теме',
	NO_INFORMATION: 'Недостаточно информации'
}

const createUuidV4 = () => window.crypto.randomUUID()
const utf8ByteLength = (value: string) =>
	new TextEncoder().encode(value).length

const AiConsultantSettingsModal = ({
	aiConsultant,
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
	onPreviewConfigChange,
	previewCollapsed,
	onPreviewCollapsedChange
}: Props) => {
	const titleId = useId()
	const buttonImageInputId = useId()
	const [tab, setTab] = useState<Tab>('main')
	const [cfg, setCfg] = useState<AiConsultantConfig>(
		mergeConfig(aiConsultant.config)
	)
	const [name, setName] = useState(aiConsultant.name)
	const [installDomain, setInstallDomain] = useState(
		aiConsultant.installDomain ?? ''
	)
	const [savedSnapshot, setSavedSnapshot] = useState(
		JSON.stringify({
			name: aiConsultant.name,
			installDomain: aiConsultant.installDomain ?? '',
			config: mergeConfig(aiConsultant.config)
		})
	)
	const [validationIssue, setValidationIssue] =
		useState<ValidationIssue | null>(null)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [confirmResetSection, setConfirmResetSection] =
		useState<EditableTab | null>(null)
	const [testInput, setTestInput] = useState('')
	const [testMessages, setTestMessages] = useState<TestMessage[]>([])
	const draftRevisionRef = useRef(aiConsultant.draftRevision)
	const testSessionIdRef = useRef('')

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
			installDomain: string
			config: AiConsultantConfig
		}) =>
			(
				persistence?.update ??
				(payload =>
					aiConsultantService.updateAiConsultant(aiConsultant.id, payload))
			)({
				name: data?.name ?? name,
				installDomain: data?.installDomain ?? installDomain,
				config: data?.config ?? cfg,
				expectedDraftRevision: draftRevisionRef.current
			}),
		onMutate: () => toast.loading('Сохраняем настройки...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
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
			setTestMessages([])
			testSessionIdRef.current = ''
			onSaved({ ...updated, config: nextConfig })
			toast.success('Черновик сохранён', { id: toastId })
			window.dispatchEvent(
				new CustomEvent('winwidget:ai-consultant:updated', {
					detail: { key: aiConsultant.publicKey }
				})
			)
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
				: aiConsultantService.uploadButtonImage(aiConsultant.id, formData)
		},
		onMutate: () => toast.loading('Загружаем картинку кнопки...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			const nextConfig = mergeConfig(updated.config)
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
		},
		onError: (error: any, _, toastId) =>
			reportMutationError(error, 'Ошибка загрузки картинки', toastId)
	})

	const testMutation = useMutation({
		mutationFn: (variables: {
			requestId: string
			sessionId: string
			message: string
			history: AiConsultantMessage[]
		}) => aiConsultantService.testMessage(aiConsultant.id, variables),
		onMutate: () => toast.loading('AI готовит тестовый ответ...'),
		onSuccess: (response, _, toastId) => {
			setTestMessages(previous => [
				...previous,
				{
					role: 'assistant',
					content: response.reply,
					outcome: response.outcome
				}
			])
			toast.success('Тестовый ответ получен', { id: toastId })
		},
		onError: (error: any, _, toastId) => {
			toast.error(
				error?.response?.data?.message ||
					'Не удалось получить тестовый ответ',
				{ id: toastId }
			)
		}
	})

	const isBusy =
		mutation.isPending ||
		buttonImageMutation.isPending ||
		testMutation.isPending
	const { requestClose, closeGuardDialog } = useWidgetSettingsCloseGuard({
		hasUnsavedChanges,
		isBusy,
		onClose
	})
	const isPagePresentation = presentation === 'page'
	const defaultButtonImageUrl = `${WIDGETS_HOST}/widgets/ai-consultant-button.png`
	const buttonImagePreviewUrl = cfg.buttonImageUrl || defaultButtonImageUrl
	const buttonImageUploadDisabled =
		!canUseCustomButtonImage ||
		hasUnsavedChanges ||
		buttonImageMutation.isPending

	const set = (patch: Partial<AiConsultantConfig>) => {
		setValidationIssue(null)
		setCfg(previous => ({ ...previous, ...patch }))
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

	const validate = () => {
		const requiredColors: Array<keyof AiConsultantConfig> = [
			'color',
			'bgColor',
			'textColor'
		]
		const invalidRequiredColor = requiredColors.find(
			key => !isWidgetHexColor(cfg[key])
		)
		const invalidNestedColor = findInvalidWidgetColor(cfg)
		const invalidColor = invalidRequiredColor || invalidNestedColor

		if (invalidColor) {
			const colorField = String(invalidColor).split('.').pop() || 'color'
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-${colorField}`,
				message: 'Введите цвет в формате #RRGGBB'
			})
			return false
		}
		if (!name.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: `${titleId}-name`,
				message: 'Укажите название виджета'
			})
			return false
		}
		if (!cfg.operatorName.trim()) {
			reportValidationIssue({
				tab: 'ai',
				fieldId: `${titleId}-operatorName`,
				message: 'Укажите имя AI-оператора'
			})
			return false
		}
		if (!cfg.greeting.trim()) {
			reportValidationIssue({
				tab: 'ai',
				fieldId: `${titleId}-greeting`,
				message: 'Укажите приветствие'
			})
			return false
		}
		if (!cfg.instructionsPrompt.trim()) {
			reportValidationIssue({
				tab: 'ai',
				fieldId: `${titleId}-instructionsPrompt`,
				message: 'Добавьте информацию о компании, товарах или услугах'
			})
			return false
		}
		if (utf8ByteLength(cfg.instructionsPrompt.trim()) > MAX_PROMPT_BYTES) {
			reportValidationIssue({
				tab: 'ai',
				fieldId: `${titleId}-instructionsPrompt`,
				message: `Инструкция не должна превышать ${MAX_PROMPT_BYTES} байт`
			})
			return false
		}
		if (!cfg.farewellMessage.trim()) {
			reportValidationIssue({
				tab: 'dialogue',
				fieldId: `${titleId}-farewellMessage`,
				message: 'Укажите сообщение перед завершением диалога'
			})
			return false
		}
		if (!cfg.inputPlaceholder.trim()) {
			reportValidationIssue({
				tab: 'dialogue',
				fieldId: `${titleId}-inputPlaceholder`,
				message: 'Укажите подсказку в поле вопроса'
			})
			return false
		}
		if (cfg.privacyUrl.trim().length > 500) {
			reportValidationIssue({
				tab: 'dialogue',
				fieldId: `${titleId}-privacyUrl`,
				message: 'Ссылка на политику не должна превышать 500 символов'
			})
			return false
		}
		if (!isValidHttpUrl(cfg.privacyUrl.trim())) {
			reportValidationIssue({
				tab: 'dialogue',
				fieldId: `${titleId}-privacyUrl`,
				message: 'Укажите полную ссылку на политику с http:// или https://'
			})
			return false
		}

		return true
	}

	const save = () => {
		if (!validate()) return

		const sanitizedConfig: AiConsultantConfig = {
			...cfg,
			operatorName: cfg.operatorName.trim(),
			greeting: cfg.greeting.trim(),
			instructionsPrompt: cfg.instructionsPrompt.trim(),
			farewellMessage: cfg.farewellMessage.trim(),
			inputPlaceholder: cfg.inputPlaceholder.trim(),
			privacyUrl: cfg.privacyUrl.trim(),
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
			inactivityTimeoutMinutes: Math.min(
				60,
				Math.max(1, Number(cfg.inactivityTimeoutMinutes) || 10)
			)
		}
		const sanitizedName = name.trim()
		const sanitizedDomain = installDomain.trim()
		setName(sanitizedName)
		setInstallDomain(sanitizedDomain)
		setCfg(sanitizedConfig)
		mutation.mutate({
			name: sanitizedName,
			installDomain: sanitizedDomain,
			config: sanitizedConfig
		})
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
			toast.error('Сначала сохраните текущие настройки')
			return
		}
		const nextConfig = { ...cfg, buttonImageUrl: '' }
		setCfg(nextConfig)
		mutation.mutate({ name, installDomain, config: nextConfig })
	}

	const handleResetDefaults = () => {
		setCfg({
			...getDefaultConfig(),
			buttonImageUrl: cfg.buttonImageUrl
		})
		setConfirmResetDefaults(false)
		setValidationIssue(null)
		toast.success('Стандартные настройки применены. Сохраните черновик')
	}

	const handleResetSection = (section: EditableTab) => {
		const defaults = getDefaultConfig()
		setCfg(previous => {
			if (section === 'main') {
				return {
					...previous,
					color: defaults.color,
					bgColor: defaults.bgColor,
					textColor: defaults.textColor,
					buttonColor: defaults.buttonColor,
					openButtonColor: defaults.openButtonColor,
					buttonSide: defaults.buttonSide,
					buttonPulse: defaults.buttonPulse,
					buttonBottom: defaults.buttonBottom,
					buttonOffset: defaults.buttonOffset,
					buttonSize: defaults.buttonSize,
					autoOpenDelay: defaults.autoOpenDelay
				}
			}
			if (section === 'ai') {
				return {
					...previous,
					operatorName: defaults.operatorName,
					greeting: defaults.greeting,
					instructionsPrompt: defaults.instructionsPrompt
				}
			}
			return {
				...previous,
				inactivityTimeoutMinutes: defaults.inactivityTimeoutMinutes,
				farewellMessage: defaults.farewellMessage,
				inputPlaceholder: defaults.inputPlaceholder,
				privacyUrl: defaults.privacyUrl,
				developInfoActive: defaults.developInfoActive
			}
		})
		setValidationIssue(null)
		setConfirmResetSection(null)
		toast.success('Раздел сброшен в черновике')
	}

	const handleTestSubmit = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		const message = testInput.trim()
		if (!message) {
			toast.error('Введите тестовый вопрос')
			return
		}
		if (hasUnsavedChanges) {
			toast.error('Сначала сохраните инструкции в черновик')
			return
		}
		if (!cfg.instructionsPrompt.trim()) {
			toast.error('Сначала добавьте инструкции для AI-оператора')
			setTab('ai')
			return
		}

		if (!testSessionIdRef.current) {
			testSessionIdRef.current = createUuidV4()
		}
		const history = testMessages
			.slice(-MAX_TEST_HISTORY_MESSAGES)
			.map(({ role, content }) => ({ role, content }))
		setTestMessages(previous => [
			...previous,
			{ role: 'user', content: message }
		])
		setTestInput('')
		testMutation.mutate({
			requestId: createUuidV4(),
			sessionId: testSessionIdRef.current,
			message,
			history
		})
	}

	const clearTestChat = () => {
		setTestMessages([])
		testSessionIdRef.current = ''
		toast.success('Тестовый чат очищен')
	}

	const embedCode = `<script src="${WIDGETS_HOST}/widgets/ai-consultant.js" data-key="${aiConsultant.publicKey}" async></script>`
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

	const renderColorField = (
		field:
			| 'color'
			| 'bgColor'
			| 'textColor'
			| 'buttonColor'
			| 'openButtonColor',
		label: string,
		fallback: string,
		optional = false
	) => {
		const fieldId = `${titleId}-${field}`
		const value = cfg[field]
		return (
			<div className={styles.field}>
				<p className={styles.label}>{label}</p>
				<div className={styles.colorRow}>
					<input
						className={styles.colorPicker}
						type="color"
						value={getWidgetColorPreview(value, fallback)}
						onChange={event => set({ [field]: event.target.value })}
					/>
					<input
						id={fieldId}
						className={inputClassName(fieldId)}
						value={value}
						onChange={event => set({ [field]: event.target.value })}
						placeholder={optional ? 'По цвету акцента' : fallback}
						maxLength={7}
					/>
					{optional && value && (
						<button
							type="button"
							className={styles.clearColorBtn}
							onClick={() => set({ [field]: '' })}
							title="Использовать цвет акцента"
						>
							✕
						</button>
					)}
				</div>
				{fieldError(fieldId)}
			</div>
		)
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
					aria-label="Закрыть настройки AI-консультанта"
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
					Настройки AI-консультанта
				</h2>
				{lifecycleActions}

				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек AI-консультанта"
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
						type="aiConsultant"
						config={cfg}
						isHardPlan={canUseCustomButtonImage}
						onDeviceChange={onPreviewDeviceChange}
						onConfigChange={onPreviewConfigChange}
						collapsed={previewCollapsed}
						onCollapsedChange={onPreviewCollapsedChange}
						autoCollapse={
							!isPagePresentation && ['code', 'info'].includes(tab)
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
								<h3 className={styles.settingsGroupTitle}>Виджет</h3>
								<div className={styles.field}>
									<p className={styles.label}>Название виджета</p>
									<input
										id={`${titleId}-name`}
										className={inputClassName(`${titleId}-name`)}
										value={name}
										onChange={event => {
											setValidationIssue(null)
											setName(event.target.value)
										}}
										maxLength={50}
									/>
									{fieldError(`${titleId}-name`)}
									<p className={styles.hint}>
										Видно только в личном кабинете.
									</p>
								</div>
								{renderColorField('color', 'Цвет акцентов', '#4705fb')}
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.optionalContent}>
										{renderColorField(
											'bgColor',
											'Цвет фона чата',
											'#ffffff'
										)}
										{renderColorField(
											'textColor',
											'Цвет текста',
											'#1f2937'
										)}
										{renderColorField(
											'buttonColor',
											'Цвет кнопок в чате',
											'#4705fb',
											true
										)}
										{renderColorField(
											'openButtonColor',
											'Цвет кнопки открытия',
											'#4705fb',
											true
										)}
									</div>
								</details>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Кнопка открытия
								</h3>
								<div className={styles.buttonImageBox}>
									<div className={styles.buttonImagePreview}>
										<Image
											src={buttonImagePreviewUrl}
											alt="Иконка AI-консультанта"
											width={80}
											height={80}
											unoptimized
										/>
									</div>
									<div className={styles.buttonImageContent}>
										<p className={styles.hint}>
											Стандартная иконка остаётся без изменений.
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
												Загрузить свою
											</label>
											<input
												id={buttonImageInputId}
												className={styles.fileInput}
												type="file"
												accept="image/png,image/jpeg,image/webp"
												disabled={buttonImageUploadDisabled}
												onChange={handleButtonImageChange}
											/>
											{cfg.buttonImageUrl && (
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													onClick={resetButtonImage}
												>
													Вернуть стандартную
												</button>
											)}
										</div>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Сторона экрана</p>
									<select
										className={styles.input}
										value={cfg.buttonSide}
										onChange={event =>
											set({
												buttonSide: event.target
													.value as AiConsultantConfig['buttonSide']
											})
										}
									>
										<option value="right">Справа</option>
										<option value="left">Слева</option>
									</select>
								</div>
								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>Размер кнопки</p>
										<span className={styles.rangeValue}>
											{cfg.buttonSize} px
										</span>
									</div>
									<input
										className={styles.rangeInput}
										type="range"
										min={40}
										max={100}
										value={cfg.buttonSize}
										onChange={event =>
											set({ buttonSize: Number(event.target.value) })
										}
									/>
								</div>
								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>Отступ снизу</p>
										<span className={styles.rangeValue}>
											{cfg.buttonBottom}%
										</span>
									</div>
									<input
										className={styles.rangeInput}
										type="range"
										min={1}
										max={50}
										value={cfg.buttonBottom}
										onChange={event =>
											set({ buttonBottom: Number(event.target.value) })
										}
									/>
								</div>
								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>Отступ от края</p>
										<span className={styles.rangeValue}>
											{cfg.buttonOffset}%
										</span>
									</div>
									<input
										className={styles.rangeInput}
										type="range"
										min={1}
										max={50}
										value={cfg.buttonOffset}
										onChange={event =>
											set({ buttonOffset: Number(event.target.value) })
										}
									/>
								</div>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={cfg.buttonPulse}
										onChange={event =>
											set({ buttonPulse: event.target.checked })
										}
									/>
									<span className={styles.checkLabel}>
										Пульсация кнопки
									</span>
								</label>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={cfg.autoOpenDelay !== null}
										onChange={event =>
											set({
												autoOpenDelay: event.target.checked ? 5 : null
											})
										}
									/>
									<span className={styles.checkLabel}>
										Открывать чат автоматически
									</span>
								</label>
								{cfg.autoOpenDelay !== null && (
									<div className={styles.field}>
										<div className={styles.rangeHeader}>
											<p className={styles.label}>Задержка открытия</p>
											<span className={styles.rangeValue}>
												{cfg.autoOpenDelay} сек.
											</span>
										</div>
										<input
											className={styles.rangeInput}
											type="range"
											min={1}
											max={60}
											value={cfg.autoOpenDelay}
											onChange={event =>
												set({
													autoOpenDelay: Number(event.target.value)
												})
											}
										/>
									</div>
								)}
							</div>
						</div>
					)}

					{tab === 'ai' && (
						<div className={styles.fields}>
							<div className={testStyles.aiNotice}>
								Посетитель всегда видит, что общается с AI-оператором.
								Ответ проверяется по фрагменту инструкции владельца, а при
								нехватке подтверждённых данных AI-оператор сообщает об
								этом. Важные цены и условия рекомендуем проверять перед
								публикацией.
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>AI-оператор</h3>
								<div className={styles.field}>
									<p className={styles.label}>Имя оператора</p>
									<input
										id={`${titleId}-operatorName`}
										className={inputClassName(`${titleId}-operatorName`)}
										value={cfg.operatorName}
										onChange={event =>
											set({ operatorName: event.target.value })
										}
										placeholder="Alex"
										maxLength={40}
									/>
									{fieldError(`${titleId}-operatorName`)}
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Приветствие</p>
									<textarea
										id={`${titleId}-greeting`}
										className={textareaClassName(`${titleId}-greeting`)}
										value={cfg.greeting}
										onChange={event =>
											set({ greeting: event.target.value })
										}
										rows={4}
										maxLength={500}
									/>
									{fieldError(`${titleId}-greeting`)}
									<p className={styles.hint}>
										Показывается сразу после открытия чата.
									</p>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Информация для ответов
								</h3>
								<div
									className={testStyles.promptSecurityNotice}
									role="note"
								>
									Добавляйте только публичную информацию о компании. Не
									указывайте пароли, API-токены, персональные или
									внутренние данные.
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Текстовая инструкция</p>
									<textarea
										id={`${titleId}-instructionsPrompt`}
										className={textareaClassName(
											`${titleId}-instructionsPrompt`
										)}
										value={cfg.instructionsPrompt}
										onChange={event =>
											set({ instructionsPrompt: event.target.value })
										}
										placeholder="Опишите компанию, товары, услуги, цены, условия доставки и другую информацию, на основе которой AI должен отвечать."
										rows={14}
										maxLength={MAX_PROMPT_BYTES}
									/>
									{fieldError(`${titleId}-instructionsPrompt`)}
									<p className={styles.hint}>
										{utf8ByteLength(cfg.instructionsPrompt)} /{' '}
										{MAX_PROMPT_BYTES} байт. Файлы, ссылки на документы и
										автоматический обход сайта не используются.
									</p>
								</div>
							</div>
						</div>
					)}

					{tab === 'dialogue' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Завершение чата
								</h3>
								<div className={styles.field}>
									<div className={styles.rangeHeader}>
										<p className={styles.label}>Таймаут бездействия</p>
										<span className={styles.rangeValue}>
											{cfg.inactivityTimeoutMinutes} мин.
										</span>
									</div>
									<input
										className={styles.rangeInput}
										type="range"
										min={1}
										max={60}
										value={cfg.inactivityTimeoutMinutes}
										onChange={event =>
											set({
												inactivityTimeoutMinutes: Number(
													event.target.value
												)
											})
										}
									/>
									<p className={styles.hint}>
										После этого времени оператор отправит прощальное
										сообщение и покинет чат.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Прощальное сообщение</p>
									<textarea
										id={`${titleId}-farewellMessage`}
										className={textareaClassName(
											`${titleId}-farewellMessage`
										)}
										value={cfg.farewellMessage}
										onChange={event =>
											set({ farewellMessage: event.target.value })
										}
										rows={4}
										maxLength={500}
									/>
									{fieldError(`${titleId}-farewellMessage`)}
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Поле вопроса</h3>
								<div className={styles.field}>
									<p className={styles.label}>Подсказка</p>
									<input
										id={`${titleId}-inputPlaceholder`}
										className={inputClassName(
											`${titleId}-inputPlaceholder`
										)}
										value={cfg.inputPlaceholder}
										onChange={event =>
											set({ inputPlaceholder: event.target.value })
										}
										maxLength={120}
									/>
									{fieldError(`${titleId}-inputPlaceholder`)}
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Ссылка на политику конфиденциальности
									</p>
									<input
										id={`${titleId}-privacyUrl`}
										className={inputClassName(`${titleId}-privacyUrl`)}
										value={cfg.privacyUrl}
										onChange={event =>
											set({ privacyUrl: event.target.value })
										}
										placeholder="https://example.com/privacy"
										maxLength={500}
									/>
									{fieldError(`${titleId}-privacyUrl`)}
									<p className={styles.hint}>
										Посетитель увидит предупреждение не отправлять
										персональные данные и ссылку на эту политику рядом с
										полем вопроса.
									</p>
								</div>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={cfg.developInfoActive}
										onChange={event =>
											set({ developInfoActive: event.target.checked })
										}
									/>
									<span className={styles.checkLabel}>
										Показывать подпись WinWidget
									</span>
								</label>
							</div>
						</div>
					)}

					{tab === 'test' && (
						<div className={styles.fields}>
							<div className={testStyles.aiNotice}>
								Тест использует сохранённый черновик. Сообщения этого теста
								не сохраняются и не публикуются.
							</div>
							<div className={styles.settingsGroup}>
								<div className={testStyles.testActions}>
									<h3 className={styles.settingsGroupTitle}>
										Проверка ответов
									</h3>
									{testMessages.length > 0 && (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={clearTestChat}
											disabled={testMutation.isPending}
										>
											Очистить чат
										</button>
									)}
								</div>
								<div className={testStyles.testChat} aria-live="polite">
									{testMessages.length === 0 && !testMutation.isPending ? (
										<p className={testStyles.testEmpty}>
											Сохраните инструкции и задайте вопрос так, как его
											задаст посетитель сайта.
										</p>
									) : (
										testMessages.map((message, index) => (
											<div
												key={`${message.role}-${index}`}
												className={`${testStyles.testMessage} ${
													message.role === 'user'
														? testStyles.testMessageUser
														: testStyles.testMessageAssistant
												}`}
											>
												<span className={testStyles.testMessageAuthor}>
													{message.role === 'user'
														? 'Вы'
														: `${cfg.operatorName} · AI`}
												</span>
												{message.content}
												{message.outcome && (
													<span className={testStyles.testOutcome}>
														{outcomeLabel[message.outcome]}
													</span>
												)}
											</div>
										))
									)}
									{testMutation.isPending && (
										<div className={testStyles.testTyping}>
											{cfg.operatorName} печатает...
										</div>
									)}
								</div>
								<form
									className={testStyles.testForm}
									onSubmit={handleTestSubmit}
								>
									<textarea
										className={`${styles.textarea} ${testStyles.testInput}`}
										value={testInput}
										onChange={event => setTestInput(event.target.value)}
										placeholder="Введите тестовый вопрос"
										maxLength={1000}
										rows={2}
										disabled={testMutation.isPending}
									/>
									<button
										type="submit"
										className={styles.saveBtn}
										disabled={testMutation.isPending || !testInput.trim()}
									>
										{testMutation.isPending ? 'Отвечает...' : 'Спросить'}
									</button>
								</form>
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
										Домен установки
									</label>
									<input
										id={`${titleId}-install-domain`}
										className={styles.input}
										value={installDomain}
										placeholder="site.ru"
										onChange={event =>
											setInstallDomain(event.target.value)
										}
									/>
									<p className={styles.domainHint}>
										Укажите точный hostname сайта, включая www или
										поддомен. Без сохранённого домена AI-консультант не
										будет работать на сайте.
									</p>
								</div>
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Настройки CSP
									</summary>
									<div className={styles.optionalContent}>
										<p className={styles.infoText}>
											Если на сайте настроен CSP, разрешите {WIDGETS_HOST}{' '}
											в script-src, connect-src и img-src, а домен своей
											картинки кнопки — в img-src.
										</p>
										<p className={styles.infoText}>
											Для https://challenges.cloudflare.com разрешите
											script-src, frame-src и connect-src.
										</p>
										<p className={styles.infoText}>
											При style-src с nonce добавьте тот же nonce в тег
											установки: виджет перенесёт его во внутренние стили.
										</p>
									</div>
								</details>
								<div className={styles.field}>
									<p className={styles.label}>Код виджета</p>
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
											void handleCopy(embedCode, 'Код скопирован', true)
										}
									>
										Скопировать код
									</button>
								</div>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Как работает AI-консультант
								</h3>
								<ul className={styles.infoList}>
									<li>
										AI отвечает только на основе вашей текстовой
										инструкции.
									</li>
									<li>
										Если данных недостаточно, AI честно сообщает об этом.
									</li>
									<li>
										Вопросы не по теме сайта отклоняются системным
										правилом.
									</li>
									<li>
										Переписка тестового и публичного чата не сохраняется.
									</li>
								</ul>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Перед публикацией
								</h3>
								<ul className={styles.infoList}>
									<li>Добавьте и сохраните текстовую инструкцию.</li>
									<li>
										Во вкладке «Тест» задайте вопросы по теме, без данных и
										не по теме.
									</li>
									<li>Проверьте чат на компьютере и телефоне.</li>
									<li>Опубликуйте сохранённый черновик.</li>
								</ul>
							</div>
						</div>
					)}

					{(tab === 'main' || tab === 'ai' || tab === 'dialogue') && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Сброс раздела
								</h3>
								{confirmResetSection === tab ? (
									<div className={styles.dangerItem}>
										<p className={styles.hint}>
											Настройки текущего раздела вернутся к стандартным.
										</p>
										<div className={styles.footerActions}>
											<button
												type="button"
												className={styles.resetAttemptsBtn}
												onClick={() => handleResetSection(tab)}
											>
												Да, сбросить
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
							disabled={isBusy}
						>
							{isPagePresentation ? 'К виджетам' : 'Отмена'}
						</button>
						<ActionTooltip
							content="Сохраняет настройки в черновик. На сайте они появятся после публикации."
							disabled={isBusy || !hasUnsavedChanges}
							disabledContent={
								isBusy
									? 'Дождитесь завершения операции.'
									: 'Нет изменений.'
							}
							align="end"
							responsiveFill
						>
							<button
								type="button"
								className={styles.saveBtn}
								onClick={save}
								disabled={isBusy || !hasUnsavedChanges}
							>
								{mutation.isPending
									? 'Сохраняем...'
									: 'Сохранить черновик'}
							</button>
						</ActionTooltip>
					</div>
				</div>

				<div className={styles.dangerActions}>
					{confirmResetDefaults ? (
						<div className={styles.dangerItem}>
							<p className={styles.hint}>
								Все настройки AI-консультанта будут заменены на
								стандартные. Загруженная иконка сохранится.
							</p>
							<div className={styles.footerActions}>
								<button
									type="button"
									className={styles.resetAttemptsBtn}
									onClick={handleResetDefaults}
								>
									Применить стандартные настройки
								</button>
								<button
									type="button"
									className={styles.cancelBtn}
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
						>
							Сбросить все настройки
						</button>
					)}
				</div>
				{closeGuardDialog}
			</div>
		</div>
	)
}

export default AiConsultantSettingsModal
