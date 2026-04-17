'use client'

import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useAuthStore } from '@/store/auth-store/auth-store'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import styles from './HomeTools.module.scss'

/* ── Wheel preview ── */
const WHL_CX = 130
const WHL_CY = 130
const WHL_R = 126
const WHL_STEP = 360 / 8

const WHL_SECTORS = [
	{ label: 'Скидка 10%', color: '#470b58', textColor: '#fff' },
	{ label: 'Подарок!', color: '#8a1580', textColor: '#fff' },
	{ label: 'Скидка 5%', color: '#c21b84', textColor: '#fff' },
	{ label: 'Бесплатно', color: '#e03060', textColor: '#fff' },
	{ label: 'Бонус', color: '#fa595e', textColor: '#fff' },
	{ label: 'Скидка 15%', color: '#f87040', textColor: '#fff' },
	{ label: 'Промокод', color: '#f8a030', textColor: '#1a0600' },
	{ label: 'Скидка 20%', color: '#f8bd31', textColor: '#1a0600' }
]

function whlPath(i: number) {
	const r2d = Math.PI / 180
	const s = -90 + i * WHL_STEP
	const e = s + WHL_STEP
	const x1 = WHL_CX + WHL_R * Math.cos(s * r2d)
	const y1 = WHL_CY + WHL_R * Math.sin(s * r2d)
	const x2 = WHL_CX + WHL_R * Math.cos(e * r2d)
	const y2 = WHL_CY + WHL_R * Math.sin(e * r2d)
	return `M ${WHL_CX} ${WHL_CY} L ${x1} ${y1} A ${WHL_R} ${WHL_R} 0 0 1 ${x2} ${y2} Z`
}

const WheelPreview = () => (
	<div className={styles.wheelPreview}>
		<svg viewBox="0 0 260 260" className={styles.wheelSvg}>
			<defs>
				<filter
					id="ht-shadow"
					x="-30%"
					y="-30%"
					width="160%"
					height="160%"
				>
					<feDropShadow
						dx="0"
						dy="4"
						stdDeviation="10"
						floodColor="rgba(0,0,0,0.55)"
					/>
				</filter>
				<linearGradient id="ht-shine" x1="0" y1="0" x2="0" y2="1">
					<stop offset="0%" stopColor="rgba(255,255,255,0.14)" />
					<stop offset="65%" stopColor="rgba(255,255,255,0)" />
				</linearGradient>
				<radialGradient id="ht-center" cx="35%" cy="35%">
					<stop offset="0%" stopColor="#dbbcf0" />
					<stop offset="100%" stopColor="#7b3fa0" />
				</radialGradient>
			</defs>

			{/* rotation: Промокод (index 6) at arrow (0°) */}
			<g
				style={{
					transform: 'rotate(157.5deg)',
					transformOrigin: '130px 130px'
				}}
			>
				{WHL_SECTORS.map((s, i) => {
					const midDeg = -90 + i * WHL_STEP + WHL_STEP / 2
					const r2d = Math.PI / 180
					const tx = WHL_CX + WHL_R * 0.63 * Math.cos(midDeg * r2d)
					const ty = WHL_CY + WHL_R * 0.63 * Math.sin(midDeg * r2d)
					return (
						<g key={i}>
							<path
								d={whlPath(i)}
								fill={s.color}
								stroke="rgba(0,0,0,0.18)"
								strokeWidth="1"
							/>
							<path
								d={whlPath(i)}
								fill="url(#ht-shine)"
								pointerEvents="none"
							/>
							<text
								x={tx}
								y={ty}
								textAnchor="middle"
								dominantBaseline="middle"
								transform={`rotate(${midDeg}, ${tx}, ${ty})`}
								style={{
									fontFamily: 'Arial, sans-serif',
									fontWeight: 700,
									fontSize: 11,
									fill: s.textColor,
									pointerEvents: 'none'
								}}
							>
								{s.label}
							</text>
						</g>
					)
				})}
				<circle
					cx={WHL_CX}
					cy={WHL_CY}
					r={WHL_R}
					fill="none"
					stroke="#f8bd31"
					strokeWidth="4"
				/>
				<circle
					cx={WHL_CX}
					cy={WHL_CY}
					r={WHL_R - 3}
					fill="none"
					stroke="rgba(255,255,255,0.12)"
					strokeWidth="1.5"
				/>
				<circle
					cx={WHL_CX}
					cy={WHL_CY}
					r={24}
					fill="none"
					stroke="rgba(255,255,255,0.2)"
					strokeWidth="2.5"
				/>
				<circle
					cx={WHL_CX}
					cy={WHL_CY}
					r={20}
					fill="url(#ht-center)"
					stroke="rgba(255,255,255,0.4)"
					strokeWidth="1.5"
				/>
				<circle
					cx={WHL_CX - 6}
					cy={WHL_CY - 6}
					r={5}
					fill="rgba(255,255,255,0.5)"
				/>
			</g>
		</svg>

		{/* Arrow */}
		<div className={styles.wheelArrow}>
			<svg viewBox="0 0 20 24" fill="none">
				<path
					d="M2 12 L18 3 L14 12 L18 21 Z"
					fill="#ffffff"
					stroke="rgba(0,0,0,0.35)"
					strokeWidth="1"
				/>
			</svg>
		</div>
	</div>
)

