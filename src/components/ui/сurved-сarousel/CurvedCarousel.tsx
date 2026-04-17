'use client'

import { useEffect, useRef } from 'react'
import styles from './CurvedCarousel.module.scss'

interface Slide {
	title: string
	description: string
	tag: string
	bg: string
	accent: string
	iconPath: React.ReactNode
}

const slides: Slide[] = [
	{
		title: 'Колесо фортуны',
		tag: 'Геймификация',
		description: 'Вовлекает посетителей и повышает конверсию до 30%',
		bg: '#12002a',
		accent: '#c77dff',
		iconPath: (
			<>
				<circle
					cx="24"
					cy="24"
					r="11"
					stroke="currentColor"
					strokeWidth="1.8"
					fill="none"
				/>
				<path
					d="M24 13v22M13 24h22M16.8 16.8l14.4 14.4M31.2 16.8 16.8 31.2"
					stroke="currentColor"
					strokeWidth="1.4"
					strokeLinecap="round"
					opacity="0.5"
				/>
				<circle cx="24" cy="24" r="3.5" fill="currentColor" />
			</>
		)
	},
	{
		title: 'Email',
		tag: 'Уведомления',
		description:
			'Мгновенное письмо с именем, призом и страницей при каждой заявке',
		bg: '#000e2a',
		accent: '#4f9cf9',
		iconPath: (
			<>
				<rect
					x="8"
					y="14"
					width="32"
					height="22"
					rx="3"
					stroke="currentColor"
					strokeWidth="1.8"
					fill="none"
				/>
				<path
					d="M8 17l16 11 16-11"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
			</>
		)
	},
	{
		title: 'Telegram',
		tag: 'Мессенджер',
		description:
			'Уведомления прямо в чат — быстрее почты, всегда под рукой',
		bg: '#001828',
		accent: '#29b6f6',
		iconPath: (
			<>
				<path
					d="M36 12 10 22l9 3.5 4 10 5-6.5 7 5L36 12Z"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
				<path
					d="M19 25.5l5 5"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
			</>
		)
	},
	{
		title: 'Webhook',
		tag: 'Автоматизация',
		description:
			'POST-запрос с данными лида — подключите Make, Zapier или n8n',
		bg: '#100028',
		accent: '#b57bee',
		iconPath: (
			<>
				<circle
					cx="24"
					cy="24"
					r="10"
					stroke="currentColor"
					strokeWidth="1.8"
					fill="none"
				/>
				<circle cx="24" cy="13" r="2.8" fill="currentColor" />
				<circle cx="24" cy="35" r="2.8" fill="currentColor" />
				<circle cx="13" cy="24" r="2.8" fill="currentColor" />
				<circle cx="35" cy="24" r="2.8" fill="currentColor" />
				<path
					d="M24 18v12M18 24h12"
					stroke="currentColor"
					strokeWidth="1.5"
					strokeLinecap="round"
					opacity="0.5"
				/>
			</>
		)
	},
	{
		title: 'Битрикс24',
		tag: 'CRM',
		description:
			'Лид с именем, телефоном и страницей создаётся автоматически',
		bg: '#1a0800',
		accent: '#ff7043',
		iconPath: (
			<>
				<rect
					x="10"
					y="20"
					width="10"
					height="16"
					rx="2.5"
					stroke="currentColor"
					strokeWidth="1.8"
					fill="none"
				/>
				<rect
					x="24"
					y="12"
					width="10"
					height="24"
					rx="2.5"
					stroke="currentColor"
					strokeWidth="1.8"
					fill="none"
				/>
				<path
					d="M15 20v-4"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
				<circle cx="15" cy="13.5" r="2.5" fill="currentColor" />
			</>
		)
	},
	{
		title: 'amoCRM',
		tag: 'CRM',
		description:
			'Новая сделка и контакт без ручного ввода при каждой заявке',
		bg: '#000d24',
		accent: '#5bc8ff',
		iconPath: (
			<>
				<path
					d="M13 28a11 11 0 1 1 21.4-4.8"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					fill="none"
				/>
				<path
					d="M30 13l5 4.5-5 4.5"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
				<circle cx="24" cy="24" r="3.5" fill="currentColor" />
			</>
		)
	},
	{
		title: 'Яндекс Метрика',
		tag: 'Аналитика',
		description:
			'Цели ip3_open и ip3_send — воронка от клика до заявки у вас в счётчике',
		bg: '#1a0000',
		accent: '#ff5252',
		iconPath: (
			<>
				<polyline
					points="10,34 17,22 22,28 28,16 36,34"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
					fill="none"
				/>
				<circle cx="36" cy="34" r="2.5" fill="currentColor" />
				<circle cx="10" cy="34" r="2.5" fill="currentColor" />
			</>
		)
	},
	{
		title: 'VK Ретаргетинг',
		tag: 'Реклама',
		description:
			'Аудитория для ретаргетинга ВКонтакте — показывайте рекламу тем, кто крутил',
		bg: '#000c24',
		accent: '#6e9ef5',
		iconPath: (
			<>
				<path
					d="M10 24c0-7.7 6.3-14 14-14s14 6.3 14 14c0 3.2-1.1 6.2-3 8.5C33 35 29 37 24 37s-9-2-11-4.5a14 14 0 0 1-3-8.5Z"
					stroke="currentColor"
					strokeWidth="1.8"
					fill="none"
				/>
				<circle
					cx="24"
					cy="22"
					r="4"
					stroke="currentColor"
					strokeWidth="1.8"
					fill="none"
				/>
				<path
					d="M14.5 33.5a10 10 0 0 1 19 0"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					fill="none"
					opacity="0.5"
				/>
			</>
		)
	},
	{
		title: 'Roistat',
		tag: 'Сквозная аналитика',
		description:
			'Видите ROI каждого канала — события передаются без дополнительных настроек',
		bg: '#001812',
		accent: '#4caf7d',
		iconPath: (
			<>
				<path
					d="M12 34V26M18 34V20M24 34V24M30 34V16M36 34V20"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
				/>
				<path
					d="M12 26l6-6 6 4 6-8 6 4"
					stroke="currentColor"
					strokeWidth="1.8"
					strokeLinecap="round"
					strokeLinejoin="round"
				/>
			</>
		)
	}
]

