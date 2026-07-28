'use client'

import { calculatorService } from '@/entities/site-widget'
import {
	Calculator,
	CalculatorConfig,
	CalculatorField,
	CalculatorFieldType,
	CalculatorIntegrations,
	CalculatorOption
} from '@/entities/site-widget'
import { useMutation } from '@tanstack/react-query'
import Image from 'next/image'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
import {
	ChangeEvent,
	InputHTMLAttributes,
	useEffect,
	useId,
	useRef,
	useState
} from 'react'
import toast from 'react-hot-toast'
import ActionTooltip from '../shared/ActionTooltip'
import styles from './CalculatorSettingsModal.module.scss'
import DirectLinkQr from '../shared/DirectLinkQr'
import {
	findInvalidWidgetColor,
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

type Tab =
	| 'main'
	| 'fields'
	| 'calculation'
	| 'integrations'
	| 'code'
	| 'info'

const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024
const DEFAULT_BUTTON_IMAGE_URL = '/images/tools/calculator-button.png'
const MAX_FIELDS = 20
const MAX_OPTIONS = 20
const MAX_AUTO_OPEN_DELAY_SECONDS = 60

type CalculatorColorField =
	| 'color'
	| 'bgColor'
	| 'buttonColor'
	| 'openButtonColor'
	| 'textColor'

interface CalculatorColorSetting {
	key: CalculatorColorField
	label: string
	pickerFallback: string | 'primary'
	placeholder: string
	resetValue: string
	hint: string
}

const CALCULATOR_COLOR_SETTINGS: CalculatorColorSetting[] = [
	{
		key: 'color',
		label: 'Цвет акцентов:',
		pickerFallback: '#4705fb',
		placeholder: '#4705fb',
		resetValue: '#4705fb',
		hint: 'Акцент полей, результата и элементов калькулятора.'
	},
	{
		key: 'bgColor',
		label: 'Цвет фона виджета',
		pickerFallback: '#1a0a2e',
		placeholder: 'Стандартный градиент',
		resetValue: '',
		hint: 'Оставьте пустым, чтобы использовать стандартный тёмный градиент.'
	},
	{
		key: 'textColor',
		label: 'Цвет текста виджета:',
		pickerFallback: '#ffffff',
		placeholder: 'Стандартный светлый',
		resetValue: '',
		hint: 'Оставьте пустым, чтобы использовать стандартные цвета текста.'
	},
	{
		key: 'buttonColor',
		label: 'Цвет кнопки расчёта:',
		pickerFallback: 'primary',
		placeholder: 'Как цвет акцентов',
		resetValue: '',
		hint: 'Кнопка внутри калькулятора. По умолчанию используется цвет акцентов.'
	},
	{
		key: 'openButtonColor',
		label: 'Цвет кнопки открытия:',
		pickerFallback: 'primary',
		placeholder: 'Как цвет акцентов',
		resetValue: '',
		hint: 'Плавающая кнопка на сайте. По умолчанию используется цвет акцентов.'
	}
]

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Основные' },
	{ id: 'fields', label: 'Поля' },
	{ id: 'calculation', label: 'Расчёт' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Установка' },
	{ id: 'info', label: 'Проверка' }
]

const makeId = () => Math.random().toString(36).slice(2, 10)

const isHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const makeOption = (label = 'Вариант'): CalculatorOption => ({
	id: makeId(),
	label,
	add: 0,
	multiplier: 1
})

const isBooleanOptionPair = (options: CalculatorOption[] = []) => {
	if (options.length !== 2) return false
	const labels = new Set(
		options.map(option => option.label.trim().toLocaleLowerCase('ru-RU'))
	)
	return (
		(labels.has('да') && labels.has('нет')) ||
		(labels.has('yes') && labels.has('no'))
	)
}

const makeField = (
	type: CalculatorFieldType = 'select'
): CalculatorField => {
	const common = {
		id: makeId(),
		label: 'Новый параметр',
		type,
		required: true
	}

	if (type === 'select') {
		return {
			...common,
			options: [makeOption('Вариант 1'), makeOption('Вариант 2')]
		}
	}

	if (type === 'radio') {
		return {
			...common,
			options: [makeOption('Да'), makeOption('Нет')]
		}
	}

	if (type === 'number') {
		return {
			...common,
			min: 0,
			max: 100,
			step: 1,
			defaultValue: 0,
			unit: 'шт.',
			unitPrice: 0
		}
	}

	return {
		...common,
		options: [makeOption('Дополнительная опция')]
	}
}

const DEFAULT_CONFIG: CalculatorConfig = {
	color: '#4705fb',
	bgColor: '',
	glassEffect: false,
	buttonColor: '',
	openButtonColor: '',
	textColor: '',
	buttonSide: 'right',
	buttonPulse: true,
	buttonBottom: 3,
	buttonOffset: 3,
	buttonSize: 60,
	buttonImageUrl: '',
	bubbleEnabled: true,
	bubbleText: 'Рассчитать стоимость',
	autoOpenDelay: null,
	title: 'Рассчитайте стоимость',
	subtitle: 'Ответьте на несколько вопросов и получите расчёт',
	calculateButtonText: 'Рассчитать',
	contactTitle: 'Оставьте контакт, чтобы получить расчёт',
	resultTitle: 'Ориентировочная стоимость',
	dataType: 'NONE',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	developInfoActive: true,
	filterDuplicates: false,
	basePrice: 0,
	currency: 'RUB',
	roundingStep: 1,
	fields: [
		{
			id: 'service',
			label: 'Выберите услугу',
			type: 'select',
			required: true,
			options: [
				{ id: 'basic', label: 'Базовая', add: 0, multiplier: 1 },
				{ id: 'premium', label: 'Расширенная', add: 5000, multiplier: 1 }
			]
		},
		{
			id: 'quantity',
			label: 'Количество',
			type: 'number',
			required: true,
			min: 1,
			max: 100,
			step: 1,
			defaultValue: 1,
			unit: 'шт.',
			unitPrice: 1000
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

const cloneConfig = (config: CalculatorConfig): CalculatorConfig =>
	JSON.parse(JSON.stringify(config)) as CalculatorConfig

const clampNumber = (
	value: number | null | undefined,
	min: number,
	max: number,
	fallback: number
) => {
	const numeric = Number(value)

	return Number.isFinite(numeric)
		? Math.min(max, Math.max(min, numeric))
		: fallback
}

const getColorPickerValue = (value: string, fallback: string) => {
	const normalized = value.trim()
	const shortHexMatch = /^#([0-9a-f]{3})$/i.exec(normalized)

	if (shortHexMatch) {
		return `#${shortHexMatch[1]
			.split('')
			.map(character => `${character}${character}`)
			.join('')}`
	}

	return /^#[0-9a-f]{6}$/i.test(normalized) ? normalized : fallback
}

const normalizeConfig = (config: CalculatorConfig): CalculatorConfig => ({
	...cloneConfig(DEFAULT_CONFIG),
	...config,
	buttonBottom: clampNumber(
		config.buttonBottom,
		1,
		50,
		DEFAULT_CONFIG.buttonBottom
	),
	buttonOffset: clampNumber(
		config.buttonOffset,
		1,
		50,
		DEFAULT_CONFIG.buttonOffset
	),
	buttonSize: clampNumber(
		config.buttonSize,
		40,
		100,
		DEFAULT_CONFIG.buttonSize
	),
	autoOpenDelay:
		config.autoOpenDelay == null || Number(config.autoOpenDelay) <= 0
			? null
			: clampNumber(
					config.autoOpenDelay,
					1,
					MAX_AUTO_OPEN_DELAY_SECONDS,
					MAX_AUTO_OPEN_DELAY_SECONDS
				),
	fields: config.fields?.length
		? config.fields.map(field => {
				const options = field.options?.map(option => ({ ...option }))
				return {
					...field,
					type:
						field.type === 'checkbox' && isBooleanOptionPair(options)
							? 'radio'
							: field.type,
					options
				}
			})
		: cloneConfig(DEFAULT_CONFIG).fields,
	integrations: {
		...DEFAULT_CONFIG.integrations,
		...(config.integrations || {})
	}
})

interface NumericInputProps extends Omit<
	InputHTMLAttributes<HTMLInputElement>,
	'type' | 'value' | 'onChange'
> {
	value: number
	onValueChange: (value: number) => void
}

const NumericInput = ({
	value,
	onValueChange,
	onBlur,
	...props
}: NumericInputProps) => {
	const [draft, setDraft] = useState(String(value))

	useEffect(() => {
		setDraft(String(value))
	}, [value])

	return (
		<input
			{...props}
			type="number"
			value={draft}
			onChange={event => {
				const nextDraft = event.target.value
				setDraft(nextDraft)
				if (
					nextDraft !== '' &&
					Number.isFinite(event.target.valueAsNumber)
				) {
					onValueChange(event.target.valueAsNumber)
				}
			}}
			onBlur={event => {
				if (event.target.value === '') setDraft(String(value))
				onBlur?.(event)
			}}
		/>
	)
}

interface Props extends WidgetSettingsPresentationProps {
	calculator: Calculator
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: Calculator) => void
	persistence?: WidgetSettingsPersistence<Calculator, CalculatorConfig>
}

interface ValidationError {
	targetId: string
	message: string
}

const CalculatorSettingsModal = ({
	calculator,
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
	const [name, setName] = useState(calculator.name)
	const [installDomain, setInstallDomain] = useState(
		calculator.installDomain ?? ''
	)
	const draftRevisionRef = useRef(calculator.draftRevision)
	const [config, setConfig] = useState<CalculatorConfig>(() =>
		normalizeConfig(calculator.config)
	)
	const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false)
	const [confirmResetSection, setConfirmResetSection] = useState<Exclude<
		Tab,
		'code' | 'info'
	> | null>(null)
	const [validationError, setValidationError] =
		useState<ValidationError | null>(null)
	const [savedSnapshot, setSavedSnapshot] = useState(() =>
		JSON.stringify({
			name: calculator.name,
			installDomain: calculator.installDomain ?? '',
			config: normalizeConfig(calculator.config)
		})
	)

	const currentSnapshot = JSON.stringify({ name, installDomain, config })
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

	const saveMutation = useMutation({
		mutationFn: (payload: {
			name: string
			installDomain?: string
			config: CalculatorConfig
		}) =>
			persistence?.update({
				...payload,
				expectedDraftRevision: draftRevisionRef.current
			}) ??
			calculatorService.updateCalculator(calculator.id, {
				...payload,
				expectedDraftRevision: draftRevisionRef.current
			}),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated: Calculator, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			const nextConfig = normalizeConfig(updated.config)
			toast.success('Сохранено', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setConfig(nextConfig)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: nextConfig
				})
			)
			onSaved({ ...updated, config: nextConfig })
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
				: calculatorService.uploadButtonImage(calculator.id, formData)
		},
		onMutate: () =>
			toast.loading('Загружаем картинку кнопки, пожалуйста подождите...'),
		onSuccess: (updated: Calculator, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			const nextConfig = normalizeConfig(updated.config)
			toast.success('Картинка кнопки обновлена', { id: toastId })
			setConfig(nextConfig)
			setSavedSnapshot(
				JSON.stringify({
					name: updated.name,
					installDomain: updated.installDomain ?? '',
					config: nextConfig
				})
			)
			onSaved({ ...updated, config: nextConfig })
		},
		onError: (error: any, _, toastId) =>
			reportMutationError(error, 'Ошибка загрузки', toastId)
	})
	const isDangerActionPending =
		saveMutation.isPending || buttonImageMutation.isPending
	const { requestClose, closeGuardDialog } = useWidgetSettingsCloseGuard({
		hasUnsavedChanges,
		isBusy: isDangerActionPending,
		onClose
	})
	const isPagePresentation = presentation === 'page'
	const validationTargetId = (suffix: string) =>
		`${titleId}-validation-${suffix}`
	const isInvalidTarget = (targetId: string) =>
		validationError?.targetId === targetId
	const clearValidationError = (targetId?: string) =>
		setValidationError(current =>
			!current || (targetId && current.targetId !== targetId)
				? current
				: null
		)
	const renderFieldError = (targetId: string) =>
		isInvalidTarget(targetId) ? (
			<p
				id={`${targetId}-error`}
				className={pageStyles.fieldError}
				role="alert"
			>
				{validationError?.message}
			</p>
		) : null
	const showValidationError = (
		nextTab: Tab,
		targetId: string,
		message: string
	) => {
		setValidationError({ targetId, message })
		setTab(nextTab)
		toast.error(message)

		window.requestAnimationFrame(() => {
			window.requestAnimationFrame(() => {
				const target = document.getElementById(targetId)

				target?.closest('details')?.setAttribute('open', '')
				target?.scrollIntoView({
					behavior: 'smooth',
					block: 'center'
				})
				target?.focus({ preventScroll: true })
			})
		})

		return false
	}

	const showInlineValidationError = (
		targetId: string,
		message?: string
	) => {
		setValidationError(current => {
			if (message) return { targetId, message }
			return current?.targetId === targetId ? null : current
		})
	}

	const validateMainFieldOnBlur = (
		field:
			| 'name'
			| 'bubbleText'
			| 'title'
			| 'calculateButtonText'
			| 'resultTitle'
			| 'contactTitle'
			| 'privacyUrl'
	) => {
		if (field === 'name') {
			showInlineValidationError(
				validationTargetId('name'),
				name.trim() ? undefined : 'Укажите название виджета'
			)
			return
		}
		if (field === 'bubbleText') {
			showInlineValidationError(
				validationTargetId('bubble-text'),
				!config.bubbleEnabled || config.bubbleText.trim()
					? undefined
					: 'Укажите текст облачка или отключите его'
			)
			return
		}
		if (field === 'title') {
			showInlineValidationError(
				validationTargetId('main-title'),
				config.title.trim() ? undefined : 'Укажите заголовок виджета'
			)
			return
		}
		if (field === 'calculateButtonText') {
			showInlineValidationError(
				validationTargetId('main-calculateButtonText'),
				config.calculateButtonText.trim()
					? undefined
					: 'Укажите текст кнопки расчёта'
			)
			return
		}
		if (field === 'resultTitle') {
			showInlineValidationError(
				validationTargetId('main-resultTitle'),
				config.resultTitle.trim()
					? undefined
					: 'Укажите заголовок результата'
			)
			return
		}
		if (field === 'contactTitle') {
			showInlineValidationError(
				validationTargetId('contact-title'),
				config.dataType === 'NONE' || config.contactTitle.trim()
					? undefined
					: 'Укажите заголовок формы контакта'
			)
			return
		}
		showInlineValidationError(
			validationTargetId('privacy-url'),
			config.dataType === 'NONE' ||
				(config.privacyUrl.trim() && isHttpUrl(config.privacyUrl))
				? undefined
				: 'Укажите полную ссылку на политику с http:// или https://'
		)
	}

	const validateOptionOnBlur = (
		fieldIndex: number,
		optionIndex: number,
		key: 'label' | 'add' | 'multiplier'
	) => {
		const field = config.fields[fieldIndex]
		const option = field?.options?.[optionIndex]
		if (!field || !option) return
		const targetId = validationTargetId(
			`field-${field.id}-option-${option.id}-${key}`
		)
		const optionLabel = `Поле «${field.label}», вариант ${optionIndex + 1}`
		const message =
			key === 'label'
				? option.label.trim()
					? undefined
					: `${optionLabel}: заполните название`
				: key === 'add'
					? Number.isFinite(option.add)
						? undefined
						: `${optionLabel}: проверьте надбавку`
					: Number.isFinite(option.multiplier) && option.multiplier > 0
						? undefined
						: `${optionLabel}: множитель должен быть больше 0`
		showInlineValidationError(targetId, message)
	}

	const validateNumberFieldOnBlur = (
		fieldIndex: number,
		key: 'min' | 'max' | 'step' | 'defaultValue' | 'unitPrice'
	) => {
		const field = config.fields[fieldIndex]
		if (!field) return
		const min = field.min ?? 0
		const max = field.max ?? 0
		const defaultValue = field.defaultValue ?? min
		const targetId = validationTargetId(`field-${field.id}-${key}`)
		let message: string | undefined

		if ((key === 'min' || key === 'max') && max < min) {
			message = `Поле «${field.label}»: максимум не может быть меньше минимума`
		} else if (key === 'step' && (field.step ?? 0) <= 0) {
			message = `Поле «${field.label}»: шаг должен быть больше 0`
		} else if (
			key === 'defaultValue' &&
			(defaultValue < min || defaultValue > max)
		) {
			message = `Поле «${field.label}»: значение по умолчанию должно быть между минимумом и максимумом`
		} else if (
			key === 'unitPrice' &&
			!Number.isFinite(field.unitPrice ?? 0)
		) {
			message = `Поле «${field.label}»: проверьте цену за единицу`
		}
		showInlineValidationError(targetId, message)
	}

	const validateCalculationFieldOnBlur = (
		field: 'basePrice' | 'currency' | 'roundingStep'
	) => {
		if (field === 'basePrice') {
			showInlineValidationError(
				validationTargetId('calculation-base-price'),
				Number.isFinite(config.basePrice) && config.basePrice >= 0
					? undefined
					: 'Базовая стоимость должна быть не меньше 0'
			)
			return
		}
		if (field === 'currency') {
			showInlineValidationError(
				validationTargetId('calculation-currency'),
				/^[A-Z]{3}$/.test(config.currency.trim().toUpperCase())
					? undefined
					: 'Укажите валюту трёхбуквенным кодом, например RUB'
			)
			return
		}
		showInlineValidationError(
			validationTargetId('calculation-rounding-step'),
			Number.isFinite(config.roundingStep) && config.roundingStep > 0
				? undefined
				: 'Шаг округления должен быть больше 0'
		)
	}

	const setField = <K extends keyof CalculatorConfig>(
		key: K,
		value: CalculatorConfig[K],
		targetId?: string
	) => {
		setConfig(previous => ({ ...previous, [key]: value }))
		if (targetId) clearValidationError(targetId)
	}

	const setIntegration = <K extends keyof CalculatorIntegrations>(
		key: K,
		value: CalculatorIntegrations[K]
	) =>
		setConfig(previous => ({
			...previous,
			integrations: { ...previous.integrations, [key]: value }
		}))

	const updateCalculatorField = (
		index: number,
		patch: Partial<CalculatorField>,
		targetId?: string
	) => {
		setConfig(previous => ({
			...previous,
			fields: previous.fields.map((field, fieldIndex) =>
				fieldIndex === index ? { ...field, ...patch } : field
			)
		}))
		if (targetId) clearValidationError(targetId)
	}

	const changeFieldType = (index: number, type: CalculatorFieldType) => {
		const next = makeField(type)
		const current = config.fields[index]
		updateCalculatorField(index, {
			...next,
			id: current.id,
			label: current.label,
			required: current.required
		})
		clearValidationError()
	}

	const addCalculatorField = () => {
		if (config.fields.length >= MAX_FIELDS) {
			toast.error(`Можно добавить не больше ${MAX_FIELDS} полей`)
			return
		}
		setField('fields', [...config.fields, makeField()])
		clearValidationError()
	}

	const removeCalculatorField = (index: number) => {
		setField(
			'fields',
			config.fields.filter((_, fieldIndex) => fieldIndex !== index)
		)
		clearValidationError()
	}

	const moveCalculatorField = (index: number, direction: -1 | 1) => {
		const target = index + direction
		if (target < 0 || target >= config.fields.length) return
		const fields = [...config.fields]
		;[fields[index], fields[target]] = [fields[target], fields[index]]
		setField('fields', fields)
		clearValidationError()
	}

	const addOption = (fieldIndex: number) => {
		const field = config.fields[fieldIndex]
		if ((field.options || []).length >= MAX_OPTIONS) {
			toast.error(`Можно добавить не больше ${MAX_OPTIONS} вариантов`)
			return
		}
		updateCalculatorField(fieldIndex, {
			options: [...(field.options || []), makeOption()]
		})
		clearValidationError()
	}

	const updateOption = (
		fieldIndex: number,
		optionIndex: number,
		patch: Partial<CalculatorOption>
	) => {
		const field = config.fields[fieldIndex]
		const option = field.options?.[optionIndex]
		const changedKey =
			'label' in patch
				? 'label'
				: 'add' in patch
					? 'add'
					: 'multiplier' in patch
						? 'multiplier'
						: null
		updateCalculatorField(
			fieldIndex,
			{
				options: (field.options || []).map((option, index) =>
					index === optionIndex ? { ...option, ...patch } : option
				)
			},
			changedKey && option
				? validationTargetId(
						`field-${field.id}-option-${option.id}-${changedKey}`
					)
				: undefined
		)
	}

	const removeOption = (fieldIndex: number, optionIndex: number) => {
		const field = config.fields[fieldIndex]
		updateCalculatorField(fieldIndex, {
			options: (field.options || []).filter(
				(_, index) => index !== optionIndex
			)
		})
		clearValidationError()
	}

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
	const scriptCode = `<script src="${apiUrl}/widgets/calculator.js" data-key="${calculator.publicKey}" async></script>`
	const directLink = `${publicSiteUrl}/page-calculator/${calculator.publicKey}`
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

	const validate = () => {
		if (!name.trim()) {
			return showValidationError(
				'main',
				validationTargetId('name'),
				'Укажите название виджета'
			)
		}

		if (config.bubbleEnabled && !config.bubbleText.trim()) {
			return showValidationError(
				'main',
				validationTargetId('bubble-text'),
				'Укажите текст облачка или отключите его'
			)
		}

		if (!config.title.trim()) {
			return showValidationError(
				'main',
				validationTargetId('main-title'),
				'Укажите заголовок виджета'
			)
		}

		if (!config.calculateButtonText.trim()) {
			return showValidationError(
				'main',
				validationTargetId('main-calculateButtonText'),
				'Укажите текст кнопки расчёта'
			)
		}

		if (!config.resultTitle.trim()) {
			return showValidationError(
				'main',
				validationTargetId('main-resultTitle'),
				'Укажите заголовок результата'
			)
		}

		if (config.dataType !== 'NONE' && !config.contactTitle.trim()) {
			return showValidationError(
				'main',
				validationTargetId('contact-title'),
				'Укажите заголовок формы контакта'
			)
		}

		if (
			config.dataType !== 'NONE' &&
			(!config.privacyUrl.trim() || !isHttpUrl(config.privacyUrl))
		) {
			return showValidationError(
				'main',
				validationTargetId('privacy-url'),
				'Укажите полную ссылку на политику с http:// или https://'
			)
		}

		if (!config.fields.length) {
			return showValidationError(
				'fields',
				validationTargetId('fields-empty'),
				'Добавьте хотя бы одно поле калькулятора'
			)
		}

		for (let index = 0; index < config.fields.length; index += 1) {
			const field = config.fields[index]
			if (!field.label.trim()) {
				return showValidationError(
					'fields',
					validationTargetId(`field-${field.id}-label`),
					`Поле ${index + 1}: заполните название`
				)
			}

			if (
				field.type === 'select' ||
				field.type === 'radio' ||
				field.type === 'checkbox'
			) {
				if (!field.options || field.options.length < 2) {
					if (field.type === 'select' || field.type === 'radio') {
						return showValidationError(
							'fields',
							validationTargetId(`field-${field.id}-options`),
							`Поле «${field.label}»: добавьте минимум 2 варианта`
						)
					}
					if (!field.options?.length) {
						return showValidationError(
							'fields',
							validationTargetId(`field-${field.id}-options`),
							`Поле «${field.label}»: добавьте хотя бы одну опцию`
						)
					}
				}

				for (
					let optionIndex = 0;
					optionIndex < field.options.length;
					optionIndex += 1
				) {
					const option = field.options[optionIndex]
					const optionLabel = `Поле «${field.label}», вариант ${optionIndex + 1}`

					if (!option.label.trim()) {
						return showValidationError(
							'fields',
							validationTargetId(
								`field-${field.id}-option-${option.id}-label`
							),
							`${optionLabel}: заполните название`
						)
					}

					if (!Number.isFinite(option.add)) {
						return showValidationError(
							'fields',
							validationTargetId(
								`field-${field.id}-option-${option.id}-add`
							),
							`${optionLabel}: проверьте надбавку`
						)
					}

					if (
						!Number.isFinite(option.multiplier) ||
						option.multiplier <= 0
					) {
						return showValidationError(
							'fields',
							validationTargetId(
								`field-${field.id}-option-${option.id}-multiplier`
							),
							`${optionLabel}: множитель должен быть больше 0`
						)
					}
				}
			}

			if (field.type === 'number') {
				const min = field.min ?? 0
				const max = field.max ?? 0
				const step = field.step ?? 0
				const defaultValue = field.defaultValue ?? min

				if (max < min) {
					return showValidationError(
						'fields',
						validationTargetId(`field-${field.id}-max`),
						`Поле «${field.label}»: максимум не может быть меньше минимума`
					)
				}

				if (step <= 0) {
					return showValidationError(
						'fields',
						validationTargetId(`field-${field.id}-step`),
						`Поле «${field.label}»: шаг должен быть больше 0`
					)
				}

				if (defaultValue < min || defaultValue > max) {
					return showValidationError(
						'fields',
						validationTargetId(`field-${field.id}-defaultValue`),
						`Поле «${field.label}»: значение по умолчанию должно быть между минимумом и максимумом`
					)
				}

				if (!Number.isFinite(field.unitPrice ?? 0)) {
					return showValidationError(
						'fields',
						validationTargetId(`field-${field.id}-unitPrice`),
						`Поле «${field.label}»: проверьте цену за единицу`
					)
				}
			}
		}

		if (!Number.isFinite(config.basePrice) || config.basePrice < 0) {
			return showValidationError(
				'calculation',
				validationTargetId('calculation-base-price'),
				'Базовая стоимость должна быть не меньше 0'
			)
		}

		if (!/^[A-Z]{3}$/.test(config.currency.trim().toUpperCase())) {
			return showValidationError(
				'calculation',
				validationTargetId('calculation-currency'),
				'Укажите валюту трёхбуквенным кодом, например RUB'
			)
		}

		if (
			!Number.isFinite(config.roundingStep) ||
			config.roundingStep <= 0
		) {
			return showValidationError(
				'calculation',
				validationTargetId('calculation-rounding-step'),
				'Шаг округления должен быть больше 0'
			)
		}

		if (config.buttonBottom < 1 || config.buttonBottom > 50) {
			return showValidationError(
				'main',
				validationTargetId('button-bottom'),
				'Высота кнопки должна быть от 1 до 50%'
			)
		}

		setValidationError(null)
		return true
	}

	const handleSave = () => {
		const invalidColor = !isWidgetHexColor(config.color)
			? 'color'
			: findInvalidWidgetColor(config)
		if (invalidColor) {
			const colorField = invalidColor.split('.').pop() || 'color'
			showValidationError(
				'main',
				validationTargetId(`color-${colorField}`),
				'Введите цвет в формате #RRGGBB'
			)
			return
		}

		if (!validate()) return

		const sanitizedName = name.trim()
		const sanitizedConfig: CalculatorConfig = {
			...config,
			currency: config.currency.trim().toUpperCase(),
			fields: config.fields.map(field => ({
				...field,
				label: field.label.trim(),
				options: field.options?.map(option => ({
					...option,
					label: option.label.trim()
				}))
			}))
		}
		setName(sanitizedName)
		setConfig(sanitizedConfig)
		saveMutation.mutate({
			name: sanitizedName,
			installDomain,
			config: sanitizedConfig
		})
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

	const resetButtonImage = () => {
		if (hasUnsavedChanges) {
			toast.error('Сначала сохраните текущие настройки виджета')
			return
		}
		const nextConfig = { ...config, buttonImageUrl: '' }
		setConfig(nextConfig)
		saveMutation.mutate({
			name: name.trim() || 'Калькулятор стоимости',
			installDomain,
			config: nextConfig
		})
	}

	const resetSettings = () => {
		const nextConfig = {
			...cloneConfig(DEFAULT_CONFIG),
			integrations: { ...config.integrations },
			buttonImageUrl: config.buttonImageUrl
		}

		setConfig(nextConfig)
		setValidationError(null)
		setIsResetConfirmOpen(false)
		toast.success('Стандартные настройки применены. Сохраните черновик')
	}

	const handleResetSection = (section: Exclude<Tab, 'code' | 'info'>) => {
		const defaults = cloneConfig(DEFAULT_CONFIG)
		setConfig(previous => {
			if (section === 'main') {
				return {
					...previous,
					color: defaults.color,
					bgColor: defaults.bgColor,
					glassEffect: defaults.glassEffect,
					buttonColor: defaults.buttonColor,
					openButtonColor: defaults.openButtonColor,
					textColor: defaults.textColor,
					buttonSide: defaults.buttonSide,
					buttonPulse: defaults.buttonPulse,
					buttonBottom: defaults.buttonBottom,
					buttonOffset: defaults.buttonOffset,
					buttonSize: defaults.buttonSize,
					buttonImageUrl: defaults.buttonImageUrl,
					bubbleEnabled: defaults.bubbleEnabled,
					bubbleText: defaults.bubbleText,
					autoOpenDelay: defaults.autoOpenDelay,
					title: defaults.title,
					subtitle: defaults.subtitle,
					calculateButtonText: defaults.calculateButtonText,
					contactTitle: defaults.contactTitle,
					resultTitle: defaults.resultTitle,
					dataType: defaults.dataType,
					privacyUrl: defaults.privacyUrl,
					developInfoActive: defaults.developInfoActive,
					filterDuplicates: defaults.filterDuplicates
				}
			}
			if (section === 'fields') {
				return {
					...previous,
					fields: cloneConfig(defaults).fields
				}
			}
			if (section === 'calculation') {
				return {
					...previous,
					basePrice: defaults.basePrice,
					currency: defaults.currency,
					roundingStep: defaults.roundingStep
				}
			}
			return {
				...previous,
				integrations: { ...defaults.integrations }
			}
		})
		setValidationError(null)
		setConfirmResetSection(null)
		toast.success('Раздел сброшен в черновике. Сохраните черновик')
	}

	const renderColorSetting = (setting: CalculatorColorSetting) => {
		const pickerFallback =
			setting.pickerFallback === 'primary'
				? getColorPickerValue(config.color, DEFAULT_CONFIG.color)
				: setting.pickerFallback
		const value = config[setting.key]
		const targetId = validationTargetId(`color-${setting.key}`)
		const isInvalidColor = isInvalidTarget(targetId)
		const colorError =
			(setting.key === 'color' || value !== '') && !isWidgetHexColor(value)
				? 'Введите цвет в формате #RRGGBB'
				: undefined
		const inheritsAccent =
			setting.key === 'buttonColor' || setting.key === 'openButtonColor'

		return (
			<div key={setting.key} className={styles.field}>
				<p className={styles.label}>{setting.label}</p>
				<div className={styles.colorRow}>
					<input
						type="color"
						className={styles.colorPicker}
						value={getColorPickerValue(value, pickerFallback)}
						onChange={event => {
							clearValidationError(targetId)
							setField(setting.key, event.target.value)
						}}
						aria-label={`${setting.label} выбор цвета`}
					/>
					<input
						id={targetId}
						className={`${styles.input} ${
							isInvalidColor ? pageStyles.inputError : ''
						}`}
						value={value}
						placeholder={setting.placeholder}
						maxLength={7}
						onChange={event => {
							clearValidationError(targetId)
							setField(setting.key, event.target.value)
						}}
						onBlur={() => showInlineValidationError(targetId, colorError)}
						aria-invalid={isInvalidColor}
						aria-describedby={
							isInvalidColor ? `${targetId}-error` : undefined
						}
					/>
					{value !== setting.resetValue && (
						<button
							type="button"
							className={styles.clearColorBtn}
							onClick={() => {
								clearValidationError(targetId)
								setField(setting.key, setting.resetValue)
							}}
							title={
								inheritsAccent
									? 'Вернуть цвет акцентов'
									: 'Сбросить к стандартному'
							}
							aria-label={
								inheritsAccent
									? 'Вернуть цвет акцентов'
									: `Сбросить настройку «${setting.label}»`
							}
						>
							✕
						</button>
					)}
				</div>
				{renderFieldError(targetId)}
				<p className={styles.hint}>{setting.hint}</p>
			</div>
		)
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
					aria-label="Закрыть настройки калькулятора"
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
					Настройки калькулятора
				</h2>
				{lifecycleActions}

				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек калькулятора"
				>
					{TABS.map(item => (
						<button
							key={item.id}
							type="button"
							id={`${titleId}-tab-${item.id}`}
							role="tab"
							aria-selected={tab === item.id}
							aria-controls={`${titleId}-panel-${item.id}`}
							tabIndex={tab === item.id ? 0 : -1}
							className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
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
						type="calculator"
						config={config}
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
					{tab === 'main' && (
						<div className={styles.fields}>
							<WidgetPresetButtons
								presets={[
									{
										id: 'service',
										label: 'Стоимость услуги',
										description: 'Базовая цена и дополнительные параметры.'
									},
									{
										id: 'quantity',
										label: 'Цена за количество',
										description: 'Расчёт стоимости по объёму заказа.'
									},
									{
										id: 'tariff',
										label: 'Сравнение тарифов',
										description: 'Выбор пакета с разной стоимостью.'
									}
								]}
								onApply={preset => {
									setValidationError(null)
									setConfig(previous => {
										const preserved = {
											color: previous.color,
											bgColor: previous.bgColor,
											glassEffect: previous.glassEffect,
											buttonColor: previous.buttonColor,
											openButtonColor: previous.openButtonColor,
											textColor: previous.textColor,
											buttonSide: previous.buttonSide,
											buttonPulse: previous.buttonPulse,
											buttonBottom: previous.buttonBottom,
											buttonOffset: previous.buttonOffset,
											buttonSize: previous.buttonSize,
											buttonImageUrl: previous.buttonImageUrl,
											autoOpenDelay: previous.autoOpenDelay,
											privacyUrl: previous.privacyUrl,
											developInfoActive: previous.developInfoActive,
											integrations: previous.integrations
										}

										if (preset === 'quantity') {
											return normalizeConfig({
												...DEFAULT_CONFIG,
												...preserved,
												title: 'Рассчитайте стоимость заказа',
												subtitle: 'Укажите необходимое количество',
												basePrice: 0,
												fields: [
													{
														id: 'quantity',
														label: 'Количество',
														type: 'number',
														required: true,
														min: 1,
														max: 1000,
														step: 1,
														defaultValue: 1,
														unit: 'шт.',
														unitPrice: 1000
													}
												]
											})
										}

										if (preset === 'tariff') {
											return normalizeConfig({
												...DEFAULT_CONFIG,
												...preserved,
												title: 'Подберите тариф',
												subtitle:
													'Выберите подходящий пакет и получите расчёт',
												fields: [
													{
														id: 'tariff',
														label: 'Тариф',
														type: 'select',
														required: true,
														options: [
															{
																id: 'start',
																label: 'Старт',
																add: 0,
																multiplier: 1
															},
															{
																id: 'business',
																label: 'Бизнес',
																add: 10000,
																multiplier: 1
															},
															{
																id: 'pro',
																label: 'Профессиональный',
																add: 25000,
																multiplier: 1
															}
														]
													}
												]
											})
										}

										return normalizeConfig({
											...DEFAULT_CONFIG,
											...preserved,
											title: 'Рассчитайте стоимость услуги',
											subtitle:
												'Выберите параметры и получите предварительный расчёт'
										})
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
										id={validationTargetId('name')}
										className={`${styles.input} ${
											isInvalidTarget(validationTargetId('name'))
												? pageStyles.inputError
												: ''
										}`}
										value={name}
										onChange={event => {
											setName(event.target.value)
											clearValidationError(validationTargetId('name'))
										}}
										onBlur={() => validateMainFieldOnBlur('name')}
										placeholder="Калькулятор стоимости"
										maxLength={50}
										aria-invalid={isInvalidTarget(
											validationTargetId('name')
										)}
										aria-describedby={
											isInvalidTarget(validationTargetId('name'))
												? `${validationTargetId('name')}-error`
												: undefined
										}
									/>
									{renderFieldError(validationTargetId('name'))}
									<p className={styles.hint}>
										Название видно только вам в личном кабинете.
									</p>
								</div>
								<div className={styles.gridTwo}>
									{renderColorSetting(CALCULATOR_COLOR_SETTINGS[0])}
								</div>
								<details className={styles.optionalDetails}>
									<summary className={styles.optionalSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.optionalContent}>
										<div className={styles.gridTwo}>
											{CALCULATOR_COLOR_SETTINGS.slice(1).map(
												renderColorSetting
											)}
										</div>
										<div className={styles.field}>
											<label className={styles.checkRow}>
												<input
													type="checkbox"
													checked={config.glassEffect}
													onChange={event =>
														setField('glassEffect', event.target.checked)
													}
												/>
												<span className={styles.checkLabel}>
													Стеклянный эффект фона
												</span>
											</label>
											<p className={styles.hint}>
												Добавляет полупрозрачность и размытие стандартному
												фону. При заданном цвете фона используется сплошная
												заливка.
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
														src={
															config.buttonImageUrl ||
															DEFAULT_BUTTON_IMAGE_URL
														}
														alt="Кнопка калькулятора"
														width={64}
														height={64}
														unoptimized={Boolean(config.buttonImageUrl)}
													/>
												</div>
												<div className={styles.buttonImageContent}>
													<p className={styles.hint}>
														PNG с прозрачным фоном, до 200 КБ.
													</p>
													<div className={styles.buttonImageActions}>
														<label
															htmlFor={buttonImageInputId}
															className={`${styles.secondaryBtn} ${
																!canUseCustomButtonImage ||
																hasUnsavedChanges
																	? styles.disabled
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
															onChange={handleButtonImageUpload}
														/>
														{config.buttonImageUrl && (
															<button
																type="button"
																className={styles.secondaryBtn}
																onClick={resetButtonImage}
																disabled={isDangerActionPending}
															>
																Вернуть стандартную
															</button>
														)}
													</div>
													{!canUseCustomButtonImage && (
														<p className={styles.domainHint}>
															Своя картинка доступна только на активном
															тарифе Hard.
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
											<label className={styles.checkRow}>
												<input
													type="checkbox"
													checked={config.buttonPulse}
													onChange={event =>
														setField('buttonPulse', event.target.checked)
													}
												/>
												<span className={styles.checkLabel}>
													Включить пульсацию кнопки
												</span>
											</label>
											<p className={styles.hint}>
												Добавляет мягкое свечение, чтобы кнопка была
												заметнее.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>
												Сторона расположения кнопки для открытия виджета на
												вашем сайте:
											</p>
											<select
												className={styles.input}
												value={config.buttonSide}
												onChange={event =>
													setField(
														'buttonSide',
														event.target.value as 'left' | 'right'
													)
												}
											>
												<option value="right">Справа</option>
												<option value="left">Слева</option>
											</select>
											<p className={styles.hint}>
												С какой стороны экрана показывать плавающую кнопку.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>Отображение облачка</p>
											<label className={styles.checkRow}>
												<input
													type="checkbox"
													checked={config.bubbleEnabled}
													onChange={event =>
														setField('bubbleEnabled', event.target.checked)
													}
												/>
												<span className={styles.checkLabel}>
													Показывать облачко рядом с кнопкой
												</span>
											</label>
											<p className={styles.hint}>
												Если выключить, на сайте останется только плавающая
												кнопка.
											</p>
										</div>

										{config.bubbleEnabled && (
											<div className={styles.field}>
												<p className={styles.label}>Текст облачка:</p>
												<input
													id={validationTargetId('bubble-text')}
													className={`${styles.input} ${
														isInvalidTarget(
															validationTargetId('bubble-text')
														)
															? pageStyles.inputError
															: ''
													}`}
													value={config.bubbleText}
													onChange={event =>
														setField(
															'bubbleText',
															event.target.value,
															validationTargetId('bubble-text')
														)
													}
													onBlur={() =>
														validateMainFieldOnBlur('bubbleText')
													}
													placeholder="Рассчитать стоимость"
													maxLength={100}
													aria-invalid={isInvalidTarget(
														validationTargetId('bubble-text')
													)}
													aria-describedby={
														isInvalidTarget(
															validationTargetId('bubble-text')
														)
															? `${validationTargetId('bubble-text')}-error`
															: undefined
													}
												/>
												{renderFieldError(
													validationTargetId('bubble-text')
												)}
												<p className={styles.hint}>
													Короткий призыв рядом с плавающей кнопкой.
												</p>
											</div>
										)}

										<div className={styles.field}>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>Отступ снизу:</p>
												<span className={pageStyles.rangeValue}>
													{config.buttonBottom}%
												</span>
											</div>
											<input
												id={validationTargetId('button-bottom')}
												type="range"
												aria-label="Отступ снизу"
												min={1}
												max={50}
												step={1}
												value={config.buttonBottom}
												className={`${pageStyles.rangeInput} ${
													isInvalidTarget(
														validationTargetId('button-bottom')
													)
														? pageStyles.inputError
														: ''
												}`}
												aria-invalid={isInvalidTarget(
													validationTargetId('button-bottom')
												)}
												aria-describedby={
													isInvalidTarget(
														validationTargetId('button-bottom')
													)
														? `${validationTargetId('button-bottom')}-error`
														: undefined
												}
												onChange={event =>
													setField(
														'buttonBottom',
														Number(event.target.value),
														validationTargetId('button-bottom')
													)
												}
											/>
											{renderFieldError(
												validationTargetId('button-bottom')
											)}
											<p className={styles.hint}>
												1% — почти у нижнего края, 50% — по центру экрана.
											</p>
										</div>

										<div className={styles.field}>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>Отступ сбоку:</p>
												<span className={pageStyles.rangeValue}>
													{config.buttonOffset}%
												</span>
											</div>
											<input
												type="range"
												aria-label="Отступ сбоку"
												min={1}
												max={50}
												step={1}
												value={config.buttonOffset}
												className={pageStyles.rangeInput}
												onChange={event =>
													setField(
														'buttonOffset',
														Number(event.target.value)
													)
												}
											/>
											<p className={styles.hint}>
												Отступ от выбранного левого или правого края.
											</p>
										</div>

										<div className={styles.field}>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>
													Размер кнопки открытия:
												</p>
												<span className={pageStyles.rangeValue}>
													{config.buttonSize}px
												</span>
											</div>
											<input
												type="range"
												aria-label="Размер кнопки открытия"
												min={40}
												max={100}
												step={1}
												value={config.buttonSize}
												className={pageStyles.rangeInput}
												onChange={event =>
													setField(
														'buttonSize',
														Number(event.target.value)
													)
												}
											/>
											<p className={styles.hint}>
												Размер плавающей кнопки на сайте. Стандартное
												значение — 60 px.
											</p>
										</div>
									</div>
								</details>

								<div className={styles.field}>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={config.autoOpenDelay != null}
											onChange={event =>
												setField(
													'autoOpenDelay',
													event.target.checked ? 5 : null
												)
											}
										/>
										<span className={styles.checkLabel}>
											Автоматически показывать
										</span>
									</label>
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
												max={MAX_AUTO_OPEN_DELAY_SECONDS}
												step={1}
												value={config.autoOpenDelay}
												className={pageStyles.rangeInput}
												onChange={event =>
													setField(
														'autoOpenDelay',
														Number(event.target.value)
													)
												}
											/>
										</>
									)}
									<p className={styles.hint}>
										Калькулятор откроется через выбранное число секунд
										после загрузки страницы.
									</p>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Тексты и запуск
									</h3>
								</div>
								{(
									[
										[
											'title',
											'Заголовок виджета:',
											'Рассчитайте стоимость',
											100,
											'Главный заголовок на первом шаге.'
										],
										[
											'subtitle',
											'Подзаголовок виджета:',
											'Ответьте на несколько вопросов и получите расчёт',
											300,
											'Кратко объясните посетителю, что нужно сделать.'
										],
										[
											'calculateButtonText',
											'Текст кнопки расчёта:',
											'Рассчитать',
											50,
											'Кнопка после заполнения параметров.'
										],
										[
											'resultTitle',
											'Заголовок результата:',
											'Ориентировочная стоимость',
											100,
											'Подпись над рассчитанной суммой.'
										]
									] as const
								).map(([key, label, placeholder, maxLength, hint]) => (
									<div key={key} className={styles.field}>
										<p className={styles.label}>{label}</p>
										<input
											id={validationTargetId(`main-${key}`)}
											className={`${styles.input} ${
												isInvalidTarget(validationTargetId(`main-${key}`))
													? pageStyles.inputError
													: ''
											}`}
											value={config[key]}
											onChange={event =>
												setField(
													key,
													event.target.value,
													validationTargetId(`main-${key}`)
												)
											}
											onBlur={() => {
												if (key !== 'subtitle') {
													validateMainFieldOnBlur(key)
												}
											}}
											placeholder={placeholder}
											maxLength={maxLength}
											aria-invalid={isInvalidTarget(
												validationTargetId(`main-${key}`)
											)}
											aria-describedby={
												isInvalidTarget(validationTargetId(`main-${key}`))
													? `${validationTargetId(`main-${key}`)}-error`
													: undefined
											}
										/>
										{renderFieldError(validationTargetId(`main-${key}`))}
										<p className={styles.hint}>{hint}</p>
									</div>
								))}
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
										value={config.dataType}
										onChange={event =>
											setField(
												'dataType',
												event.target.value as CalculatorConfig['dataType']
											)
										}
									>
										<option value="PHONE">Номер телефона</option>
										<option value="EMAIL">Email</option>
										<option value="PHONE_AND_EMAIL">
											Номер телефона и Email
										</option>
										<option value="NONE">Не собирать контакты</option>
									</select>
									<p className={styles.hint}>
										Если сбор включён, контакт запрашивается перед
										результатом. Без сбора результат показывается сразу, а
										заявка не создаётся.
									</p>
								</div>
								{config.dataType !== 'NONE' && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>
												Заголовок формы контакта:
											</p>
											<input
												id={validationTargetId('contact-title')}
												className={`${styles.input} ${
													isInvalidTarget(
														validationTargetId('contact-title')
													)
														? pageStyles.inputError
														: ''
												}`}
												value={config.contactTitle}
												onChange={event =>
													setField(
														'contactTitle',
														event.target.value,
														validationTargetId('contact-title')
													)
												}
												onBlur={() =>
													validateMainFieldOnBlur('contactTitle')
												}
												placeholder="Оставьте контакт, чтобы получить расчёт"
												maxLength={150}
												aria-invalid={isInvalidTarget(
													validationTargetId('contact-title')
												)}
												aria-describedby={
													isInvalidTarget(
														validationTargetId('contact-title')
													)
														? `${validationTargetId('contact-title')}-error`
														: undefined
												}
											/>
											{renderFieldError(
												validationTargetId('contact-title')
											)}
											<p className={styles.hint}>
												Показывается перед полями телефона или email.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Ссылка на политику конфиденциальности:
											</p>
											<input
												id={validationTargetId('privacy-url')}
												type="url"
												className={`${styles.input} ${
													isInvalidTarget(
														validationTargetId('privacy-url')
													)
														? pageStyles.inputError
														: ''
												}`}
												value={config.privacyUrl}
												onChange={event =>
													setField(
														'privacyUrl',
														event.target.value,
														validationTargetId('privacy-url')
													)
												}
												onBlur={() =>
													validateMainFieldOnBlur('privacyUrl')
												}
												placeholder="https://winwidget.ru/legal-documentation/consent-processing"
												maxLength={500}
												aria-invalid={isInvalidTarget(
													validationTargetId('privacy-url')
												)}
												aria-describedby={
													isInvalidTarget(
														validationTargetId('privacy-url')
													)
														? `${validationTargetId('privacy-url')}-error`
														: undefined
												}
											/>
											{renderFieldError(validationTargetId('privacy-url'))}
											<p className={styles.hint}>
												Можно оставить ссылку Winwidget или указать
												политику вашей компании.
											</p>
										</div>
										<div className={styles.field}>
											<label className={styles.checkRow}>
												<input
													type="checkbox"
													checked={config.filterDuplicates}
													onChange={event =>
														setField(
															'filterDuplicates',
															event.target.checked
														)
													}
												/>
												<span className={styles.checkLabel}>
													Не учитывать повторные контакты
												</span>
											</label>
											<p className={styles.hint}>
												Повторная заявка с уже сохранённым телефоном или
												email не будет создана.
											</p>
										</div>
									</>
								)}
								<div className={styles.field}>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={config.developInfoActive}
											onChange={event =>
												setField('developInfoActive', event.target.checked)
											}
										/>
										<span className={styles.checkLabel}>
											Показывать ссылку на Winwidget
										</span>
									</label>
									<p className={styles.hint}>
										Управляет отображением подписи сервиса внутри
										калькулятора.
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
									<p className={styles.hint}>
										Сброс заменит внешний вид, тексты, поля, формулу и
										параметры показа стандартными значениями. Название,
										домен, интеграции и своя картинка сохранятся.
									</p>
									<button
										type="button"
										className={styles.resetSettingsBtn}
										onClick={() => setIsResetConfirmOpen(true)}
										disabled={isDangerActionPending}
									>
										Сбросить все настройки
									</button>
								</div>
							</div>
						</div>
					)}

					{tab === 'fields' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Параметры расчёта
									</h3>
								</div>
								<p className={styles.infoText}>
									Поля показываются посетителю в указанном порядке. Для
									вариантов можно задать надбавку и множитель, для числа —
									цену за единицу.
								</p>
							</div>
							{config.fields.map((field, fieldIndex) => (
								<div key={field.id} className={styles.itemCard}>
									<div className={styles.itemHeader}>
										<strong>Поле {fieldIndex + 1}</strong>
										<div className={styles.itemActions}>
											<button
												type="button"
												className={styles.smallBtn}
												onClick={() => moveCalculatorField(fieldIndex, -1)}
												disabled={fieldIndex === 0}
											>
												Выше
											</button>
											<button
												type="button"
												className={styles.smallBtn}
												onClick={() => moveCalculatorField(fieldIndex, 1)}
												disabled={fieldIndex === config.fields.length - 1}
											>
												Ниже
											</button>
											<button
												type="button"
												className={styles.dangerBtn}
												onClick={() => removeCalculatorField(fieldIndex)}
											>
												Удалить
											</button>
										</div>
									</div>
									<div className={styles.gridTwo}>
										<div className={styles.field}>
											<p className={styles.label}>Название поля:</p>
											<input
												id={validationTargetId(`field-${field.id}-label`)}
												className={`${styles.input} ${
													isInvalidTarget(
														validationTargetId(`field-${field.id}-label`)
													)
														? pageStyles.inputError
														: ''
												}`}
												value={field.label}
												aria-invalid={isInvalidTarget(
													validationTargetId(`field-${field.id}-label`)
												)}
												aria-describedby={
													isInvalidTarget(
														validationTargetId(`field-${field.id}-label`)
													)
														? `${validationTargetId(
																`field-${field.id}-label`
															)}-error`
														: undefined
												}
												onChange={event =>
													updateCalculatorField(
														fieldIndex,
														{
															label: event.target.value
														},
														validationTargetId(`field-${field.id}-label`)
													)
												}
												onBlur={() =>
													showInlineValidationError(
														validationTargetId(`field-${field.id}-label`),
														field.label.trim()
															? undefined
															: `Поле ${fieldIndex + 1}: заполните название`
													)
												}
												placeholder={`Параметр ${fieldIndex + 1}`}
												maxLength={100}
											/>
											{renderFieldError(
												validationTargetId(`field-${field.id}-label`)
											)}
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Тип поля:</p>
											<select
												className={styles.input}
												value={field.type}
												onChange={event =>
													changeFieldType(
														fieldIndex,
														event.target.value as CalculatorFieldType
													)
												}
											>
												<option value="select">Выпадающий список</option>
												<option value="number">Числовое поле</option>
												<option value="radio">Один вариант</option>
												<option value="checkbox">
													Несколько вариантов
												</option>
											</select>
										</div>
									</div>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={field.required}
											onChange={event =>
												updateCalculatorField(fieldIndex, {
													required: event.target.checked
												})
											}
										/>
										<span className={styles.checkLabel}>
											Обязательное поле
										</span>
									</label>

									{(field.type === 'select' ||
										field.type === 'radio' ||
										field.type === 'checkbox') && (
										<div className={styles.optionList}>
											{(field.options || []).map((option, optionIndex) => (
												<div key={option.id} className={styles.optionRow}>
													<div className={styles.compactField}>
														<span>Название варианта:</span>
														<input
															id={validationTargetId(
																`field-${field.id}-option-${option.id}-label`
															)}
															className={`${styles.input} ${
																isInvalidTarget(
																	validationTargetId(
																		`field-${field.id}-option-${option.id}-label`
																	)
																)
																	? pageStyles.inputError
																	: ''
															}`}
															value={option.label}
															placeholder={`Вариант ${optionIndex + 1}`}
															maxLength={100}
															onChange={event =>
																updateOption(fieldIndex, optionIndex, {
																	label: event.target.value
																})
															}
															onBlur={() =>
																validateOptionOnBlur(
																	fieldIndex,
																	optionIndex,
																	'label'
																)
															}
														/>
														{renderFieldError(
															validationTargetId(
																`field-${field.id}-option-${option.id}-label`
															)
														)}
													</div>
													<div className={styles.compactField}>
														<span>Надбавка:</span>
														<NumericInput
															id={validationTargetId(
																`field-${field.id}-option-${option.id}-add`
															)}
															className={`${styles.input} ${
																isInvalidTarget(
																	validationTargetId(
																		`field-${field.id}-option-${option.id}-add`
																	)
																)
																	? pageStyles.inputError
																	: ''
															}`}
															aria-label={`Надбавка для варианта ${option.label}`}
															value={option.add}
															onValueChange={value =>
																updateOption(fieldIndex, optionIndex, {
																	add: value
																})
															}
															onBlur={() =>
																validateOptionOnBlur(
																	fieldIndex,
																	optionIndex,
																	'add'
																)
															}
														/>
														{renderFieldError(
															validationTargetId(
																`field-${field.id}-option-${option.id}-add`
															)
														)}
													</div>
													<div className={styles.compactField}>
														<span>Множитель:</span>
														<NumericInput
															id={validationTargetId(
																`field-${field.id}-option-${option.id}-multiplier`
															)}
															min={0.01}
															step={0.01}
															className={`${styles.input} ${
																isInvalidTarget(
																	validationTargetId(
																		`field-${field.id}-option-${option.id}-multiplier`
																	)
																)
																	? pageStyles.inputError
																	: ''
															}`}
															aria-label={`Множитель для варианта ${option.label}`}
															value={option.multiplier}
															onValueChange={value =>
																updateOption(fieldIndex, optionIndex, {
																	multiplier: value
																})
															}
															onBlur={() =>
																validateOptionOnBlur(
																	fieldIndex,
																	optionIndex,
																	'multiplier'
																)
															}
														/>
														{renderFieldError(
															validationTargetId(
																`field-${field.id}-option-${option.id}-multiplier`
															)
														)}
													</div>
													<button
														type="button"
														className={styles.removeBtn}
														onClick={() =>
															removeOption(fieldIndex, optionIndex)
														}
														aria-label="Удалить вариант"
													>
														✕
													</button>
												</div>
											))}
											<button
												id={validationTargetId(
													`field-${field.id}-options`
												)}
												type="button"
												className={`${styles.secondaryBtn} ${
													isInvalidTarget(
														validationTargetId(`field-${field.id}-options`)
													)
														? pageStyles.inputError
														: ''
												}`}
												onClick={() => addOption(fieldIndex)}
											>
												Добавить вариант
											</button>
											{renderFieldError(
												validationTargetId(`field-${field.id}-options`)
											)}
										</div>
									)}

									{field.type === 'number' && (
										<div className={styles.gridThree}>
											{(
												[
													['min', 'Минимум'],
													['max', 'Максимум'],
													['step', 'Шаг'],
													['defaultValue', 'По умолчанию'],
													['unitPrice', 'Цена за единицу']
												] as const
											).map(([key, label]) => (
												<div key={key} className={styles.field}>
													<p className={styles.label}>{label}:</p>
													<NumericInput
														id={validationTargetId(
															`field-${field.id}-${key}`
														)}
														className={`${styles.input} ${
															isInvalidTarget(
																validationTargetId(
																	`field-${field.id}-${key}`
																)
															)
																? pageStyles.inputError
																: ''
														}`}
														value={field[key] ?? 0}
														onValueChange={value =>
															updateCalculatorField(
																fieldIndex,
																{
																	[key]: value
																},
																validationTargetId(
																	`field-${field.id}-${key}`
																)
															)
														}
														onBlur={() =>
															validateNumberFieldOnBlur(fieldIndex, key)
														}
													/>
													{renderFieldError(
														validationTargetId(`field-${field.id}-${key}`)
													)}
												</div>
											))}
											<div className={styles.field}>
												<p className={styles.label}>Единица:</p>
												<input
													className={styles.input}
													value={field.unit || ''}
													onChange={event =>
														updateCalculatorField(fieldIndex, {
															unit: event.target.value
														})
													}
												/>
											</div>
										</div>
									)}
								</div>
							))}
							<button
								id={validationTargetId('fields-empty')}
								type="button"
								className={`${styles.addBtn} ${
									isInvalidTarget(validationTargetId('fields-empty'))
										? pageStyles.inputError
										: ''
								}`}
								onClick={addCalculatorField}
							>
								Добавить поле
							</button>
							{renderFieldError(validationTargetId('fields-empty'))}
						</div>
					)}

					{tab === 'calculation' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>Формула</h3>
								</div>
								<p className={styles.infoText}>
									Итог = (базовая стоимость + надбавки + значения числовых
									полей × цена за единицу) × множители. После этого
									результат округляется с указанным шагом.
								</p>
								<div className={styles.gridThree}>
									<div className={styles.field}>
										<p className={styles.label}>Базовая стоимость:</p>
										<NumericInput
											id={validationTargetId('calculation-base-price')}
											min={0}
											className={`${styles.input} ${
												isInvalidTarget(
													validationTargetId('calculation-base-price')
												)
													? pageStyles.inputError
													: ''
											}`}
											value={config.basePrice}
											onValueChange={value =>
												setField(
													'basePrice',
													value,
													validationTargetId('calculation-base-price')
												)
											}
											onBlur={() =>
												validateCalculationFieldOnBlur('basePrice')
											}
										/>
										{renderFieldError(
											validationTargetId('calculation-base-price')
										)}
										<p className={styles.hint}>
											Начальная сумма до применения выбранных параметров.
										</p>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Валюта:</p>
										<input
											id={validationTargetId('calculation-currency')}
											className={`${styles.input} ${
												isInvalidTarget(
													validationTargetId('calculation-currency')
												)
													? pageStyles.inputError
													: ''
											}`}
											value={config.currency}
											onChange={event =>
												setField(
													'currency',
													event.target.value,
													validationTargetId('calculation-currency')
												)
											}
											onBlur={() =>
												validateCalculationFieldOnBlur('currency')
											}
											maxLength={3}
											placeholder="RUB"
										/>
										{renderFieldError(
											validationTargetId('calculation-currency')
										)}
										<p className={styles.hint}>
											Трёхбуквенный код: RUB, USD или EUR.
										</p>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Шаг округления:</p>
										<NumericInput
											id={validationTargetId('calculation-rounding-step')}
											min={0.01}
											step={0.01}
											className={`${styles.input} ${
												isInvalidTarget(
													validationTargetId('calculation-rounding-step')
												)
													? pageStyles.inputError
													: ''
											}`}
											value={config.roundingStep}
											onValueChange={value =>
												setField(
													'roundingStep',
													value,
													validationTargetId('calculation-rounding-step')
												)
											}
											onBlur={() =>
												validateCalculationFieldOnBlur('roundingStep')
											}
										/>
										{renderFieldError(
											validationTargetId('calculation-rounding-step')
										)}
										<p className={styles.hint}>
											Например, 100 округляет результат до ближайшей сотни.
										</p>
									</div>
								</div>
							</div>
						</div>
					)}

					{tab === 'integrations' && (
						<div className={styles.fields}>
							{config.dataType === 'NONE' && (
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
							{config.dataType !== 'NONE' && (
								<>
									<div className={styles.settingsGroup}>
										<div className={styles.settingsGroupHeader}>
											<h3 className={styles.settingsGroupTitle}>
												Уведомления
											</h3>
										</div>
										<p className={styles.infoText}>
											Можно включить email и Telegram одновременно. Оба
											уведомления отправляются после сохранения заявки.
										</p>
										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок на Email
											</p>
											<input
												type="email"
												className={styles.input}
												value={config.integrations.email || ''}
												placeholder="mail@example.ru"
												maxLength={200}
												onChange={event =>
													setIntegration('email', event.target.value)
												}
											/>
											<p className={styles.hint}>
												На этот адрес будут приходить новые заявки
												калькулятора.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок в Telegram
											</p>
											<input
												className={styles.input}
												value={config.integrations.telegramChatId || ''}
												placeholder="123456789"
												maxLength={100}
												onChange={event =>
													setIntegration(
														'telegramChatId',
														event.target.value
													)
												}
											/>
											<p className={styles.hint}>
												Напишите боту <b>@winwidget_info_bot</b> команду
												/start, затем укажите ваш Telegram ID. Узнать его
												можно через <b>@getmyid_bot</b>.
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
												type="url"
												className={styles.input}
												value={config.integrations.webhookUrl || ''}
												placeholder="https://example.ru/webhook"
												maxLength={500}
												onChange={event =>
													setIntegration('webhookUrl', event.target.value)
												}
											/>
											<p className={styles.hint}>
												Winwidget отправит данные заявки POST-запросом на
												указанный адрес.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок в Битрикс24
											</p>
											<input
												type="url"
												className={styles.input}
												value={
													config.integrations.bitrix24WebhookUrl || ''
												}
												placeholder="https://company.bitrix24.ru/rest/..."
												maxLength={500}
												onChange={event =>
													setIntegration(
														'bitrix24WebhookUrl',
														event.target.value
													)
												}
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
												value={config.integrations.amoCrmDomain || ''}
												placeholder="company.amocrm.ru"
												maxLength={100}
												onChange={event =>
													setIntegration(
														'amoCrmDomain',
														event.target.value
													)
												}
											/>
											<p className={styles.hint}>
												Например, company.amocrm.ru без пути и протокола.
											</p>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>
												amoCRM — токен доступа
											</p>
											<input
												type="password"
												className={styles.input}
												value={config.integrations.amoCrmToken || ''}
												placeholder="Долгосрочный токен из настроек API"
												maxLength={500}
												onChange={event =>
													setIntegration('amoCrmToken', event.target.value)
												}
											/>
											<p className={styles.hint}>
												При каждой заявке будут создаваться сделка и
												контакт.
											</p>
										</div>
									</div>
								</>
							)}

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
										placeholder="12345678"
										maxLength={100}
										onChange={event =>
											setIntegration('yandexMetrikaId', event.target.value)
										}
									/>
									<p className={styles.hint}>
										При открытии отправляется цель <b>calculator_open</b>,
										после заявки — <b>calculator_lead</b>. Счётчик должен
										быть установлен на странице сайта.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>
										Ретаргетинг ВКонтакте — ID пикселя
									</p>
									<input
										className={styles.input}
										value={config.integrations.vkPixelId || ''}
										placeholder="VK-RTRG-12345-ABCDEF"
										maxLength={100}
										onChange={event =>
											setIntegration('vkPixelId', event.target.value)
										}
									/>
									<p className={styles.hint}>
										События: <b>calculator_open</b> и{' '}
										<b>calculator_lead</b>. Пиксель VK должен быть
										установлен на странице сайта.
									</p>
								</div>
								<div className={styles.field}>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={config.integrations.roistatEnabled || false}
											onChange={event =>
												setIntegration(
													'roistatEnabled',
													event.target.checked
												)
											}
										/>
										<span className={styles.checkLabel}>
											Включить отправку целей в Roistat
										</span>
									</label>
									<p className={styles.hint}>
										Отправляются цели <b>calculator_open</b> и{' '}
										<b>calculator_lead</b>. Код Roistat должен быть
										подключён на странице сайта.
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
									<p className={styles.label}>Домен установки виджета:</p>
									<input
										className={styles.input}
										value={installDomain}
										placeholder="site.ru"
										maxLength={255}
										onChange={event =>
											setInstallDomain(event.target.value)
										}
									/>
									<p className={styles.domainHint}>
										Домен должен совпадать с сайтом, на котором установлен
										код. Прямая ссылка работает без домена.
									</p>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Код виджета:</p>
									<p className={styles.hint}>
										Вставьте код перед закрывающим тегом &lt;/body&gt;.
									</p>
									<textarea
										className={`${styles.input} ${styles.codeArea}`}
										value={scriptCode}
										readOnly
									/>
									<button
										type="button"
										className={styles.secondaryBtn}
										onClick={() =>
											copyToClipboard(scriptCode, 'Код скопирован', true)
										}
									>
										Копировать код
									</button>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Прямая ссылка
									</h3>
								</div>
								<p className={styles.hint}>
									Используйте калькулятор без установки на сайт или
									отправьте ссылку клиенту.
								</p>
								<div className={styles.directLink}>
									<input
										className={styles.input}
										value={directLink}
										readOnly
									/>
									<a
										href={directLink}
										target="_blank"
										rel="noreferrer"
										className={styles.openLink}
									>
										Открыть
									</a>
								</div>
								<button
									type="button"
									className={styles.secondaryBtn}
									onClick={() =>
										copyToClipboard(directLink, 'Ссылка скопирована')
									}
								>
									Копировать ссылку
								</button>
								<DirectLinkQr
									value={directLink}
									downloadName={`winwidget-calculator-${calculator.publicKey}.png`}
								/>
							</div>
						</div>
					)}

					{tab === 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Как работает калькулятор
									</h3>
								</div>
								<ul className={styles.infoList}>
									<li>Посетитель заполняет настроенные поля.</li>
									<li>
										Калькулятор применяет надбавки, цену за единицу и
										множители без выполнения пользовательского JavaScript.
									</li>
									<li>
										Если сбор данных включён, контакт всегда запрашивается
										перед показом результата.
									</li>
									<li>
										Если выбран вариант «Не собирать контакты», результат
										показывается сразу, а заявка не создаётся.
									</li>
									<li>
										При включённом сборе данных заявка, параметры и
										итоговая стоимость сохраняются на единой странице
										заявок кабинета.
									</li>
								</ul>
							</div>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Перед запуском
									</h3>
								</div>
								<ul className={styles.infoList}>
									<li>Проверьте минимальные и максимальные значения.</li>
									<li>Сравните несколько расчётов вручную.</li>
									<li>
										Отправьте тестовую заявку и проверьте интеграции.
									</li>
									<li>Откройте прямую ссылку на телефоне.</li>
								</ul>
							</div>
						</div>
					)}

					{tab !== 'code' && tab !== 'info' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Сброс раздела
									</h3>
								</div>
								{confirmResetSection === tab ? (
									<div className={styles.dangerActions}>
										<p className={styles.hint}>
											{tab === 'integrations'
												? 'Только настройки интеграций вернутся к стандартным значениям. Остальные разделы и домен сохранятся.'
												: 'Только настройки текущего раздела вернутся к стандартным значениям. Другие разделы, домен и интеграции сохранятся.'}
										</p>
										<div className={styles.footerActions}>
											<button
												type="button"
												className={styles.resetSettingsBtn}
												onClick={() => handleResetSection(tab)}
											>
												Да, сбросить раздел
											</button>
											<button
												type="button"
												className={styles.secondaryBtn}
												onClick={() => setConfirmResetSection(null)}
											>
												Отмена
											</button>
										</div>
									</div>
								) : (
									<button
										type="button"
										className={styles.resetSettingsBtn}
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
							disabled={saveMutation.isPending}
						>
							{isPagePresentation ? 'К виджетам' : 'Отмена'}
						</button>
						<ActionTooltip
							content="Сохраняет настройки в черновик. На сайте они появятся только после публикации."
							disabled={saveMutation.isPending || !hasUnsavedChanges}
							disabledContent={
								saveMutation.isPending
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
								disabled={saveMutation.isPending || !hasUnsavedChanges}
							>
								{saveMutation.isPending
									? 'Сохранение...'
									: 'Сохранить черновик'}
							</button>
						</ActionTooltip>
					</div>
				</div>
				{closeGuardDialog}
				{isResetConfirmOpen && (
					<ConfirmDialog
						title="Сбросить настройки калькулятора?"
						message="Внешний вид, тексты, поля, формула и параметры показа будут заменены стандартными значениями. Название, домен, интеграции и своя картинка сохранятся."
						confirmLabel="Да, сбросить"
						cancelLabel="Отмена"
						confirmDisabled={isDangerActionPending}
						onConfirm={resetSettings}
						onCancel={() => setIsResetConfirmOpen(false)}
					/>
				)}
			</div>
		</div>
	)
}

export default CalculatorSettingsModal
