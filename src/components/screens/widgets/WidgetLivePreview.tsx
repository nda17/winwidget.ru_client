'use client'

import { CallbackConfig } from '@/services/callback/callback.types'
import { CountdownTimerConfig } from '@/services/countdown-timer/countdown-timer.types'
import { QuizConfig } from '@/services/quiz/quiz.types'
import { WidgetConfig } from '@/services/widget/widget.types'
import Image from 'next/image'
import type { CSSProperties } from 'react'
import styles from './WidgetLivePreview.module.scss'

type PreviewType = 'wheel' | 'quiz' | 'callback' | 'timer'

type CommonPreviewConfig = {
	color?: string
	bgColor?: string
	buttonColor?: string
	openButtonColor?: string
	buttonSide?: 'left' | 'right'
	buttonPulse?: boolean
	buttonBottom?: number
	buttonOffset?: number
	buttonSize?: number
	buttonImageUrl?: string
	bubbleEnabled?: boolean
	bubbleText?: string
	title?: string
	subtitle?: string
}

type WidgetLivePreviewProps =
	| {
			type: 'wheel'
			config: WidgetConfig
			buttonImageUrl: string
	  }
	| {
			type: 'quiz'
			config: QuizConfig
			buttonImageUrl: string
	  }
	| {
			type: 'callback'
			config: CallbackConfig
			buttonImageUrl: string
	  }
	| {
			type: 'timer'
			config: CountdownTimerConfig
			buttonImageUrl: string
	  }

const DEFAULT_ACCENT = '#4705fb'
const WHEEL_COLORS = [
	'#4705fb',
	'#c21b84',
	'#fa595e',
	'#f8bd31',
	'#22c55e',
	'#14b8a6',
	'#3b82f6',
	'#a855f7'
]

const clampNumber = (
	value: number | undefined,
	min: number,
	max: number,
	fallback: number
) => {
	const numericValue = Number(value)

	if (Number.isNaN(numericValue)) return fallback

	return Math.min(max, Math.max(min, numericValue))
}

const safeText = (value: string | undefined, fallback: string) => {
	const text = value?.trim()
	return text || fallback
}

const getAccent = (config: CommonPreviewConfig) =>
	config.color?.trim() || DEFAULT_ACCENT

const getButtonColor = (config: CommonPreviewConfig) =>
	config.openButtonColor?.trim() ||
	config.buttonColor?.trim() ||
	getAccent(config)

const getStageStyle = (config: CommonPreviewConfig) =>
	({
		'--preview-accent': getAccent(config),
		'--preview-bg': config.bgColor?.trim() || '#0d0d1a',
		'--preview-button-color': getButtonColor(config),
		'--preview-button-size': `${clampNumber(
			config.buttonSize,
			44,
			76,
			60
		)}px`,
		'--preview-button-offset': `${clampNumber(
			config.buttonOffset,
			1,
			14,
			3
		)}%`,
		'--preview-button-bottom': `${clampNumber(
			config.buttonBottom,
			2,
			18,
			3
		)}%`
	}) as CSSProperties

const getButtonClassName = (config: CommonPreviewConfig) =>
	[
		styles.floatingButton,
		config.buttonSide === 'left'
			? styles.floatingButtonLeft
			: styles.floatingButtonRight,
		config.buttonPulse !== false ? styles.floatingButtonPulse : ''
	]
		.filter(Boolean)
		.join(' ')

const getBubbleClassName = (config: CommonPreviewConfig) =>
	[
		styles.bubble,
		config.buttonSide === 'left' ? styles.bubbleLeft : styles.bubbleRight
	]
		.filter(Boolean)
		.join(' ')

