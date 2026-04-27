'use client'

import {
	DEMO_PHONE_PLACEHOLDER,
	formatDemoPhone,
	isDemoPhoneValid
} from '@/utils/demo-phone.util'
import { useEffect, useId, useRef, useState } from 'react'
import styles from './DemoWheel.module.scss'

const CONFETTI_COLORS_EXP = [
	'#FFD700',
	'#FFC200',
	'#FF6B9D',
	'#FF4757',
	'#7BED9F',
	'#2ED573',
	'#70A1FF',
	'#1E90FF',
	'#ECCC68',
	'#ffffff',
	'#A29BFE',
	'#6C5CE7',
	'#FF6348',
	'#FFA502'
]
const CONFETTI_COLORS_FALL = [
	'#FFD700',
	'#FF6B9D',
	'#7BED9F',
	'#70A1FF',
	'#ECCC68',
	'#ffffff',
	'#A29BFE',
	'#FF6348'
]
const CONFETTI_SHAPES = [
	'square',
	'circle',
	'streamer',
	'diamond',
	'square',
	'circle'
] as const

function applyConfettiBaseStyle(
	el: HTMLDivElement,
	shape: string,
	size: number
) {
	el.style.position = 'absolute'
	el.style.pointerEvents = 'none'
	el.style.opacity = '1'
	el.style.transformOrigin = 'center center'
	el.style.willChange = 'transform, opacity'
	if (shape === 'streamer') {
		el.style.width = '4px'
		el.style.height = '20px'
		el.style.borderRadius = '2px'
	} else {
		el.style.width = `${size}px`
		el.style.height = `${size}px`
		if (shape === 'square') el.style.borderRadius = '2px'
		else if (shape === 'circle') el.style.borderRadius = '50%'
		else if (shape === 'diamond') el.style.borderRadius = '1px'
	}
}

function confettiExplosioneEffect(container: HTMLElement) {
	const rect = container.getBoundingClientRect()
	const W = rect.width
	const H = rect.height
	const count = 160

	const waves = [
		{
			delay: 0,
			origins: [{ x: W * 0.5, y: H * 0.35, n: Math.floor(count * 0.45) }]
		},
		{
			delay: 180,
			origins: [
				{ x: W * 0.2, y: H * 0.25, n: Math.floor(count * 0.25) },
				{ x: W * 0.8, y: H * 0.25, n: Math.floor(count * 0.25) }
			]
		},
		{
			delay: 380,
			origins: [
				{ x: W * 0.5, y: H * 0.2, n: Math.floor(count * 0.2) },
				{ x: W * 0.1, y: H * 0.4, n: Math.floor(count * 0.1) },
				{ x: W * 0.9, y: H * 0.4, n: Math.floor(count * 0.1) }
			]
		}
	]

	waves.forEach(({ delay, origins }) => {
		setTimeout(() => {
			origins.forEach(({ x, y, n }) => {
				for (let i = 0; i < n; i++) {
					const el = document.createElement('div')
					const shape =
						CONFETTI_SHAPES[
							Math.floor(Math.random() * CONFETTI_SHAPES.length)
						]
					const size = Math.random() * 8 + 5
					applyConfettiBaseStyle(el, shape, size)
					el.style.backgroundColor =
						CONFETTI_COLORS_EXP[
							Math.floor(Math.random() * CONFETTI_COLORS_EXP.length)
						]
					el.style.left = `${x + (Math.random() - 0.5) * 16}px`
					el.style.top = `${y + (Math.random() - 0.5) * 16}px`
					container.appendChild(el)

					const angle =
						(-90 + (Math.random() - 0.5) * 200) * (Math.PI / 180)
					const power = 120 + Math.random() * 220
					const vx = Math.cos(angle) * power
					const vy = Math.sin(angle) * power
					const r0 = Math.random() * 360
					const r1 = r0 + (Math.random() * 900 - 450)
					const phase1 = 380 + Math.random() * 200

					requestAnimationFrame(() => {
						el.style.transition = `transform ${phase1}ms cubic-bezier(.15,.8,.25,1)`
						el.style.transform = `translate(${vx}px,${vy}px) rotate(${r0}deg)`
					})
					setTimeout(() => {
						const fallY = H - y + Math.abs(vy) + 80
						const drift = (Math.random() - 0.5) * 100
						const phase2 = 1800 + Math.random() * 900
						el.style.transition = `transform ${phase2}ms cubic-bezier(.1,.5,.3,1), opacity ${Math.round(phase2 * 0.35)}ms ease-out ${Math.round(phase2 * 0.65)}ms`
						el.style.transform = `translate(${vx + drift}px,${vy + fallY}px) rotate(${r1}deg)`
						el.style.opacity = '0'
					}, phase1)
					setTimeout(() => el.remove(), phase1 + 2800)
				}
			})
		}, delay)
	})
}

