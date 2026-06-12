'use client'

import type { HomePageDemoWidgetsContent } from '@/services/home-page-content/home-page-content.types'
import DemoWheel from '@/components/screens/home/demo-wheel/DemoWheel'
import DemoQuiz from '@/components/screens/home/demo-quiz/DemoQuiz'
import DemoCallback from '@/components/screens/home/demo-callback/DemoCallback'
import DemoCountdown from '@/components/screens/home/demo-countdown/DemoCountdown'
import DemoOnlineConsultant from '@/components/screens/home/demo-online-consultant/DemoOnlineConsultant'
import DemoStopOffer from '@/components/screens/home/demo-stop-offer/DemoStopOffer'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './DemoWidgets.module.scss'

type ActiveDemo =
	| 'wheel'
	| 'quiz'
	| 'callback'
	| 'countdown'
	| 'onlineConsultant'
	| 'stopOffer'

const SWITCH_INTERVAL = 7000
const FADE_DURATION = 520
const EDGE_OFFSET = 12
const MOBILE_EDGE_OFFSET = 8
const DEMO_ORDER: ActiveDemo[] = [
	'wheel',
	'quiz',
	'callback',
	'countdown',
	'onlineConsultant',
	'stopOffer'
]

const getNextDemo = (demo: ActiveDemo) => {
	const currentIndex = DEMO_ORDER.indexOf(demo)
	return DEMO_ORDER[(currentIndex + 1) % DEMO_ORDER.length]
}

interface Props {
	content: HomePageDemoWidgetsContent
}