const buildWheelGradient = (config: WidgetConfig) => {
	const bonuses = (config.bonuses || [])
		.filter(bonus => bonus.active !== false)
		.slice(0, 8)
	const sectors = bonuses.length
		? bonuses
		: WHEEL_COLORS.slice(0, 6).map(color => ({
				name: '',
				active: true,
				color
			}))
	const step = 100 / sectors.length

	return `conic-gradient(${sectors
		.map((bonus, index) => {
			const color =
				bonus.color?.trim() || WHEEL_COLORS[index % WHEEL_COLORS.length]
			const from = Number((index * step).toFixed(2))
			const to = Number(((index + 1) * step).toFixed(2))

			return `${color} ${from}% ${to}%`
		})
		.join(', ')})`
}

const getTimerParts = (config: CountdownTimerConfig) => {
	const fallbackSeconds = Math.max(
		60,
		(config.evergreenDurationMinutes || 15) * 60
	)
	const fixedSeconds =
		config.timerMode === 'FIXED_DATE'
			? Math.max(
					0,
					Math.floor(
						(new Date(config.deadlineAt || '').getTime() - Date.now()) /
							1000
					)
				)
			: fallbackSeconds
	const secondsTotal = Number.isNaN(fixedSeconds)
		? fallbackSeconds
		: fixedSeconds
	const days = Math.floor(secondsTotal / 86400)
	const hours = Math.floor((secondsTotal % 86400) / 3600)
	const minutes = Math.floor((secondsTotal % 3600) / 60)
	const seconds = secondsTotal % 60

	return [
		{ label: 'дн', value: days },
		{ label: 'ч', value: hours },
		{ label: 'м', value: minutes },
		{ label: 'с', value: seconds }
	]
}

const renderFloatingButton = (
	config: CommonPreviewConfig,
	buttonImageUrl: string
) => (
	<div className={getButtonClassName(config)}>
		<div className={styles.floatingButtonIcon}>
			<Image
				src={buttonImageUrl}
				alt=""
				width={76}
				height={76}
				unoptimized
			/>
		</div>
	</div>
)

const renderBubble = (config: CommonPreviewConfig) => {
	if (config.bubbleEnabled === false) return null

	return (
		<div className={getBubbleClassName(config)}>
			{safeText(config.bubbleText, safeText(config.title, 'Виджет'))}
		</div>
	)
}

const WheelPreview = ({ config }: { config: WidgetConfig }) => {
	const activeBonuses = (config.bonuses || []).filter(
		bonus => bonus.active !== false
	)
	const bonusName = safeText(activeBonuses[0]?.name, 'Бонус')

	return (
		<div className={styles.widgetPanel}>
			<div className={styles.panelHeader}>
				<h3 className={styles.panelTitle}>
					{safeText(config.title, 'Крутите колесо!')}
				</h3>
				<p className={styles.panelText}>
					{safeText(config.subtitle, bonusName)}
				</p>
			</div>
			<div className={styles.wheelLayout}>
				<div
					className={styles.wheel}
					style={
						{
							'--preview-wheel-gradient': buildWheelGradient(config),
							'--preview-wheel-center':
								config.centerColor?.trim() || '#ffffff',
							'--preview-wheel-arrow':
								config.arrowColor?.trim() || '#ffcc00'
						} as CSSProperties
					}
				>
					<span className={styles.wheelCenter} />
					<span className={styles.wheelArrow} />
				</div>
				<div className={styles.panelSide}>
					<span className={styles.prizeBadge}>{bonusName}</span>
					<span className={styles.primaryButton}>
						{safeText(config.buttonText, 'Крутить!')}
					</span>
				</div>
			</div>
		</div>
	)
}

const QuizPreview = ({ config }: { config: QuizConfig }) => {
	const question = config.questions?.[0]
	const options = question?.options?.slice(0, 3) || []

	return (
		<div className={styles.widgetPanel}>
			<div className={styles.panelHeader}>
				<h3 className={styles.panelTitle}>
					{safeText(config.title, 'Пройдите наш квиз!')}
				</h3>
				<p className={styles.panelText}>
					{safeText(config.subtitle, ' ')}
				</p>
			</div>
			<div className={styles.quizQuestion}>
				{safeText(
					question?.text,
					safeText(config.buttonText, 'Начать квиз')
				)}
			</div>
			<div className={styles.optionList}>
				{(options.length
					? options
					: [{ id: 'default', text: 'Вариант' }]
				).map(option => (
					<span key={option.id} className={styles.optionItem}>
						{safeText(option.text, 'Вариант')}
					</span>
				))}
			</div>
		</div>
	)
}