function confettiFallsEffect(container: HTMLElement) {
	const rect = container.getBoundingClientRect()
	for (let i = 0; i < 60; i++) {
		const delay = Math.random() * 1200
		setTimeout(() => {
			const el = document.createElement('div')
			const shape =
				CONFETTI_SHAPES[Math.floor(Math.random() * CONFETTI_SHAPES.length)]
			const size = Math.random() * 6 + 5
			applyConfettiBaseStyle(el, shape, size)
			el.style.backgroundColor =
				CONFETTI_COLORS_FALL[
					Math.floor(Math.random() * CONFETTI_COLORS_FALL.length)
				]
			el.style.left = `${Math.random() * rect.width}px`
			el.style.top = '-20px'
			container.appendChild(el)

			const duration = 3.5 + Math.random() * 2
			const swingX = (Math.random() - 0.5) * 60
			const rotate = Math.random() * 720 * (Math.random() < 0.5 ? 1 : -1)
			requestAnimationFrame(() => {
				el.style.transition = `top ${duration}s linear, transform ${duration}s ease-out, opacity 0.8s ease-out ${(duration - 0.9).toFixed(1)}s`
				el.style.top = `${rect.height + 20}px`
				el.style.transform = `translateX(${swingX}px) rotate(${rotate}deg)`
				el.style.opacity = '0'
			})
			setTimeout(() => el.remove(), duration * 1000 + 300)
		}, delay)
	}
}

