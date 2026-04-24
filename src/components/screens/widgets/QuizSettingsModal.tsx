'use client'

import quizService from '@/services/quiz/quiz.service'
import {
	Quiz,
	QuizConfig,
	QuizOption,
	QuizQuestion,
	QuizResult
} from '@/services/quiz/quiz.types'
import { useMutation } from '@tanstack/react-query'
import { useId, useState } from 'react'
import toast from 'react-hot-toast'
import styles from './QuizSettingsModal.module.scss'

type Tab = 'main' | 'questions' | 'results' | 'integrations' | 'code'

interface Props {
	quiz: Quiz
	onClose: () => void
	onSaved: (updated: Quiz) => void
}

const makeId = () => Math.random().toString(36).slice(2, 9)

const DEFAULT_CONFIG: QuizConfig = {
	color: '#4705fb',
	bgColor: '',
	buttonColor: '',
	buttonSide: 'right',
	buttonPulse: true,
	buttonBottom: 3,
	buttonOffset: 3,
	buttonSize: 60,
	autoOpenDelay: 45,
	title: 'Пройдите наш квиз!',
	subtitle:
		'Ответьте на несколько вопросов и получите персональную рекомендацию',
	buttonText: 'Начать квиз',
	contactTitle: 'Оставьте контакт для получения результата',
	dataType: 'PHONE',
	phoneRegion: 'RU',
	privacyUrl:
		'https://winwidget.ru/legal-documentation/consent-processing',
	filterDuplicates: false,
	alreadyPlayedTitle: '🎉 Вы уже проходили этот квиз!',
	alreadyPlayedSubtitle:
		'Каждый посетитель может пройти квиз только один раз',
	hideIfPlayed: false,
	quizCooldownDays: 0,
	quizResetToken: '',
	questions: [],
	results: [],
	integrations: { ...({} as QuizConfig['integrations']) }
}

