'use client'

import { quizService } from '@/entities/site-widget'
import {
	Quiz,
	QuizConfig,
	QuizOption,
	QuizQuestion,
	QuizResult
} from '@/entities/site-widget'
import ConfirmDialog from '@/shared/ui/confirm-dialog/ConfirmDialog'
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
import useWidgetSettingsCloseGuard from '../shared/useWidgetSettingsCloseGuard'
import WidgetLivePreview from '../shared/WidgetLivePreview'
import WidgetPresetButtons from '../shared/WidgetPresetButtons'
import pageStyles from '../shared/WidgetSettingsModal.module.scss'
import type {
	WidgetSettingsPersistence,
	WidgetSettingsPresentationProps
} from '../shared/WidgetSettingsPersistence'
import WidgetSettingsPreviewPortal from '../shared/WidgetSettingsPreviewPortal'
import styles from './QuizSettingsModal.module.scss'

type Tab =
	| 'main'
	| 'questions'
	| 'results'
	| 'integrations'
	| 'code'
	| 'info'
type EditableTab = Exclude<Tab, 'code' | 'info'>
type ScoreMode = 'simple' | 'advanced'
type QuizTemplateKey = 'tariff' | 'service' | 'discount' | 'diagnostic'
const BUTTON_IMAGE_MAX_SIZE_BYTES = 200 * 1024

interface ValidationIssue {
	tab: Tab
	fieldId: string
	message: string
}

const QUIZ_TEMPLATE_LABELS: Record<QuizTemplateKey, string> = {
	tariff: 'Подбор тарифа',
	service: 'Подбор услуги',
	discount: 'Квиз для скидки',
	diagnostic: 'Диагностика потребности'
}

interface Props extends WidgetSettingsPresentationProps {
	quiz: Quiz
	canUseCustomButtonImage: boolean
	onClose: () => void
	onSaved: (updated: Quiz) => void
	persistence?: WidgetSettingsPersistence<Quiz, QuizConfig>
}

const makeId = () => Math.random().toString(36).slice(2, 9)

const clampNumber = (
	value: number,
	min: number,
	max: number,
	fallback: number
) => {
	const numeric = Number.isFinite(value) ? value : fallback
	return Math.min(max, Math.max(min, numeric))
}

const isHttpUrl = (value: string) => {
	try {
		const url = new URL(value)
		return url.protocol === 'http:' || url.protocol === 'https:'
	} catch {
		return false
	}
}

const makeScoredOption = (
	text: string,
	resultIds: string[],
	winnerId: string
): QuizOption => ({
	id: `o${makeId()}`,
	text,
	scores: Object.fromEntries(
		resultIds.map(resultId => [resultId, resultId === winnerId ? 10 : 0])
	)
})

