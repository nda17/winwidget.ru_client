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
import {
	ChangeEvent,
	InputHTMLAttributes,
	useEffect,
	useId,
	useState
} from 'react'
import toast from 'react-hot-toast'
import styles from './CalculatorSettingsModal.module.scss'
import DirectLinkQr from '../shared/DirectLinkQr'
import WidgetLivePreview from '../shared/WidgetLivePreview'

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

const TABS: { id: Tab; label: string }[] = [
	{ id: 'main', label: 'Главные' },
	{ id: 'fields', label: 'Поля' },
	{ id: 'calculation', label: 'Расчёт' },
	{ id: 'integrations', label: 'Интеграции' },
	{ id: 'code', label: 'Код' },
	{ id: 'info', label: 'Инфо' }
]

const makeId = () => Math.random().toString(36).slice(2, 10)

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
	contactPosition: 'AFTER_RESULT',
	resultTitle: 'Ориентировочная стоимость',
	dataType: 'PHONE',
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

const normalizeConfig = (config: CalculatorConfig): CalculatorConfig => ({
	...cloneConfig(DEFAULT_CONFIG),
	...config,
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

interface Props {
	calculator: Calculator
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: Calculator) => void
}

const CalculatorSettingsModal = ({
	calculator,
	canUseCustomButtonImage,
	onClose,
	onSaved
}: Props) => {
	const titleId = useId()
	const buttonImageInputId = useId()
	const [tab, setTab] = useState<Tab>('main')
	const [name, setName] = useState(calculator.name)
	const [installDomain, setInstallDomain] = useState(
		calculator.installDomain ?? ''
	)
	const [config, setConfig] = useState<CalculatorConfig>(() =>
		normalizeConfig(calculator.config)
	)
	const [savedSnapshot, setSavedSnapshot] = useState(() =>
		JSON.stringify({
			name: calculator.name,
			installDomain: calculator.installDomain ?? '',
			config: normalizeConfig(calculator.config)
		})
	)

	const currentSnapshot = JSON.stringify({ name, installDomain, config })
	const hasUnsavedChanges = currentSnapshot !== savedSnapshot

	const saveMutation = useMutation({
		mutationFn: (payload: {
			name: string
			installDomain?: string
			config: CalculatorConfig
		}) => calculatorService.updateCalculator(calculator.id, payload),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated: Calculator, _, toastId) => {
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
		onError: (error: any, _, toastId) => {
			toast.error(error?.response?.data?.message || 'Ошибка сохранения', {
				id: toastId
			})
		}
	})

	const buttonImageMutation = useMutation({
		mutationFn: (file: File) => {
			const formData = new FormData()
			formData.append('file', file)
			return calculatorService.uploadButtonImage(calculator.id, formData)
		},
		onMutate: () =>
			toast.loading('Загружаем картинку кнопки, пожалуйста подождите...'),
		onSuccess: (updated: Calculator, _, toastId) => {
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
		onError: (error: any, _, toastId) => {
			toast.error(error?.response?.data?.message || 'Ошибка загрузки', {
				id: toastId
			})
		}
	})

	const setField = <K extends keyof CalculatorConfig>(
		key: K,
		value: CalculatorConfig[K]
	) => setConfig(previous => ({ ...previous, [key]: value }))

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
		patch: Partial<CalculatorField>
	) =>
		setConfig(previous => ({
			...previous,
			fields: previous.fields.map((field, fieldIndex) =>
				fieldIndex === index ? { ...field, ...patch } : field
			)
		}))

	const changeFieldType = (index: number, type: CalculatorFieldType) => {
		const next = makeField(type)
		const current = config.fields[index]
		updateCalculatorField(index, {
			...next,
			id: current.id,
			label: current.label,
			required: current.required
		})
	}

	const addCalculatorField = () => {
		if (config.fields.length >= MAX_FIELDS) {
			toast.error(`Можно добавить не больше ${MAX_FIELDS} полей`)
			return
		}
		setField('fields', [...config.fields, makeField()])
	}

	const removeCalculatorField = (index: number) =>
		setField(
			'fields',
			config.fields.filter((_, fieldIndex) => fieldIndex !== index)
		)

	const moveCalculatorField = (index: number, direction: -1 | 1) => {
		const target = index + direction
		if (target < 0 || target >= config.fields.length) return
		const fields = [...config.fields]
		;[fields[index], fields[target]] = [fields[target], fields[index]]
		setField('fields', fields)
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
	}

	const updateOption = (
		fieldIndex: number,
		optionIndex: number,
		patch: Partial<CalculatorOption>
	) => {
		const field = config.fields[fieldIndex]
		updateCalculatorField(fieldIndex, {
			options: (field.options || []).map((option, index) =>
				index === optionIndex ? { ...option, ...patch } : option
			)
		})
	}

	const removeOption = (fieldIndex: number, optionIndex: number) => {
		const field = config.fields[fieldIndex]
		updateCalculatorField(fieldIndex, {
			options: (field.options || []).filter(
				(_, index) => index !== optionIndex
			)
		})
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

	const validate = () => {
		if (!Number.isFinite(config.basePrice) || config.basePrice < 0) {
			toast.error('Базовая стоимость должна быть не меньше 0')
			return false
		}

		if (!/^[A-Z]{3}$/.test(config.currency.trim().toUpperCase())) {
			toast.error('Укажите валюту трёхбуквенным кодом, например RUB')
			return false
		}

		if (
			!Number.isFinite(config.roundingStep) ||
			config.roundingStep <= 0
		) {
			toast.error('Шаг округления должен быть больше 0')
			return false
		}

		if (!config.fields.length) {
			toast.error('Добавьте хотя бы одно поле калькулятора')
			return false
		}

		for (let index = 0; index < config.fields.length; index += 1) {
			const field = config.fields[index]
			if (!field.label.trim()) {
				toast.error(`Поле ${index + 1}: заполните название`)
				return false
			}

			if (
				field.type === 'select' ||
				field.type === 'radio' ||
				field.type === 'checkbox'
			) {
				if (!field.options || field.options.length < 2) {
					if (field.type === 'select' || field.type === 'radio') {
						toast.error(
							`Поле «${field.label}»: добавьте минимум 2 варианта`
						)
						return false
					}
					if (!field.options?.length) {
						toast.error(
							`Поле «${field.label}»: добавьте хотя бы одну опцию`
						)
						return false
					}
				}

				const invalidOption = field.options.findIndex(
					option =>
						!option.label.trim() ||
						!Number.isFinite(option.add) ||
						!Number.isFinite(option.multiplier) ||
						option.multiplier <= 0
				)
				if (invalidOption !== -1) {
					toast.error(
						`Поле «${field.label}», вариант ${invalidOption + 1}: проверьте название, надбавку и множитель`
					)
					return false
				}
			}

			if (field.type === 'number') {
				const min = field.min ?? 0
				const max = field.max ?? 0
				const step = field.step ?? 0
				const defaultValue = field.defaultValue ?? min
				if (
					max < min ||
					step <= 0 ||
					defaultValue < min ||
					defaultValue > max
				) {
					toast.error(
						`Поле «${field.label}»: проверьте минимум, максимум, шаг и значение по умолчанию`
					)
					return false
				}
				if (!Number.isFinite(field.unitPrice ?? 0)) {
					toast.error(`Поле «${field.label}»: проверьте цену за единицу`)
					return false
				}
			}
		}

		if (config.buttonBottom < 1 || config.buttonBottom > 50) {
			toast.error('Высота кнопки: введите число от 1 до 50')
			return false
		}

		return true
	}

	const handleSave = () => {
		if (!validate()) return

		const sanitizedName = name.trim() || 'Калькулятор стоимости'
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

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть настройки калькулятора"
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
					Настройки калькулятора
				</h2>

				<div className={styles.tabs} role="tablist">
					{TABS.map(item => (
						<button
							key={item.id}
							type="button"
							role="tab"
							aria-selected={tab === item.id}
							className={`${styles.tab} ${tab === item.id ? styles.tabActive : ''}`}
							onClick={() => setTab(item.id)}
						>
							{item.label}
						</button>
					))}
				</div>

				<WidgetLivePreview
					type="calculator"
					config={config}
					isHardPlan={canUseCustomButtonImage}
				/>

				<div className={styles.tabContent}>
					{tab === 'main' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Внешний вид</h3>
								<div className={styles.field}>
									<p className={styles.label}>Название виджета</p>
									<input
										className={styles.input}
										value={name}
										onChange={event => setName(event.target.value)}
										maxLength={50}
									/>
								</div>
								<div className={styles.gridTwo}>
									{(
										[
											['color', 'Основной цвет', '#4705fb'],
											['bgColor', 'Фон виджета', '#ffffff'],
											['buttonColor', 'Кнопка расчёта', '#4705fb'],
											['openButtonColor', 'Кнопка открытия', '#4705fb'],
											['textColor', 'Цвет текста', '#1a1a1a']
										] as const
									).map(([key, label, fallback]) => (
										<div key={key} className={styles.field}>
											<p className={styles.label}>{label}</p>
											<div className={styles.colorRow}>
												<input
													type="color"
													className={styles.colorPicker}
													value={config[key] || fallback}
													onChange={event =>
														setField(key, event.target.value)
													}
												/>
												<input
													className={styles.input}
													value={config[key]}
													placeholder={fallback}
													onChange={event =>
														setField(key, event.target.value)
													}
												/>
											</div>
										</div>
									))}
								</div>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={config.glassEffect}
										onChange={event =>
											setField('glassEffect', event.target.checked)
										}
									/>
									<span>Стеклянный эффект фона</span>
								</label>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Кнопка открытия
								</h3>
								<div className={styles.gridTwo}>
									<div className={styles.field}>
										<p className={styles.label}>Сторона</p>
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
											<option value="left">Слева</option>
											<option value="right">Справа</option>
										</select>
									</div>
									{(
										[
											['buttonBottom', 'Высота от низа, %', 1, 50],
											['buttonOffset', 'Отступ от края, %', 1, 50],
											['buttonSize', 'Размер кнопки, px', 40, 100]
										] as const
									).map(([key, label, min, max]) => (
										<div key={key} className={styles.field}>
											<p className={styles.label}>{label}</p>
											<NumericInput
												className={styles.input}
												min={min}
												max={max}
												value={config[key]}
												onValueChange={value => setField(key, value)}
											/>
										</div>
									))}
								</div>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={config.buttonPulse}
										onChange={event =>
											setField('buttonPulse', event.target.checked)
										}
									/>
									<span>Пульсация кнопки</span>
								</label>
								<div className={styles.buttonImageBox}>
									<div className={styles.buttonImagePreview}>
										<Image
											src={
												config.buttonImageUrl || DEFAULT_BUTTON_IMAGE_URL
											}
											alt="Кнопка калькулятора"
											width={64}
											height={64}
											unoptimized={Boolean(config.buttonImageUrl)}
										/>
									</div>
									<div className={styles.buttonImageContent}>
										<p className={styles.hint}>
											Своя PNG-картинка до 200 КБ доступна на тарифе Hard.
										</p>
										<div className={styles.buttonImageActions}>
											<label
												htmlFor={buttonImageInputId}
												className={`${styles.secondaryBtn} ${!canUseCustomButtonImage || hasUnsavedChanges ? styles.disabled : ''}`}
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
												>
													Сбросить
												</button>
											)}
										</div>
									</div>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Тексты и запуск
								</h3>
								{(
									[
										['title', 'Заголовок'],
										['subtitle', 'Подзаголовок'],
										['calculateButtonText', 'Текст кнопки расчёта'],
										['contactTitle', 'Заголовок формы контакта'],
										['resultTitle', 'Заголовок результата'],
										['bubbleText', 'Текст подсказки у кнопки']
									] as const
								).map(([key, label]) => (
									<div key={key} className={styles.field}>
										<p className={styles.label}>{label}</p>
										<input
											className={styles.input}
											value={config[key]}
											onChange={event => setField(key, event.target.value)}
										/>
									</div>
								))}
								<div className={styles.gridTwo}>
									<div className={styles.field}>
										<p className={styles.label}>Автооткрытие, секунд</p>
										<input
											type="number"
											min={0}
											className={styles.input}
											value={config.autoOpenDelay ?? ''}
											placeholder="Не открывать автоматически"
											onChange={event =>
												setField(
													'autoOpenDelay',
													event.target.value === ''
														? null
														: Math.max(0, Number(event.target.value))
												)
											}
										/>
									</div>
									<label className={styles.checkRow}>
										<input
											type="checkbox"
											checked={config.bubbleEnabled}
											onChange={event =>
												setField('bubbleEnabled', event.target.checked)
											}
										/>
										<span>Показывать подсказку</span>
									</label>
								</div>
							</div>

							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Сбор контакта
								</h3>
								<div className={styles.gridTwo}>
									<div className={styles.field}>
										<p className={styles.label}>Когда собирать контакт</p>
										<select
											className={styles.input}
											value={config.contactPosition}
											onChange={event =>
												setField(
													'contactPosition',
													event.target
														.value as CalculatorConfig['contactPosition']
												)
											}
										>
											<option value="BEFORE_RESULT">
												Перед результатом
											</option>
											<option value="AFTER_RESULT">
												После результата
											</option>
										</select>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Какие контакты собирать</p>
										<select
											className={styles.input}
											value={config.dataType}
											onChange={event =>
												setField(
													'dataType',
													event.target
														.value as CalculatorConfig['dataType']
												)
											}
										>
											<option value="PHONE">Телефон</option>
											<option value="EMAIL">Email</option>
											<option value="PHONE_AND_EMAIL">
												Телефон и Email
											</option>
										</select>
									</div>
								</div>
								<div className={styles.field}>
									<p className={styles.label}>Ссылка на согласие</p>
									<input
										className={styles.input}
										value={config.privacyUrl}
										onChange={event =>
											setField('privacyUrl', event.target.value)
										}
									/>
								</div>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={config.filterDuplicates}
										onChange={event =>
											setField('filterDuplicates', event.target.checked)
										}
									/>
									<span>Не сохранять повторные контакты</span>
								</label>
								<label className={styles.checkRow}>
									<input
										type="checkbox"
										checked={config.developInfoActive}
										onChange={event =>
											setField('developInfoActive', event.target.checked)
										}
									/>
									<span>Показывать ссылку на Winwidget</span>
								</label>
							</div>
						</div>
					)}

					{tab === 'fields' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Параметры расчёта
								</h3>
								<p className={styles.infoText}>
									Поля показываются посетителю в указанном порядке. Для
									выбора и чекбокса настройте надбавку и множитель, для
									числа — цену за единицу.
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
											<p className={styles.label}>Название поля</p>
											<input
												className={styles.input}
												value={field.label}
												onChange={event =>
													updateCalculatorField(fieldIndex, {
														label: event.target.value
													})
												}
											/>
										</div>
										<div className={styles.field}>
											<p className={styles.label}>Тип</p>
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
												<option value="select">Выбор</option>
												<option value="number">Число</option>
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
										<span>Обязательное поле</span>
									</label>

									{(field.type === 'select' ||
										field.type === 'radio' ||
										field.type === 'checkbox') && (
										<div className={styles.optionList}>
											{(field.options || []).map((option, optionIndex) => (
												<div key={option.id} className={styles.optionRow}>
													<input
														className={styles.input}
														value={option.label}
														placeholder="Название варианта"
														onChange={event =>
															updateOption(fieldIndex, optionIndex, {
																label: event.target.value
															})
														}
													/>
													<div className={styles.compactField}>
														<span>Надбавка</span>
														<NumericInput
															className={styles.input}
															aria-label={`Надбавка для варианта ${option.label}`}
															value={option.add}
															onValueChange={value =>
																updateOption(fieldIndex, optionIndex, {
																	add: value
																})
															}
														/>
													</div>
													<div className={styles.compactField}>
														<span>Множитель</span>
														<NumericInput
															min={0.01}
															step={0.01}
															className={styles.input}
															aria-label={`Множитель для варианта ${option.label}`}
															value={option.multiplier}
															onValueChange={value =>
																updateOption(fieldIndex, optionIndex, {
																	multiplier: value
																})
															}
														/>
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
												type="button"
												className={styles.secondaryBtn}
												onClick={() => addOption(fieldIndex)}
											>
												Добавить вариант
											</button>
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
													<p className={styles.label}>{label}</p>
													<NumericInput
														className={styles.input}
														value={field[key] ?? 0}
														onValueChange={value =>
															updateCalculatorField(fieldIndex, {
																[key]: value
															})
														}
													/>
												</div>
											))}
											<div className={styles.field}>
												<p className={styles.label}>Единица</p>
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
								type="button"
								className={styles.addBtn}
								onClick={addCalculatorField}
							>
								Добавить поле
							</button>
						</div>
					)}

					{tab === 'calculation' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Формула</h3>
								<p className={styles.infoText}>
									Итог = (базовая стоимость + надбавки + значения числовых
									полей × цена за единицу) × множители. После этого
									результат округляется с указанным шагом.
								</p>
								<div className={styles.gridThree}>
									<div className={styles.field}>
										<p className={styles.label}>Базовая стоимость</p>
										<NumericInput
											min={0}
											className={styles.input}
											value={config.basePrice}
											onValueChange={value => setField('basePrice', value)}
										/>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Валюта</p>
										<input
											className={styles.input}
											value={config.currency}
											onChange={event =>
												setField('currency', event.target.value)
											}
											maxLength={10}
											placeholder="RUB"
										/>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>Шаг округления</p>
										<NumericInput
											min={0.01}
											step={0.01}
											className={styles.input}
											value={config.roundingStep}
											onValueChange={value =>
												setField('roundingStep', value)
											}
										/>
									</div>
								</div>
							</div>
						</div>
					)}

					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Получение заявок
								</h3>
								{(
									[
										['email', 'Email для уведомлений', 'mail@example.ru'],
										['telegramChatId', 'Telegram Chat ID', '123456789'],
										[
											'webhookUrl',
											'Webhook URL',
											'https://example.ru/webhook'
										],
										[
											'bitrix24WebhookUrl',
											'Битрикс24 — входящий webhook',
											'https://company.bitrix24.ru/rest/...'
										],
										['amoCrmDomain', 'amoCRM — домен', 'company.amocrm.ru']
									] as const
								).map(([key, label, placeholder]) => (
									<div key={key} className={styles.field}>
										<p className={styles.label}>{label}</p>
										<input
											className={styles.input}
											value={String(config.integrations[key] || '')}
											placeholder={placeholder}
											onChange={event =>
												setIntegration(key, event.target.value)
											}
										/>
									</div>
								))}
								<div className={styles.field}>
									<p className={styles.label}>amoCRM — токен доступа</p>
									<input
										type="password"
										className={styles.input}
										value={config.integrations.amoCrmToken || ''}
										onChange={event =>
											setIntegration('amoCrmToken', event.target.value)
										}
									/>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>Аналитика</h3>
								<div className={styles.gridTwo}>
									<div className={styles.field}>
										<p className={styles.label}>Яндекс Метрика — ID</p>
										<input
											className={styles.input}
											value={config.integrations.yandexMetrikaId || ''}
											onChange={event =>
												setIntegration(
													'yandexMetrikaId',
													event.target.value
												)
											}
										/>
									</div>
									<div className={styles.field}>
										<p className={styles.label}>VK — ID пикселя</p>
										<input
											className={styles.input}
											value={config.integrations.vkPixelId || ''}
											onChange={event =>
												setIntegration('vkPixelId', event.target.value)
											}
										/>
									</div>
								</div>
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
									<span>Отправлять цели в Roistat</span>
								</label>
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
									<p className={styles.label}>Домен установки</p>
									<input
										className={styles.input}
										value={installDomain}
										placeholder="site.ru"
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
									<p className={styles.label}>Код виджета</p>
									<textarea
										className={`${styles.input} ${styles.codeArea}`}
										value={scriptCode}
										readOnly
									/>
									<button
										type="button"
										className={styles.secondaryBtn}
										onClick={() => {
											navigator.clipboard.writeText(scriptCode)
											toast.success('Код скопирован')
										}}
									>
										Копировать код
									</button>
								</div>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Прямая ссылка
								</h3>
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
									onClick={() => {
										navigator.clipboard.writeText(directLink)
										toast.success('Ссылка скопирована')
									}}
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
								<h3 className={styles.settingsGroupTitle}>
									Как работает калькулятор
								</h3>
								<ul className={styles.infoList}>
									<li>Посетитель заполняет настроенные поля.</li>
									<li>
										Калькулятор применяет надбавки, цену за единицу и
										множители без выполнения пользовательского JavaScript.
									</li>
									<li>
										Контакт запрашивается до или после результата — в
										зависимости от выбранной настройки.
									</li>
									<li>
										Заявка, параметры и итоговая стоимость сохраняются в
										единой странице заявок кабинета.
									</li>
								</ul>
							</div>
							<div className={styles.settingsGroup}>
								<h3 className={styles.settingsGroupTitle}>
									Перед запуском
								</h3>
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
							onClick={onClose}
							disabled={saveMutation.isPending}
						>
							Отмена
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
			</div>
		</div>
	)
}

export default CalculatorSettingsModal
