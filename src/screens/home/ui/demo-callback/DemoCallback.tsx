'use client'

import {
	DEMO_PHONE_PLACEHOLDER,
	formatDemoPhone,
	isDemoPhoneValid
} from '@/screens/home/lib/demo-phone'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './DemoCallback.module.scss'

const ACCENT = '#4705fb'

const SALES_TEXTS = [
	'Хочешь такой же виджет на свой сайт? Подключи за 5 минут — и клиенты начнут оставлять заявки прямо сейчас.',
	'98% посетителей уходят без заявки. Виджет обратного звонка удерживает их и превращает в клиентов.',
	'Средний рост конверсии после установки виджета — до 30%. Проверь на своём сайте бесплатно.',
	'Заявки из виджета летят прямо в Telegram, CRM или на почту — ни один лид не потеряется.',
	'Никакого кода и разработчиков: скопируй одну строку и виджет уже работает на твоём сайте.',
	'Твои конкуренты уже используют виджеты для захвата лидов. Не отставай — первые 7 дней бесплатно.'
]

const TIME_SLOTS = [
	'9:00–11:00',
	'11:00–13:00',
	'13:00–15:00',
	'15:00–17:00',
	'17:00–19:00'
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

const DemoCallback = ({ open, onClose }: Props) => {
	const dialogTitleId = useId()
	const [step, setStep] = useState<'form' | 'success'>('form')
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
				setStep('form')
				setPhone('')
				setPhoneValid(false)
				setPhoneError(false)
			}, 300)
		}
	}, [open])

	useEffect(() => {
		if (!open || step !== 'form') {
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
				{step === 'form' ? (
					<>
						<button
							type="button"
							className={styles.closeBtn}
							onClick={onClose}
							aria-label="Закрыть"
						>
							&times;
						</button>

						<h2 id={dialogTitleId} className={styles.title}>
							Заказать звонок
						</h2>
						<p className={styles.subtitle}>
							Оставьте номер телефона — мы перезвоним в удобное время
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
								style={{
									borderColor: phoneError ? '#ef4444' : undefined
								}}
							/>
							{phoneError && (
								<p className={styles.errText}>
									Введите корректный номер телефона
								</p>
							)}
						</div>

						<div className={styles.fieldWrap}>
							<label htmlFor="demo-cb-slot" className={styles.selectLabel}>
								Удобное время для звонка
							</label>
							<select
								id="demo-cb-slot"
								className={styles.select}
								style={{
									['--accent' as string]: ACCENT
								}}
							>
								{TIME_SLOTS.map(slot => (
									<option key={slot} value={slot}>
										{slot}
									</option>
								))}
							</select>
						</div>

						<button
							type="button"
							className={styles.submitBtn}
							style={{ opacity: phoneValid ? 1 : 0.5 }}
							onClick={handleSubmit}
						>
							Заказать звонок
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
							Спасибо! Мы перезвоним
						</h2>
						<p className={styles.successSubtitle}>
							Ожидайте звонка в выбранное время
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

export default DemoCallback