const DEFAULT_CONFIG: QuizConfig = {
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
	bubbleEnabled: true,
	bubbleText: 'Пройдите квиз!',
	autoOpenDelay: null,
	title: 'Пройдите наш квиз!',
	subtitle:
		'Ответьте на несколько вопросов и получите персональную рекомендацию',
	buttonText: 'Начать квиз',
	contactTitle: 'Оставьте контакт для получения результата',
	dataType: 'PHONE',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	developInfoActive: true,
	filterDuplicates: false,
	alreadyPlayedTitle: '🎉 Вы уже проходили этот квиз!',
	alreadyPlayedSubtitle:
		'Каждый посетитель может пройти квиз только один раз',
	hideIfPlayed: false,
	quizCooldownDays: 0,
	quizResetToken: '',
	questions: [
		{
			id: 'q1',
			text: 'Вопрос 1',
			type: 'radio',
			options: [
				{ id: 'q1o1', text: 'Вариант А', scores: { r1: 1, r2: 0 } },
				{ id: 'q1o2', text: 'Вариант Б', scores: { r1: 0, r2: 1 } }
			]
		},
		{
			id: 'q2',
			text: 'Вопрос 2',
			type: 'radio',
			options: [
				{ id: 'q2o1', text: 'Вариант А', scores: { r1: 1, r2: 0 } },
				{ id: 'q2o2', text: 'Вариант Б', scores: { r1: 0, r2: 1 } }
			]
		},
		{
			id: 'q3',
			text: 'Вопрос 3',
			type: 'radio',
			options: [
				{ id: 'q3o1', text: 'Вариант А', scores: { r1: 1, r2: 0 } },
				{ id: 'q3o2', text: 'Вариант Б', scores: { r1: 0, r2: 1 } }
			]
		},
		{
			id: 'q4',
			text: 'Вопрос 4',
			type: 'radio',
			options: [
				{ id: 'q4o1', text: 'Вариант А', scores: { r1: 1, r2: 0 } },
				{ id: 'q4o2', text: 'Вариант Б', scores: { r1: 0, r2: 1 } }
			]
		}
	],
	results: [
		{
			id: 'r1',
			title: 'Результат A',
			description: 'Опишите здесь что получит клиент с таким профилем.',
			promoCode: '',
			buttonText: '',
			buttonUrl: ''
		},
		{
			id: 'r2',
			title: 'Результат B',
			description: 'Опишите здесь что получит клиент с таким профилем.',
			promoCode: '',
			buttonText: '',
			buttonUrl: ''
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

const buildQuizTemplate = (
	template: QuizTemplateKey
): Pick<
	QuizConfig,
	| 'title'
	| 'subtitle'
	| 'buttonText'
	| 'contactTitle'
	| 'results'
	| 'questions'
> => {
	const resultIds = [`r${makeId()}`, `r${makeId()}`]

	if (template === 'tariff') {
		const results: QuizResult[] = [
			{
				id: resultIds[0],
				title: 'Вам подойдёт базовый тариф',
				description:
					'Подходит для старта, проверки спроса и небольшого потока заявок.',
				promoCode: '',
				buttonText: '',
				buttonUrl: ''
			},
			{
				id: resultIds[1],
				title: 'Вам подойдёт расширенный тариф',
				description:
					'Подходит для активного продвижения, аналитики и большего объёма заявок.',
				promoCode: '',
				buttonText: '',
				buttonUrl: ''
			}
		]

		return {
			title: 'Подберите подходящий тариф',
			subtitle:
				'Ответьте на пару вопросов, и мы предложим оптимальный вариант',
			buttonText: 'Подобрать тариф',
			contactTitle: 'Оставьте контакт, чтобы получить рекомендацию',
			results,
			questions: [
				{
					id: `q${makeId()}`,
					text: 'Какой у вас ожидаемый поток заявок?',
					type: 'radio',
					options: [
						makeScoredOption(
							'До 100 заявок в месяц',
							resultIds,
							resultIds[0]
						),
						makeScoredOption(
							'Больше 100 заявок в месяц',
							resultIds,
							resultIds[1]
						)
					]
				},
				{
					id: `q${makeId()}`,
					text: 'Нужна ли расширенная аналитика?',
					type: 'radio',
					options: [
						makeScoredOption(
							'Пока достаточно базовой',
							resultIds,
							resultIds[0]
						),
						makeScoredOption(
							'Да, хочу видеть больше данных',
							resultIds,
							resultIds[1]
						)
					]
				}
			]
		}
	}

	if (template === 'service') {
		const results: QuizResult[] = [
			{
				id: resultIds[0],
				title: 'Вам подойдёт консультация',
				description:
					'Начнём с диагностики задачи и предложим понятный план дальнейших действий.',
				promoCode: '',
				buttonText: '',
				buttonUrl: ''
			},
			{
				id: resultIds[1],
				title: 'Вам подойдёт комплексная услуга',
				description:
					'Возьмём задачу под ключ: от настройки до запуска и сопровождения.',
				promoCode: '',
				buttonText: '',
				buttonUrl: ''
			}
		]

		return {
			title: 'Подберите услугу под вашу задачу',
			subtitle: 'Ответьте на вопросы, чтобы получить точную рекомендацию',
			buttonText: 'Подобрать услугу',
			contactTitle: 'Куда отправить рекомендацию?',
			results,
			questions: [
				{
					id: `q${makeId()}`,
					text: 'Насколько задача уже понятна?',
					type: 'radio',
					options: [
						makeScoredOption(
							'Нужна помощь с выбором',
							resultIds,
							resultIds[0]
						),
						makeScoredOption(
							'Нужно быстро запустить решение',
							resultIds,
							resultIds[1]
						)
					]
				},
				{
					id: `q${makeId()}`,
					text: 'Какой формат вам удобнее?',
					type: 'radio',
					options: [
						makeScoredOption(
							'Сначала обсудить детали',
							resultIds,
							resultIds[0]
						),
						makeScoredOption(
							'Передать задачу специалистам',
							resultIds,
							resultIds[1]
						)
					]
				}
			]
		}
	}

	if (template === 'discount') {
		const results: QuizResult[] = [
			{
				id: resultIds[0],
				title: 'Ваша скидка 10%',
				description:
					'Отличный стартовый бонус. Используйте промокод при оформлении заказа.',
				promoCode: 'SALE10',
				buttonText: '',
				buttonUrl: ''
			},
			{
				id: resultIds[1],
				title: 'Ваша скидка 20%',
				description:
					'Максимальный бонус за подходящие ответы. Промокод уже ждёт вас.',
				promoCode: 'SALE20',
				buttonText: '',
				buttonUrl: ''
			}
		]

		return {
			title: 'Ответьте на вопросы и получите скидку',
			subtitle: 'Размер скидки зависит от ваших ответов',
			buttonText: 'Получить скидку',
			contactTitle: 'Оставьте контакт, чтобы забрать промокод',
			results,
			questions: [
				{
					id: `q${makeId()}`,
					text: 'Когда планируете покупку?',
					type: 'radio',
					options: [
						makeScoredOption(
							'Позже, присматриваюсь',
							resultIds,
							resultIds[0]
						),
						makeScoredOption('В ближайшие дни', resultIds, resultIds[1])
					]
				},
				{
					id: `q${makeId()}`,
					text: 'Хотите получить персональное предложение?',
					type: 'radio',
					options: [
						makeScoredOption('Только промокод', resultIds, resultIds[0]),
						makeScoredOption(
							'Да, хочу лучшее предложение',
							resultIds,
							resultIds[1]
						)
					]
				}
			]
		}
	}

	const results: QuizResult[] = [
		{
			id: resultIds[0],
			title: 'Сейчас лучше начать с диагностики',
			description:
				'Сначала стоит уточнить потребности и ограничения, чтобы не переплачивать за лишнее.',
			promoCode: '',
			buttonText: '',
			buttonUrl: ''
		},
		{
			id: resultIds[1],
			title: 'Вы готовы к внедрению',
			description:
				'По ответам видно, что можно переходить к подбору решения и запуску.',
			promoCode: '',
			buttonText: '',
			buttonUrl: ''
		}
	]

	return {
		title: 'Диагностика потребности',
		subtitle: 'Ответьте на вопросы, чтобы понять лучший следующий шаг',
		buttonText: 'Пройти диагностику',
		contactTitle: 'Оставьте контакт, чтобы получить вывод',
		results,
		questions: [
			{
				id: `q${makeId()}`,
				text: 'Есть ли уже выбранное решение?',
				type: 'radio',
				options: [
					makeScoredOption('Нет, пока выбираю', resultIds, resultIds[0]),
					makeScoredOption('Да, нужно внедрить', resultIds, resultIds[1])
				]
			},
			{
				id: `q${makeId()}`,
				text: 'Как быстро нужен результат?',
				type: 'radio',
				options: [
					makeScoredOption(
						'Можно спокойно разобраться',
						resultIds,
						resultIds[0]
					),
					makeScoredOption(
						'Нужно как можно быстрее',
						resultIds,
						resultIds[1]
					)
				]
			}
		]
	}
}

const QuizSettingsModal = ({
	quiz,
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
	const [tab, setTab] = useState<Tab>('main')
	const [config, setConfig] = useState<QuizConfig>({ ...quiz.config })
	const [name, setName] = useState(quiz.name)
	const [installDomain, setInstallDomain] = useState(
		quiz.installDomain ?? ''
	)
	const draftRevisionRef = useRef(quiz.draftRevision)
	const [scoreMode, setScoreMode] = useState<ScoreMode>('simple')
	const titleId = useId()
	const buttonImageInputId = useId()
	const [confirmResetAttempts, setConfirmResetAttempts] = useState(false)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)
	const [confirmResetSection, setConfirmResetSection] =
		useState<EditableTab | null>(null)
	const [pendingTemplate, setPendingTemplate] =
		useState<QuizTemplateKey | null>(null)
	const [validationIssue, setValidationIssue] =
		useState<ValidationIssue | null>(null)
	const [savedSnapshot, setSavedSnapshot] = useState(
		JSON.stringify({
			name: quiz.name,
			installDomain: quiz.installDomain ?? '',
			config: quiz.config
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
		mutationFn: (data: {
			name: string
			installDomain?: string
			config: QuizConfig
		}) =>
			(
				persistence?.update ??
				(payload => quizService.updateQuiz(quiz.id, payload))
			)({
				...data,
				installDomain: data.installDomain ?? installDomain,
				expectedDraftRevision: draftRevisionRef.current
			}),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			toast.success('Сохранено', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setConfig(updated.config)
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

	const resetAttemptsMutation = useMutation({
		mutationFn: (newToken: string) =>
			(
				persistence?.update ??
				(payload => quizService.updateQuiz(quiz.id, payload))
			)({
				name,
				config: { ...config, quizResetToken: newToken },
				expectedDraftRevision: draftRevisionRef.current
			}),
		onMutate: () =>
			toast.loading('Сохраняем сброс в черновик, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			toast.success(
				'Сброс сохранён в черновик; вступит в силу после публикации',
				{ id: toastId }
			)
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setConfig(updated.config)
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
			reportMutationError(error, 'Ошибка сброса', toastId)
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
				: quizService.uploadButtonImage(quiz.id, formData)
		},
		onMutate: () =>
			toast.loading('Загружаем картинку кнопки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			draftRevisionRef.current = updated.draftRevision
			toast.success('Картинка кнопки обновлена', { id: toastId })
			setName(updated.name)
			setInstallDomain(updated.installDomain ?? '')
			setConfig(updated.config)
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
		saveMutation.isPending ||
		resetAttemptsMutation.isPending ||
		buttonImageMutation.isPending
	const { requestClose, closeGuardDialog } = useWidgetSettingsCloseGuard({
		hasUnsavedChanges,
		isBusy: isDangerActionPending,
		onClose
	})
	const isPagePresentation = presentation === 'page'

	const setField = <K extends keyof QuizConfig>(
		key: K,
		value: QuizConfig[K]
	) => {
		setValidationIssue(null)
		setConfig(prev => ({ ...prev, [key]: value }))
	}

	const setIntegration = (
		key: keyof QuizConfig['integrations'],
		value: any
	) => {
		setValidationIssue(null)
		setConfig(prev => ({
			...prev,
			integrations: { ...prev.integrations, [key]: value }
		}))
	}

	const getValidationFieldId = (suffix: string) => `${titleId}-${suffix}`

	const isValidationFieldInvalid = (fieldId: string) =>
		validationIssue?.fieldId === fieldId

	const getValidationDescriptionId = (fieldId: string) =>
		isValidationFieldInvalid(fieldId) ? `${fieldId}-error` : undefined

	const renderValidationError = (fieldId: string) =>
		isValidationFieldInvalid(fieldId) ? (
			<p
				id={`${fieldId}-error`}
				className={pageStyles.fieldError}
				role="alert"
			>
				{validationIssue?.message}
			</p>
		) : null

	const reportValidationIssue = (issue: ValidationIssue) => {
		setValidationIssue(issue)
		setTab(issue.tab)
		toast.error(issue.message)

		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				const field = document.getElementById(issue.fieldId)
				if (!field) return
				field.closest('details')?.setAttribute('open', '')
				field.scrollIntoView({ behavior: 'smooth', block: 'center' })
				field.focus({ preventScroll: true })
			})
		})
	}

	const setBlurValidationIssue = (
		issue: ValidationIssue | null,
		fieldId: string
	) => {
		setValidationIssue(
			previous =>
				issue ?? (previous?.fieldId === fieldId ? null : previous)
		)
	}

	// --- Questions helpers ---

	const addQuestion = () => {
		if (config.questions.length >= 10) return
		setValidationIssue(null)
		const newId = `q${makeId()}`
		const initialScores: Record<string, number> = {}
		for (const r of config.results) initialScores[r.id] = 0

		const newQ: QuizQuestion = {
			id: newId,
			text: '',
			type: 'radio',
			options: [
				{
					id: `${newId}o${makeId()}`,
					text: '',
					scores: { ...initialScores }
				},
				{
					id: `${newId}o${makeId()}`,
					text: '',
					scores: { ...initialScores }
				}
			]
		}
		setConfig(prev => ({ ...prev, questions: [...prev.questions, newQ] }))
	}

	const removeQuestion = (qIdx: number) => {
		if (config.questions.length <= 1) return
		setValidationIssue(null)
		setConfig(prev => ({
			...prev,
			questions: prev.questions.filter((_, i) => i !== qIdx)
		}))
	}

	const updateQuestion = (
		qIdx: number,
		field: keyof QuizQuestion,
		value: any
	) => {
		setValidationIssue(null)
		setConfig(prev => {
			const questions = [...prev.questions]
			questions[qIdx] = { ...questions[qIdx], [field]: value }
			return { ...prev, questions }
		})
	}

	const addOption = (qIdx: number) => {
		if (config.questions[qIdx].options.length >= 4) return
		setValidationIssue(null)
		const initialScores: Record<string, number> = {}
		for (const r of config.results) initialScores[r.id] = 0

		const q = config.questions[qIdx]
		const newOpt: QuizOption = {
			id: `${q.id}o${makeId()}`,
			text: '',
			scores: { ...initialScores }
		}
		setConfig(prev => {
			const questions = [...prev.questions]
			questions[qIdx] = {
				...questions[qIdx],
				options: [...questions[qIdx].options, newOpt]
			}
			return { ...prev, questions }
		})
	}

	const removeOption = (qIdx: number, oIdx: number) => {
		if (config.questions[qIdx].options.length <= 2) return
		setValidationIssue(null)
		setConfig(prev => {
			const questions = [...prev.questions]
			questions[qIdx] = {
				...questions[qIdx],
				options: questions[qIdx].options.filter((_, i) => i !== oIdx)
			}
			return { ...prev, questions }
		})
	}

	const updateOption = (
		qIdx: number,
		oIdx: number,
		field: keyof QuizOption,
		value: any
	) => {
		setValidationIssue(null)
		setConfig(prev => {
			const questions = [...prev.questions]
			const options = [...questions[qIdx].options]
			options[oIdx] = { ...options[oIdx], [field]: value }
			questions[qIdx] = { ...questions[qIdx], options }
			return { ...prev, questions }
		})
	}

	const updateScore = (
		qIdx: number,
		oIdx: number,
		resultId: string,
		pts: number
	) => {
		setValidationIssue(null)
		setConfig(prev => {
			const questions = [...prev.questions]
			const options = [...questions[qIdx].options]
			options[oIdx] = {
				...options[oIdx],
				scores: { ...options[oIdx].scores, [resultId]: pts }
			}
			questions[qIdx] = { ...questions[qIdx], options }
			return { ...prev, questions }
		})
	}

	const getLeadingResultId = (option: QuizOption) => {
		let winnerId = config.results[0]?.id || ''
		let maxScore = -Infinity

		for (const result of config.results) {
			const score = option.scores[result.id] ?? 0
			if (score > maxScore) {
				maxScore = score
				winnerId = result.id
			}
		}

		return winnerId
	}

	const setOptionWinner = (
		qIdx: number,
		oIdx: number,
		winnerId: string
	) => {
		setValidationIssue(null)
		setConfig(prev => {
			const questions = [...prev.questions]
			const options = [...questions[qIdx].options]
			options[oIdx] = {
				...options[oIdx],
				scores: Object.fromEntries(
					prev.results.map(result => [
						result.id,
						result.id === winnerId ? 10 : 0
					])
				)
			}
			questions[qIdx] = { ...questions[qIdx], options }
			return { ...prev, questions }
		})
	}

	// --- Results helpers ---

	const addResult = () => {
		if (config.results.length >= 5) return
		setValidationIssue(null)
		const newId = `r${makeId()}`
		const newResult: QuizResult = {
			id: newId,
			title: '',
			description: '',
			promoCode: '',
			buttonText: '',
			buttonUrl: ''
		}
		// Add score=0 for new result in every option of every question
		setConfig(prev => {
			const questions = prev.questions.map(q => ({
				...q,
				options: q.options.map(o => ({
					...o,
					scores: { ...o.scores, [newId]: 0 }
				}))
			}))
			return { ...prev, results: [...prev.results, newResult], questions }
		})
	}

	const removeResult = (rIdx: number) => {
		if (config.results.length <= 2) return
		setValidationIssue(null)
		const removedId = config.results[rIdx].id
		setConfig(prev => {
			const results = prev.results.filter((_, i) => i !== rIdx)
			const questions = prev.questions.map(q => ({
				...q,
				options: q.options.map(o => {
					const scores = { ...o.scores }
					delete scores[removedId]
					return { ...o, scores }
				})
			}))
			return { ...prev, results, questions }
		})
	}

	const updateResult = (
		rIdx: number,
		field: keyof QuizResult,
		value: string
	) => {
		setValidationIssue(null)
		setConfig(prev => {
			const results = [...prev.results]
			results[rIdx] = { ...results[rIdx], [field]: value }
			return { ...prev, results }
		})
	}

	const applyPendingTemplate = () => {
		if (!pendingTemplate) return

		const templateConfig = buildQuizTemplate(pendingTemplate)
		const templateLabel = QUIZ_TEMPLATE_LABELS[pendingTemplate]
		setValidationIssue(null)
		setConfig(prev => ({
			...prev,
			...templateConfig
		}))
		setPendingTemplate(null)
		setTab('questions')
		toast.success(`Шаблон «${templateLabel}» применён`)
	}

	// ---

	const getColorValidationIssue = (path: string): ValidationIssue => {
		const fieldIds: Partial<Record<keyof QuizConfig, string>> = {
			color: getValidationFieldId('color'),
			bgColor: getValidationFieldId('bg-color'),
			buttonColor: getValidationFieldId('button-color'),
			openButtonColor: getValidationFieldId('open-button-color')
		}

		return {
			tab: 'main',
			fieldId:
				fieldIds[path as keyof QuizConfig] ??
				getValidationFieldId('color'),
			message: 'Введите цвет в формате #RRGGBB'
		}
	}

	const handleResetSection = () => {
		if (!confirmResetSection) return

		setConfig(previous => {
			if (confirmResetSection === 'questions') {
				return {
					...previous,
					questions: DEFAULT_CONFIG.questions.map(question => ({
						...question,
						options: question.options.map(option => ({
							...option,
							scores: { ...option.scores }
						}))
					}))
				}
			}

			if (confirmResetSection === 'results') {
				return {
					...previous,
					results: DEFAULT_CONFIG.results.map(result => ({ ...result }))
				}
			}

			if (confirmResetSection === 'integrations') {
				return {
					...previous,
					integrations: { ...DEFAULT_CONFIG.integrations }
				}
			}

			return {
				...DEFAULT_CONFIG,
				questions: previous.questions,
				results: previous.results,
				integrations: previous.integrations,
				quizResetToken: previous.quizResetToken
			}
		})
		setValidationIssue(null)
		setConfirmResetSection(null)
		toast.success('Раздел сброшен в черновике; сохраните черновик')
	}

	const handleSave = () => {
		const invalidColor = !isWidgetHexColor(config.color)
			? 'color'
			: findInvalidWidgetColor(config)
		if (invalidColor) {
			reportValidationIssue(getColorValidationIssue(invalidColor))
			return
		}

		if (!name.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('name'),
				message: 'Укажите название виджета'
			})
			return
		}

		if ((config.bubbleEnabled ?? true) && !config.bubbleText.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('bubble-text'),
				message: 'Укажите текст облачка или отключите его'
			})
			return
		}

		if (!config.title.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('title'),
				message: 'Укажите заголовок квиза'
			})
			return
		}

		if (!config.buttonText.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('button-text'),
				message: 'Укажите текст кнопки запуска'
			})
			return
		}

		if (config.dataType !== 'NONE' && !config.contactTitle.trim()) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('contact-title'),
				message: 'Укажите заголовок экрана контакта'
			})
			return
		}

		if (
			config.dataType !== 'NONE' &&
			(!config.privacyUrl.trim() || !isHttpUrl(config.privacyUrl))
		) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('privacy-url'),
				message: 'Укажите полную ссылку на политику с http:// или https://'
			})
			return
		}

		const bottom = config.buttonBottom
		if (!bottom || bottom < 1 || bottom > 50) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('button-bottom'),
				message: 'Высота кнопки: выберите значение от 1 до 50%'
			})
			return
		}

		const cooldown = config.quizCooldownDays ?? 0
		if (cooldown < 0 || cooldown > 365) {
			reportValidationIssue({
				tab: 'main',
				fieldId: getValidationFieldId('cooldown'),
				message:
					'Повторное прохождение: выберите значение от 0 до 365 дней'
			})
			return
		}

		if (config.questions.length < 1) {
			reportValidationIssue({
				tab: 'questions',
				fieldId: getValidationFieldId('questions-add'),
				message: 'Добавьте хотя бы один вопрос'
			})
			return
		}

		for (
			let questionIndex = 0;
			questionIndex < config.questions.length;
			questionIndex += 1
		) {
			const question = config.questions[questionIndex]
			if (!question.text.trim()) {
				reportValidationIssue({
					tab: 'questions',
					fieldId: getValidationFieldId(`question-${question.id}-text`),
					message: `Вопрос ${questionIndex + 1}: заполните текст вопроса`
				})
				return
			}

			const emptyOptionIndex = question.options.findIndex(
				option => !option.text.trim()
			)
			if (emptyOptionIndex !== -1) {
				const option = question.options[emptyOptionIndex]
				reportValidationIssue({
					tab: 'questions',
					fieldId: getValidationFieldId(
						`question-${question.id}-option-${option.id}`
					),
					message: `Вопрос ${questionIndex + 1}, вариант ${emptyOptionIndex + 1}: заполните текст`
				})
				return
			}
		}

		if (config.results.length < 2) {
			reportValidationIssue({
				tab: 'results',
				fieldId: getValidationFieldId('results-add'),
				message: 'Добавьте минимум 2 результата'
			})
			return
		}

		for (let i = 0; i < config.results.length; i++) {
			const r = config.results[i]
			if (!r.title.trim()) {
				reportValidationIssue({
					tab: 'results',
					fieldId: getValidationFieldId(`result-${r.id}-title`),
					message: `Результат ${i + 1}: заполните заголовок`
				})
				return
			}

			const hasText = r.buttonText.trim() !== ''
			const hasUrl = r.buttonUrl.trim() !== ''
			if (hasText && !hasUrl) {
				reportValidationIssue({
					tab: 'results',
					fieldId: getValidationFieldId(`result-${r.id}-button-url`),
					message: `Результат ${i + 1}: заполните ссылку кнопки или уберите текст кнопки`
				})
				return
			}
			if (hasUrl && !hasText) {
				reportValidationIssue({
					tab: 'results',
					fieldId: getValidationFieldId(`result-${r.id}-button-text`),
					message: `Результат ${i + 1}: заполните текст кнопки или уберите ссылку`
				})
				return
			}
			if (hasUrl && !isHttpUrl(r.buttonUrl)) {
				reportValidationIssue({
					tab: 'results',
					fieldId: getValidationFieldId(`result-${r.id}-button-url`),
					message: `Результат ${i + 1}: укажите полную ссылку с http:// или https://`
				})
				return
			}
		}

		const webhookUrl = config.integrations.webhookUrl?.trim() || ''
		if (
			config.dataType !== 'NONE' &&
			webhookUrl &&
			!isHttpUrl(webhookUrl)
		) {
			reportValidationIssue({
				tab: 'integrations',
				fieldId: getValidationFieldId('integration-webhook-url'),
				message: 'Укажите полный URL webhook с http:// или https://'
			})
			return
		}

		const bitrix24WebhookUrl =
			config.integrations.bitrix24WebhookUrl?.trim() || ''
		if (
			config.dataType !== 'NONE' &&
			bitrix24WebhookUrl &&
			!isHttpUrl(bitrix24WebhookUrl)
		) {
			reportValidationIssue({
				tab: 'integrations',
				fieldId: getValidationFieldId('integration-bitrix24-url'),
				message: 'Укажите полный URL Bitrix24 с http:// или https://'
			})
			return
		}

		setValidationIssue(null)
		const sanitizedName = name.trim()
		setName(sanitizedName)
		saveMutation.mutate({ name: sanitizedName, installDomain, config })
	}

	const handleResetAttempts = () => {
		if (hasUnsavedChanges) {
			toast.error('Сначала сохраните текущие настройки виджета')
			return
		}

		resetAttemptsMutation.mutate(makeId())
		setConfirmResetAttempts(false)
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
	const scriptCode = `<script src="${apiUrl}/widgets/quiz.js" data-key="${quiz.publicKey}" async></script>`
	const directLink = `${publicSiteUrl}/page-quiz/${quiz.publicKey}`
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
	const defaultButtonImageUrl = `${apiUrl}/widgets/quiz-button.png`
	const buttonImagePreviewUrl =
		config.buttonImageUrl || defaultButtonImageUrl
	const buttonImageUploadDisabled =
		!canUseCustomButtonImage ||
		hasUnsavedChanges ||
		buttonImageMutation.isPending

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
			name: name.trim() || 'Квиз',
			config: nextConfig
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
					aria-label="Закрыть настройки квиза"
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
					Настройки квиза
				</h2>
				{lifecycleActions}

				<div
					className={styles.tabs}
					role="tablist"
					aria-label="Разделы настроек квиза"
				>
					{(
						[
							'main',
							'questions',
							'results',
							'integrations',
							'code',
							'info'
						] as Tab[]
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
							{t === 'main' && 'Основные'}
							{t === 'questions' && `Вопросы (${config.questions.length})`}
							{t === 'results' && `Результаты (${config.results.length})`}
							{t === 'integrations' && 'Интеграции'}
							{t === 'code' && 'Установка'}
							{t === 'info' && 'Проверка'}
						</button>
					))}
				</div>

				<WidgetSettingsPreviewPortal
					inline={!isPagePresentation}
					target={previewPortalTarget}
				>
					<WidgetLivePreview
						type="quiz"
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
					{/* ===== ГЛАВНЫЕ ===== */}
					{tab === 'main' && (
						<div className={styles.fields}>
							<WidgetPresetButtons
								presets={[
									{
										id: 'tariff',
										label: 'Подбор тарифа',
										description: 'Сегментация по объёму и потребностям.'
									},
									{
										id: 'service',
										label: 'Подбор услуги',
										description: 'Рекомендация подходящего формата работы.'
									},
									{
										id: 'discount',
										label: 'Квиз для скидки',
										description: 'Вопросы, результат и готовый промокод.'
									},
									{
										id: 'diagnostic',
										label: 'Диагностика',
										description:
											'Определение готовности клиента к покупке.'
									}
								]}
								onApply={preset =>
									setPendingTemplate(preset as QuizTemplateKey)
								}
							/>
							{pendingTemplate && (
								<div className={styles.dangerItem}>
									<p className={styles.hint}>
										Шаблон «{QUIZ_TEMPLATE_LABELS[pendingTemplate]}»
										заменит тексты, вопросы и результаты. Оформление, домен
										и интеграции сохранятся.
									</p>
									<div className={styles.footerActions}>
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={applyPendingTemplate}
										>
											Применить шаблон
										</button>
										<button
											type="button"
											className={styles.cancelBtn}
											onClick={() => setPendingTemplate(null)}
										>
											Отмена
										</button>
									</div>
								</div>
							)}
							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Внешний вид
									</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Название виджета:</p>
									<input
										id={getValidationFieldId('name')}
										className={`${styles.input} ${
											isValidationFieldInvalid(
												getValidationFieldId('name')
											)
												? pageStyles.inputError
												: ''
										}`}
										value={name}
										onChange={e => {
											setValidationIssue(null)
											setName(e.target.value)
										}}
										onBlur={() => {
											const fieldId = getValidationFieldId('name')
											setBlurValidationIssue(
												name.trim()
													? null
													: {
															tab: 'main',
															fieldId,
															message: 'Укажите название виджета'
														},
												fieldId
											)
										}}
										placeholder="Квиз"
										maxLength={50}
										aria-invalid={isValidationFieldInvalid(
											getValidationFieldId('name')
										)}
										aria-describedby={getValidationDescriptionId(
											getValidationFieldId('name')
										)}
									/>
									{renderValidationError(getValidationFieldId('name'))}
									<p className={styles.hint}>
										Отображается только в вашем кабинете. Посетители это
										название не видят.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Цвет акцентов:</p>
									<div className={styles.colorRow}>
										<input
											type="color"
											className={styles.colorPicker}
											value={getWidgetColorPreview(
												config.color,
												'#4705fb'
											)}
											onChange={e => setField('color', e.target.value)}
										/>
										<input
											id={getValidationFieldId('color')}
											className={`${styles.input} ${
												isValidationFieldInvalid(
													getValidationFieldId('color')
												)
													? pageStyles.inputError
													: ''
											}`}
											value={config.color}
											onChange={e => setField('color', e.target.value)}
											onBlur={() => {
												const fieldId = getValidationFieldId('color')
												setBlurValidationIssue(
													isWidgetHexColor(config.color)
														? null
														: {
																tab: 'main',
																fieldId,
																message: 'Введите цвет в формате #RRGGBB'
															},
													fieldId
												)
											}}
											placeholder="#4705fb"
											maxLength={7}
											aria-invalid={isValidationFieldInvalid(
												getValidationFieldId('color')
											)}
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
									{renderValidationError(getValidationFieldId('color'))}
									<p className={styles.hint}>
										Цвет акцентов: прогресс-бар, кнопки и бейдж результата.
									</p>
								</div>

								<details className={styles.advancedBlock}>
									<summary className={styles.advancedSummary}>
										Тонкая настройка оформления
									</summary>
									<div className={styles.advancedContent}>
										<div className={styles.field}>
											<p className={styles.label}>Цвет фона виджета</p>
											<div className={styles.colorRow}>
												<input
													type="color"
													className={styles.colorPicker}
													value={getWidgetColorPreview(
														config.bgColor,
														'#4705fb'
													)}
													onChange={e =>
														setField('bgColor', e.target.value)
													}
												/>
												<input
													id={getValidationFieldId('bg-color')}
													className={`${styles.input} ${
														isValidationFieldInvalid(
															getValidationFieldId('bg-color')
														)
															? pageStyles.inputError
															: ''
													}`}
													value={config.bgColor || ''}
													onChange={e =>
														setField('bgColor', e.target.value)
													}
													onBlur={() => {
														const fieldId =
															getValidationFieldId('bg-color')
														setBlurValidationIssue(
															!config.bgColor ||
																isWidgetHexColor(config.bgColor)
																? null
																: {
																		tab: 'main',
																		fieldId,
																		message:
																			'Введите цвет в формате #RRGGBB'
																	},
															fieldId
														)
													}}
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
											{renderValidationError(
												getValidationFieldId('bg-color')
											)}
											<p className={styles.hint}>
												Цвет фона карточки квиза. Оставьте пустым для
												стандартного тёмного градиента.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>Цвет кнопки:</p>
											<div className={styles.colorRow}>
												<input
													type="color"
													className={styles.colorPicker}
													value={getWidgetColorPreview(
														config.buttonColor,
														getWidgetColorPreview(config.color, '#4705fb')
													)}
													onChange={e =>
														setField('buttonColor', e.target.value)
													}
												/>
												<input
													id={getValidationFieldId('button-color')}
													className={`${styles.input} ${
														isValidationFieldInvalid(
															getValidationFieldId('button-color')
														)
															? pageStyles.inputError
															: ''
													}`}
													value={config.buttonColor || ''}
													onChange={e =>
														setField('buttonColor', e.target.value)
													}
													onBlur={() => {
														const fieldId =
															getValidationFieldId('button-color')
														setBlurValidationIssue(
															!config.buttonColor ||
																isWidgetHexColor(config.buttonColor)
																? null
																: {
																		tab: 'main',
																		fieldId,
																		message:
																			'Введите цвет в формате #RRGGBB'
																	},
															fieldId
														)
													}}
													placeholder="Как цвет акцентов"
													maxLength={7}
												/>
												{config.buttonColor && (
													<button
														type="button"
														className={styles.inheritColorBtn}
														onClick={() => setField('buttonColor', '')}
													>
														Вернуть цвет акцентов
													</button>
												)}
											</div>
											{renderValidationError(
												getValidationFieldId('button-color')
											)}
											<p className={styles.hint}>
												Цвет кнопок «Далее» и «Получить результат».
												Оставьте пустым, чтобы использовать цвет акцентов.
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
											<p className={styles.label}>Цвет кнопки открытия:</p>
											<div className={styles.colorRow}>
												<input
													type="color"
													className={styles.colorPicker}
													value={getWidgetColorPreview(
														config.openButtonColor,
														getWidgetColorPreview(config.color, '#4705fb')
													)}
													onChange={e =>
														setField('openButtonColor', e.target.value)
													}
												/>
												<input
													id={getValidationFieldId('open-button-color')}
													className={`${styles.input} ${
														isValidationFieldInvalid(
															getValidationFieldId('open-button-color')
														)
															? pageStyles.inputError
															: ''
													}`}
													value={config.openButtonColor || ''}
													onChange={e =>
														setField('openButtonColor', e.target.value)
													}
													onBlur={() => {
														const fieldId = getValidationFieldId(
															'open-button-color'
														)
														setBlurValidationIssue(
															!config.openButtonColor ||
																isWidgetHexColor(config.openButtonColor)
																? null
																: {
																		tab: 'main',
																		fieldId,
																		message:
																			'Введите цвет в формате #RRGGBB'
																	},
															fieldId
														)
													}}
													placeholder="Как цвет акцентов"
													maxLength={7}
												/>
												{config.openButtonColor && (
													<button
														type="button"
														className={styles.inheritColorBtn}
														onClick={() => setField('openButtonColor', '')}
													>
														Вернуть цвет акцентов
													</button>
												)}
											</div>
											{renderValidationError(
												getValidationFieldId('open-button-color')
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
													id="quizPulse"
													type="checkbox"
													checked={config.buttonPulse}
													onChange={e =>
														setField('buttonPulse', e.target.checked)
													}
												/>
												<label
													htmlFor="quizPulse"
													className={styles.checkLabel}
												>
													Включить пульсацию кнопки
												</label>
											</div>
											<p className={styles.hint}>
												Дополнительный эффект свечения на плавающей кнопке
												открытия квиза.
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
												С какой стороны экрана будет показана плавающая
												кнопка открытия квиза.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>Отображение облачка</p>
											<div className={styles.checkRow}>
												<input
													id="quizBubbleEnabled"
													type="checkbox"
													checked={config.bubbleEnabled ?? true}
													onChange={e =>
														setField('bubbleEnabled', e.target.checked)
													}
												/>
												<label
													htmlFor="quizBubbleEnabled"
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
													id={getValidationFieldId('bubble-text')}
													className={`${styles.input} ${
														isValidationFieldInvalid(
															getValidationFieldId('bubble-text')
														)
															? pageStyles.inputError
															: ''
													}`}
													value={config.bubbleText ?? ''}
													onChange={e =>
														setField('bubbleText', e.target.value)
													}
													onBlur={() => {
														const fieldId =
															getValidationFieldId('bubble-text')
														setBlurValidationIssue(
															config.bubbleText.trim()
																? null
																: {
																		tab: 'main',
																		fieldId,
																		message:
																			'Укажите текст облачка или отключите его'
																	},
															fieldId
														)
													}}
													placeholder="Пройдите квиз!"
													maxLength={80}
													aria-invalid={isValidationFieldInvalid(
														getValidationFieldId('bubble-text')
													)}
													aria-describedby={getValidationDescriptionId(
														getValidationFieldId('bubble-text')
													)}
												/>
												{renderValidationError(
													getValidationFieldId('bubble-text')
												)}
												<p className={styles.hint}>
													Подсказка рядом с плавающей кнопкой. Если
													оставить пустым, будет показан стандартный текст.
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
												id={getValidationFieldId('button-bottom')}
												type="range"
												aria-label="Отступ снизу"
												min={1}
												max={50}
												value={config.buttonBottom}
												onChange={e =>
													setField('buttonBottom', Number(e.target.value))
												}
												onBlur={() => {
													const fieldId =
														getValidationFieldId('button-bottom')
													setBlurValidationIssue(
														config.buttonBottom >= 1 &&
															config.buttonBottom <= 50
															? null
															: {
																	tab: 'main',
																	fieldId,
																	message:
																		'Высота кнопки: выберите значение от 1 до 50%'
																},
														fieldId
													)
												}}
												className={pageStyles.rangeInput}
												aria-invalid={isValidationFieldInvalid(
													getValidationFieldId('button-bottom')
												)}
												aria-describedby={getValidationDescriptionId(
													getValidationFieldId('button-bottom')
												)}
											/>
											{renderValidationError(
												getValidationFieldId('button-bottom')
											)}
											<p className={styles.hint}>
												Отступ от нижнего края экрана в процентах. 3 —
												почти внизу, 50 — по центру.
											</p>
										</div>

										<div className={styles.field}>
											<div className={pageStyles.rangeHeader}>
												<p className={styles.label}>Отступ сбоку:</p>
												<span className={pageStyles.rangeValue}>
													{config.buttonOffset ?? 3}%
												</span>
											</div>
											<input
												type="range"
												aria-label="Отступ сбоку"
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
												<p className={styles.label}>
													Размер кнопки открытия:
												</p>
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
												Размер плавающей кнопки открытия квиза в пикселях.
												По умолчанию 60px.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>Автооткрытие:</p>
											<div className={styles.checkRow}>
												<input
													id={`${titleId}-auto-open-enabled`}
													type="checkbox"
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
													Автоматически показывать
												</label>
											</div>
											{config.autoOpenDelay != null && (
												<>
													<div className={pageStyles.rangeHeader}>
														<p className={styles.label}>
															Автооткрытие через:
														</p>
														<span className={pageStyles.rangeValue}>
															{config.autoOpenDelay} сек.
														</span>
													</div>
													<input
														type="range"
														aria-label="Автооткрытие через"
														min={1}
														max={60}
														step={1}
														className={pageStyles.rangeInput}
														value={config.autoOpenDelay}
														onChange={e =>
															setField(
																'autoOpenDelay',
																Number(e.target.value)
															)
														}
													/>
												</>
											)}
											<p className={styles.hint}>
												Через сколько секунд виджет откроется автоматически
												после открытия страницы вашего сайта. Если
												пользователь уже участвовал, автооткрытие не
												сработает.
											</p>
										</div>
									</div>
								</details>
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>Тексты</h3>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Заголовок квиза:</p>
									<input
										id={getValidationFieldId('title')}
										className={`${styles.input} ${
											isValidationFieldInvalid(
												getValidationFieldId('title')
											)
												? pageStyles.inputError
												: ''
										}`}
										value={config.title}
										onChange={e => setField('title', e.target.value)}
										onBlur={() => {
											const fieldId = getValidationFieldId('title')
											setBlurValidationIssue(
												config.title.trim()
													? null
													: {
															tab: 'main',
															fieldId,
															message: 'Укажите заголовок квиза'
														},
												fieldId
											)
										}}
										placeholder="Пройдите наш квиз!"
										maxLength={60}
										aria-invalid={isValidationFieldInvalid(
											getValidationFieldId('title')
										)}
										aria-describedby={getValidationDescriptionId(
											getValidationFieldId('title')
										)}
									/>
									{renderValidationError(getValidationFieldId('title'))}
									<p className={styles.hint}>
										Крупный заголовок на стартовом экране квиза.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Подзаголовок:</p>
									<input
										className={styles.input}
										value={config.subtitle}
										onChange={e => setField('subtitle', e.target.value)}
										placeholder="Ответьте на вопросы и получите результат"
										maxLength={120}
									/>
									<p className={styles.hint}>
										Описание под заголовком на стартовом экране.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Текст кнопки запуска:</p>
									<input
										id={getValidationFieldId('button-text')}
										className={`${styles.input} ${
											isValidationFieldInvalid(
												getValidationFieldId('button-text')
											)
												? pageStyles.inputError
												: ''
										}`}
										value={config.buttonText}
										onChange={e => setField('buttonText', e.target.value)}
										onBlur={() => {
											const fieldId = getValidationFieldId('button-text')
											setBlurValidationIssue(
												config.buttonText.trim()
													? null
													: {
															tab: 'main',
															fieldId,
															message: 'Укажите текст кнопки запуска'
														},
												fieldId
											)
										}}
										placeholder="Начать квиз"
										maxLength={30}
										aria-invalid={isValidationFieldInvalid(
											getValidationFieldId('button-text')
										)}
										aria-describedby={getValidationDescriptionId(
											getValidationFieldId('button-text')
										)}
									/>
									{renderValidationError(
										getValidationFieldId('button-text')
									)}
									<p className={styles.hint}>
										Текст кнопки, с которой начинается прохождение квиза.
									</p>
								</div>

								{config.dataType !== 'NONE' && (
									<div className={styles.field}>
										<p className={styles.label}>
											Заголовок экрана контакта:
										</p>
										<input
											id={getValidationFieldId('contact-title')}
											className={`${styles.input} ${
												isValidationFieldInvalid(
													getValidationFieldId('contact-title')
												)
													? pageStyles.inputError
													: ''
											}`}
											value={config.contactTitle}
											onChange={e =>
												setField('contactTitle', e.target.value)
											}
											onBlur={() => {
												const fieldId =
													getValidationFieldId('contact-title')
												setBlurValidationIssue(
													config.contactTitle.trim()
														? null
														: {
																tab: 'main',
																fieldId,
																message:
																	'Укажите заголовок экрана контакта'
															},
													fieldId
												)
											}}
											placeholder="Оставьте контакт для получения результата"
											maxLength={80}
											aria-invalid={isValidationFieldInvalid(
												getValidationFieldId('contact-title')
											)}
											aria-describedby={getValidationDescriptionId(
												getValidationFieldId('contact-title')
											)}
										/>
										{renderValidationError(
											getValidationFieldId('contact-title')
										)}
										<p className={styles.hint}>
											Заголовок экрана, на котором посетитель оставляет
											свои данные перед показом результата.
										</p>
									</div>
								)}
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Сбор контактов
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
												e.target.value as QuizConfig['dataType']
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
										Какие данные собирать у посетителя в обмен на
										персональный результат.
									</p>
								</div>

								{config.dataType !== 'NONE' && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>
												Ссылка на политику конфиденциальности:
											</p>
											<input
												id={getValidationFieldId('privacy-url')}
												type="url"
												className={`${styles.input} ${
													isValidationFieldInvalid(
														getValidationFieldId('privacy-url')
													)
														? pageStyles.inputError
														: ''
												}`}
												value={config.privacyUrl}
												onChange={e =>
													setField('privacyUrl', e.target.value)
												}
												onBlur={() => {
													const fieldId =
														getValidationFieldId('privacy-url')
													setBlurValidationIssue(
														config.privacyUrl.trim() &&
															isHttpUrl(config.privacyUrl)
															? null
															: {
																	tab: 'main',
																	fieldId,
																	message:
																		'Укажите полную ссылку на политику с http:// или https://'
																},
														fieldId
													)
												}}
												placeholder="https://..."
												maxLength={500}
												aria-invalid={isValidationFieldInvalid(
													getValidationFieldId('privacy-url')
												)}
												aria-describedby={getValidationDescriptionId(
													getValidationFieldId('privacy-url')
												)}
											/>
											{renderValidationError(
												getValidationFieldId('privacy-url')
											)}
											<p className={styles.hint}>
												По умолчанию ведёт на нашу политику. Замените на
												ссылку своей политики конфиденциальности.
											</p>
										</div>

										<details className={styles.advancedBlock}>
											<summary className={styles.advancedSummary}>
												Расширенные настройки
											</summary>

											<div className={styles.advancedContent}>
												<div className={styles.field}>
													<div className={styles.checkRow}>
														<input
															id="quizFilterDuplicates"
															type="checkbox"
															checked={config.filterDuplicates}
															onChange={e =>
																setField(
																	'filterDuplicates',
																	e.target.checked
																)
															}
														/>
														<label
															htmlFor="quizFilterDuplicates"
															className={styles.checkLabel}
														>
															Не сохранять повторные контакты
														</label>
													</div>
													<p className={styles.hint}>
														Если посетитель оставит контакт, который уже
														есть в базе этого квиза — повторная заявка не
														будет сохранена и уведомления не придут.
													</p>
												</div>
											</div>
										</details>
									</>
								)}
							</div>

							<div className={styles.settingsGroup}>
								<div className={styles.settingsGroupHeader}>
									<h3 className={styles.settingsGroupTitle}>
										Повторные прохождения
									</h3>
								</div>

								<div className={styles.field}>
									<div className={styles.checkRow}>
										<input
											id="quizHideIfPlayed"
											type="checkbox"
											checked={config.hideIfPlayed}
											onChange={e =>
												setField('hideIfPlayed', e.target.checked)
											}
										/>
										<label
											htmlFor="quizHideIfPlayed"
											className={styles.checkLabel}
										>
											Скрывать кнопку, если уже проходили
										</label>
									</div>
									<p className={styles.hint}>
										Плавающая кнопка и квиз полностью скроются для тех, кто
										уже проходил.
									</p>
								</div>

								{!config.hideIfPlayed && (
									<>
										<div className={styles.field}>
											<p className={styles.label}>
												Заголовок «Уже проходили»:
											</p>
											<input
												className={styles.input}
												value={config.alreadyPlayedTitle}
												onChange={e =>
													setField('alreadyPlayedTitle', e.target.value)
												}
												placeholder="🎉 Вы уже проходили этот квиз!"
												maxLength={80}
											/>
											<p className={styles.hint}>
												Показывается посетителю, который открывает квиз
												повторно.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>
												Подзаголовок «Уже проходили»:
											</p>
											<input
												className={styles.input}
												value={config.alreadyPlayedSubtitle}
												onChange={e =>
													setField('alreadyPlayedSubtitle', e.target.value)
												}
												placeholder="Каждый посетитель может пройти квиз только один раз"
												maxLength={160}
											/>
											<p className={styles.hint}>
												Подпись под заголовком антифрод-экрана.
											</p>
										</div>
									</>
								)}

								<div className={styles.field}>
									<div className={pageStyles.rangeHeader}>
										<p className={styles.label}>
											Когда можно пройти повторно:
										</p>
										<span className={pageStyles.rangeValue}>
											{(config.quizCooldownDays ?? 0) === 0
												? 'Однократно'
												: `${config.quizCooldownDays} дн.`}
										</span>
									</div>
									<input
										id={getValidationFieldId('cooldown')}
										type="range"
										aria-label="Повторное прохождение через"
										min={0}
										max={365}
										step={1}
										className={pageStyles.rangeInput}
										value={config.quizCooldownDays ?? 0}
										onChange={e =>
											setField('quizCooldownDays', Number(e.target.value))
										}
										onBlur={() => {
											const fieldId = getValidationFieldId('cooldown')
											const value = config.quizCooldownDays ?? 0
											setBlurValidationIssue(
												value >= 0 && value <= 365
													? null
													: {
															tab: 'main',
															fieldId,
															message:
																'Повторное прохождение: выберите значение от 0 до 365 дней'
														},
												fieldId
											)
										}}
										aria-invalid={isValidationFieldInvalid(
											getValidationFieldId('cooldown')
										)}
										aria-describedby={getValidationDescriptionId(
											getValidationFieldId('cooldown')
										)}
									/>
									{renderValidationError(getValidationFieldId('cooldown'))}
									<p className={styles.hint}>
										0 — пройти квиз можно только один раз. При другом
										значении посетитель сможет пройти его снова через
										указанное количество дней.
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
												Сброс сохранится в черновике. Все посетители смогут
												пройти квиз заново только после публикации виджета.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													onClick={handleResetAttempts}
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

									{!confirmResetDefaults ? (
										<button
											type="button"
											className={styles.resetAttemptsBtn}
											onClick={() => setConfirmResetDefaults(true)}
											disabled={isDangerActionPending}
										>
											Сбросить настройки, кроме вопросов и результатов
										</button>
									) : (
										<div className={styles.dangerItem}>
											<p className={styles.hint}>
												Оформление, тексты и параметры показа будут
												заменены стандартными. Вопросы, результаты,
												интеграции, своя картинка и история попыток
												сохранятся. Изменения останутся в форме до
												сохранения черновика.
											</p>
											<div className={styles.footerActions}>
												<button
													type="button"
													className={styles.resetAttemptsBtn}
													disabled={isDangerActionPending}
													onClick={() => {
														const resetConfig = {
															...DEFAULT_CONFIG,
															questions: config.questions,
															results: config.results,
															integrations: { ...config.integrations },
															buttonImageUrl: config.buttonImageUrl,
															quizResetToken: config.quizResetToken
														}
														setConfig(resetConfig)
														setValidationIssue(null)
														setConfirmResetDefaults(false)
														toast.success(
															'Стандартные настройки применены. Сохраните черновик'
														)
													}}
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
								</div>
							</div>
						</div>
					)}

					{/* ===== ВОПРОСЫ ===== */}
					{tab === 'questions' && (
						<div className={styles.fields}>
							<div className={styles.infoBlock}>
								<p className={styles.infoBlockTitle}>
									Как работает балльная система
								</p>
								<ul className={styles.infoBlockList}>
									<li>
										Каждый вариант ответа приносит баллы одному или
										нескольким результатам.
									</li>
									<li>
										После прохождения квиза баллы по всем ответам
										суммируются для каждого результата.
									</li>
									<li>
										Посетитель получает тот результат, у которого набралось
										больше всего баллов.
									</li>
								</ul>
								<p
									className={`${styles.infoBlockTitle} ${styles.infoBlockSubTitle}`}
								>
									Что значит режим баллов
								</p>
								<ul className={styles.infoBlockList}>
									<li>
										<b>Простой</b> — у каждого ответа выбирается один
										результат. Система сама ставит ему 10 баллов, а
										остальным 0.
									</li>
									<li>
										<b>Продвинутый</b> — можно вручную указать баллы от 0
										до 10 для каждого результата, если ответ должен влиять
										сразу на несколько итогов.
									</li>
								</ul>
								<p
									className={`${styles.infoBlockTitle} ${styles.infoBlockSubTitle}`}
								>
									Как настраивать
								</p>
								<ul className={styles.infoBlockList}>
									<li>
										Сначала создайте результаты во вкладке «Результаты» —
										они появятся как колонки баллов.
									</li>
									<li>
										Для каждого варианта ответа задайте баллы (0–10) для
										каждого результата.
									</li>
									<li>
										Если вариант ответа ведёт к результату — поставьте ему
										высокий балл (например, 5–10), остальным — 0 или 1.
									</li>
									<li>
										Минимум 1 вопрос, максимум 10. В каждом вопросе от 2 до
										4 вариантов ответа.
									</li>
								</ul>
							</div>
							{config.results.length < 2 && (
								<p className={pageStyles.fieldError}>
									⚠️ Сначала добавьте минимум 2 результата во вкладке
									«Результаты»
								</p>
							)}

							<div className={styles.scoreModeBar}>
								<span className={styles.scoreModeLabel}>Режим баллов</span>
								<div className={styles.scoreModeSwitch}>
									<button
										type="button"
										className={`${styles.scoreModeBtn} ${
											scoreMode === 'simple'
												? styles.scoreModeBtnActive
												: ''
										}`}
										onClick={() => setScoreMode('simple')}
									>
										Простой
									</button>
									<button
										type="button"
										className={`${styles.scoreModeBtn} ${
											scoreMode === 'advanced'
												? styles.scoreModeBtnActive
												: ''
										}`}
										onClick={() => setScoreMode('advanced')}
									>
										Продвинутый
									</button>
								</div>
							</div>

							{config.questions.map((q, qIdx) => (
								<div key={q.id} className={styles.questionBlock}>
									<div className={styles.questionHeader}>
										<span className={styles.questionNumber}>
											Вопрос {qIdx + 1} из {config.questions.length}
										</span>
										<div className={styles.headerActions}>
											<select
												className={`${styles.input} ${styles.questionTypeSelect}`}
												value={q.type}
												onChange={e =>
													updateQuestion(qIdx, 'type', e.target.value)
												}
											>
												<option value="radio">Один ответ</option>
												<option value="checkbox">Несколько ответов</option>
											</select>
											<button
												type="button"
												className={styles.removeBtn}
												onClick={() => removeQuestion(qIdx)}
												disabled={config.questions.length <= 1}
												title={
													config.questions.length <= 1
														? 'Минимум 1 вопрос'
														: 'Удалить вопрос'
												}
											>
												✕
											</button>
										</div>
									</div>
									<p
										className={`${styles.hint} ${styles.questionTypeHint}`}
									>
										{q.type === 'radio'
											? 'Один ответ — посетитель выбирает один вариант. Подходит для большинства вопросов.'
											: 'Несколько ответов — посетитель отмечает любое количество вариантов. Баллы суммируются по всем выбранным.'}
									</p>

									<input
										id={getValidationFieldId(`question-${q.id}-text`)}
										className={`${styles.input} ${
											isValidationFieldInvalid(
												getValidationFieldId(`question-${q.id}-text`)
											)
												? pageStyles.inputError
												: ''
										}`}
										value={q.text}
										onChange={e =>
											updateQuestion(qIdx, 'text', e.target.value)
										}
										onBlur={() => {
											const fieldId = getValidationFieldId(
												`question-${q.id}-text`
											)
											setBlurValidationIssue(
												q.text.trim()
													? null
													: {
															tab: 'questions',
															fieldId,
															message: `Вопрос ${qIdx + 1}: заполните текст вопроса`
														},
												fieldId
											)
										}}
										placeholder={`Текст вопроса ${qIdx + 1}`}
										maxLength={200}
										aria-invalid={isValidationFieldInvalid(
											getValidationFieldId(`question-${q.id}-text`)
										)}
										aria-describedby={getValidationDescriptionId(
											getValidationFieldId(`question-${q.id}-text`)
										)}
									/>
									{renderValidationError(
										getValidationFieldId(`question-${q.id}-text`)
									)}

									<div className={styles.optionRow}>
										{q.options.map((opt, oIdx) => (
											<div key={opt.id} className={styles.optionItem}>
												<div className={styles.optionTop}>
													<span className={styles.optionNumber}>
														{oIdx + 1}.
													</span>
													<input
														id={getValidationFieldId(
															`question-${q.id}-option-${opt.id}`
														)}
														className={`${styles.optionInput} ${
															isValidationFieldInvalid(
																getValidationFieldId(
																	`question-${q.id}-option-${opt.id}`
																)
															)
																? pageStyles.inputError
																: ''
														}`}
														value={opt.text}
														onChange={e =>
															updateOption(
																qIdx,
																oIdx,
																'text',
																e.target.value
															)
														}
														onBlur={() => {
															const fieldId = getValidationFieldId(
																`question-${q.id}-option-${opt.id}`
															)
															setBlurValidationIssue(
																opt.text.trim()
																	? null
																	: {
																			tab: 'questions',
																			fieldId,
																			message: `Вопрос ${qIdx + 1}, вариант ${oIdx + 1}: заполните текст`
																		},
																fieldId
															)
														}}
														placeholder={`Вариант ${oIdx + 1}`}
														maxLength={150}
														aria-invalid={isValidationFieldInvalid(
															getValidationFieldId(
																`question-${q.id}-option-${opt.id}`
															)
														)}
														aria-describedby={getValidationDescriptionId(
															getValidationFieldId(
																`question-${q.id}-option-${opt.id}`
															)
														)}
													/>
													<button
														type="button"
														className={styles.removeBtn}
														onClick={() => removeOption(qIdx, oIdx)}
														disabled={q.options.length <= 2}
														title={
															q.options.length <= 2
																? 'Минимум 2 варианта'
																: 'Удалить'
														}
													>
														✕
													</button>
												</div>
												{renderValidationError(
													getValidationFieldId(
														`question-${q.id}-option-${opt.id}`
													)
												)}

												{config.results.length > 0 && (
													<div className={styles.scoresRow}>
														{scoreMode === 'simple' ? (
															<div className={styles.simpleScoreItem}>
																<span className={styles.scoreLabel}>
																	Ведёт к результату:
																</span>
																<select
																	className={styles.input}
																	value={getLeadingResultId(opt)}
																	onChange={e =>
																		setOptionWinner(
																			qIdx,
																			oIdx,
																			e.target.value
																		)
																	}
																>
																	{config.results.map((r, rIdx) => (
																		<option key={r.id} value={r.id}>
																			{r.title || `Результат ${rIdx + 1}`}
																		</option>
																	))}
																</select>
															</div>
														) : (
															config.results.map(r => (
																<div
																	key={r.id}
																	className={`${styles.scoreItem} ${
																		getLeadingResultId(opt) === r.id
																			? styles.scoreItemWinner
																			: ''
																	}`}
																>
																	<span
																		className={styles.scoreLabel}
																		title={r.title}
																	>
																		{r.title ||
																			`Рез.${config.results.indexOf(r) + 1}`}
																		:
																	</span>
																	<input
																		type="number"
																		className={styles.scoreInput}
																		min={0}
																		max={10}
																		value={opt.scores[r.id] ?? 0}
																		onChange={e =>
																			updateScore(
																				qIdx,
																				oIdx,
																				r.id,
																				clampNumber(
																					Number(e.target.value),
																					0,
																					10,
																					0
																				)
																			)
																		}
																		title={`Баллы для результата "${r.title}"`}
																	/>
																	<div className={styles.scoreQuickBtns}>
																		<button
																			type="button"
																			className={styles.scoreQuickBtn}
																			onClick={() =>
																				setOptionWinner(qIdx, oIdx, r.id)
																			}
																		>
																			+10 этому
																		</button>
																		<button
																			type="button"
																			className={styles.scoreQuickBtn}
																			onClick={() =>
																				updateScore(qIdx, oIdx, r.id, 0)
																			}
																		>
																			0
																		</button>
																	</div>
																</div>
															))
														)}
													</div>
												)}
											</div>
										))}

										<button
											type="button"
											className={styles.addOptionBtn}
											onClick={() => addOption(qIdx)}
											disabled={q.options.length >= 4}
										>
											{q.options.length >= 4
												? 'Максимум 4 варианта'
												: '+ Добавить вариант'}
										</button>
									</div>
								</div>
							))}

							<button
								id={getValidationFieldId('questions-add')}
								type="button"
								className={`${styles.addBtn} ${
									isValidationFieldInvalid(
										getValidationFieldId('questions-add')
									)
										? pageStyles.inputError
										: ''
								}`}
								onClick={addQuestion}
								disabled={config.questions.length >= 10}
								aria-describedby={getValidationDescriptionId(
									getValidationFieldId('questions-add')
								)}
							>
								{config.questions.length >= 10
									? 'Максимум 10 вопросов'
									: '+ Добавить вопрос'}
							</button>
							{renderValidationError(
								getValidationFieldId('questions-add')
							)}

							{config.questions.length === 0 && (
								<p className={`${styles.hint} ${styles.emptyHint}`}>
									Минимум 1 вопрос, максимум 10
								</p>
							)}
						</div>
					)}

					{/* ===== РЕЗУЛЬТАТЫ ===== */}
					{tab === 'results' && (
						<div className={styles.fields}>
							{config.results.map((r, rIdx) => (
								<div key={r.id} className={styles.resultBlock}>
									<div className={styles.resultHeader}>
										<span className={styles.resultNumber}>
											Результат {rIdx + 1}
										</span>
										<div className={styles.headerActions}>
											<span className={styles.resultId}>id: {r.id}</span>
											<button
												type="button"
												className={styles.removeBtn}
												onClick={() => removeResult(rIdx)}
												disabled={config.results.length <= 2}
												title={
													config.results.length <= 2
														? 'Минимум 2 результата'
														: 'Удалить результат'
												}
											>
												✕
											</button>
										</div>
									</div>

									<div className={styles.field}>
										<p className={styles.label}>Заголовок:</p>
										<input
											id={getValidationFieldId(`result-${r.id}-title`)}
											className={`${styles.input} ${
												isValidationFieldInvalid(
													getValidationFieldId(`result-${r.id}-title`)
												)
													? pageStyles.inputError
													: ''
											}`}
											value={r.title}
											onChange={e =>
												updateResult(rIdx, 'title', e.target.value)
											}
											onBlur={() => {
												const fieldId = getValidationFieldId(
													`result-${r.id}-title`
												)
												setBlurValidationIssue(
													r.title.trim()
														? null
														: {
																tab: 'results',
																fieldId,
																message: `Результат ${rIdx + 1}: заполните заголовок`
															},
													fieldId
												)
											}}
											placeholder="Например: Вам подойдёт тариф HARD"
											maxLength={80}
											aria-invalid={isValidationFieldInvalid(
												getValidationFieldId(`result-${r.id}-title`)
											)}
											aria-describedby={getValidationDescriptionId(
												getValidationFieldId(`result-${r.id}-title`)
											)}
										/>
										{renderValidationError(
											getValidationFieldId(`result-${r.id}-title`)
										)}
										<p className={styles.hint}>
											Крупный текст на финальном экране квиза, который
											увидит посетитель после прохождения.
										</p>
									</div>

									<div className={styles.field}>
										<p className={styles.label}>Описание:</p>
										<textarea
											className={styles.textarea}
											value={r.description}
											onChange={e =>
												updateResult(rIdx, 'description', e.target.value)
											}
											placeholder="Опишите что получит клиент с таким результатом"
											maxLength={400}
										/>
										<p className={styles.hint}>
											Подробный текст под заголовком с персональной
											рекомендацией или объяснением результата.
										</p>
									</div>

									<div className={styles.field}>
										<p className={styles.label}>
											Промокод (необязательно):
										</p>
										<input
											className={styles.input}
											value={r.promoCode}
											onChange={e =>
												updateResult(rIdx, 'promoCode', e.target.value)
											}
											placeholder="СКИДКА20"
											maxLength={30}
										/>
										<p className={styles.hint}>
											Будет выделен крупным шрифтом на финальном экране.
											Также приходит в уведомлении вместе с заявкой.
										</p>
									</div>

									<div className={styles.field}>
										<p className={styles.label}>
											Текст кнопки (необязательно):
										</p>
										<input
											id={getValidationFieldId(
												`result-${r.id}-button-text`
											)}
											className={`${styles.input} ${
												isValidationFieldInvalid(
													getValidationFieldId(
														`result-${r.id}-button-text`
													)
												)
													? pageStyles.inputError
													: ''
											}`}
											value={r.buttonText}
											onChange={e =>
												updateResult(rIdx, 'buttonText', e.target.value)
											}
											onBlur={() => {
												const fieldId = getValidationFieldId(
													`result-${r.id}-button-text`
												)
												setBlurValidationIssue(
													r.buttonUrl.trim() && !r.buttonText.trim()
														? {
																tab: 'results',
																fieldId,
																message: `Результат ${rIdx + 1}: заполните текст кнопки или уберите ссылку`
															}
														: null,
													fieldId
												)
											}}
											placeholder="Получить скидку"
											maxLength={40}
											aria-invalid={isValidationFieldInvalid(
												getValidationFieldId(`result-${r.id}-button-text`)
											)}
											aria-describedby={getValidationDescriptionId(
												getValidationFieldId(`result-${r.id}-button-text`)
											)}
										/>
										{renderValidationError(
											getValidationFieldId(`result-${r.id}-button-text`)
										)}
										<p className={styles.hint}>
											Кнопка с призывом к действию (CTA) под описанием
											результата. Заполните вместе со ссылкой ниже.
										</p>
									</div>

									<div className={styles.field}>
										<p className={styles.label}>
											Ссылка кнопки (необязательно):
										</p>
										<input
											id={getValidationFieldId(
												`result-${r.id}-button-url`
											)}
											type="url"
											className={`${styles.input} ${
												isValidationFieldInvalid(
													getValidationFieldId(`result-${r.id}-button-url`)
												)
													? pageStyles.inputError
													: ''
											}`}
											value={r.buttonUrl}
											onChange={e =>
												updateResult(rIdx, 'buttonUrl', e.target.value)
											}
											onBlur={() => {
												const fieldId = getValidationFieldId(
													`result-${r.id}-button-url`
												)
												const value = r.buttonUrl.trim()
												const message =
													r.buttonText.trim() && !value
														? `Результат ${rIdx + 1}: заполните ссылку кнопки или уберите текст кнопки`
														: value && !isHttpUrl(value)
															? `Результат ${rIdx + 1}: укажите полную ссылку с http:// или https://`
															: null
												setBlurValidationIssue(
													message
														? {
																tab: 'results',
																fieldId,
																message
															}
														: null,
													fieldId
												)
											}}
											placeholder="https://..."
											maxLength={500}
											aria-invalid={isValidationFieldInvalid(
												getValidationFieldId(`result-${r.id}-button-url`)
											)}
											aria-describedby={getValidationDescriptionId(
												getValidationFieldId(`result-${r.id}-button-url`)
											)}
										/>
										{renderValidationError(
											getValidationFieldId(`result-${r.id}-button-url`)
										)}
										<p className={styles.hint}>
											Куда переходит посетитель по клику на кнопку.
											Например, на страницу товара или оформления заказа.
										</p>
									</div>
								</div>
							))}

							<button
								id={getValidationFieldId('results-add')}
								type="button"
								className={`${styles.addBtn} ${
									isValidationFieldInvalid(
										getValidationFieldId('results-add')
									)
										? pageStyles.inputError
										: ''
								}`}
								onClick={addResult}
								disabled={config.results.length >= 5}
								aria-describedby={getValidationDescriptionId(
									getValidationFieldId('results-add')
								)}
							>
								{config.results.length >= 5
									? 'Максимум 5 результатов'
									: '+ Добавить результат'}
							</button>
							{renderValidationError(getValidationFieldId('results-add'))}

							{config.results.length === 0 && (
								<p className={`${styles.hint} ${styles.emptyHint}`}>
									Минимум 2 результата, максимум 5. Добавьте результаты
									перед вопросами.
								</p>
							)}
						</div>
					)}

					{/* ===== ИНТЕГРАЦИИ ===== */}
					{tab === 'integrations' && (
						<div className={styles.fields}>
							{config.dataType === 'NONE' && (
								<div className={styles.settingsGroup}>
									<h3 className={styles.settingsGroupTitle}>
										Контакты отключены
									</h3>
									<p className={styles.hint}>
										Email, Telegram, webhook и CRM не используются без
										заявок. Настройки аналитики остаются доступными ниже.
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

										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок на Email
											</p>
											<input
												className={styles.input}
												type="email"
												value={config.integrations?.email || ''}
												onChange={e =>
													setIntegration('email', e.target.value)
												}
												placeholder="admin@example.com"
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
												value={config.integrations?.telegramChatId || ''}
												onChange={e =>
													setIntegration('telegramChatId', e.target.value)
												}
												placeholder="-123456789"
											/>
											<p className={styles.hint}>
												Напишите боту <b>@winwidget_info_bot</b> команду
												/start, затем укажите сюда ваш Telegram ID. Узнать
												ID можно через бот <b>@getmyid_bot</b>
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
												id={getValidationFieldId(
													'integration-webhook-url'
												)}
												className={`${styles.input} ${
													isValidationFieldInvalid(
														getValidationFieldId('integration-webhook-url')
													)
														? pageStyles.inputError
														: ''
												}`}
												type="url"
												value={config.integrations?.webhookUrl || ''}
												onChange={e =>
													setIntegration('webhookUrl', e.target.value)
												}
												onBlur={() => {
													const fieldId = getValidationFieldId(
														'integration-webhook-url'
													)
													const value =
														config.integrations.webhookUrl?.trim() || ''
													setBlurValidationIssue(
														!value || isHttpUrl(value)
															? null
															: {
																	tab: 'integrations',
																	fieldId,
																	message:
																		'Укажите полный URL webhook с http:// или https://'
																},
														fieldId
													)
												}}
												placeholder="https://..."
											/>
											{renderValidationError(
												getValidationFieldId('integration-webhook-url')
											)}
											<p className={styles.hint}>
												На указанный URL придёт POST-запрос с данными:{' '}
												<b>contact</b>, <b>phone</b>, <b>email</b>,{' '}
												<b>result</b> — результат квиза, <b>answers</b> —
												ответы, <b>url</b> — страница.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>
												Отправка заявок в Битрикс24
											</p>
											<input
												id={getValidationFieldId(
													'integration-bitrix24-url'
												)}
												className={`${styles.input} ${
													isValidationFieldInvalid(
														getValidationFieldId(
															'integration-bitrix24-url'
														)
													)
														? pageStyles.inputError
														: ''
												}`}
												type="url"
												value={
													config.integrations?.bitrix24WebhookUrl || ''
												}
												onChange={e =>
													setIntegration(
														'bitrix24WebhookUrl',
														e.target.value
													)
												}
												onBlur={() => {
													const fieldId = getValidationFieldId(
														'integration-bitrix24-url'
													)
													const value =
														config.integrations.bitrix24WebhookUrl?.trim() ||
														''
													setBlurValidationIssue(
														!value || isHttpUrl(value)
															? null
															: {
																	tab: 'integrations',
																	fieldId,
																	message:
																		'Укажите полный URL Bitrix24 с http:// или https://'
																},
														fieldId
													)
												}}
												placeholder="https://yourcompany.bitrix24.ru/rest/..."
											/>
											{renderValidationError(
												getValidationFieldId('integration-bitrix24-url')
											)}
											<p className={styles.hint}>
												Укажите URL вашего входящего вебхука из Битрикс24.
												Перейдите в Битрикс24 → Приложения → Вебхуки →
												Входящий вебхук. Новые заявки будут создаваться как
												лиды в CRM.
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>
												amoCRM — домен аккаунта
											</p>
											<input
												className={styles.input}
												value={config.integrations?.amoCrmDomain || ''}
												onChange={e =>
													setIntegration('amoCrmDomain', e.target.value)
												}
												placeholder="yourcompany.amocrm.ru"
											/>
											<p className={styles.hint}>
												Домен вашего аккаунта amoCRM, например{' '}
												<b>mycompany.amocrm.ru</b>
											</p>
										</div>

										<div className={styles.field}>
											<p className={styles.label}>
												amoCRM — токен доступа
											</p>
											<input
												className={styles.input}
												type="password"
												value={config.integrations?.amoCrmToken || ''}
												onChange={e =>
													setIntegration('amoCrmToken', e.target.value)
												}
												placeholder="Долгосрочный токен из настроек API"
											/>
											<p className={styles.hint}>
												Перейдите в amoCRM → Настройки → Интеграции → API →
												скопируйте долгосрочный токен. При каждой заявке
												будут создаваться сделка и контакт.
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
										value={config.integrations?.yandexMetrikaId || ''}
										onChange={e =>
											setIntegration('yandexMetrikaId', e.target.value)
										}
										placeholder="12345678"
									/>
									<p className={styles.hint}>
										При открытии квиза отправляется цель <b>wq_open</b>,
										при отправке заявки — <b>wq_send</b>. Счётчик должен
										быть установлен на странице сайта.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>
										Ретаргетинг ВКонтакте — ID пикселя
									</p>
									<input
										className={styles.input}
										value={config.integrations?.vkPixelId || ''}
										onChange={e =>
											setIntegration('vkPixelId', e.target.value)
										}
										placeholder="VK-RTRG-..."
									/>
									<p className={styles.hint}>
										При открытии квиза отправляется событие <b>wq_open</b>,
										при отправке заявки — <b>wq_send</b>. Пиксель VK должен
										быть установлен на странице сайта.
									</p>
								</div>

								<div className={styles.field}>
									<p className={styles.label}>Roistat</p>
									<div className={styles.checkRow}>
										<input
											id="quizRoistat"
											type="checkbox"
											checked={
												config.integrations?.roistatEnabled || false
											}
											onChange={e =>
												setIntegration('roistatEnabled', e.target.checked)
											}
										/>
										<label
											htmlFor="quizRoistat"
											className={styles.checkLabel}
										>
											Включить отправку целей в Roistat
										</label>
									</div>
									<p className={styles.hint}>
										При открытии квиза отправляется цель <b>wq_open</b>,
										при отправке заявки — <b>wq_send</b>. Код Roistat
										должен быть подключён на странице сайта.
									</p>
								</div>
							</div>
						</div>
					)}

					{/* ===== УСТАНОВКА НА САЙТ ===== */}
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
										Скрипт для вставки на сайт:
									</p>
									<textarea
										className={`${styles.input} ${styles.codeArea}`}
										value={scriptCode}
										readOnly
										rows={3}
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
											value={directLink}
											readOnly
											onClick={e =>
												(e.target as HTMLInputElement).select()
											}
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
										className={styles.copyBtn}
										onClick={() =>
											copyToClipboard(directLink, 'Ссылка скопирована')
										}
									>
										Копировать ссылку
									</button>
									<p className={styles.hint}>
										Используйте, если не нужно подключать квиз к сайту —
										подходит для рассылок, рекламы и мессенджеров.
									</p>
									<DirectLinkQr
										value={directLink}
										downloadName={`winwidget-quiz-${quiz.publicKey}.png`}
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
										Как работает квиз
									</h3>
								</div>
								<p className={styles.infoText}>
									Квиз задаёт посетителю вопросы, считает баллы или ведёт
									по выбранным вариантам, показывает результат и собирает
									заявку. Заявка сохраняется в кабинете и уходит в
									подключённые каналы.
								</p>
								<ul className={styles.infoList}>
									<li>
										В «Главных» настройте внешний вид, тексты, кнопку и
										форму контактов.
									</li>
									<li>
										В «Результатах» подготовьте финальные экраны и условия
										показа.
									</li>
									<li>
										В «Вопросах» добавьте шаги квиза, ответы и баллы для
										логики результата.
									</li>
									<li>
										В «Установке» добавьте квиз на сайт или используйте
										прямую ссылку.
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
										Пройдите квиз целиком и убедитесь, что каждый ответ
										ведёт к нужному результату.
									</li>
									<li>
										Проверьте обязательность контактных полей и текст
										согласия.
									</li>
									<li>
										Отправьте тестовую заявку и посмотрите, пришла ли она в
										интеграции.
									</li>
									<li>
										Если используете рекламу, откройте прямую ссылку
										отдельно и проверьте мобильный вид.
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

export default QuizSettingsModal
