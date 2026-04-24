'use client'

import { useEffect, useRef, useState } from 'react'
import DemoWheel from '@/components/screens/home/demo-wheel/DemoWheel'
import DemoQuiz from '@/components/screens/home/demo-quiz/DemoQuiz'
import styles from './DemoWidgets.module.scss'

type ActiveDemo = 'wheel' | 'quiz'

const SWITCH_INTERVAL = 7000
const FADE_DURATION = 400

const DemoWidgets = () => {
	const [activeDemo, setActiveDemo] = useState<ActiveDemo>('wheel')
	const [btnVisible, setBtnVisible] = useState(true)
	const [wheelOpen, setWheelOpen] = useState(false)
	const [quizOpen, setQuizOpen] = useState(false)
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
				setActiveDemo(prev => (prev === 'wheel' ? 'quiz' : 'wheel'))
				setBtnVisible(true)
			}, FADE_DURATION)
		}, SWITCH_INTERVAL)
		return () => clearInterval(interval)
	}, [])

	const handleClick = () => {
		if (activeDemo === 'wheel') setWheelOpen(true)
		else setQuizOpen(true)
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
							: 'Открыть демо квиза'
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
					) : (
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
					)}
				</button>
			</div>

			<DemoWheel
				hideButton
				open={wheelOpen}
				onClose={() => setWheelOpen(false)}
			/>
			<DemoQuiz open={quizOpen} onClose={() => setQuizOpen(false)} />
		</>
	)
}

export default DemoWidgets