function getParams() {
	const w = window.innerWidth
	if (w < 480) return { spread: 180, arc: 28, rotateY: 60, dip: 12 }
	if (w < 768) return { spread: 280, arc: 42, rotateY: 65, dip: 18 }
	return { spread: 540, arc: 70, rotateY: 70, dip: 28 }
}

export default function CurvedCarousel() {
	const itemRefs = useRef<(HTMLDivElement | null)[]>([])
	const rotationRef = useRef(0)
	const currentSpeedRef = useRef(0.0025)
	const targetSpeedRef = useRef(0.0025)
	const rafRef = useRef<number | null>(null)

	useEffect(() => {
		const animate = () => {
			rotationRef.current -= currentSpeedRef.current
			currentSpeedRef.current +=
				(targetSpeedRef.current - currentSpeedRef.current) * 0.035

			const total = slides.length
			const step = (Math.PI * 2) / total
			const { spread, arc, rotateY: rotateYMax, dip } = getParams()

			itemRefs.current.forEach((node, index) => {
				if (!node) return

				const angle = rotationRef.current + index * step
				const sin = Math.sin(angle)
				const cos = Math.cos(angle)

				const z = (1 - cos) / 2

				if (cos > 0.1) {
					node.style.visibility = 'hidden'
					return
				}
				node.style.visibility = 'visible'

				const x = sin * spread
				const y = Math.abs(sin) * -arc + -cos * dip
				const scale = 0.5 + z * 0.5
				const rotateY = sin * -rotateYMax
				const opacity = 0.4 + z * 0.6

				node.style.transform = `translate3d(${x}px, ${y}px, 0) rotateY(${rotateY}deg) scale(${scale})`
				node.style.opacity = `${opacity}`
				node.style.zIndex = `${Math.round(z * 100)}`
			})

			rafRef.current = requestAnimationFrame(animate)
		}

		rafRef.current = requestAnimationFrame(animate)

		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current)
		}
	}, [])

	return (
		<div className={styles.section}>
			<div className={styles.heading}>
				<svg
					viewBox="-80 -10 960 110"
					className={styles.headingTitle}
					overflow="visible"
					aria-label="Готовые интеграции в ваш бизнес"
				>
					<defs>
						<path id="textArc" d="M 30,8 Q 400,72 770,8" />
					</defs>
					<text
						textAnchor="middle"
						fontFamily="var(--font-family)"
						fontWeight="600"
						fontSize="34"
						fill="#1a1a1a"
					>
						<textPath href="#textArc" startOffset="50%">
							Готовые интеграции в ваш бизнес
						</textPath>
					</text>
				</svg>
			</div>
			<div
				className={styles.carousel}
				onMouseEnter={() => {
					targetSpeedRef.current = 0.01
				}}
				onMouseLeave={() => {
					targetSpeedRef.current = 0.0025
				}}
			>
				<div className={styles.track}>
					{slides.map((slide, index) => (
						<div
							key={index}
							ref={el => {
								itemRefs.current[index] = el
							}}
							className={styles.card}
							style={{ backgroundColor: slide.bg }}
						>
							{/* Glow blob */}
							<div
								className={styles.glow}
								style={{
									background: `radial-gradient(ellipse at 70% 110%, ${slide.accent}55 0%, transparent 65%)`
								}}
							/>
							{/* Top noise overlay */}
							<div className={styles.noise} />
							{/* Border shimmer */}
							<div
								className={styles.borderShimmer}
								style={{
									background: `linear-gradient(135deg, ${slide.accent}40 0%, transparent 50%, ${slide.accent}18 100%)`
								}}
							/>

							<div className={styles.cardInner}>
								{/* Icon */}
								<div
									className={styles.iconWrap}
									style={{
										boxShadow: `0 0 24px ${slide.accent}50, inset 0 1px 0 rgb(255 255 255 / 0.12)`,
										background: `linear-gradient(135deg, ${slide.accent}22 0%, ${slide.accent}0a 100%)`,
										borderColor: `${slide.accent}35`
									}}
								>
									<svg
										width="28"
										height="28"
										viewBox="0 0 48 48"
										fill="none"
										color={slide.accent}
									>
										{slide.iconPath}
									</svg>
								</div>

								{/* Tag */}
								<span
									className={styles.tag}
									style={{
										color: slide.accent,
										background: `${slide.accent}15`,
										borderColor: `${slide.accent}30`
									}}
								>
									{slide.tag}
								</span>

								{/* Title */}
								<h3 className={styles.title}>{slide.title}</h3>

								{/* Description */}
								<p className={styles.description}>{slide.description}</p>

								{/* Bottom accent line */}
								<div
									className={styles.accentLine}
									style={{
										background: `linear-gradient(90deg, ${slide.accent} 0%, ${slide.accent}00 100%)`
									}}
								/>
							</div>
						</div>
					))}
				</div>
			</div>
		</div>
	)
}
