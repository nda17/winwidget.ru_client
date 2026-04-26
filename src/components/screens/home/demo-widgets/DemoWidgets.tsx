'use client'

import { useEffect, useRef, useState } from 'react'
import DemoWheel from '@/components/screens/home/demo-wheel/DemoWheel'
import DemoQuiz from '@/components/screens/home/demo-quiz/DemoQuiz'
import DemoCallback from '@/components/screens/home/demo-callback/DemoCallback'
import styles from './DemoWidgets.module.scss'

type ActiveDemo = 'wheel' | 'quiz' | 'callback'

const SWITCH_INTERVAL = 7000
const FADE_DURATION = 400

const DemoWidgets = () => {
	const [activeDemo, setActiveDemo] = useState<ActiveDemo>('wheel')
	const [btnVisible, setBtnVisible] = useState(true)
	const [wheelOpen, setWheelOpen] = useState(false)
	const [quizOpen, setQuizOpen] = useState(false)
	const [callbackOpen, setCallbackOpen] = useState(false)
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
			setTimeout(() => {
				setActiveDemo(prev => {
					if (prev === 'wheel') return 'quiz'
					if (prev === 'quiz') return 'callback'
					return 'wheel'
				})
				setBtnVisible(true)
			}, FADE_DURATION)
		}, SWITCH_INTERVAL)
		return () => clearInterval(interval)
	}, [])

	const handleClick = () => {
		if (activeDemo === 'wheel') setWheelOpen(true)
		else if (activeDemo === 'quiz') setQuizOpen(true)
		else setCallbackOpen(true)
	}

	return (
		<>
			<div ref={floatRef} className={styles.floatOuter}>
				<button
					type="button"
					className={styles.floatBtn}
					onClick={handleClick}
					aria-label={
						activeDemo === 'wheel'
							? 'Открыть демо колеса фортуны'
							: activeDemo === 'quiz'
								? 'Открыть демо квиза'
								: 'Открыть демо обратного звонка'
					}
					style={{
						opacity: btnVisible ? 1 : 0,
						transform: btnVisible ? 'scale(1)' : 'scale(0.85)',
						transition: `opacity ${FADE_DURATION}ms ease, transform ${FADE_DURATION}ms ease`
					}}
				>
					{activeDemo === 'wheel' ? (
						<>
							<span className={styles.floatIcon}>🎁</span>
							<span
								className={`${styles.floatLabel} ${styles.floatLabelWheel}`}
							>
								Приз!
							</span>
						</>
					) : activeDemo === 'quiz' ? (
						<>
							<span className={styles.floatIconQuiz}>
								<svg
									width="60"
									height="60"
									viewBox="0 0 60 60"
									fill="none"
								>
									<defs>
										<radialGradient id="dwqGrad" cx="40%" cy="30%" r="70%">
											<stop offset="0%" stopColor="#7c3aed" />
											<stop offset="100%" stopColor="#4705fb" />
										</radialGradient>
									</defs>
									<circle cx="30" cy="30" r="30" fill="url(#dwqGrad)" />
									<circle
										cx="30"
										cy="30"
										r="28"
										fill="none"
										stroke="rgba(255,255,255,0.18)"
										strokeWidth="1"
									/>
									<text
										x="30"
										y="38"
										textAnchor="middle"
										fontFamily="system-ui,sans-serif"
										fontSize="28"
										fontWeight="900"
										fill="white"
									>
										?
									</text>
								</svg>
							</span>
							<span
								className={`${styles.floatLabel} ${styles.floatLabelQuiz}`}
							>
								Квиз!
								<br />
								Приз!
							</span>
						</>
					) : (
						<>
							<span className={styles.floatIconCallback}>
								<span className={styles.floatCallbackRing} />
								<svg
									width="60"
									height="60"
									viewBox="0 0 60 60"
									fill="none"
								>
									<defs>
										<linearGradient
											id="dwcbGrad"
											x1="0"
											y1="0"
											x2="60"
											y2="60"
											gradientUnits="userSpaceOnUse"
										>
											<stop offset="0%" stopColor="#9333ea" />
											<stop offset="100%" stopColor="#4705fb" />
										</linearGradient>
									</defs>
									<circle cx="30" cy="30" r="30" fill="url(#dwcbGrad)" />
									<circle
										cx="30"
										cy="30"
										r="27"
										fill="none"
										stroke="rgba(255,255,255,0.22)"
										strokeWidth="1.5"
									/>
									<path
										d="M21 19.5c0-.83.67-1.5 1.5-1.5h3.1c.4 0 .77.24.9.6l1.4 4c.14.38.03.82-.28 1.1l-1.62 1.62c1.15 2.38 3.08 4.3 5.46 5.46l1.62-1.62c.28-.3.72-.42 1.1-.28l4 1.4c.36.13.6.5.6.9V34c0 .83-.67 1.5-1.5 1.5C28.27 35.5 21 28.23 21 19.5z"
										fill="white"
										opacity="0.95"
									/>
								</svg>
							</span>
							<span
								className={`${styles.floatLabel} ${styles.floatLabelCallback}`}
							>
								Звонок!
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
		</>
	)
}

export default DemoWidgets
