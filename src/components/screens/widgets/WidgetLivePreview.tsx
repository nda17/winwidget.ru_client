'use client'

import { CallbackConfig } from '@/services/callback/callback.types'
import { CountdownTimerConfig } from '@/services/countdown-timer/countdown-timer.types'
import { QuizConfig } from '@/services/quiz/quiz.types'
import { WidgetConfig } from '@/services/widget/widget.types'
import type { CSSProperties } from 'react'
import styles from './WidgetLivePreview.module.scss'

type PreviewType = 'wheel' | 'quiz' | 'callback' | 'timer'

type CommonPreviewConfig = {
	color?: string
	bgColor?: string
	buttonColor?: string
	title?: string
	subtitle?: string
}

type ContactDataType = 'PHONE' | 'EMAIL' | 'PHONE_AND_EMAIL' | 'NONE'

type WidgetLivePreviewProps =
	| {
			type: 'wheel'
			config: WidgetConfig
	  }
	| {
			type: 'quiz'
			config: QuizConfig
	  }
	| {
			type: 'callback'
			config: CallbackConfig
	  }
	| {
			type: 'timer'
			config: CountdownTimerConfig
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

const safeText = (value: string | undefined, fallback: string) => {
	const text = value?.trim()
	return text || fallback
}

const getAccent = (config: CommonPreviewConfig) =>
	config.color?.trim() || DEFAULT_ACCENT

const getPrimaryButtonColor = (config: CommonPreviewConfig) =>
	config.buttonColor?.trim() || getAccent(config)

const getStageStyle = (config: CommonPreviewConfig) =>
	({
		'--preview-accent': getAccent(config),
		'--preview-widget-bg': config.bgColor?.trim() || '#ffffff',
		'--preview-primary-button-color': getPrimaryButtonColor(config)
	}) as CSSProperties

const renderContactFields = (dataType: ContactDataType) => {
	if (dataType === 'NONE') return null

	return (
		<div className={styles.contactFields}>
			{(dataType === 'PHONE' || dataType === 'PHONE_AND_EMAIL') && (
				<div className={styles.inputPreview}>+7 (___) ___-__-__</div>
			)}
			{(dataType === 'EMAIL' || dataType === 'PHONE_AND_EMAIL') && (
				<div className={styles.inputPreview}>email@example.ru</div>
			)}
		</div>
	)
}

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
					{renderContactFields(config.dataType)}
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
			{renderContactFields(config.dataType)}
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
				renderContactFields(config.dataType)
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
				<p className={styles.previewTitle}>Предпросмотр</p>
				<span className={styles.previewBadge}>
					{getTypeLabel(props.type)}
				</span>
			</div>
			<div className={styles.stage} style={getStageStyle(commonConfig)}>
				{renderPreviewContent(props)}
			</div>
		</section>
	)
}

export default WidgetLivePreview
