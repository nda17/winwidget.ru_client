'use client'

import type { ReactNode } from 'react'
import styles from './WidgetTypeModal.module.scss'

interface WidgetType {
	id: string
	name: string
	description: string
	icon: ReactNode
	available: boolean
}

const WheelIcon = () => (
	<svg
		width="72"
		height="72"
		viewBox="0 0 72 72"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="36" cy="36" r="34" stroke="#e0d6f0" strokeWidth="2" />
		{[0, 1, 2, 3, 4, 5, 6, 7].map(i => {
			const angle = (i * 45 * Math.PI) / 180
			const nextAngle = ((i + 1) * 45 * Math.PI) / 180
			const r = 33
			const x1 = 36 + r * Math.sin(angle)
			const y1 = 36 - r * Math.cos(angle)
			const x2 = 36 + r * Math.sin(nextAngle)
			const y2 = 36 - r * Math.cos(nextAngle)
			const colors = [
				'#470B58',
				'#7b3fa0',
				'#C21B84',
				'#e85d9a',
				'#FA595E',
				'#f7847a',
				'#F8BD31',
				'#fad06e'
			]
			return (
				<path
					key={i}
					d={`M36,36 L${x1},${y1} A${r},${r} 0 0,1 ${x2},${y2} Z`}
					fill={colors[i]}
					opacity="0.85"
				/>
			)
		})}
		<circle
			cx="36"
			cy="36"
			r="9"
			fill="#fff"
			stroke="#e0d6f0"
			strokeWidth="1.5"
		/>
		<circle cx="36" cy="36" r="4" fill="#7b3fa0" />
	</svg>
)

const DrumIcon = () => (
	<svg
		width="72"
		height="72"
		viewBox="0 0 72 72"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect
			x="10"
			y="16"
			width="52"
			height="40"
			rx="6"
			stroke="#e0d6f0"
			strokeWidth="2"
			fill="none"
		/>
		{[0, 1, 2].map(i => (
			<rect
				key={i}
				x="16"
				y={22 + i * 11}
				width="40"
				height="9"
				rx="3"
				fill={(['#470B58', '#C21B84', '#FA595E'] as const)[i]}
				opacity="0.7"
			/>
		))}
		<rect x="8" y="14" width="56" height="6" rx="3" fill="#e0d6f0" />
		<rect x="8" y="52" width="56" height="6" rx="3" fill="#e0d6f0" />
	</svg>
)

const WIDGET_TYPES: WidgetType[] = [
	{
		id: 'wheel',
		name: 'Колесо фортуны',
		description:
			'Вращающееся колесо с призами. Пользователь вводит контакт и крутит колесо.',
		icon: <WheelIcon />,
		available: true
	},
	{
		id: 'drum',
		name: 'Барабан',
		description: 'Слот-машина с полосами призов. Скоро будет доступна.',
		icon: <DrumIcon />,
		available: false
	}
]

interface Props {
	onSelect: (typeId: string) => void
	onClose: () => void
	isCreating: boolean
}

const WidgetTypeModal = ({ onSelect, onClose, isCreating }: Props) => {
	return (
		<div className={styles.overlay} onClick={onClose}>
			<div className={styles.modal} onClick={e => e.stopPropagation()}>
				<button
					className={styles.closeBtn}
					onClick={onClose}
					aria-label="Закрыть"
				>
					✕
				</button>
				<h2 className={styles.title}>Выберите тип виджета</h2>
				<p className={styles.subtitle}>
					Кликните по виджету, чтобы создать его
				</p>
				<div className={styles.grid}>
					{WIDGET_TYPES.map(type => (
						<button
							key={type.id}
							className={`${styles.card} ${!type.available ? styles.cardDisabled : ''}`}
							onClick={() => type.available && onSelect(type.id)}
							disabled={!type.available || isCreating}
						>
							{!type.available && (
								<span className={styles.badge}>Скоро</span>
							)}
							<div className={styles.icon}>{type.icon}</div>
							<div className={styles.name}>{type.name}</div>
							<div className={styles.desc}>{type.description}</div>
							{isCreating && type.available && (
								<div className={styles.creating}>Создание...</div>
							)}
						</button>
					))}
				</div>
			</div>
		</div>
	)
}

export default WidgetTypeModal