const CENTER = 150
const RADIUS = 150
const EMAIL_RE =
	/^(([^<>()[\].,;:\s@"]+(\.[^<>()[\].,;:\s@"]+)*)|(".+"))@(([^<>()[\].,;:\s@"]+\.)+[^<>()[\].,;:\s@"]{2,})$/i

const SECTORS = [
	{ label: 'Скидка 10%', color: '#470b58', textColor: '#fff' },
	{ label: 'Подарок!', color: '#8a1580', textColor: '#fff' },
	{ label: 'Скидка 5%', color: '#c21b84', textColor: '#fff' },
	{ label: 'Бесплатно', color: '#e03060', textColor: '#fff' },
	{ label: 'Бонус', color: '#fa595e', textColor: '#fff' },
	{ label: 'Скидка 15%', color: '#f87040', textColor: '#fff' },
	{ label: 'Промокод', color: '#f8a030', textColor: '#1a0600' },
	{ label: 'Скидка 20%', color: '#f8bd31', textColor: '#1a0600' }
]

const STEP = 360 / SECTORS.length
const SPIN_DURATION = 4 // секунд

const SALES_TEXTS = [
	'Хочешь такой же виджет на свой сайт? Подключи за 5 минут — и твои посетители начнут оставлять заявки прямо сейчас.',
	'Каждый посетитель сайта — потенциальный клиент. Колесо фортуны превращает любопытных в покупателей. Попробуй бесплатно.',
	'98% посетителей уходят без заявки. Виджет удерживает их — весело, ненавязчиво и эффективно. Хочешь так же?',
	'Твои конкуренты уже используют виджеты для захвата лидов. Не отставай — первые 7 дней бесплатно.',
	'Этот виджет настраивается под любой сайт: свои призы, цвета, интеграция с CRM. Запусти за 5 минут.',
	'Средний рост конверсии после установки виджета — до 30%. Проверь на своём сайте бесплатно.',
	'Никакого кода и разработчиков: скопируй одну строку и виджет уже работает на твоём сайте.',
	'Заявки из виджета летят прямо в Telegram, CRM или на почту — ни один лид не потеряется.'
]

function sectorPath(start: number, end: number) {
	const r = Math.PI / 180
	const x1 = CENTER + RADIUS * Math.cos(start * r)
	const y1 = CENTER + RADIUS * Math.sin(start * r)
	const x2 = CENTER + RADIUS * Math.cos(end * r)
	const y2 = CENTER + RADIUS * Math.sin(end * r)
	return `M ${CENTER} ${CENTER} L ${x1} ${y1} A ${RADIUS} ${RADIUS} 0 0 1 ${x2} ${y2} Z`
}

function shakeElement(el: HTMLElement) {
	const distance = 6
	const shakes = 15
	const duration = 350
	let start: number | null = null
	const animate = (time: number) => {
		if (!start) start = time
		const progress = (time - start) / duration
		el.style.transform = `translateX(${Math.sin(progress * shakes * Math.PI * 2) * distance * (1 - progress)}px)`
		if (progress < 1) requestAnimationFrame(animate)
		else el.style.transform = ''
	}
	requestAnimationFrame(animate)
}

interface DemoWheelProps {
	hideButton?: boolean
	open?: boolean
	onClose?: () => void
}

const DemoWheel = ({
	hideButton,
	open: externalOpen,
	onClose: externalClose
}: DemoWheelProps = {}) => {
	const [internalOpen, setInternalOpen] = useState(false)
	const isControlled = externalOpen !== undefined
	const open = isControlled ? externalOpen! : internalOpen
	const [rotation, setRotation] = useState(0)
	const [spinning, setSpinning] = useState(false)
	const dialogTitleId = useId()
	const [salesText, setSalesText] = useState<string | null>(null)
	const [phone, setPhone] = useState('')
	const [email, setEmail] = useState('')
	const [phoneError, setPhoneError] = useState(false)
	const [emailError, setEmailError] = useState(false)
	const salesIndexRef = useRef(-1)

	const phoneRef = useRef<HTMLInputElement>(null)
	const emailRef = useRef<HTMLInputElement>(null)
	const floatRef = useRef<HTMLDivElement>(null)
	const cardRef = useRef<HTMLDivElement>(null)
	// Отдельный слой для качания — управляется напрямую через DOM, не через state
	const swingRef = useRef<SVGGElement>(null)

	useEffect(() => {
		const updateRight = () => {
			const mainEl = document.querySelector('main')
			const floatEl = floatRef.current
			if (!mainEl || !floatEl) return
			const fromViewportRight =
				window.innerWidth - mainEl.getBoundingClientRect().right
			floatEl.style.right = fromViewportRight + 24 + 'px'
		}
		updateRight()
		window.addEventListener('resize', updateRight)
		return () => window.removeEventListener('resize', updateRight)
	}, [])

	useEffect(() => {
		document.body.style.overflow = open ? 'hidden' : ''
		return () => {
			document.body.style.overflow = ''
		}
	}, [open])

	const validate = () => {
		let valid = true
		if (!isDemoPhoneValid(phone)) {
			setPhoneError(true)
			if (phoneRef.current) shakeElement(phoneRef.current)
			valid = false
		}
		if (!EMAIL_RE.test(email)) {
			setEmailError(true)
			if (emailRef.current) shakeElement(emailRef.current)
			valid = false
		}
		return valid
	}

	const handlePhoneChange = (value: string) => {
		setPhone(formatDemoPhone(value))
		setPhoneError(false)
	}

	const handlePhoneBlur = () => {
		if (!phone.trim()) return
		if (!isDemoPhoneValid(phone)) setPhoneError(true)
		else setPhone(formatDemoPhone(phone))
	}

	const spin = () => {
		if (spinning || !validate()) return
		setSalesText(null)

		// Выбираем следующий текст по кругу, без повтора
		const nextIndex = (salesIndexRef.current + 1) % SALES_TEXTS.length
		salesIndexRef.current = nextIndex

		// Выбираем случайный выигрышный сектор
		const winIndex = Math.floor(Math.random() * SECTORS.length)

		// Центр сектора в координатах колеса (как в wheel.js)
		const midAngleSVG = -90 + winIndex * STEP + STEP / 2

		// Для попадания сектора на стрелку (правая сторона = 0°):
		// нужно rotation ≡ -midAngleSVG (mod 360)
		const targetOffset = ((-midAngleSVG % 360) + 360) % 360
		const currentMod = rotation % 360
		let delta = (targetOffset - currentMod + 360) % 360
		// Минимум 6 полных оборотов (как в wheel.js)
		if (delta < 2160) delta += 360 * Math.ceil((2160 - delta) / 360)

		setSpinning(true)
		setRotation(rotation + delta)
	}

	const handleTransitionEnd = () => {
		setSpinning(false)

		if (cardRef.current) {
			confettiExplosioneEffect(cardRef.current)
			setTimeout(() => {
				if (cardRef.current) confettiFallsEffect(cardRef.current)
			}, 600)
		}

		// Качание через отдельный DOM-слой
		const el = swingRef.current
		if (!el) return
		const amplitude = 5
		const duration = 1000
		const start = Date.now()
		const tick = () => {
			const progress = Math.min((Date.now() - start) / duration, 1)
			const swing =
				Math.sin(progress * Math.PI * 4) * amplitude * (1 - progress)
			el.style.transform = `rotate(${swing}deg)`
			el.style.transformOrigin = '150px 150px'
			if (progress < 1) {
				requestAnimationFrame(tick)
			} else {
				el.style.transform = ''
				// Показываем продающий текст после окончания качания
				setSalesText(SALES_TEXTS[salesIndexRef.current])
			}
		}
		requestAnimationFrame(tick)
	}

	const close = () => {
		if (!spinning) {
			if (isControlled) externalClose?.()
			else setInternalOpen(false)
		}
	}

	return (
		<>
			{!hideButton && (
				<div ref={floatRef} className={styles.floatOuter}>
					<button
						type="button"
						className={styles.floatBtn}
						onClick={() => setInternalOpen(true)}
						aria-label="Приз! Открыть демо-виджет"
					>
						<span className={styles.floatIcon}>🎁</span>
						<span className={styles.floatLabel}>Приз!</span>
					</button>
				</div>
			)}

			{open && (
				<div className={styles.overlay}>
					<button
						type="button"
						className={styles.backdrop}
						onClick={close}
						aria-label="Закрыть демо-виджет"
					/>
					<div
						ref={cardRef}
						className={styles.card}
						role="dialog"
						aria-modal="true"
						aria-labelledby={dialogTitleId}
					>
						<button
							className={styles.closeBtn}
							onClick={close}
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

						<div className={styles.content}>
							<div className={styles.controls}>
								<h2 id={dialogTitleId} className={styles.title}>
									Крути и выигрывай!
								</h2>
								<p className={styles.subtitle}>
									Испытай удачу и получи один из наших призов прямо сейчас
								</p>
								<input
									ref={phoneRef}
									type="tel"
									placeholder={`✦  ${DEMO_PHONE_PLACEHOLDER}`}
									className={`${styles.input} ${phoneError ? styles.inputError : ''}`}
									value={phone}
									onChange={e => handlePhoneChange(e.target.value)}
									onBlur={handlePhoneBlur}
									inputMode="tel"
									autoComplete="tel"
								/>
								<input
									ref={emailRef}
									type="email"
									placeholder="✦  Ваш email"
									className={`${styles.input} ${emailError ? styles.inputError : ''}`}
									value={email}
									onChange={e => {
										setEmail(e.target.value)
										setEmailError(false)
									}}
									onBlur={() => {
										if (email.trim()) validate()
									}}
								/>
								<button
									type="button"
									className={styles.spinBtn}
									onClick={spin}
									disabled={spinning}
								>
									🎰&nbsp;{spinning ? 'Крутится...' : 'Крутить!'}
								</button>
								{salesText ? (
									<div className={styles.salesText}>{salesText}</div>
								) : (
									<div className={styles.demoTag}>
										Демонстрационный режим
									</div>
								)}
							</div>

							<div className={styles.wheelWrap}>
								<div className={styles.arrow}>
									<svg viewBox="0 0 20 24" fill="none">
										<path
											d="M2 12 L18 3 L14 12 L18 21 Z"
											fill="#ffffff"
											stroke="rgba(0,0,0,0.3)"
											strokeWidth="1"
										/>
									</svg>
								</div>

								<svg viewBox="0 0 300 300" className={styles.svg}>
									<defs>
										<filter
											id="dw-shadow"
											x="-50%"
											y="-50%"
											width="200%"
											height="200%"
										>
											<feDropShadow
												dx="0"
												dy="3"
												stdDeviation="6"
												floodColor="rgba(0,0,0,0.45)"
											/>
										</filter>
										<filter
											id="dw-text"
											x="-20%"
											y="-20%"
											width="140%"
											height="140%"
										>
											<feDropShadow
												dx="0"
												dy="1"
												stdDeviation="1.5"
												floodColor="rgba(0,0,0,0.5)"
											/>
										</filter>
										<linearGradient
											id="dw-shine"
											x1="0"
											y1="0"
											x2="0"
											y2="1"
										>
											<stop
												offset="0%"
												stopColor="rgba(255,255,255,0.12)"
											/>
											<stop offset="60%" stopColor="rgba(255,255,255,0)" />
										</linearGradient>
										<radialGradient id="dw-center" cx="35%" cy="35%">
											<stop offset="0%" stopColor="#ffffff" />
											<stop offset="100%" stopColor="#7b3fa0" />
										</radialGradient>
									</defs>

									{/* Слой качания (swing) — управляется через DOM-ref */}
									<g ref={swingRef}>
										{/* Слой вращения — управляется через state */}
										<g
											style={{
												transform: `rotate(${rotation}deg)`,
												transition: spinning
													? `transform ${SPIN_DURATION}s cubic-bezier(.17,.67,.3,1)`
													: 'none',
												transformOrigin: '150px 150px'
											}}
											onTransitionEnd={handleTransitionEnd}
										>
											{SECTORS.map((s, i) => {
												const start = i * STEP - 90
												const end = start + STEP
												const mid = start + STEP / 2
												const rad = Math.PI / 180
												const tx =
													CENTER + RADIUS * 0.62 * Math.cos(mid * rad)
												const ty =
													CENTER + RADIUS * 0.62 * Math.sin(mid * rad)
												return (
													<g key={i}>
														<path
															d={sectorPath(start, end)}
															fill={s.color}
															stroke="rgba(0,0,0,0.18)"
															strokeWidth="1.5"
														/>
														<path
															d={sectorPath(start, end)}
															fill="url(#dw-shine)"
															pointerEvents="none"
														/>
														<text
															x={tx}
															y={ty}
															textAnchor="middle"
															dominantBaseline="middle"
															transform={`rotate(${mid}, ${tx}, ${ty})`}
															style={{
																fontFamily: 'Arial, sans-serif',
																fontWeight: 700,
																fontSize: 13,
																fill: s.textColor
															}}
															filter="url(#dw-text)"
														>
															{s.label}
														</text>
													</g>
												)
											})}
											<circle
												cx={CENTER}
												cy={CENTER}
												r={RADIUS}
												fill="none"
												stroke="#f8bd31"
												strokeWidth="4"
												filter="url(#dw-shadow)"
											/>
											<circle
												cx={CENTER}
												cy={CENTER}
												r={RADIUS - 2}
												fill="none"
												stroke="rgba(255,255,255,0.12)"
												strokeWidth="2"
											/>
											<circle
												cx={CENTER}
												cy={CENTER}
												r={26}
												fill="none"
												stroke="rgba(255,255,255,0.2)"
												strokeWidth="3"
											/>
											<circle
												cx={CENTER}
												cy={CENTER}
												r={22}
												fill="url(#dw-center)"
												stroke="rgba(255,255,255,0.35)"
												strokeWidth="1.5"
												filter="url(#dw-shadow)"
											/>
											<circle
												cx={CENTER - 6}
												cy={CENTER - 6}
												r={4}
												fill="rgba(255,255,255,0.45)"
											/>
										</g>
									</g>
								</svg>
							</div>
						</div>
					</div>
				</div>
			)}
		</>
	)
}

export default DemoWheel