/* ── Tools data ── */
const TOOLS: {
	title: string
	description: string
	gradient: string
	preview?: React.ReactNode
	comingSoon?: boolean
}[] = [
	{
		title: 'Колесо Фортуны',
		description: 'Дарите скидки\nи бонусы за телефон и/или email',
		gradient:
			'linear-gradient(160deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)',
		preview: <WheelPreview />
	},
	{
		title: 'Заказ звонка',
		description: 'Связывайтесь с клиентом\nпо его просьбе перезвонить',
		gradient:
			'linear-gradient(160deg, #f43f5e 0%, #ec4899 50%, #f97316 100%)'
	},
	{
		title: 'Квиз-опросы',
		description: 'Узнайте потребности\nклиента через игру',
		gradient:
			'linear-gradient(160deg, #6366f1 0%, #a855f7 50%, #ec4899 100%)',
		comingSoon: true
	},
	{
		title: 'Ловец призов',
		description: 'Дайте возможность клиенту\nиспытать удачу',
		gradient:
			'linear-gradient(160deg, #0ea5e9 0%, #6366f1 50%, #a855f7 100%)',
		comingSoon: true
	},
	{
		title: 'Таймер обратного отсчёта',
		description: 'Создавайте ощущение\nсрочности у покупателя',
		gradient:
			'linear-gradient(160deg, #10b981 0%, #0ea5e9 50%, #6366f1 100%)',
		comingSoon: true
	},
	{
		title: 'Супер-кликер',
		description:
			'Дайте возможность клиенту\nнакликать себе скидку\nза определенное время',
		gradient:
			'linear-gradient(160deg, #f43f5e 0%, #ec4899 50%, #a855f7 100%)',
		comingSoon: true
	}
]

const GAP = 16

const getVisible = (w: number) => {
	if (w < 560) return 1
	if (w < 900) return 2
	return 3
}

