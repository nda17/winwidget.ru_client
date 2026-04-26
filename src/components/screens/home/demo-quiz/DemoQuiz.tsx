'use client'

import { useEffect, useId, useRef, useState } from 'react'
import styles from './DemoQuiz.module.scss'

interface Props {
	open: boolean
	onClose: () => void
}

const SALES_TEXTS = [
	'Хочешь такой же виджет на свой сайт? Подключи за 5 минут — и твои посетители начнут оставлять заявки прямо сейчас.',
	'Каждый посетитель сайта — потенциальный клиент. Квиз превращает любопытных в покупателей. Попробуй бесплатно.',
	'98% посетителей уходят без заявки. Виджет удерживает их — весело, ненавязчиво и эффективно. Хочешь так же?',
	'Твои конкуренты уже используют виджеты для захвата лидов. Не отставай — первые 7 дней бесплатно.',
	'Этот виджет настраивается под любой сайт: свои вопросы, цвета, интеграция с CRM. Запусти за 5 минут.',
	'Заявки из виджета летят прямо в Telegram, CRM или на почту — ни один лид не потеряется.'
]

const QUESTIONS = [
	{
		text: 'Как посетители сейчас узнают о вас?',
		options: [
			'Через поиск (SEO)',
			'Через рекламу',
			'По рекомендациям',
			'Пока мало кто знает'
		]
	},
	{
		text: 'Что происходит с большинством посетителей вашего сайта?',
		options: [
			'Уходят без действий',
			'Смотрят, но редко пишут',
			'Иногда оставляют заявки',
			'Часто оставляют контакты'
		]
	},
	{
		text: 'Что мешает получать больше заявок?',
		options: [
			'Нет инструментов для захвата лидов',
			'Посетители не мотивированы',
			'Слишком сложная форма',
			'Затрудняюсь ответить'
		]
	},
	{
		text: 'Как быстро вы хотите запустить сбор заявок?',
		options: [
			'Прямо сейчас',
			'В течение недели',
			'Пока изучаю варианты',
			'Ещё не решил'
		]
	}
]

const RESULTS = [
	{
		title: 'Стартовый уровень',
		emoji: '🚀',
		text: 'Ваш сайт теряет потенциальных клиентов. Квиз-виджет вовлечёт посетителей и превратит их в лиды — без навязчивых форм и сложных настроек.'
	},
	{
		title: 'Есть куда расти',
		emoji: '📈',
		text: 'Вы работаете над конверсией, но упускаете часть лидов. Квиз добавит игровую механику и увеличит вовлечённость посетителей.'
	},
	{
		title: 'Продвинутый уровень',
		emoji: '⚡',
		text: 'Вы понимаете важность лидогенерации. Квиз с интеграцией CRM и Telegram автоматизирует сбор заявок и сэкономит время.'
	}
]

const DemoQuiz = ({ open, onClose }: Props) => {
	const dialogTitleId = useId()
	const [step, setStep] = useState(0)
	const [answers, setAnswers] = useState<number[]>([])
	const [selected, setSelected] = useState<number | null>(null)
	const [resultIdx, setResultIdx] = useState<number>(0)
	const [salesText, setSalesText] = useState<string | null>(null)
	const salesIndexRef = useRef(-1)

	useEffect(() => {
		document.body.style.overflow = open ? 'hidden' : ''
		return () => {
			document.body.style.overflow = ''
		}
	}, [open])

	useEffect(() => {
		if (!open) {
			setTimeout(() => {
				setStep(0)
				setAnswers([])
				setSelected(null)
				setSalesText(null)
				salesIndexRef.current = -1
			}, 300)
		}
	}, [open])

	useEffect(() => {
		if (step !== QUESTIONS.length) {
			setSalesText(null)
			return
		}
		let intervalId: ReturnType<typeof setInterval>
		const timerId = setTimeout(() => {
			const next = () => {
				salesIndexRef.current =
					(salesIndexRef.current + 1) % SALES_TEXTS.length
				setSalesText(SALES_TEXTS[salesIndexRef.current])
			}
			next()
			intervalId = setInterval(next, 6000)
		}, 1500)
		return () => {
			clearTimeout(timerId)
			clearInterval(intervalId)
		}
	}, [step])

	const handleNext = () => {
		if (selected === null) return
		const newAnswers = [...answers, selected]
		setAnswers(newAnswers)
		setSelected(null)

		if (step < QUESTIONS.length - 1) {
			setStep(step + 1)
		} else {
			const sum = newAnswers.reduce((a, b) => a + b, 0)
			const idx = sum <= 4 ? 0 : sum <= 8 ? 1 : 2
			setResultIdx(idx)
			setStep(QUESTIONS.length)
		}
	}

	const handleRestart = () => {
		setStep(0)
		setAnswers([])
		setSelected(null)
	}

	const isResult = step === QUESTIONS.length
	const progress = Math.round((step / QUESTIONS.length) * 100)
	const result = RESULTS[resultIdx]

	if (!open) return null

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть демо-квиз"
			/>
			<div
				className={styles.card}
				role="dialog"
				aria-modal="true"
				aria-labelledby={dialogTitleId}
			>
				<button
					className={styles.closeBtn}
					onClick={onClose}
					type="button"
					aria-label="Закрыть"
				>
					<svg viewBox="0 0 24 24" fill="none">
						<line
							x1="6"
							y1="6"
							x2="18"
							y2="18"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
						<line
							x1="18"
							y1="6"
							x2="6"
							y2="18"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
						/>
					</svg>
				</button>

				{!isResult ? (
					<>
						<div className={styles.progressWrap}>
							<div
								className={styles.progressBar}
								style={{ width: `${progress}%` }}
							/>
						</div>
						<p className={styles.stepLabel}>
							Вопрос {step + 1} из {QUESTIONS.length}
						</p>

						<h2 id={dialogTitleId} className={styles.question}>
							{QUESTIONS[step].text}
						</h2>

						<div className={styles.options}>
							{QUESTIONS[step].options.map((opt, i) => (
								<button
									key={i}
									type="button"
									className={`${styles.option} ${selected === i ? styles.optionSelected : ''}`}
									onClick={() => setSelected(i)}
								>
									<span className={styles.optionCheck} />
									{opt}
								</button>
							))}
						</div>

						<button
							type="button"
							className={styles.nextBtn}
							onClick={handleNext}
							disabled={selected === null}
						>
							{step < QUESTIONS.length - 1
								? 'Далее →'
								: 'Узнать результат'}
						</button>

						<p className={styles.demoTag}>Демонстрационный режим</p>
					</>
				) : (
					<div className={styles.result}>
						<div className={styles.resultEmoji}>{result.emoji}</div>
						<h2 id={dialogTitleId} className={styles.resultTitle}>
							{result.title}
						</h2>
						<p className={styles.resultText}>{result.text}</p>
						<a href="/register" className={styles.ctaBtn}>
							Попробовать бесплатно
						</a>
						<button
							type="button"
							className={styles.restartBtn}
							onClick={handleRestart}
						>
							Пройти заново
						</button>
						<p className={styles.demoTag}>Демонстрационный режим</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default DemoQuiz
