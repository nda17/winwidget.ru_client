'use client'

import { useId, type ReactNode } from 'react'
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

const QuizIcon = () => (
	<svg
		width="72"
		height="72"
		viewBox="0 0 72 72"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<rect
			x="8"
			y="10"
			width="56"
			height="52"
			rx="8"
			stroke="#e0d6f0"
			strokeWidth="2"
			fill="none"
		/>
		<rect
			x="16"
			y="20"
			width="28"
			height="5"
			rx="2.5"
			fill="#7b3fa0"
			opacity="0.7"
		/>
		<rect
			x="16"
			y="30"
			width="40"
			height="4"
			rx="2"
			fill="#C21B84"
			opacity="0.5"
		/>
		<rect
			x="16"
			y="38"
			width="36"
			height="4"
			rx="2"
			fill="#C21B84"
			opacity="0.5"
		/>
		<rect
			x="16"
			y="46"
			width="32"
			height="4"
			rx="2"
			fill="#C21B84"
			opacity="0.5"
		/>
		<circle cx="55" cy="55" r="10" fill="#4705fb" />
		<text
			x="55"
			y="59"
			textAnchor="middle"
			fill="white"
			fontSize="12"
			fontWeight="bold"
		>
			?
		</text>
	</svg>
)

const CallbackIcon = () => (
	<svg
		width="72"
		height="72"
		viewBox="0 0 72 72"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="36" cy="36" r="34" stroke="#e0d6f0" strokeWidth="2" />
		<path
			d="M19 28c0-6.1 5-11 11.1-11h11.8C48 17 53 21.9 53 28v7.8c0 6.1-5 11-11.1 11H33l-8.1 6.1c-1.3 1-3.1.1-3.1-1.6v-6.6A10.9 10.9 0 0119 35.8V28z"
			fill="#fff"
			stroke="#e0d6f0"
			strokeWidth="2.4"
			strokeLinejoin="round"
		/>
		<path
			d="M29 27.5h4.5l2.1 5-3 1.9a12.7 12.7 0 006 6l1.9-3 5 2.1V44c-9.1 0-16.5-7.4-16.5-16.5z"
			fill="#7b3fa0"
		/>
		<circle cx="50" cy="48" r="10" fill="#F8BD31" />
		<path
			d="M50 43.5v5l3.5 2"
			stroke="#470B58"
			strokeWidth="2.4"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
		<path
			d="M42 27h5M42 33h7"
			stroke="#C21B84"
			strokeWidth="3"
			strokeLinecap="round"
			opacity="0.55"
		/>
	</svg>
)

const TimerIcon = () => (
	<svg
		width="72"
		height="72"
		viewBox="0 0 72 72"
		fill="none"
		xmlns="http://www.w3.org/2000/svg"
	>
		<circle cx="36" cy="36" r="34" stroke="#e0d6f0" strokeWidth="2" />
		<rect
			x="16"
			y="22"
			width="40"
			height="30"
			rx="7"
			fill="#fff"
			stroke="#e0d6f0"
			strokeWidth="2"
		/>
		<rect x="22" y="16" width="8" height="10" rx="3" fill="#7b3fa0" />
		<rect x="42" y="16" width="8" height="10" rx="3" fill="#C21B84" />
		<path
			d="M24 35h24"
			stroke="#7b3fa0"
			strokeWidth="3"
			strokeLinecap="round"
			opacity="0.75"
		/>
		<path
			d="M30 43h12"
			stroke="#FA595E"
			strokeWidth="3"
			strokeLinecap="round"
			opacity="0.75"
		/>
		<circle cx="52" cy="50" r="9" fill="#F8BD31" />
		<path
			d="M52 45v5l3 3"
			stroke="#470B58"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		/>
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
		id: 'quiz',
		name: 'Квиз',
		description:
			'Серия вопросов с персональным результатом. Собирает контакт и даёт рекомендацию.',
		icon: <QuizIcon />,
		available: true
	},
	{
		id: 'callback',
		name: 'Обратный звонок',
		description:
			'Клиент вводит телефон и выбирает удобное время. Вы получаете заявку с часовым поясом.',
		icon: <CallbackIcon />,
		available: true
	},
	{
		id: 'timer',
		name: 'Таймер обратного отсчёта',
		description:
			'Показывает дедлайн акции, ведёт на товар или собирает контакт перед переходом.',
		icon: <TimerIcon />,
		available: true
	}
]

interface Props {
	onSelect: (typeId: string) => void
	onClose: () => void
	isCreating: boolean
}

const WidgetTypeModal = ({ onSelect, onClose, isCreating }: Props) => {
	const titleId = useId()
	const descriptionId = useId()

	return (
		<div className={styles.overlay}>
			<button
				type="button"
				className={styles.backdrop}
				onClick={onClose}
				aria-label="Закрыть окно выбора типа виджета"
			/>
			<div
				className={styles.modal}
				role="dialog"
				aria-modal="true"
				aria-labelledby={titleId}
				aria-describedby={descriptionId}
			>
				<button
					type="button"
					className={styles.closeBtn}
					onClick={onClose}
					aria-label="Закрыть"
				>
					✕
				</button>
				<h2 id={titleId} className={styles.title}>
					Выберите тип виджета
				</h2>
				<p id={descriptionId} className={styles.subtitle}>
					Кликните по виджету, чтобы создать его
				</p>
				<div className={styles.gridLayout}>
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
