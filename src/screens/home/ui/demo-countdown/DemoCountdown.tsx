'use client'

import {
	DEMO_PHONE_PLACEHOLDER,
	formatDemoPhone,
	isDemoPhoneValid
} from '@/screens/home/lib/demo-phone'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './DemoCountdown.module.scss'

const SALES_TEXTS = [
	'Хочешь такой же виджет на свой сайт? Подключи за 5 минут — и клиенты начнут оставлять заявки прямо сейчас.',
	'Таймер обратного отсчёта создаёт ощущение срочности и увеличивает конверсию до 40% — попробуй бесплатно.',
	'Виджет запускает персональный отсчёт для каждого посетителя и собирает контакты автоматически.',
	'Заявки из виджета летят прямо в Telegram, CRM или на почту — ни один лид не потеряется.',
	'Никакого кода и разработчиков: скопируй одну строку и виджет уже работает на твоём сайте.',
	'Твои конкуренты уже используют виджеты для захвата лидов. Не отставай — первые 7 дней бесплатно.'
]

const TIMER_SECONDS = 900

function shakeElement(el: HTMLElement) {
	el.classList.remove(styles.shake)
	void el.offsetWidth
	el.classList.add(styles.shake)
	setTimeout(() => el.classList.remove(styles.shake), 450)
}

function pad(n: number) {
	return n < 10 ? '0' + n : String(n)
}

interface Props {
	open: boolean
	onClose: () => void
}

const DemoCountdown = ({ open, onClose }: Props) => {
	const dialogTitleId = useId()
	const [step, setStep] = useState<'countdown' | 'success'>('countdown')
	const [secondsLeft, setSecondsLeft] = useState(TIMER_SECONDS)
	const [phone, setPhone] = useState('')
	const [phoneValid, setPhoneValid] = useState(false)
	const [phoneError, setPhoneError] = useState(false)
	const [salesText, setSalesText] = useState<string | null>(null)
	const phoneRef = useRef<HTMLInputElement>(null)
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
				setStep('countdown')
				setPhone('')
				setPhoneValid(false)
				setPhoneError(false)
			}, 300)
		}
	}, [open])

	useEffect(() => {
		if (!open || step !== 'countdown') return
		setSecondsLeft(TIMER_SECONDS)
		const id = setInterval(() => {
			setSecondsLeft(prev => {
				if (prev <= 1) {
					clearInterval(id)
					return 0
				}
				return prev - 1
			})
		}, 1000)
		return () => clearInterval(id)
	}, [open, step])

	useEffect(() => {
		if (!open || step !== 'countdown') {
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
	}, [open, step])

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
		setStep('success')
	}

	const days = 0
	const hours = 0
	const minutes = Math.floor(secondsLeft / 60)
	const secs = secondsLeft % 60

	if (!open) return null

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть"
			/>
			<div
				className={styles.modal}
				role="dialog"
				aria-modal="true"
				aria-labelledby={dialogTitleId}
			>
				{step === 'countdown' ? (
					<>
						<button
							type="button"
							className={styles.closeBtn}
							onClick={onClose}
							aria-label="Закрыть"
						>
							&times;
						</button>

						<div className={styles.badgeWrap}>
							<span className={styles.badge}>Акция</span>
						</div>

						<h2 id={dialogTitleId} className={styles.title}>
							Скидка ограничена по времени
						</h2>
						<p className={styles.subtitle}>
							Успейте воспользоваться предложением до окончания таймера
						</p>

						<div className={styles.timerGrid}>
							{(
								[
									[days, 'дни'],
									[hours, 'часы'],
									[minutes, 'мин'],
									[secs, 'сек']
								] as [number, string][]
							).map(([val, label]) => (
								<div key={label} className={styles.timerBox}>
									<span className={styles.timerValue}>
										{label === 'дни' ? String(val) : pad(val)}
									</span>
									<span className={styles.timerCaption}>{label}</span>
								</div>
							))}
						</div>

						<p className={styles.contactTitle}>
							Оставьте контакт, чтобы получить предложение
						</p>

						<div className={styles.fieldWrap}>
							<input
								ref={phoneRef}
								type="tel"
								placeholder={DEMO_PHONE_PLACEHOLDER}
								className={`${styles.input} ${phoneError ? styles.inputError : ''}`}
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
							style={{ opacity: phoneValid ? 1 : 0.5 }}
							onClick={handleSubmit}
						>
							Получить предложение
						</button>

						<p className={styles.privacy}>
							Нажимая кнопку, вы соглашаетесь с{' '}
							<a
								href="/legal-documentation/consent-processing"
								target="_blank"
								rel="noopener"
							>
								политикой конфиденциальности
							</a>
						</p>

						{salesText ? (
							<div className={styles.salesText}>{salesText}</div>
						) : (
							<p className={styles.demoTag}>Демонстрационный режим</p>
						)}
					</>
				) : (
					<>
						<button
							type="button"
							className={styles.closeBtn}
							onClick={onClose}
							aria-label="Закрыть"
						>
							&times;
						</button>

						<div className={styles.successIcon}>✓</div>
						<h2 id={dialogTitleId} className={styles.successTitle}>
							Спасибо! Заявка отправлена
						</h2>
						<p className={styles.successSubtitle}>
							Мы скоро свяжемся с вами
						</p>
						<a href="/register" className={styles.ctaBtn}>
							Попробовать бесплатно
						</a>

						<p className={styles.demoTag}>Демонстрационный режим</p>
					</>
				)}
			</div>
		</div>
	)
}

export default DemoCountdown
