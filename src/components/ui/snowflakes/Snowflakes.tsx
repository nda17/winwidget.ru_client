'use client'

import { useEffect, useRef } from 'react'
import styles from './Snowflakes.module.scss'

const SNOWFLAKES_COUNT = 60

interface SnowflakeConfig {
	id: number
	left: number
	size: number
	duration: number
	delay: number
	opacity: number
	drift: number
	symbol: string
}

const SYMBOLS = ['❄', '❅', '❆', '✦', '•']

function generateFlakes(): SnowflakeConfig[] {
	return Array.from({ length: SNOWFLAKES_COUNT }, (_, i) => ({
		id: i,
		left: Math.random() * 100,
		size: 10 + Math.random() * 16,
		duration: 8 + Math.random() * 14,
		delay: -(Math.random() * 20),
		opacity: 0.4 + Math.random() * 0.6,
		drift: -30 + Math.random() * 60,
		symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]
	}))
}

const Snowflakes = () => {
	const flakesRef = useRef<SnowflakeConfig[]>(generateFlakes())

	return (
		<div className={styles.container} aria-hidden="true">
			{flakesRef.current.map(flake => (
				<span
					key={flake.id}
					className={styles.flake}
					style={
						{
							left: `${flake.left}%`,
							fontSize: `${flake.size}px`,
							opacity: flake.opacity,
							animationDuration: `${flake.duration}s`,
							animationDelay: `${flake.delay}s`,
							'--drift': `${flake.drift}px`
						} as React.CSSProperties
					}
				>
					{flake.symbol}
				</span>
			))}
		</div>
	)
}

export default Snowflakes