const QuizSettingsModal = ({ quiz, onClose, onSaved }: Props) => {
	const [tab, setTab] = useState<Tab>('main')
	const [config, setConfig] = useState<QuizConfig>({ ...quiz.config })
	const [name, setName] = useState(quiz.name)
	const titleId = useId()
	const [cooldownInput, setCooldownInput] = useState(
		String(quiz.config.quizCooldownDays ?? 0)
	)
	const [confirmResetAttempts, setConfirmResetAttempts] = useState(false)
	const [confirmResetDefaults, setConfirmResetDefaults] = useState(false)

	const saveMutation = useMutation({
		mutationFn: (data: { name: string; config: QuizConfig }) =>
			quizService.updateQuiz(quiz.id, data),
		onMutate: () =>
			toast.loading('Сохраняем настройки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Сохранено', { id: toastId })
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
			quizService.updateQuiz(quiz.id, {
				name,
				config: { ...config, quizResetToken: newToken }
			}),
		onMutate: () =>
			toast.loading('Сбрасываем попытки, пожалуйста подождите...'),
		onSuccess: (updated, _, toastId) => {
			toast.success('Попытки всех посетителей сброшены', { id: toastId })
			setConfig(updated.config)
			onSaved(updated)
		},
		onError: (e: any, _, toastId) => {
			toast.error(e?.response?.data?.message || 'Ошибка сброса', {
				id: toastId
			})
		}
	})

	const setField = <K extends keyof QuizConfig>(
		key: K,
		value: QuizConfig[K]
	) => {
		setConfig(prev => ({ ...prev, [key]: value }))
	}

	const setIntegration = (
		key: keyof QuizConfig['integrations'],
		value: any
	) => {
		setConfig(prev => ({
			...prev,
			integrations: { ...prev.integrations, [key]: value }
		}))
	}

	// --- Questions helpers ---

	const addQuestion = () => {
		if (config.questions.length >= 10) return
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
		setConfig(prev => {
			const questions = [...prev.questions]
			questions[qIdx] = { ...questions[qIdx], [field]: value }
			return { ...prev, questions }
		})
	}

	const addOption = (qIdx: number) => {
		if (config.questions[qIdx].options.length >= 4) return
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

	// --- Results helpers ---

	const addResult = () => {
		if (config.results.length >= 5) return
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
		setConfig(prev => {
			const results = [...prev.results]
			results[rIdx] = { ...results[rIdx], [field]: value }
			return { ...prev, results }
		})
	}

	// ---

	const handleSave = () => {
		if (config.results.length < 2) {
			toast.error('Минимум 2 результата необходимо для квиза')
			return
		}
		if (config.questions.length < 1) {
			toast.error('Добавьте хотя бы один вопрос')
			return
		}
		const emptyQuestion = config.questions.findIndex(q => !q.text.trim())
		if (emptyQuestion !== -1) {
			toast.error(`Вопрос ${emptyQuestion + 1}: заполните текст вопроса`)
			return
		}
		const bottom = config.buttonBottom
		if (!bottom || bottom < 1 || bottom > 50) {
			toast.error('Высота кнопки: введите число от 1 до 50')
			return
		}
		for (let i = 0; i < config.results.length; i++) {
			const r = config.results[i]
			const hasText = r.buttonText.trim() !== ''
			const hasUrl = r.buttonUrl.trim() !== ''
			if (hasText && !hasUrl) {
				toast.error(
					`Результат ${i + 1}: заполните ссылку кнопки или уберите текст кнопки`
				)
				return
			}
			if (hasUrl && !hasText) {
				toast.error(
					`Результат ${i + 1}: заполните текст кнопки или уберите ссылку`
				)
				return
			}
		}
		const cooldown = config.quizCooldownDays ?? 0
		if (cooldown > 365) {
			toast.error('Повторное прохождение: введите число от 0 до 365')
			return
		}
		const sanitizedName = name.trim() || 'Квиз'
		setName(sanitizedName)
		saveMutation.mutate({ name: sanitizedName, config })
	}

	const handleResetAttempts = () => {
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

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть настройки квиза"
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
				>
					✕
				</button>
				<h2 id={titleId} className={styles.modalTitle}>
					Настройки квиза
				</h2>

				<div className={styles.tabs}>
					{(
						[
							'main',
							'results',
							'questions',
							'integrations',
							'code'
						] as Tab[]
					).map(t => (
						<button
							key={t}
							className={`${styles.tab} ${tab === t ? styles.tabActive : ''}`}
							onClick={() => setTab(t)}
						>
							{t === 'main' && 'Главные'}
							{t === 'questions' && `Вопросы (${config.questions.length})`}
							{t === 'results' && `Результаты (${config.results.length})`}
							{t === 'integrations' && 'Интеграции'}
							{t === 'code' && 'Код'}
						</button>
					))}
				</div>

				<div className={styles.tabContent}>
					{/* ===== ГЛАВНЫЕ ===== */}
					{tab === 'main' && (
						<div className={styles.fields}>
							<div className={styles.field}>
								<p className={styles.label}>Название квиза:</p>
								<input
									className={styles.input}
									value={name}
									onChange={e => setName(e.target.value)}
									placeholder="Квиз"
									maxLength={15}
								/>
								<p className={styles.hint}>
									Отображается только в вашем кабинете. Посетители это
									название не видят.
								</p>
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
									Основной цвет акцентов: прогресс-бар, кнопки, бейдж
									результата.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Цвет фона виджета:</p>
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
										value={config.buttonColor || config.color}
										onChange={e => setField('buttonColor', e.target.value)}
									/>
									<input
										className={styles.input}
										value={config.buttonColor || ''}
										onChange={e => setField('buttonColor', e.target.value)}
										placeholder="По умолчанию — основной цвет"
										maxLength={7}
									/>
									{config.buttonColor && (
										<button
											type="button"
											className={styles.clearColorBtn}
											onClick={() => setField('buttonColor', '')}
											title="Сбросить"
										>
											✕
										</button>
									)}
								</div>
								<p className={styles.hint}>
									Цвет кнопок «Далее» и «Получить результат». Оставьте
									пустым, чтобы использовать основной цвет.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Расположение кнопки:</p>
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
									С какой стороны экрана будет показана плавающая кнопка
									открытия квиза.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>
									Высота кнопки от низа экрана:{' '}
									<strong>{config.buttonBottom}%</strong>
								</p>
								<input
									type="range"
									min={1}
									max={50}
									value={config.buttonBottom}
									onChange={e =>
										setField('buttonBottom', Number(e.target.value))
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
									<strong>{config.buttonOffset ?? 3}%</strong>
								</p>
								<input
									type="range"
									min={1}
									max={50}
									value={config.buttonOffset ?? 3}
									onChange={e =>
										setField('buttonOffset', Number(e.target.value))
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
									Размер кнопки:{' '}
									<strong>{config.buttonSize ?? 60}px</strong>
								</p>
								<input
									type="range"
									min={40}
									max={100}
									value={config.buttonSize ?? 60}
									onChange={e =>
										setField('buttonSize', Number(e.target.value))
									}
									className={styles.input}
									style={{
										padding: '8px 0',
										background: 'transparent',
										border: 'none'
									}}
								/>
								<p className={styles.hint}>
									Размер плавающей кнопки открытия квиза в пикселях. По
									умолчанию 60px.
								</p>
							</div>

							<div className={styles.field}>
								<div className={styles.checkRow}>
									<input
										id="quizPulse"
										type="checkbox"
										checked={config.buttonPulse}
										onChange={e =>
											setField('buttonPulse', e.target.checked)
										}
									/>
									<label htmlFor="quizPulse" className={styles.checkLabel}>
										Пульсация кнопки
									</label>
								</div>
								<p className={styles.hint}>
									Дополнительный эффект свечения на плавающей кнопке
									открытия квиза.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Авто-открытие через (сек):</p>
								<input
									type="number"
									className={styles.input}
									value={config.autoOpenDelay ?? ''}
									onChange={e =>
										setField(
											'autoOpenDelay',
											e.target.value === '' ? null : Number(e.target.value)
										)
									}
									placeholder="Не открывать автоматически"
									min={0}
								/>
								<p className={styles.hint}>
									Через сколько секунд квиз откроется автоматически.
									Оставьте пустым для отключения.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Заголовок квиза:</p>
								<input
									className={styles.input}
									value={config.title}
									onChange={e => setField('title', e.target.value)}
									placeholder="Пройдите наш квиз!"
									maxLength={60}
								/>
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
									className={styles.input}
									value={config.buttonText}
									onChange={e => setField('buttonText', e.target.value)}
									placeholder="Начать квиз"
									maxLength={30}
								/>
								<p className={styles.hint}>
									Текст кнопки, с которой начинается прохождение квиза.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Заголовок экрана контакта:</p>
								<input
									className={styles.input}
									value={config.contactTitle}
									onChange={e => setField('contactTitle', e.target.value)}
									placeholder="Оставьте контакт для получения результата"
									maxLength={80}
								/>
								<p className={styles.hint}>
									Заголовок экрана, на котором посетитель оставляет свои
									данные перед показом результата.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Сбор данных:</p>
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
									<option value="PHONE">Телефон</option>
									<option value="EMAIL">Email</option>
									<option value="PHONE_AND_EMAIL">Телефон и Email</option>
									<option value="NONE">Не собирать</option>
								</select>
								<p className={styles.hint}>
									Какие данные собирать у посетителя в обмен на
									персональный результат.
								</p>
							</div>

							{(config.dataType === 'PHONE' ||
								config.dataType === 'PHONE_AND_EMAIL') && (
								<div className={styles.field}>
									<p className={styles.label}>Регион телефона:</p>
									<select
										className={styles.input}
										value={config.phoneRegion}
										onChange={e => setField('phoneRegion', e.target.value)}
									>
										<option value="RU">Россия (+7)</option>
										<option value="BY">Беларусь (+375)</option>
										<option value="KZ">Казахстан (+7)</option>
										<option value="UA">Украина (+380)</option>
										<option value="international">Международный</option>
									</select>
									<p className={styles.hint}>
										Определяет формат и маску номера телефона в поле ввода.
									</p>
								</div>
							)}

							<div className={styles.field}>
								<p className={styles.label}>
									Ссылка на политику конфиденциальности:
								</p>
								<input
									className={styles.input}
									value={config.privacyUrl}
									onChange={e => setField('privacyUrl', e.target.value)}
									placeholder="https://..."
									maxLength={500}
								/>
								<p className={styles.hint}>
									По умолчанию ведёт на нашу политику. Замените на ссылку
									своей политики конфиденциальности.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Заголовок «Уже проходили»:</p>
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
									Показывается посетителю, который открывает квиз повторно.
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

							<div className={styles.field}>
								<p className={styles.label}>
									Повторное прохождение раз в N дней:
								</p>
								<input
									type="number"
									className={styles.input}
									value={cooldownInput}
									onChange={e => {
										setCooldownInput(e.target.value)
										const n = parseInt(e.target.value)
										if (!isNaN(n) && n >= 0 && n <= 365) {
											setField('quizCooldownDays', n)
										}
									}}
									min={0}
									max={365}
									placeholder="0"
								/>
								<p className={styles.hint}>
									0 — проходить можно только единоразово. Любое другое
									число - посетитель сможет проходить снова через указанное
									кол-во дней.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>
									Сброс попыток всех посетителей:
								</p>
								{!confirmResetAttempts ? (
									<button
										type="button"
										className={styles.resetAttemptsBtn}
										onClick={() => setConfirmResetAttempts(true)}
										disabled={resetAttemptsMutation.isPending}
									>
										Сбросить попытки всех посетителей
									</button>
								) : (
									<div
										style={{
											display: 'flex',
											flexDirection: 'column',
											gap: 8
										}}
									>
										<p
											className={styles.hint}
											style={{ color: '#e05a5a' }}
										>
											Все посетители смогут пройти квиз заново. Действие
											необратимо.
										</p>
										<div style={{ display: 'flex', gap: 8 }}>
											<button
												type="button"
												className={styles.resetAttemptsBtn}
												onClick={handleResetAttempts}
												disabled={resetAttemptsMutation.isPending}
											>
												{resetAttemptsMutation.isPending
													? 'Сброс...'
													: 'Да, сбросить'}
											</button>
											<button
												type="button"
												className={styles.copyBtn}
												onClick={() => setConfirmResetAttempts(false)}
											>
												Отмена
											</button>
										</div>
									</div>
								)}
								<p className={styles.hint}>
									Позволяет сбросить счётчик прохождений квиза сразу всем
									посетителям. Они снова смогут пройти квиз.
								</p>
							</div>

							<div className={styles.field}>
								<div className={styles.checkRow}>
									<input
										id="quizFilterDuplicates"
										type="checkbox"
										checked={config.filterDuplicates}
										onChange={e =>
											setField('filterDuplicates', e.target.checked)
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
									Если посетитель оставит контакт, который уже есть в базе
									этого квиза — повторная заявка не будет сохранена и
									уведомления не придут.
								</p>
							</div>

							<div className={styles.field}>
								{!confirmResetDefaults ? (
									<button
										type="button"
										className={styles.resetAttemptsBtn}
										onClick={() => setConfirmResetDefaults(true)}
									>
										Сбросить все настройки до значений по умолчанию
									</button>
								) : (
									<div
										style={{
											display: 'flex',
											flexDirection: 'column',
											gap: 8
										}}
									>
										<p
											className={styles.hint}
											style={{ color: '#e05a5a' }}
										>
											Все настройки квиза будут заменены на стандартные.
											Действие необратимо после сохранения.
										</p>
										<div style={{ display: 'flex', gap: 8 }}>
											<button
												type="button"
												className={styles.resetAttemptsBtn}
												onClick={() => {
													setConfig({
														...DEFAULT_CONFIG,
														questions: config.questions,
														results: config.results
													})
													setCooldownInput('0')
													setConfirmResetDefaults(false)
												}}
											>
												Да, сбросить
											</button>
											<button
												type="button"
												className={styles.copyBtn}
												onClick={() => setConfirmResetDefaults(false)}
											>
												Отмена
											</button>
										</div>
									</div>
								)}
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
									className={styles.infoBlockTitle}
									style={{ marginTop: 4 }}
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
								<p style={{ color: '#e05a5a', fontSize: 13 }}>
									⚠️ Сначала добавьте минимум 2 результата во вкладке
									«Результаты»
								</p>
							)}

							{config.questions.map((q, qIdx) => (
								<div key={q.id} className={styles.questionBlock}>
									<div className={styles.questionHeader}>
										<span className={styles.questionNumber}>
											Вопрос {qIdx + 1} из {config.questions.length}
										</span>
										<div
											style={{
												display: 'flex',
												gap: 8,
												alignItems: 'center'
											}}
										>
											<select
												className={styles.input}
												style={{
													width: 'auto',
													padding: '4px 8px',
													fontSize: 12
												}}
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
													config.questions.length <= 4
														? 'Минимум 1 вопрос'
														: 'Удалить вопрос'
												}
											>
												✕
											</button>
										</div>
									</div>
									<p className={styles.hint} style={{ marginTop: -4 }}>
										{q.type === 'radio'
											? 'Один ответ — посетитель выбирает один вариант. Подходит для большинства вопросов.'
											: 'Несколько ответов — посетитель отмечает любое количество вариантов. Баллы суммируются по всем выбранным.'}
									</p>

									<input
										className={styles.input}
										value={q.text}
										onChange={e =>
											updateQuestion(qIdx, 'text', e.target.value)
										}
										placeholder={`Текст вопроса ${qIdx + 1}`}
										maxLength={200}
									/>

									<div className={styles.optionRow}>
										{q.options.map((opt, oIdx) => (
											<div key={opt.id} className={styles.optionItem}>
												<div className={styles.optionTop}>
													<span
														style={{
															color: '#bbb',
															fontSize: 13,
															minWidth: 20
														}}
													>
														{oIdx + 1}.
													</span>
													<input
														className={styles.optionInput}
														value={opt.text}
														onChange={e =>
															updateOption(
																qIdx,
																oIdx,
																'text',
																e.target.value
															)
														}
														placeholder={`Вариант ${oIdx + 1}`}
														maxLength={150}
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

												{config.results.length > 0 && (
													<div className={styles.scoresRow}>
														{config.results.map(r => (
															<div key={r.id} className={styles.scoreItem}>
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
																			Math.max(
																				0,
																				Math.min(
																					10,
																					Number(e.target.value)
																				)
																			)
																		)
																	}
																	title={`Баллы для результата "${r.title}"`}
																/>
															</div>
														))}
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
								type="button"
								className={styles.addBtn}
								onClick={addQuestion}
								disabled={config.questions.length >= 10}
							>
								{config.questions.length >= 10
									? 'Максимум 10 вопросов'
									: '+ Добавить вопрос'}
							</button>

							{config.questions.length === 0 && (
								<p className={styles.hint} style={{ textAlign: 'center' }}>
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
										<div
											style={{
												display: 'flex',
												alignItems: 'center',
												gap: 8
											}}
										>
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
											className={styles.input}
											value={r.title}
											onChange={e =>
												updateResult(rIdx, 'title', e.target.value)
											}
											placeholder="Например: Вам подойдёт тариф HARD"
											maxLength={80}
										/>
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
											className={styles.input}
											value={r.buttonText}
											onChange={e =>
												updateResult(rIdx, 'buttonText', e.target.value)
											}
											placeholder="Получить скидку"
											maxLength={40}
										/>
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
											className={styles.input}
											value={r.buttonUrl}
											onChange={e =>
												updateResult(rIdx, 'buttonUrl', e.target.value)
											}
											placeholder="https://..."
											maxLength={500}
										/>
										<p className={styles.hint}>
											Куда переходит посетитель по клику на кнопку.
											Например, на страницу товара или оформления заказа.
										</p>
									</div>
								</div>
							))}

							<button
								type="button"
								className={styles.addBtn}
								onClick={addResult}
								disabled={config.results.length >= 5}
							>
								{config.results.length >= 5
									? 'Максимум 5 результатов'
									: '+ Добавить результат'}
							</button>

							{config.results.length === 0 && (
								<p className={styles.hint} style={{ textAlign: 'center' }}>
									Минимум 2 результата, максимум 5. Добавьте результаты
									перед вопросами.
								</p>
							)}
						</div>
					)}

					{/* ===== ИНТЕГРАЦИИ ===== */}
					{tab === 'integrations' && (
						<div className={styles.fields}>
							<div className={styles.field}>
								<p className={styles.label}>Отправка заявок на Email:</p>
								<input
									className={styles.input}
									type="email"
									value={config.integrations?.email || ''}
									onChange={e => setIntegration('email', e.target.value)}
									placeholder="admin@example.com"
								/>
								<p className={styles.hint}>
									Уведомление о каждой новой заявке придёт на этот email.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Отправка заявок в Telegram:</p>
								<input
									className={styles.input}
									value={config.integrations?.telegramChatId || ''}
									onChange={e =>
										setIntegration('telegramChatId', e.target.value)
									}
									placeholder="-123456789"
								/>
								<p className={styles.hint}>
									Напишите боту <b>@winwidget_bot</b> команду /start, затем
									укажите сюда ваш Telegram ID. Узнать ID можно через бот{' '}
									<b>@getmyid_bot</b>
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Внешний URL (Webhook):</p>
								<input
									className={styles.input}
									value={config.integrations?.webhookUrl || ''}
									onChange={e =>
										setIntegration('webhookUrl', e.target.value)
									}
									placeholder="https://..."
								/>
								<p className={styles.hint}>
									На указанный URL придёт POST-запрос с данными:{' '}
									<b>contact</b>, <b>phone</b>, <b>email</b>, <b>result</b>{' '}
									— результат квиза, <b>answers</b> — ответы, <b>url</b> —
									страница.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>
									Отправка заявок в Битрикс24:
								</p>
								<input
									className={styles.input}
									value={config.integrations?.bitrix24WebhookUrl || ''}
									onChange={e =>
										setIntegration('bitrix24WebhookUrl', e.target.value)
									}
									placeholder="https://yourcompany.bitrix24.ru/rest/..."
								/>
								<p className={styles.hint}>
									Укажите URL вашего входящего вебхука из Битрикс24.
									Перейдите в Битрикс24 → Приложения → Вебхуки → Входящий
									вебхук. Новые заявки будут создаваться как лиды в CRM.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>amoCRM — домен аккаунта:</p>
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
								<p className={styles.label}>amoCRM — токен доступа:</p>
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
									скопируйте долгосрочный токен. При каждой заявке будут
									создаваться сделка и контакт.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>
									Яндекс Метрика — ID счётчика:
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
									При открытии квиза отправляется цель <b>wq_open</b>, при
									отправке заявки — <b>wq_send</b>. Счётчик должен быть
									установлен на странице сайта.
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>
									Ретаргетинг ВКонтакте — ID пикселя:
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
								<p className={styles.label}>Roistat:</p>
								<div className={styles.checkRow}>
									<input
										id="quizRoistat"
										type="checkbox"
										checked={config.integrations?.roistatEnabled || false}
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
									При открытии квиза отправляется цель <b>wq_open</b>, при
									отправке заявки — <b>wq_send</b>. Код Roistat должен быть
									подключён на странице сайта.
								</p>
							</div>
						</div>
					)}

					{/* ===== КОД ===== */}
					{tab === 'code' && (
						<div className={styles.fields}>
							<div className={styles.field}>
								<p className={styles.label}>Скрипт для вставки на сайт:</p>
								<textarea
									className={`${styles.input} ${styles.codeArea}`}
									value={scriptCode}
									readOnly
									rows={3}
									onClick={e => (e.target as HTMLTextAreaElement).select()}
								/>
								<button
									type="button"
									className={styles.copyBtn}
									onClick={() => {
										navigator.clipboard.writeText(scriptCode)
										toast.success('Скопировано!')
									}}
								>
									Копировать код
								</button>
								<p className={styles.hint}>
									Вставьте этот код в &lt;head&gt; или перед &lt;/body&gt;
								</p>
							</div>

							<div className={styles.field}>
								<p className={styles.label}>Прямая ссылка на квиз:</p>
								<div className={styles.directLink}>
									<input
										className={styles.input}
										value={directLink}
										readOnly
										onClick={e => (e.target as HTMLInputElement).select()}
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
									onClick={() => {
										navigator.clipboard.writeText(directLink)
										toast.success('Скопировано!')
									}}
								>
									Копировать ссылку
								</button>
								<p className={styles.hint}>
									Используйте, если не нужно подключать квиз к сайту —
									подходит для рассылок, рекламы и мессенджеров.
								</p>
							</div>
						</div>
					)}
				</div>

				<button
					type="button"
					className={styles.saveBtn}
					onClick={handleSave}
					disabled={saveMutation.isPending}
				>
					{saveMutation.isPending ? 'Сохранение...' : 'Сохранить'}
				</button>
			</div>
		</div>
	)
}

export default QuizSettingsModal