const DemoWidgets = ({ content }: Props) => {
	const [activeDemo, setActiveDemo] = useState<ActiveDemo>('wheel')
	const [previousDemo, setPreviousDemo] = useState<ActiveDemo | null>(null)
	const [wheelOpen, setWheelOpen] = useState(false)
	const [quizOpen, setQuizOpen] = useState(false)
	const [callbackOpen, setCallbackOpen] = useState(false)
	const [countdownOpen, setCountdownOpen] = useState(false)
	const [onlineConsultantOpen, setOnlineConsultantOpen] = useState(false)
	const [stopOfferOpen, setStopOfferOpen] = useState(false)
	const [bubbleVisible, setBubbleVisible] = useState(false)
	const floatRef = useRef<HTMLDivElement>(null)
	const activeDemoRef = useRef<ActiveDemo>('wheel')
	const switchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null
	)

	useEffect(() => {
		const updateRight = () => {
			const mainEl = document.querySelector('main')
			const floatEl = floatRef.current
			if (!mainEl || !floatEl) return
			const fromViewportRight =
				window.innerWidth - mainEl.getBoundingClientRect().right
			const edgeOffset =
				window.innerWidth <= 480 ? MOBILE_EDGE_OFFSET : EDGE_OFFSET
			floatEl.style.right = fromViewportRight + edgeOffset + 'px'
		}
		updateRight()
		window.addEventListener('resize', updateRight)
		return () => window.removeEventListener('resize', updateRight)
	}, [])

	useEffect(() => {
		const interval = setInterval(() => {
			const currentDemo = activeDemoRef.current
			const nextDemo = getNextDemo(currentDemo)

			if (switchTimeoutRef.current) {
				clearTimeout(switchTimeoutRef.current)
			}

			setPreviousDemo(currentDemo)
			setActiveDemo(nextDemo)
			activeDemoRef.current = nextDemo
			setBubbleVisible(false)

			switchTimeoutRef.current = setTimeout(() => {
				setPreviousDemo(null)
			}, FADE_DURATION)
		}, SWITCH_INTERVAL)

		return () => {
			clearInterval(interval)

			if (switchTimeoutRef.current) {
				clearTimeout(switchTimeoutRef.current)
			}
		}
	}, [])

	useEffect(() => {
		setBubbleVisible(false)
		const t = setTimeout(() => setBubbleVisible(true), 3000)
		return () => clearTimeout(t)
	}, [activeDemo])

	const handleClick = () => {
		setBubbleVisible(false)
		if (activeDemo === 'wheel') setWheelOpen(true)
		else if (activeDemo === 'quiz') setQuizOpen(true)
		else if (activeDemo === 'callback') setCallbackOpen(true)
		else if (activeDemo === 'countdown') setCountdownOpen(true)
		else if (activeDemo === 'onlineConsultant')
			setOnlineConsultantOpen(true)
		else setStopOfferOpen(true)
	}

	const renderButtonContent = (demo: ActiveDemo) => {
		if (demo === 'wheel') {
			return (
				<Image
					src="/images/tools/wheel-gift-button.png"
					alt=""
					width={64}
					height={64}
					className={styles.floatIcon}
					aria-hidden="true"
				/>
			)
		}

		if (demo === 'quiz') {
			return (
				<Image
					src="/images/tools/quiz-button.png"
					alt=""
					width={60}
					height={60}
					className={styles.floatIconQuiz}
					aria-hidden="true"
				/>
			)
		}

		if (demo === 'callback') {
			return (
				<Image
					src="/images/tools/callback-button.png"
					alt=""
					width={60}
					height={60}
					className={styles.floatIconCallback}
					aria-hidden="true"
				/>
			)
		}

		if (demo === 'countdown') {
			return (
				<Image
					src="/images/tools/timer-button.png"
					alt=""
					width={60}
					height={60}
					className={styles.floatIconTimer}
					aria-hidden="true"
				/>
			)
		}

		if (demo === 'onlineConsultant') {
			return (
				<Image
					src="/images/tools/online-consultant-button.png"
					alt=""
					width={60}
					height={60}
					className={styles.floatIconOnlineConsultant}
					aria-hidden="true"
				/>
			)
		}

		return (
			<Image
				src="/images/tools/stop-offer-button.png"
				alt=""
				width={60}
				height={60}
				className={styles.floatIconStopOffer}
				aria-hidden="true"
			/>
		)
	}

	return (
		<>
			<div ref={floatRef} className={styles.floatOuter}>
				{bubbleVisible && (
					<div className={styles.bubble}>
						<button
							type="button"
							className={styles.bubbleClose}
							onClick={e => {
								e.stopPropagation()
								setBubbleVisible(false)
							}}
							aria-label="Закрыть облако"
						>
							✕
						</button>
						<p className={styles.bubbleText}>
							{content.bubbleTexts[activeDemo]}
						</p>
						<span className={styles.bubbleDot} />
						<div className={styles.bubbleTail} />
					</div>
				)}

				<button
					type="button"
					className={styles.floatBtn}
					onClick={handleClick}
					aria-label={
						activeDemo === 'wheel'
							? 'Открыть демо колеса фортуны'
							: activeDemo === 'quiz'
								? 'Открыть демо квиза'
								: activeDemo === 'callback'
									? 'Открыть демо обратного звонка'
									: activeDemo === 'countdown'
										? 'Открыть демо таймера обратного отсчёта'
										: activeDemo === 'onlineConsultant'
											? 'Открыть демо онлайн-консультанта'
											: 'Открыть демо стоп-оффера'
					}
				>
					{previousDemo && previousDemo !== activeDemo && (
						<span
							key={`previous-${previousDemo}`}
							className={`${styles.buttonLayer} ${styles.buttonLayerLeaving}`}
						>
							{renderButtonContent(previousDemo)}
						</span>
					)}
					<span
						key={`active-${activeDemo}`}
						className={`${styles.buttonLayer} ${
							previousDemo
								? styles.buttonLayerEntering
								: styles.buttonLayerActive
						}`}
					>
						{renderButtonContent(activeDemo)}
					</span>
				</button>
			</div>

			<DemoWheel
				hideButton
				open={wheelOpen}
				onClose={() => setWheelOpen(false)}
			/>
			<DemoQuiz open={quizOpen} onClose={() => setQuizOpen(false)} />
			<DemoCallback
				open={callbackOpen}
				onClose={() => setCallbackOpen(false)}
			/>
			<DemoCountdown
				open={countdownOpen}
				onClose={() => setCountdownOpen(false)}
			/>
			<DemoOnlineConsultant
				open={onlineConsultantOpen}
				onClose={() => setOnlineConsultantOpen(false)}
			/>
			<DemoStopOffer
				open={stopOfferOpen}
				onClose={() => setStopOfferOpen(false)}
			/>
		</>
	)
}

export default DemoWidgets
