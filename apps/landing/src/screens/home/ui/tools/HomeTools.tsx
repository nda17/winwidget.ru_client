'use client'

import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import type {
	HomePageToolItem,
	HomePageToolsContent
} from '@/entities/home-page-content'
import { useAuthStore } from '@/entities/user'
import Image from 'next/image'
import Link from '@/shared/lib/navigation/ZoneLink'
import { useEffect, useRef, useState } from 'react'
import styles from './HomeTools.module.scss'

const WheelPreview = () => (
	<div className={styles.wheelPreview}>
		<Image
			src="/images/tools/wheel-widget-preview.png"
			alt="Превью виджета колеса фортуны Winwidget"
			width={304}
			height={260}
			className={styles.wheelImage}
			sizes="(max-width: 560px) 78vw, 240px"
		/>
	</div>
)

const QuizPreview = () => (
	<div className={styles.quizPreview}>
		<Image
			src="/images/tools/quiz-widget-preview.png"
			alt="Превью виджета квиза Winwidget"
			width={940}
			height={956}
			className={styles.quizImage}
			sizes="(max-width: 560px) 78vw, 240px"
		/>
	</div>
)

const CallbackPreview = () => (
	<div className={styles.callbackPreview}>
		<Image
			src="/images/tools/callback-widget-preview.png"
			alt="Превью виджета заказа звонка Winwidget"
			width={653}
			height={673}
			className={styles.callbackImage}
			sizes="(max-width: 560px) 78vw, 240px"
		/>
	</div>
)

const TimerPreview = () => (
	<div className={styles.timerPreview}>
		<Image
			src="/images/tools/timer-widget-preview.png"
			alt="Превью виджета обратного отсчёта Winwidget"
			width={944}
			height={690}
			className={styles.timerImage}
			sizes="(max-width: 560px) 78vw, 240px"
		/>
	</div>
)

const StopOfferPreview = () => (
	<div className={styles.stopOfferPreview}>
		<Image
			src="/images/tools/stop-offer-widget-preview.png"
			alt="Превью виджета стоп-оффер Winwidget"
			width={900}
			height={796}
			className={styles.stopOfferImage}
			sizes="(max-width: 560px) 78vw, 240px"
		/>
	</div>
)

const AiConsultantPreview = () => (
	<div className={styles.aiConsultantPreview}>
		<div className={styles.aiConsultantModal}>
			<div className={styles.aiConsultantHeader}>
				<span className={styles.aiConsultantAvatar}>A</span>
				<div>
					<strong>Alex</strong>
					<span>AI-оператор</span>
				</div>
			</div>
			<p className={styles.aiConsultantEvent}>Alex присоединился к чату</p>
			<p className={styles.aiConsultantMessage}>
				Готов ответить на ваши вопросы
			</p>
			<div className={styles.aiConsultantTyping} aria-hidden="true">
				<span />
				<span />
				<span />
			</div>
		</div>
		<Image
			src="/images/tools/ai-consultant-button.png"
			alt="Превью кнопки AI-консультанта Winwidget"
			width={320}
			height={320}
			className={styles.aiConsultantButton}
			sizes="(max-width: 560px) 68px, 78px"
		/>
	</div>
)

const CalculatorPreview = () => (
	<div className={styles.calculatorPreview} aria-hidden="true">
		<Image
			src="/images/tools/calculator-widget-preview.png"
			alt=""
			width={940}
			height={954}
			className={styles.calculatorImage}
			sizes="(max-width: 560px) 78vw, 240px"
		/>
		<Image
			src="/images/tools/calculator-button.png"
			alt=""
			width={320}
			height={320}
			className={styles.calculatorPreviewButton}
			sizes="(max-width: 560px) 58px, 68px"
		/>
	</div>
)

const TOOL_GRADIENTS = [
	'linear-gradient(160deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)',
	'linear-gradient(160deg, #170724 0%, #3a1670 48%, #8a3ffc 100%)',
	'linear-gradient(160deg, #f43f5e 0%, #ec4899 50%, #f97316 100%)',
	'linear-gradient(160deg, #10b981 0%, #0ea5e9 50%, #6366f1 100%)',
	'linear-gradient(160deg, #a855f7 0%, #ec4899 50%, #f43f5e 100%)',
	'linear-gradient(160deg, #0ea5e9 0%, #6366f1 50%, #a855f7 100%)',
	'linear-gradient(160deg, #f43f5e 0%, #ec4899 50%, #a855f7 100%)'
]

const GAP = 16

const getVisible = (w: number) => {
	if (w < 560) return 1
	if (w < 900) return 2
	return 3
}

const getPreview = (tool: HomePageToolItem) => {
	if (tool.previewType === 'wheel') return <WheelPreview />
	if (tool.previewType === 'quiz') return <QuizPreview />
	if (tool.previewType === 'callback') return <CallbackPreview />
	if (tool.previewType === 'timer') return <TimerPreview />
	if (tool.previewType === 'aiConsultant') return <AiConsultantPreview />
	if (tool.previewType === 'stopOffer') return <StopOfferPreview />
	if (
		tool.previewType === 'calculator' ||
		(tool.previewType === 'none' &&
			tool.title.trim() === 'Калькулятор стоимости')
	)
		return <CalculatorPreview />
	return null
}

interface Props {
	content: HomePageToolsContent
}

const HomeTools = ({ content }: Props) => {
	const [offset, setOffset] = useState(0)
	const [cardWidth, setCardWidth] = useState(0)
	const [visible, setVisible] = useState(3)
	const viewportRef = useRef<HTMLDivElement>(null)
	const touchStartX = useRef<number | null>(null)

	const auth = useAuthStore(state => state.auth)
	const ctaHref = auth ? PUBLIC_PAGES.CABINET : PUBLIC_PAGES.REGISTER
	const tools = content.items

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

	const maxOffset = Math.max(0, tools.length - visible)
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
			<h2 className={styles.title}>{content.title}</h2>

			{tools.length > 0 && (
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
							{tools.map((tool, i) => (
								<div
									key={`${tool.title}-${i}`}
									className={styles.card}
									style={
										{
											width: cardWidth || undefined,
											flex: cardWidth ? `0 0 ${cardWidth}px` : undefined,
											'--card-gradient':
												TOOL_GRADIENTS[i % TOOL_GRADIENTS.length]
										} as React.CSSProperties
									}
								>
									{tool.comingSoon && (
										<span className={styles.comingSoon}>Скоро</span>
									)}
									<div className={styles.cardBody}>{getPreview(tool)}</div>
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
			)}

			{tools.length > 0 && visible === 1 && (
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
					{tools.map((_, i) => (
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
					{content.ctaText}
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