const HomeTools = () => {
	const [offset, setOffset] = useState(0)
	const [cardWidth, setCardWidth] = useState(0)
	const [visible, setVisible] = useState(3)
	const viewportRef = useRef<HTMLDivElement>(null)
	const touchStartX = useRef<number | null>(null)

	const auth = useAuthStore(state => state.auth)
	const ctaHref = auth ? PUBLIC_PAGES.CABINET : PUBLIC_PAGES.REGISTER

	useEffect(() => {
		const calc = () => {
			if (viewportRef.current) {
				const w = viewportRef.current.offsetWidth
				const v = getVisible(w)
				setVisible(v)
				setCardWidth((w - GAP * (v - 1)) / v)
			}
		}
		calc()
		window.addEventListener('resize', calc)
		return () => window.removeEventListener('resize', calc)
	}, [])

	const maxOffset = TOOLS.length - visible
	const canPrev = offset > 0
	const canNext = offset < maxOffset

	useEffect(() => {
		setOffset(o => Math.min(o, maxOffset))
	}, [maxOffset])

	const prev = () => setOffset(o => Math.max(0, o - 1))
	const next = () => setOffset(o => Math.min(maxOffset, o + 1))

	const translateX = offset * (cardWidth + GAP)

	const onTouchStart = (e: React.TouchEvent) => {
		touchStartX.current = e.touches[0].clientX
	}
	const onTouchEnd = (e: React.TouchEvent) => {
		if (touchStartX.current === null) return
		const dx = touchStartX.current - e.changedTouches[0].clientX
		if (dx > 40) next()
		else if (dx < -40) prev()
		touchStartX.current = null
	}

	return (
		<section id="tools" className={styles.section}>
			<h2 className={styles.title}>
				Инструменты, которые влюбляют в ваш бренд
			</h2>

			<div className={styles.sliderWrap}>
				<button
					className={`${styles.arrow} ${!canPrev ? styles.arrowDisabled : ''}`}
					onClick={prev}
					type="button"
					aria-label="Предыдущий"
					disabled={!canPrev}
				>
					<svg width="10" height="18" viewBox="0 0 10 18" fill="none">
						<path
							d="M9 1L1 9L9 17"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>

				<div
					className={styles.viewport}
					ref={viewportRef}
					onTouchStart={onTouchStart}
					onTouchEnd={onTouchEnd}
				>
					<div
						className={styles.track}
						style={{
							transform: `translateX(-${translateX}px)`,
							gap: `${GAP}px`
						}}
					>
						{TOOLS.map((tool, i) => (
							<div
								key={i}
								className={styles.card}
								style={
									{
										width: cardWidth || undefined,
										flex: cardWidth ? `0 0 ${cardWidth}px` : undefined,
										'--card-gradient': tool.gradient
									} as React.CSSProperties
								}
							>
								{tool.comingSoon && (
									<span className={styles.comingSoon}>Скоро</span>
								)}
								<div className={styles.cardBody}>
									{tool.preview ?? null}
								</div>
								<div className={styles.cardFooter}>
									<h3 className={styles.cardTitle}>{tool.title}</h3>
									<p className={styles.cardDesc}>{tool.description}</p>
								</div>
							</div>
						))}
					</div>
				</div>

				<button
					className={`${styles.arrow} ${!canNext ? styles.arrowDisabled : ''}`}
					onClick={next}
					type="button"
					aria-label="Следующий"
					disabled={!canNext}
				>
					<svg width="10" height="18" viewBox="0 0 10 18" fill="none">
						<path
							d="M1 1L9 9L1 17"
							stroke="currentColor"
							strokeWidth="1.8"
							strokeLinecap="round"
							strokeLinejoin="round"
						/>
					</svg>
				</button>
			</div>

			{visible === 1 && (
				<div className={styles.dots}>
					<button
						className={`${styles.dotArrow} ${!canPrev ? styles.dotArrowDisabled : ''}`}
						onClick={prev}
						disabled={!canPrev}
						aria-label="Предыдущий"
					>
						<svg width="7" height="12" viewBox="0 0 7 12" fill="none">
							<path
								d="M6 1L1 6L6 11"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
					{TOOLS.map((_, i) => (
						<button
							key={i}
							className={`${styles.dot} ${i === offset ? styles.dotActive : ''}`}
							onClick={() => setOffset(i)}
							aria-label={`Карточка ${i + 1}`}
						/>
					))}
					<button
						className={`${styles.dotArrow} ${!canNext ? styles.dotArrowDisabled : ''}`}
						onClick={next}
						disabled={!canNext}
						aria-label="Следующий"
					>
						<svg width="7" height="12" viewBox="0 0 7 12" fill="none">
							<path
								d="M1 1L6 6L1 11"
								stroke="currentColor"
								strokeWidth="1.6"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</button>
				</div>
			)}

			<div className={styles.cta}>
				<Link href={ctaHref} className={styles.ctaButton}>
					Попробовать бесплатно 7 дней
					<span className={styles.ctaArrow}>
						<svg width="20" height="20" viewBox="0 0 20 20" fill="none">
							<path
								d="M4.5 10H15.5M15.5 10L10.5 5M15.5 10L10.5 15"
								stroke="currentColor"
								strokeWidth="1.8"
								strokeLinecap="round"
								strokeLinejoin="round"
							/>
						</svg>
					</span>
				</Link>
			</div>
		</section>
	)
}

export default HomeTools
