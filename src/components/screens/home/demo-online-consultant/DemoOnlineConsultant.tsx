'use client'

import {
	DEMO_PHONE_PLACEHOLDER,
	formatDemoPhone,
	isDemoPhoneValid
} from '@/utils/demo-phone.util'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './DemoOnlineConsultant.module.scss'

const ACTIONS = [
	{
		id: 'price',
		label: 'Цена',
		answer:
			'Стоимость зависит от задачи и тарифа. Оставьте номер, и мы подскажем подходящий вариант.',
		buttonText: 'Посмотреть тарифы',
		buttonUrl: '#pricing'
	},
	{
		id: 'setup',
		label: 'Настройка',
		answer:
			'Виджет ставится одной строкой кода. Цвета, тексты, вопросы и интеграции меняются в кабинете.',
		buttonText: '',
		buttonUrl: ''
	},
	{
		id: 'integrations',
		label: 'Интеграции',
		answer:
			'Заявки можно отправлять на email, в Telegram, CRM, webhook и системы аналитики.',
		buttonText: '',
		buttonUrl: ''
	},
	{
		id: 'trial',
		label: 'Пробный период',
		answer:
			'Первые 7 дней можно протестировать виджеты бесплатно и проверить, как они собирают заявки.',
		buttonText: 'Попробовать',
		buttonUrl: '/register'
	}
]

const SALES_TEXTS = [
	'Хочешь такой же виджет на свой сайт? Подключи за 5 минут — и посетители начнут задавать вопросы прямо сейчас.',
	'Онлайн-консультант закрывает частые вопросы без полноценного чата и помогает не терять тёплые заявки.',
	'Добавь популярные вопросы, быстрые ответы и ссылки — виджет сам подскажет посетителю следующий шаг.',
	'Заявки из виджета можно отправлять в Telegram, CRM, webhook или на почту — ни один лид не потеряется.',
	'Никакого кода и разработчиков: скопируй одну строку и виджет уже работает на твоём сайте.',
	'Первые 7 дней можно протестировать виджет бесплатно и проверить, как он собирает заявки.'
]

function shakeElement(el: HTMLElement) {
	el.classList.remove(styles.shake)
	void el.offsetWidth
	el.classList.add(styles.shake)
	setTimeout(() => el.classList.remove(styles.shake), 450)
}

interface Props {
	open: boolean
	onClose: () => void
}