const CallbackPreview = ({ config }: { config: CallbackConfig }) => {
	const timeSlots = (config.timeSlots || []).filter(Boolean).slice(0, 2)

	return (
		<div className={styles.widgetPanel}>
			<div className={styles.panelHeader}>
				<h3 className={styles.panelTitle}>
					{safeText(config.title, 'Заказать звонок')}
				</h3>
				<p className={styles.panelText}>
					{safeText(config.subtitle, ' ')}
				</p>
			</div>
			<div className={styles.inputPreview}>+7 (___) ___-__-__</div>
			{timeSlots.length > 0 && (
				<div className={styles.slotList}>
					{timeSlots.map(slot => (
						<span key={slot} className={styles.slotItem}>
							{slot}
						</span>
					))}
				</div>
			)}
			<span className={styles.primaryButton}>
				{safeText(config.submitButtonText, 'Заказать звонок')}
			</span>
		</div>
	)
}

const TimerPreview = ({ config }: { config: CountdownTimerConfig }) => {
	const timerParts = getTimerParts(config)

	return (
		<div className={styles.widgetPanel}>
			<div className={styles.panelHeader}>
				<h3 className={styles.panelTitle}>
					{safeText(config.title, 'Скидка ограничена по времени')}
				</h3>
				<p className={styles.panelText}>
					{safeText(config.subtitle, ' ')}
				</p>
			</div>
			<div className={styles.timerGrid}>
				{timerParts.map(part => (
					<span key={part.label} className={styles.timerCell}>
						<strong>{String(part.value).padStart(2, '0')}</strong>
						<small>{part.label}</small>
					</span>
				))}
			</div>
			{config.dataType === 'NONE' ? (
				<span className={styles.primaryButton}>
					{safeText(config.actionButtonText, 'Перейти к акции')}
				</span>
			) : (
				<div className={styles.inputPreview}>
					{config.dataType === 'EMAIL'
						? 'email@example.ru'
						: '+7 (___) ___-__-__'}
				</div>
			)}
		</div>
	)
}

const renderPreviewContent = (props: WidgetLivePreviewProps) => {
	if (props.type === 'wheel') return <WheelPreview config={props.config} />
	if (props.type === 'quiz') return <QuizPreview config={props.config} />
	if (props.type === 'callback') {
		return <CallbackPreview config={props.config} />
	}

	return <TimerPreview config={props.config} />
}

const getTypeLabel = (type: PreviewType) => {
	if (type === 'wheel') return 'Колесо'
	if (type === 'quiz') return 'Квиз'
	if (type === 'callback') return 'Звонок'

	return 'Таймер'
}

const WidgetLivePreview = (props: WidgetLivePreviewProps) => {
	const commonConfig = props.config as CommonPreviewConfig

	return (
		<section className={styles.preview} aria-label="Live preview виджета">
			<div className={styles.previewHeader}>
				<p className={styles.previewTitle}>Live preview</p>
				<span className={styles.previewBadge}>
					{getTypeLabel(props.type)}
				</span>
			</div>
			<div className={styles.stage} style={getStageStyle(commonConfig)}>
				<div className={styles.mockPage} aria-hidden="true">
					<span />
					<span />
					<span />
				</div>
				<div className={styles.surface}>{renderPreviewContent(props)}</div>
				{renderBubble(commonConfig)}
				{renderFloatingButton(commonConfig, props.buttonImageUrl)}
			</div>
		</section>
	)
}

export default WidgetLivePreview
