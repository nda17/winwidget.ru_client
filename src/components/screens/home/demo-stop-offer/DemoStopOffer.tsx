'use client'

import {
	DEMO_PHONE_PLACEHOLDER,
	formatDemoPhone,
	isDemoPhoneValid
} from '@/utils/demo-phone.util'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './DemoStopOffer.module.scss'

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

const DemoStopOffer = ({ open, onClose }: Props) => {
	const dialogTitleId = useId()
	const [submitted, setSubmitted] = useState(false)
	const [phone, setPhone] = useState('')
	const [phoneValid, setPhoneValid] = useState(false)
	const [phoneError, setPhoneError] = useState(false)
	const phoneRef = useRef<HTMLInputElement>(null)

	useEffect(() => {
		document.body.style.overflow = open ? 'hidden' : ''
		return () => {
			document.body.style.overflow = ''
		}
	}, [open])

	useEffect(() => {
		if (!open) {
			setTimeout(() => {
				setSubmitted(false)
				setPhone('')
				setPhoneValid(false)
				setPhoneError(false)
			}, 300)
		}
	}, [open])

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
				aria-label="Закрыть стоп-оффер"
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
							Спасибо! Скидка закреплена
						</h2>
						<p className={styles.successSubtitle}>
							Мы скоро свяжемся с вами
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
						<div className={styles.badge}>Подождите</div>
						<div className={styles.offer}>Скидка 10%</div>
						<h2 id={dialogTitleId} className={styles.title}>
							Заберите скидку 10%
						</h2>
						<p className={styles.subtitle}>
							Оставьте контакт или перейдите к предложению прямо сейчас
						</p>

						<p className={styles.contactTitle}>Куда отправить скидку?</p>
						<div className={styles.form}>
							<div>
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
								onClick={handleSubmit}
							>
								Забрать скидку
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

export default DemoStopOffer