const DemoOnlineConsultant = ({ open, onClose }: Props) => {
	const dialogTitleId = useId()
	const [selectedActionId, setSelectedActionId] = useState(ACTIONS[0].id)
	const [submitted, setSubmitted] = useState(false)
	const [phone, setPhone] = useState('')
	const [phoneValid, setPhoneValid] = useState(false)
	const [phoneError, setPhoneError] = useState(false)
	const [salesText, setSalesText] = useState<string | null>(null)
	const phoneRef = useRef<HTMLInputElement>(null)
	const salesIndexRef = useRef(-1)

	const selectedAction =
		ACTIONS.find(action => action.id === selectedActionId) || ACTIONS[0]

	useEffect(() => {
		document.body.style.overflow = open ? 'hidden' : ''
		return () => {
			document.body.style.overflow = ''
		}
	}, [open])

	useEffect(() => {
		if (!open) {
			setTimeout(() => {
				setSelectedActionId(ACTIONS[0].id)
				setSubmitted(false)
				setPhone('')
				setPhoneValid(false)
				setPhoneError(false)
				setSalesText(null)
			}, 300)
		}
	}, [open])

	useEffect(() => {
		if (!open || submitted) {
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
		}, 3000)

		return () => {
			clearTimeout(timerId)
			clearInterval(intervalId)
		}
	}, [open, submitted])

	const handlePhoneChange = (value: string) => {
		const formatted = formatDemoPhone(value)
		const valid = isDemoPhoneValid(formatted)
		setPhone(formatted)
		setPhoneValid(valid)
		if (valid) setPhoneError(false)
	}

	const handlePhoneBlur = () => {
		if (!phone.trim()) return
		const valid = isDemoPhoneValid(phone)
		setPhoneValid(valid)
		setPhoneError(!valid)
		if (valid) setPhone(formatDemoPhone(phone))
	}

	const handleSubmit = () => {
		if (!phoneValid) {
			setPhoneError(true)
			if (phoneRef.current) shakeElement(phoneRef.current)
			return
		}

		setSubmitted(true)
	}

	if (!open) return null

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть онлайн-консультант"
			/>
			<div
				className={styles.modal}
				role="dialog"
				aria-modal="true"
				aria-labelledby={dialogTitleId}
			>
				<button
					type="button"
					className={styles.closeBtn}
					onClick={onClose}
					aria-label="Закрыть"
				>
					&times;
				</button>

				{submitted ? (
					<>
						<div className={styles.successIcon}>✓</div>
						<h2 id={dialogTitleId} className={styles.successTitle}>
							Спасибо! Заявка отправлена
						</h2>
						<p className={styles.successSubtitle}>
							Мы свяжемся с вами и ответим по теме «{selectedAction.label}
							».
						</p>
						<div className={styles.brand}>
							Сделано в{' '}
							<a
								href="https://winwidget.ru"
								target="_blank"
								rel="noopener"
							>
								winwidget.ru
							</a>
						</div>
					</>
				) : (
					<>
						<h2 id={dialogTitleId} className={styles.title}>
							Онлайн-консультант
						</h2>
						<p className={styles.subtitle}>
							Выберите популярный вопрос и получите быстрый ответ.
						</p>

						<div className={styles.actions}>
							{ACTIONS.map(action => (
								<button
									type="button"
									key={action.id}
									className={`${styles.actionBtn} ${
										selectedActionId === action.id
											? styles.actionBtnActive
											: ''
									}`}
									onClick={() => setSelectedActionId(action.id)}
								>
									{action.label}
								</button>
							))}
						</div>

						<div className={styles.answer}>
							<p>{selectedAction.answer}</p>
							{selectedAction.buttonText && selectedAction.buttonUrl && (
								<a
									className={styles.answerLink}
									href={selectedAction.buttonUrl}
								>
									{selectedAction.buttonText}
								</a>
							)}
						</div>

						<p className={styles.contactTitle}>
							Оставьте контакт, если нужен персональный ответ
						</p>
						<div className={styles.form}>
							<div>
								<input
									ref={phoneRef}
									type="tel"
									placeholder={DEMO_PHONE_PLACEHOLDER}
									className={`${styles.input} ${
										phoneError ? styles.inputError : ''
									}`}
									value={phone}
									onChange={e => handlePhoneChange(e.target.value)}
									onBlur={handlePhoneBlur}
									inputMode="tel"
									autoComplete="tel"
								/>
								{phoneError && (
									<p className={styles.errText}>
										Введите корректный номер телефона
									</p>
								)}
							</div>

							<button
								type="button"
								className={styles.submitBtn}
								onClick={handleSubmit}
							>
								Отправить
							</button>

							<p className={styles.privacy}>
								Нажимая кнопку, вы соглашаетесь с{' '}
								<a
									href="/legal-documentation/consent-processing"
									target="_blank"
									rel="noopener"
								>
									обработкой данных
								</a>
							</p>

							{salesText ? (
								<div className={styles.salesText}>{salesText}</div>
							) : (
								<p className={styles.demoTag}>Демонстрационный режим</p>
							)}
						</div>

						<div className={styles.brand}>
							Сделано в{' '}
							<a
								href="https://winwidget.ru"
								target="_blank"
								rel="noopener"
							>
								winwidget.ru
							</a>
						</div>
					</>
				)}
			</div>
		</div>
	)
}

export default DemoOnlineConsultant
