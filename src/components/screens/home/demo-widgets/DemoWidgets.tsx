'use client'

import type { HomePageDemoWidgetsContent } from '@/services/home-page-content/home-page-content.types'
import DemoWheel from '@/components/screens/home/demo-wheel/DemoWheel'
import DemoQuiz from '@/components/screens/home/demo-quiz/DemoQuiz'
import DemoCallback from '@/components/screens/home/demo-callback/DemoCallback'
import DemoCountdown from '@/components/screens/home/demo-countdown/DemoCountdown'
import Image from 'next/image'
import { useEffect, useRef, useState } from 'react'
import styles from './DemoWidgets.module.scss'

type ActiveDemo = 'wheel' | 'quiz' | 'callback' | 'countdown'

const SWITCH_INTERVAL = 7000
const FADE_DURATION = 400

interface Props {
	content: HomePageDemoWidgetsContent
}

const DemoWidgets = ({ content }: Props) => {
	const [activeDemo, setActiveDemo] = useState<ActiveDemo>('wheel')
	const [btnVisible, setBtnVisible] = useState(true)
	const [wheelOpen, setWheelOpen] = useState(false)
	const [quizOpen, setQuizOpen] = useState(false)
	const [callbackOpen, setCallbackOpen] = useState(false)
	const [countdownOpen, setCountdownOpen] = useState(false)
	const [bubbleVisible, setBubbleVisible] = useState(false)
	const floatRef = useRef<HTMLDivElement>(null)

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
		const interval = setInterval(() => {
			setBtnVisible(false)
			setBubbleVisible(false)
			setTimeout(() => {
				setActiveDemo(prev => {
					if (prev === 'wheel') return 'quiz'
					if (prev === 'quiz') return 'callback'
					if (prev === 'callback') return 'countdown'
					return 'wheel'
				})
				setBtnVisible(true)
			}, FADE_DURATION)
		}, SWITCH_INTERVAL)
		return () => clearInterval(interval)
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
		else setCountdownOpen(true)
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
									: 'Открыть демо таймера обратного отсчёта'
					}
					style={{
						opacity: btnVisible ? 1 : 0,
						transform: btnVisible ? 'scale(1)' : 'scale(0.85)',
						transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`
					}}
				>
					{activeDemo === 'wheel' ? (
						<>
							<Image
								src="/images/tools/wheel-gift-button.png"
								alt=""
								width={64}
								height={64}
								className={styles.floatIcon}
								aria-hidden="true"
							/>
							<span
								className={`${styles.floatLabel} ${styles.floatLabelWheel}`}
							>
								{content.labels.wheel}
							</span>
						</>
					) : activeDemo === 'quiz' ? (
						<>
							<Image
								src="/images/tools/quiz-button.png"
								alt=""
								width={60}
								height={60}
								className={styles.floatIconQuiz}
								aria-hidden="true"
							/>
							<span
								className={`${styles.floatLabel} ${styles.floatLabelQuiz}`}
							>
								{content.labels.quiz
									.split('\n')
									.map((line, index, lines) => (
										<span key={`${line}-${index}`}>
											{line}
											{index < lines.length - 1 && <br />}
										</span>
									))}
							</span>
						</>
					) : activeDemo === 'callback' ? (
						<Image
							src="/images/tools/callback-button.png"
							alt=""
							width={60}
							height={60}
							className={styles.floatIconCallback}
							aria-hidden="true"
						/>
					) : (
						<>
							<Image
								src="/images/tools/timer-button.png"
								alt=""
								width={60}
								height={60}
								className={styles.floatIconTimer}
								aria-hidden="true"
							/>
							<span
								className={`${styles.floatLabel} ${styles.floatLabelTimer}`}
							>
								{content.labels.countdown}
							</span>
						</>
					)}
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
		</>
	)
}

export default DemoWidgets
