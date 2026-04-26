'use client'

import { useEffect, useId, useRef, useState } from 'react'
import styles from './DemoCallback.module.scss'

const MASK = '+7 (###) ###-##-##'
const PLACEHOLDER = '+7 (___) ___-__-__'
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

function renderMask(digits: string): string {
	let i = 0
	return MASK.replace(/#/g, () => (i < digits.length ? digits[i++] : '_'))
}

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
	const [phone, setPhone] = useState(renderMask(''))
	const [phoneValid, setPhoneValid] = useState(false)
	const [phoneError, setPhoneError] = useState(false)
	const [salesText, setSalesText] = useState<string | null>(null)
	const digitsRef = useRef('')
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
				setPhone(renderMask(''))
				setPhoneValid(false)
				setPhoneError(false)
				digitsRef.current = ''
			}, 300)
		}
	}, [open])

	useEffect(() => {
		const el = phoneRef.current
		if (!el || !phone) return
		const pos = phone.indexOf('_')
		const cursor = pos === -1 ? phone.length : pos
		el.setSelectionRange(cursor, cursor)
	}, [phone])

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

	const applyDigits = (digits: string) => {
		digitsRef.current = digits
		const masked = renderMask(digits)
		setPhone(masked)
		const valid = digits.length >= 10
		setPhoneValid(valid)
		if (valid) setPhoneError(false)
	}

	const handlePhoneFocus = () => {
		if (!digitsRef.current) {
			const masked = renderMask('')
			setPhone(masked)
		}
	}

	const handlePhoneKeyDown = (
		e: React.KeyboardEvent<HTMLInputElement>
	) => {
		if (/\d/.test(e.key)) {
			if (digitsRef.current.length < 10) {
				applyDigits(digitsRef.current + e.key)
			}
			e.preventDefault()
			return
		}
		if (e.key === 'Backspace') {
			applyDigits(digitsRef.current.slice(0, -1))
			e.preventDefault()
			return
		}
		if (!['ArrowLeft', 'ArrowRight', 'Tab'].includes(e.key)) {
			e.preventDefault()
		}
	}

	const handlePhonePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
		e.preventDefault()
		const text = e.clipboardData.getData('text')
		let digits = text.replace(/\D/g, '')
		if (digits.startsWith('8')) digits = '7' + digits.slice(1)
		if (digits.startsWith('7')) digits = digits.slice(1)
		applyDigits(digits.slice(0, 10))
	}

	const handlePhoneBlur = () => {
		if (!digitsRef.current.length) setPhone(renderMask(''))
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
								placeholder={PLACEHOLDER}
								className={`${styles.input} ${phoneError ? styles.inputError : ''}`}
								value={phone}
								onChange={() => {}}
								onFocus={handlePhoneFocus}
								onKeyDown={handlePhoneKeyDown}
								onPaste={handlePhonePaste}
								onBlur={handlePhoneBlur}
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
