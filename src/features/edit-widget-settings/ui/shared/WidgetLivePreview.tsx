'use client'

import { CallbackConfig } from '@/entities/site-widget'
import { CalculatorConfig } from '@/entities/site-widget'
import { CountdownTimerConfig } from '@/entities/site-widget'
import { OnlineConsultantConfig } from '@/entities/site-widget'
import { QuizConfig } from '@/entities/site-widget'
import { StopOfferConfig } from '@/entities/site-widget'
import { WidgetConfig } from '@/entities/site-widget'
import { useDebounce } from '@/shared/lib/hooks/useDebounce'
import type { CSSProperties, RefObject } from 'react'
import { useEffect, useRef, useState } from 'react'
import ActionTooltip from './ActionTooltip'
import styles from './WidgetLivePreview.module.scss'
import { stabilizeWidgetPreviewColors } from './widgetColor'

type PreviewType =
	| 'wheel'
	| 'quiz'
	| 'callback'
	| 'timer'
	| 'stopOffer'
	| 'onlineConsultant'
	| 'calculator'

type WidgetLivePreviewEntityProps =
	| {
			type: 'wheel'
			config: WidgetConfig
			isHardPlan: boolean
	  }
	| {
			type: 'quiz'
			config: QuizConfig
			isHardPlan: boolean
	  }
	| {
			type: 'callback'
			config: CallbackConfig
			isHardPlan: boolean
	  }
	| {
			type: 'timer'
			config: CountdownTimerConfig
			isHardPlan: boolean
	  }
	| {
			type: 'stopOffer'
			config: StopOfferConfig
			isHardPlan: boolean
	  }
	| {
			type: 'onlineConsultant'
			config: OnlineConsultantConfig
			isHardPlan: boolean
	  }
	| {
			type: 'calculator'
			config: CalculatorConfig
			isHardPlan: boolean
	  }

type WidgetLivePreviewProps = WidgetLivePreviewEntityProps & {
	autoCollapse?: boolean
	onDeviceChange?: (device: PreviewDevice) => void
	onConfigChange?: () => void
	scrollTargetRef?: RefObject<HTMLElement | null>
}

type PreviewDevice = 'desktop' | 'mobile'
type PreviewSurface = 'dialog' | 'launcher'

const API_URL =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST || 'https://winwidget.ru'
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'

const SCRIPT_BY_TYPE: Record<PreviewType, string> = {
	wheel: 'wheel.js',
	quiz: 'quiz.js',
	callback: 'callback.js',
	timer: 'timer.js',
	stopOffer: 'stop-offer.js',
	onlineConsultant: 'online-consultant.js',
	calculator: 'calculator.js'
}

const CONFIG_PATH_BY_TYPE: Record<PreviewType, string> = {
	wheel: 'widget',
	quiz: 'quiz',
	callback: 'callback',
	timer: 'countdown-timer',
	stopOffer: 'stop-offer',
	onlineConsultant: 'online-consultant',
	calculator: 'calculator'
}

const DESKTOP_PREVIEW_FRAME = {
	width: 940,
	height: 520
}
const MOBILE_PREVIEW_FRAME = {
	width: 390,
	height: 844
}
const MOBILE_PREVIEW_MAX_SCALE = 390 / MOBILE_PREVIEW_FRAME.width
const PREVIEW_DEVICE_HORIZONTAL_INSET: Record<PreviewDevice, number> = {
	desktop: 52,
	mobile: 68
}
const PREVIEW_DEVICE_VERTICAL_INSET: Record<PreviewDevice, number> = {
	desktop: 96,
	mobile: 56
}
const MOBILE_PREVIEW_BREAKPOINT = 600
const PREVIEW_VIEWPORT_WINDOW_INSET = 272
const MIN_PREVIEW_VIEWPORT_HEIGHT = 240
const DEFAULT_PREVIEW_SCALE = 0.62
const DEFAULT_PREVIEW_LAYOUT = {
	frameWidth: DESKTOP_PREVIEW_FRAME.width,
	frameHeight: DESKTOP_PREVIEW_FRAME.height,
	scale: DEFAULT_PREVIEW_SCALE
}

const escapeScriptJson = (value: unknown) =>
	JSON.stringify(value).replace(/</g, '\\u003c')

const hashString = (value: string) => {
	let hash = 0

	for (let i = 0; i < value.length; i += 1) {
		hash = (hash << 5) - hash + value.charCodeAt(i)
		hash |= 0
	}

	return Math.abs(hash).toString(36)
}

const getPreviewLayout = (
	containerWidth: number,
	containerHeight: number | undefined,
	device: PreviewDevice
) => {
	const frame =
		device === 'mobile' ? MOBILE_PREVIEW_FRAME : DESKTOP_PREVIEW_FRAME
	const availableFrameWidth = Math.max(
		0,
		containerWidth - PREVIEW_DEVICE_HORIZONTAL_INSET[device]
	)
	const maxScale = device === 'mobile' ? MOBILE_PREVIEW_MAX_SCALE : 1
	const heightScale =
		containerHeight === undefined
			? maxScale
			: Math.max(
					0,
					containerHeight - PREVIEW_DEVICE_VERTICAL_INSET[device]
				) / frame.height
	const scale = Math.min(
		maxScale,
		availableFrameWidth / frame.width,
		heightScale
	)

	return {
		frameWidth: frame.width,
		frameHeight: frame.height,
		scale
	}
}

const scrollNearestScrollableParent = (
	element: HTMLElement | null,
	deltaY: number,
	explicitTarget?: HTMLElement | null
) => {
	if (!element || !Number.isFinite(deltaY) || deltaY === 0) return

	const scrollableParents: HTMLElement[] = []
	let parent = element.parentElement

	while (parent) {
		const style = window.getComputedStyle(parent)
		const isScrollable =
			/(auto|scroll)/.test(style.overflowY) &&
			parent.scrollHeight > parent.clientHeight

		if (isScrollable) scrollableParents.push(parent)

		parent = parent.parentElement
	}

	const canScrollElement = (target: HTMLElement) => {
		const maxScrollTop = target.scrollHeight - target.clientHeight

		return deltaY < 0
			? target.scrollTop > 0
			: target.scrollTop < maxScrollTop
	}
	const scrollElement = (target: HTMLElement) => {
		if (!canScrollElement(target)) return false

		target.scrollBy({ top: deltaY, behavior: 'auto' })
		return true
	}
	const scrollWindow = () => {
		const scrollingElement =
			document.scrollingElement || document.documentElement
		const maxScrollTop = Math.max(
			0,
			scrollingElement.scrollHeight - window.innerHeight
		)
		const scrollTop = window.scrollY || scrollingElement.scrollTop
		const canScroll = deltaY < 0 ? scrollTop > 0 : scrollTop < maxScrollTop

		if (!canScroll) return false

		window.scrollBy({ top: deltaY, behavior: 'auto' })
		return true
	}
	const triedTargets = new Set<HTMLElement>()
	const scrollExplicitTarget = () => {
		if (!explicitTarget || triedTargets.has(explicitTarget)) return false

		triedTargets.add(explicitTarget)
		return scrollElement(explicitTarget)
	}
	const scrollAncestors = () => {
		for (const target of scrollableParents) {
			if (triedTargets.has(target)) continue

			triedTargets.add(target)
			if (scrollElement(target)) return true
		}

		return false
	}

	if (deltaY < 0) {
		if (scrollExplicitTarget() || scrollAncestors() || scrollWindow())
			return
	} else if (
		scrollAncestors() ||
		scrollWindow() ||
		scrollExplicitTarget()
	) {
		return
	}
}

const getDataType = (dataType: string | undefined, fallback = 'PHONE') =>
	(dataType || fallback).toUpperCase()

const getWheelSubtitle = (dataType: string) => {
	if (dataType === 'EMAIL')
		return 'Введите свою почту, чтобы выиграть приз'
	if (dataType === 'PHONE_AND_EMAIL') {
		return 'Введите свой номер телефона и почту, чтобы выиграть приз'
	}
	if (dataType === 'NONE') return 'Крутите барабан, чтобы выиграть приз'

	return 'Введите свой номер телефона, чтобы выиграть приз'
}

const getSharedPublicConfig = (
	config: {
		color?: string
		bgColor?: string
		glassEffect?: boolean
		wheelBorderColor?: string
		buttonColor?: string
		openButtonColor?: string
		buttonSide?: 'left' | 'right'
		buttonPulse?: boolean
		buttonBottom?: number
		buttonOffset?: number
		buttonSize?: number
		buttonImageUrl?: string
		autoOpenDelay?: number | null
		bubbleEnabled?: boolean
		bubbleText?: string
		developInfoActive?: boolean
		integrations?: {
			yandexMetrikaId?: string
			vkPixelId?: string
			roistatEnabled?: boolean
		}
	},
	isHardPlan: boolean
) => ({
	isActive: true,
	color: config.color || '#4705fb',
	bgColor: config.bgColor || null,
	glassEffect: config.glassEffect === true,
	wheelBorderColor: config.wheelBorderColor || '',
	buttonColor: config.buttonColor || '',
	openButtonColor: config.openButtonColor || '',
	buttonSide: config.buttonSide || 'right',
	buttonPulse: config.buttonPulse !== false,
	buttonBottom: config.buttonBottom ?? 3,
	buttonOffset: config.buttonOffset ?? 3,
	buttonSize: config.buttonSize ?? 60,
	buttonImageUrl: isHardPlan ? config.buttonImageUrl || '' : '',
	hideBranding: isHardPlan,
	autoOpenDelay: config.autoOpenDelay || null,
	bubbleEnabled: config.bubbleEnabled !== false,
	bubbleText: config.bubbleText || '',
	developInfoActive: config.developInfoActive !== false && !isHardPlan,
	yandexMetrikaId: config.integrations?.yandexMetrikaId || null,
	vkPixelId: config.integrations?.vkPixelId || null,
	roistatEnabled: config.integrations?.roistatEnabled === true
})

const buildPreviewPublicConfig = (props: WidgetLivePreviewProps) => {
	if (props.type === 'wheel') {
		const dataType = getDataType(props.config.dataType)

		return {
			...getSharedPublicConfig(props.config, props.isHardPlan),
			title: props.config.title || 'Крутите колесо!',
			subtitle: props.config.subtitle || getWheelSubtitle(dataType),
			winMessage: props.config.winMessage || '',
			buttonText: props.config.buttonText || 'Крутить!',
			privacyUrl: props.config.privacyUrl || null,
			dataType,
			spinDuration: props.config.spinDuration ?? 5,
			bubbleText: props.config.bubbleText || 'Испытайте удачу!',
			alreadyPlayedTitle:
				props.config.alreadyPlayedTitle || '🎉 Вы уже участвовали!',
			alreadyPlayedSubtitle:
				props.config.alreadyPlayedSubtitle ||
				'Каждый посетитель может крутить колесо только один раз',
			hideIfPlayed: false,
			buttonColor: props.config.buttonColor || '',
			textColor: props.config.textColor || '',
			centerColor: props.config.centerColor || '#ffffff',
			arrowColor: props.config.arrowColor || '#ffcc00',
			spinCooldownDays: props.config.spinCooldownDays ?? 0,
			spinResetToken: props.config.spinResetToken || '',
			hasPlayedByIp: false,
			bonuses: props.config.bonuses || []
		}
	}

	if (props.type === 'quiz') {
		return {
			...getSharedPublicConfig(props.config, props.isHardPlan),
			bubbleText: props.config.bubbleText || 'Пройдите квиз!',
			title: props.config.title || 'Пройдите наш квиз!',
			subtitle: props.config.subtitle || '',
			buttonText: props.config.buttonText || 'Начать квиз',
			contactTitle:
				props.config.contactTitle ||
				'Оставьте контакт для получения результата',
			dataType: getDataType(props.config.dataType),
			privacyUrl: props.config.privacyUrl || null,
			alreadyPlayedTitle:
				props.config.alreadyPlayedTitle ||
				'🎉 Вы уже проходили этот квиз!',
			alreadyPlayedSubtitle:
				props.config.alreadyPlayedSubtitle ||
				'Каждый посетитель может пройти квиз только один раз',
			hideIfPlayed: false,
			quizCooldownDays: props.config.quizCooldownDays ?? 0,
			quizResetToken: props.config.quizResetToken || '',
			hasPlayedByIp: false,
			questions: props.config.questions || [],
			results: props.config.results || []
		}
	}

	if (props.type === 'callback') {
		return {
			...getSharedPublicConfig(props.config, props.isHardPlan),
			bubbleText:
				props.config.bubbleText || props.config.title || 'Перезвоним!',
			title: props.config.title || 'Заказать звонок',
			subtitle: props.config.subtitle || '',
			submitButtonText: props.config.submitButtonText || 'Заказать звонок',
			successTitle: props.config.successTitle || 'Спасибо! Мы перезвоним',
			successSubtitle: props.config.successSubtitle || '',
			privacyUrl: props.config.privacyUrl || null,
			filterDuplicates: false,
			timeSlots: props.config.timeSlots || [],
			hasSubmittedByIp: false
		}
	}

	if (props.type === 'calculator') {
		return {
			...getSharedPublicConfig(props.config, props.isHardPlan),
			glassEffect: props.config.glassEffect === true,
			textColor: props.config.textColor || '',
			title: props.config.title || 'Рассчитайте стоимость',
			subtitle: props.config.subtitle || '',
			calculateButtonText:
				props.config.calculateButtonText || 'Рассчитать',
			contactTitle:
				props.config.contactTitle ||
				'Оставьте контакт, чтобы получить расчёт',
			resultTitle: props.config.resultTitle || 'Ориентировочная стоимость',
			dataType: getDataType(props.config.dataType),
			privacyUrl: props.config.privacyUrl || null,
			filterDuplicates: false,
			basePrice: props.config.basePrice ?? 0,
			currency: props.config.currency || 'RUB',
			roundingStep: props.config.roundingStep || 1,
			fields: props.config.fields || []
		}
	}

	if (props.type === 'stopOffer') {
		const dataType = getDataType(props.config.dataType, 'PHONE')

		return {
			isActive: true,
			color: props.config.color || '#4705fb',
			bgColor: props.config.bgColor || '',
			buttonColor: props.config.buttonColor || '',
			hideBranding: props.isHardPlan,
			autoOpenDelay: props.config.autoOpenDelay || null,
			desktopExitIntent: props.config.desktopExitIntent !== false,
			mobileAutoOpenDelay: props.config.mobileAutoOpenDelay ?? 8,
			scrollPercent: props.config.scrollPercent ?? 70,
			showOnce: false,
			displayCooldownDays: props.config.displayCooldownDays ?? 7,
			displayResetToken: props.config.displayResetToken || '',
			hideIfSubmitted: false,
			badgeText: props.config.badgeText || 'Подождите',
			title: props.config.title || 'Персональное предложение',
			subtitle: props.config.subtitle || '',
			offerText: props.config.offerText || 'Скидка 10%',
			dataType,
			contactTitle: props.config.contactTitle || 'Куда отправить скидку?',
			submitButtonText: props.config.submitButtonText || 'Забрать скидку',
			successTitle:
				props.config.successTitle || 'Спасибо! Скидка закреплена',
			successSubtitle: props.config.successSubtitle || '',
			actionButtonEnabled: props.config.actionButtonEnabled === true,
			actionButtonText: props.config.actionButtonText || 'Перейти к акции',
			actionButtonUrl: props.config.actionButtonUrl || '',
			privacyUrl: props.config.privacyUrl || null,
			developInfoActive:
				props.config.developInfoActive !== false && !props.isHardPlan,
			filterDuplicates: false,
			submissionCooldownDays: props.config.submissionCooldownDays ?? 0,
			submissionResetToken: props.config.submissionResetToken || '',
			hasSubmittedByIp: false
		}
	}

	if (props.type === 'onlineConsultant') {
		return {
			...getSharedPublicConfig(props.config, props.isHardPlan),
			color: props.config.color || '#ef2b17',
			buttonSize: props.config.buttonSize ?? 60,
			bubbleEnabled: false,
			bubbleText: '',
			title: props.config.title || 'Онлайн-консультант',
			subtitle: props.config.subtitle || '',
			dataType: getDataType(props.config.dataType, 'PHONE'),
			contactTitle:
				props.config.contactTitle ||
				'Оставьте контакт, если нужен персональный ответ',
			submitButtonText: props.config.submitButtonText || 'Отправить',
			successTitle:
				props.config.successTitle || 'Спасибо! Заявка отправлена',
			successSubtitle: props.config.successSubtitle || '',
			privacyUrl: props.config.privacyUrl || null,
			filterDuplicates: false,
			quickActions: props.config.quickActions || [],
			hasSubmittedByIp: false
		}
	}

	const dataType = getDataType(props.config.dataType, 'NONE')

	return {
		...getSharedPublicConfig(props.config, props.isHardPlan),
		bubbleText: props.config.bubbleText || 'Акция',
		title: props.config.title || 'Скидка ограничена по времени',
		subtitle: props.config.subtitle || '',
		timerMode: props.config.timerMode || 'EVERGREEN',
		deadlineAt: props.config.deadlineAt || null,
		evergreenDurationMinutes: props.config.evergreenDurationMinutes ?? 15,
		expiredBehavior: props.config.expiredBehavior || 'showExpired',
		expiredTitle: props.config.expiredTitle || 'Акция завершена',
		expiredSubtitle: props.config.expiredSubtitle || '',
		dataType,
		contactTitle:
			props.config.contactTitle ||
			'Оставьте контакт, чтобы получить предложение',
		submitButtonText:
			props.config.submitButtonText || 'Получить предложение',
		successTitle:
			props.config.successTitle || 'Спасибо! Заявка отправлена',
		successSubtitle: props.config.successSubtitle || '',
		actionButtonText: props.config.actionButtonText || 'Перейти к акции',
		actionButtonUrl: props.config.actionButtonUrl || '',
		privacyUrl: props.config.privacyUrl || null,
		filterDuplicates: false,
		submissionCooldownDays: props.config.submissionCooldownDays ?? 0,
		timerResetToken: props.config.timerResetToken || '',
		hasSubmittedByIp: false
	}
}

const buildPreviewSandboxDocument = (
	type: PreviewType,
	publicConfig: object,
	previewKey: string,
	surface: PreviewSurface
) => {
	const scriptUrl = `${API_URL}/widgets/${SCRIPT_BY_TYPE[type]}`
	const configPath = CONFIG_PATH_BY_TYPE[type]

	return `<!doctype html>
<html lang="ru">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<style>
		html,
		body {
			width: 100%;
			min-width: 100%;
			height: 100%;
			margin: 0;
			position: relative;
			background: #f7f6fb;
			overflow: hidden;
			overscroll-behavior: none;
		}

		body::-webkit-scrollbar {
			display: none;
		}

		.winwidget-preview-site {
			position: absolute;
			inset: 0;
			z-index: 0;
			box-sizing: border-box;
			overflow: hidden;
			color: #211f32;
			background:
				radial-gradient(circle at 86% 17%, rgba(120, 92, 246, 0.16), transparent 28%),
				radial-gradient(circle at 9% 92%, rgba(255, 184, 112, 0.17), transparent 25%),
				#f8f7fc;
			font-family:
				-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
			pointer-events: none;
			user-select: none;
		}

		.winwidget-preview-site::before,
		.winwidget-preview-site::after {
			content: "";
			position: absolute;
			border-radius: 999px;
			filter: blur(1px);
		}

		.winwidget-preview-site::before {
			width: 230px;
			height: 230px;
			right: -92px;
			top: 118px;
			background: rgba(111, 76, 241, 0.08);
		}

		.winwidget-preview-site::after {
			width: 170px;
			height: 170px;
			left: -78px;
			bottom: -82px;
			background: rgba(255, 174, 91, 0.1);
		}

		.winwidget-preview-site__header {
			position: relative;
			z-index: 1;
			display: flex;
			height: 72px;
			box-sizing: border-box;
			align-items: center;
			justify-content: space-between;
			padding: 0 54px;
			border-bottom: 1px solid rgba(52, 45, 89, 0.08);
			background: rgba(255, 255, 255, 0.72);
			backdrop-filter: blur(16px);
		}

		.winwidget-preview-site__brand {
			display: flex;
			align-items: center;
			gap: 10px;
			font-size: 17px;
			font-weight: 800;
			letter-spacing: 0.08em;
		}

		.winwidget-preview-site__brand-mark {
			display: grid;
			width: 30px;
			height: 30px;
			place-items: center;
			border-radius: 10px;
			color: #fff;
			background: linear-gradient(135deg, #7957f2, #4d2ac8);
			box-shadow: 0 8px 18px rgba(91, 60, 211, 0.24);
			font-size: 14px;
			letter-spacing: 0;
		}

		.winwidget-preview-site__nav {
			display: flex;
			align-items: center;
			gap: 30px;
			color: #68647a;
			font-size: 13px;
			font-weight: 600;
		}

		.winwidget-preview-site__header-action {
			padding: 10px 18px;
			border: 1px solid rgba(101, 72, 224, 0.18);
			border-radius: 12px;
			color: #5d3dd1;
			background: #fff;
			box-shadow: 0 8px 24px rgba(48, 38, 92, 0.08);
			font-size: 13px;
			font-weight: 700;
		}

		.winwidget-preview-site__menu {
			display: none;
			width: 36px;
			height: 36px;
			align-items: center;
			justify-content: center;
			border-radius: 11px;
			background: #fff;
			box-shadow: 0 7px 20px rgba(45, 37, 85, 0.09);
		}

		.winwidget-preview-site__menu::before {
			content: "";
			width: 15px;
			height: 10px;
			border-top: 2px solid #4f4969;
			border-bottom: 2px solid #4f4969;
		}

		.winwidget-preview-site__main {
			position: relative;
			z-index: 1;
			box-sizing: border-box;
			padding: 28px 54px 24px;
		}

		.winwidget-preview-site__hero {
			display: grid;
			min-height: 278px;
			grid-template-columns: minmax(0, 1.08fr) minmax(320px, 0.92fr);
			align-items: center;
			gap: 38px;
		}

		.winwidget-preview-site__eyebrow {
			display: inline-flex;
			align-items: center;
			gap: 8px;
			padding: 7px 11px;
			border-radius: 999px;
			color: #6343d5;
			background: rgba(111, 76, 241, 0.1);
			font-size: 11px;
			font-weight: 800;
			letter-spacing: 0.06em;
			text-transform: uppercase;
		}

		.winwidget-preview-site__eyebrow-dot {
			width: 7px;
			height: 7px;
			border-radius: 999px;
			background: #7654ef;
			box-shadow: 0 0 0 4px rgba(118, 84, 239, 0.12);
		}

		.winwidget-preview-site__title {
			max-width: 470px;
			margin: 17px 0 12px;
			font-size: 42px;
			font-weight: 800;
			letter-spacing: -0.045em;
			line-height: 1.03;
		}

		.winwidget-preview-site__title-accent {
			color: #6946df;
		}

		.winwidget-preview-site__text {
			max-width: 450px;
			margin: 0;
			color: #716d80;
			font-size: 14px;
			line-height: 1.55;
		}

		.winwidget-preview-site__actions {
			display: flex;
			align-items: center;
			gap: 20px;
			margin-top: 21px;
		}

		.winwidget-preview-site__primary-action {
			padding: 12px 19px;
			border-radius: 12px;
			color: #fff;
			background: linear-gradient(135deg, #7654ef, #5633cd);
			box-shadow: 0 12px 25px rgba(91, 58, 207, 0.24);
			font-size: 13px;
			font-weight: 750;
		}

		.winwidget-preview-site__secondary-action {
			color: #514b66;
			font-size: 13px;
			font-weight: 700;
		}

		.winwidget-preview-site__visual {
			position: relative;
			height: 260px;
		}

		.winwidget-preview-site__dashboard {
			position: absolute;
			inset: 14px 8px 8px 0;
			box-sizing: border-box;
			padding: 22px;
			border: 1px solid rgba(67, 56, 119, 0.09);
			border-radius: 25px;
			background: rgba(255, 255, 255, 0.94);
			box-shadow: 0 24px 55px rgba(58, 46, 110, 0.14);
		}

		.winwidget-preview-site__dashboard-head {
			display: flex;
			align-items: center;
			gap: 10px;
		}

		.winwidget-preview-site__dashboard-avatar {
			width: 34px;
			height: 34px;
			border-radius: 11px;
			background: linear-gradient(145deg, #ffe2bd, #ffad75);
		}

		.winwidget-preview-site__dashboard-heading {
			flex: 1;
		}

		.winwidget-preview-site__dashboard-heading strong,
		.winwidget-preview-site__dashboard-heading span {
			display: block;
		}

		.winwidget-preview-site__dashboard-heading strong {
			font-size: 12px;
		}

		.winwidget-preview-site__dashboard-heading span {
			margin-top: 3px;
			color: #9691a5;
			font-size: 9px;
		}

		.winwidget-preview-site__period {
			padding: 7px 9px;
			border-radius: 9px;
			color: #777187;
			background: #f5f3fa;
			font-size: 9px;
			font-weight: 700;
		}

		.winwidget-preview-site__chart {
			display: flex;
			height: 102px;
			align-items: flex-end;
			gap: 9px;
			margin-top: 22px;
			padding: 0 7px 11px;
			border-bottom: 1px solid #ece9f3;
		}

		.winwidget-preview-site__chart-bar {
			flex: 1;
			min-width: 11px;
			border-radius: 7px 7px 3px 3px;
			background: linear-gradient(180deg, #8a6bf5, #6544db);
		}

		.winwidget-preview-site__chart-bar:nth-child(1) {
			height: 34%;
			opacity: 0.52;
		}

		.winwidget-preview-site__chart-bar:nth-child(2) {
			height: 53%;
			opacity: 0.67;
		}

		.winwidget-preview-site__chart-bar:nth-child(3) {
			height: 45%;
			opacity: 0.58;
		}

		.winwidget-preview-site__chart-bar:nth-child(4) {
			height: 72%;
			opacity: 0.78;
		}

		.winwidget-preview-site__chart-bar:nth-child(5) {
			height: 62%;
			opacity: 0.7;
		}

		.winwidget-preview-site__chart-bar:nth-child(6) {
			height: 88%;
		}

		.winwidget-preview-site__metrics {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 8px;
			margin-top: 13px;
		}

		.winwidget-preview-site__metric {
			padding: 9px 10px;
			border-radius: 10px;
			background: #f7f5fb;
		}

		.winwidget-preview-site__metric strong,
		.winwidget-preview-site__metric span {
			display: block;
		}

		.winwidget-preview-site__metric strong {
			font-size: 11px;
		}

		.winwidget-preview-site__metric span {
			margin-top: 3px;
			color: #9a95a8;
			font-size: 8px;
		}

		.winwidget-preview-site__growth {
			position: absolute;
			right: -5px;
			top: 0;
			display: flex;
			align-items: center;
			gap: 7px;
			padding: 9px 12px;
			border: 1px solid rgba(101, 72, 224, 0.1);
			border-radius: 12px;
			color: #4d3b97;
			background: #fff;
			box-shadow: 0 12px 25px rgba(61, 47, 119, 0.13);
			font-size: 10px;
			font-weight: 800;
		}

		.winwidget-preview-site__growth-icon {
			display: grid;
			width: 22px;
			height: 22px;
			place-items: center;
			border-radius: 8px;
			color: #fff;
			background: #7250e8;
			font-size: 11px;
		}

		.winwidget-preview-site__features {
			display: grid;
			grid-template-columns: repeat(3, 1fr);
			gap: 12px;
			margin-top: 17px;
		}

		.winwidget-preview-site__feature {
			display: flex;
			align-items: center;
			gap: 11px;
			padding: 13px 14px;
			border: 1px solid rgba(61, 51, 104, 0.07);
			border-radius: 15px;
			background: rgba(255, 255, 255, 0.72);
		}

		.winwidget-preview-site__feature-icon {
			display: grid;
			width: 31px;
			height: 31px;
			flex: 0 0 31px;
			place-items: center;
			border-radius: 10px;
			color: #6543d6;
			background: #efebff;
			font-size: 13px;
			font-weight: 800;
		}

		.winwidget-preview-site__feature-copy strong,
		.winwidget-preview-site__feature-copy span {
			display: block;
		}

		.winwidget-preview-site__feature-copy strong {
			font-size: 11px;
		}

		.winwidget-preview-site__feature-copy span {
			margin-top: 3px;
			color: #9691a5;
			font-size: 8px;
		}

		@media (max-width: 600px) {
			.winwidget-preview-site {
				background:
					radial-gradient(circle at 105% 12%, rgba(120, 92, 246, 0.18), transparent 33%),
					radial-gradient(circle at -5% 94%, rgba(255, 184, 112, 0.16), transparent 29%),
					#f8f7fc;
			}

			.winwidget-preview-site::before {
				width: 170px;
				height: 170px;
				right: -92px;
				top: 118px;
			}

			.winwidget-preview-site__header {
				height: 68px;
				padding: 0 25px;
			}

			.winwidget-preview-site__nav,
			.winwidget-preview-site__header-action {
				display: none;
			}

			.winwidget-preview-site__menu {
				display: flex;
			}

			.winwidget-preview-site__main {
				padding: 34px 25px 22px;
			}

			.winwidget-preview-site__hero {
				display: block;
				min-height: 0;
			}

			.winwidget-preview-site__eyebrow {
				padding: 7px 10px;
				font-size: 10px;
			}

			.winwidget-preview-site__title {
				margin: 17px 0 13px;
				font-size: 39px;
				line-height: 1.05;
			}

			.winwidget-preview-site__text {
				font-size: 14px;
				line-height: 1.55;
			}

			.winwidget-preview-site__actions {
				gap: 17px;
				margin-top: 20px;
			}

			.winwidget-preview-site__primary-action {
				padding: 12px 17px;
			}

			.winwidget-preview-site__visual {
				height: 232px;
				margin-top: 27px;
			}

			.winwidget-preview-site__dashboard {
				inset: 12px 5px 0 0;
				padding: 18px;
				border-radius: 22px;
			}

			.winwidget-preview-site__chart {
				height: 76px;
				gap: 7px;
				margin-top: 17px;
			}

			.winwidget-preview-site__metrics {
				margin-top: 10px;
			}

			.winwidget-preview-site__metric {
				padding: 8px;
			}

			.winwidget-preview-site__growth {
				right: -2px;
				padding: 8px 10px;
			}

			.winwidget-preview-site__features {
				display: none;
			}
		}
	</style>
	<script>
		(function () {
			var previewKey = ${JSON.stringify(previewKey)};
			var previewType = ${JSON.stringify(type)};
			var previewSurface = ${JSON.stringify(surface)};
			var configPath = ${JSON.stringify(configPath)};
			var publicConfig = ${escapeScriptJson(publicConfig)};
			var nativeFetch = window.fetch.bind(window);
			var restartNoticeSent = false;
			var previewTouchLastY = null;
			var previewStoragePrefixes = [
				'winwidget_played_',
				'wintimer_submitted_',
				'winstopoffer_seen_',
				'winstopoffer_submitted_',
				'winonlineconsultant_submitted_',
				'wincalculator_submitted_'
			];
			var sandboxStageLayouts = {
				wheel: {
					host: 'wheel-widget-host',
					css: '#main-wrapper{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:16px!important;padding-right:16px!important}#main-wrapper::-webkit-scrollbar{display:none!important}#banner-wrapper{max-width:calc(100vw - 32px)!important;max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
				},
				quiz: {
					host: 'quiz-widget-host',
					css: '#wq-wrap{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:clamp(16px,8vw,52px)!important;padding-right:clamp(16px,8vw,52px)!important}#wq-wrap::-webkit-scrollbar{display:none!important}#wq-card{max-width:min(520px, calc(100vw - 32px))!important;max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
				},
				callback: {
					host: 'callback-widget-host',
					css: '#callback-widget-overlay{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:clamp(16px,8vw,52px)!important;padding-right:clamp(16px,8vw,52px)!important}#callback-widget-overlay::-webkit-scrollbar{display:none!important}#wcb-modal{max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
				},
				timer: {
					host: 'timer-widget-host',
					css: '#timer-widget-overlay{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:clamp(16px,8vw,52px)!important;padding-right:clamp(16px,8vw,52px)!important}#wt-modal{max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
				},
				stopOffer: {
					host: 'stop-offer-widget-host',
					css: '#wso-overlay{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:clamp(16px,8vw,52px)!important;padding-right:clamp(16px,8vw,52px)!important}#wso-modal{max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
				},
				onlineConsultant: {
					host: 'online-consultant-widget-host',
					css: '.woc-overlay{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:clamp(16px,8vw,52px)!important;padding-right:clamp(16px,8vw,52px)!important}.woc-modal{max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
				},
				calculator: {
					host: 'calculator-widget-host',
					css: '#wwc-overlay{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:clamp(16px,8vw,52px)!important;padding-right:clamp(16px,8vw,52px)!important}#wwc-card{max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
				}
			};

			function sendParentScroll(deltaY, inputType) {
				if (!Number.isFinite(deltaY) || deltaY === 0) return;

				window.parent.postMessage(
					{
						source: 'winwidget-live-preview',
						previewKey: previewKey,
						event: 'scroll-parent',
						deltaY: deltaY,
						inputType: inputType
					},
					'*'
				);
			}

			window.addEventListener(
				'wheel',
				function (event) {
					if (event.ctrlKey) return;

					var deltaMultiplier =
						event.deltaMode === 1
							? 16
							: event.deltaMode === 2
								? window.innerHeight
								: 1;

					sendParentScroll(event.deltaY * deltaMultiplier, 'wheel');
				},
				{ passive: true, capture: true }
			);

			window.addEventListener(
				'touchstart',
				function (event) {
					if (!event.touches || event.touches.length !== 1) {
						previewTouchLastY = null;
						return;
					}

					previewTouchLastY = event.touches[0].clientY;
				},
				{ passive: true, capture: true }
			);

			window.addEventListener(
				'touchmove',
				function (event) {
					if (
						!event.touches ||
						event.touches.length !== 1 ||
						previewTouchLastY === null
					) {
						previewTouchLastY = null;
						return;
					}

					var nextY = event.touches[0].clientY;
					sendParentScroll(previewTouchLastY - nextY, 'touch');
					previewTouchLastY = nextY;
				},
				{ passive: true, capture: true }
			);

			window.addEventListener(
				'touchend',
				function () {
					previewTouchLastY = null;
				},
				{ passive: true, capture: true }
			);

			window.addEventListener(
				'touchcancel',
				function () {
					previewTouchLastY = null;
				},
				{ passive: true, capture: true }
			);

			function isPreviewStorageKey(key) {
				var text = String(key || '');

				for (var i = 0; i < previewStoragePrefixes.length; i += 1) {
					if (text.indexOf(previewStoragePrefixes[i]) === 0) return true;
				}

				return false;
			}

			try {
				if (window.Storage && window.Storage.prototype) {
					var nativeGetItem = window.Storage.prototype.getItem;
					var nativeSetItem = window.Storage.prototype.setItem;
					var nativeRemoveItem = window.Storage.prototype.removeItem;

					window.Storage.prototype.getItem = function (key) {
						if (isPreviewStorageKey(key)) return null;

						return nativeGetItem.call(this, key);
					};
					window.Storage.prototype.setItem = function (key, value) {
						if (isPreviewStorageKey(key)) return undefined;

						return nativeSetItem.call(this, key, value);
					};
					window.Storage.prototype.removeItem = function (key) {
						if (isPreviewStorageKey(key)) return undefined;

						return nativeRemoveItem.call(this, key);
					};
				}
			} catch (e) {}

			try {
				var cookieDescriptor =
					Object.getOwnPropertyDescriptor(Document.prototype, 'cookie') ||
					Object.getOwnPropertyDescriptor(HTMLDocument.prototype, 'cookie');

				if (
					cookieDescriptor &&
					cookieDescriptor.get &&
					cookieDescriptor.set
				) {
					Object.defineProperty(document, 'cookie', {
						configurable: true,
						get: function () {
							return cookieDescriptor.get
								.call(document)
								.split(';')
								.filter(function (part) {
									return part.trim().indexOf('wq_p_') !== 0;
								})
								.join(';');
						},
						set: function (value) {
							if (String(value || '').trim().indexOf('wq_p_') === 0) {
								return value;
							}

							cookieDescriptor.set.call(document, value);

							return value;
						}
					});
				}
			} catch (e) {}

			var shouldAutoOpen = previewSurface === 'dialog';

			window.winwidget = previewType === 'wheel'
				? previewKey
				: { autoOpen: shouldAutoOpen };
			window.winwidgetAutoOpen = previewType === 'wheel' && shouldAutoOpen;
			window.winquizAutoOpen = previewType === 'quiz' && shouldAutoOpen;
			window.wincallbackAutoOpen =
				previewType === 'callback' && shouldAutoOpen;
			window.winwidgetCallbackAutoOpen =
				previewType === 'callback' && shouldAutoOpen;
			window.wintimerAutoOpen = previewType === 'timer' && shouldAutoOpen;
			window.winwidgetTimerAutoOpen =
				previewType === 'timer' && shouldAutoOpen;
			window.wintimer = previewType === 'timer' ? previewKey : undefined;
			window.winstopofferAutoOpen =
				previewType === 'stopOffer' && shouldAutoOpen;
			window.winwidgetStopOfferAutoOpen =
				previewType === 'stopOffer' && shouldAutoOpen;
			window.winstopoffer =
				previewType === 'stopOffer' ? previewKey : undefined;
			window.winonlineconsultantAutoOpen =
				previewType === 'onlineConsultant' && shouldAutoOpen;
			window.winwidgetOnlineConsultantAutoOpen =
				previewType === 'onlineConsultant' && shouldAutoOpen;
			window.winonlineconsultant =
				previewType === 'onlineConsultant' ? previewKey : undefined;
			window.wincalculatorAutoOpen =
				previewType === 'calculator' && shouldAutoOpen;
			window.wincalculator =
				previewType === 'calculator' ? previewKey : undefined;

			function schedulePreviewRestart() {
				if (restartNoticeSent) return;

				restartNoticeSent = true;

				setTimeout(
					function () {
						window.parent.postMessage(
							{
								source: 'winwidget-live-preview',
								previewKey: previewKey,
								event: 'ready-to-restart'
							},
							'*'
						);
					},
					previewType === 'wheel' ? 1800 : 900
				);
			}

			window.fetch = function (input, init) {
				var url = typeof input === 'string' ? input : input && input.url;
				var method = (
					(init && init.method) ||
					(typeof input !== 'string' && input && input.method) ||
					'GET'
				).toUpperCase();

				if (
					url &&
					url.indexOf(
						'/api/v1/' + configPath + '/' + previewKey + '/config'
					) !== -1
				) {
					return Promise.resolve(
						new Response(JSON.stringify(publicConfig), {
							status: 200,
							headers: { 'Content-Type': 'application/json' }
						})
					);
				}

				if (
					url &&
					url.indexOf('/api/v1/widget-events/') !== -1
				) {
					return Promise.resolve(new Response(null, { status: 204 }));
				}

				if (
					url &&
					(
						url.indexOf('/' + previewKey + '/lead') !== -1 ||
						(method !== 'GET' && url.indexOf('/api/v1/') !== -1)
					)
				) {
					schedulePreviewRestart();

					return Promise.resolve(
						new Response(JSON.stringify({ ok: true, preview: true }), {
							status: 200,
							headers: { 'Content-Type': 'application/json' }
						})
					);
				}

				return nativeFetch(input, init);
			};

			function applySandboxStageLayout() {
				var target = sandboxStageLayouts[previewType];
				var host = target && document.getElementById(target.host);
				var root = host && host.shadowRoot;

				if (!root) return false;

				var style = root.getElementById('winwidget-preview-sandbox-layout');

				if (!style) {
					style = document.createElement('style');
					style.id = 'winwidget-preview-sandbox-layout';
					root.appendChild(style);
				}

				style.textContent = target.css;

				return true;
			}

			var layoutAttempts = 0;
			var layoutTimer = setInterval(function () {
				layoutAttempts += 1;

				if (applySandboxStageLayout() || layoutAttempts > 80) {
					clearInterval(layoutTimer);
				}
			}, 50);
		})();
	</script>
</head>
<body>
	<div class="winwidget-preview-site" aria-hidden="true">
		<header class="winwidget-preview-site__header">
			<div class="winwidget-preview-site__brand">
				<span class="winwidget-preview-site__brand-mark">W</span>
				<span>WEAVE</span>
			</div>
			<nav class="winwidget-preview-site__nav">
				<span>Возможности</span>
				<span>Решения</span>
				<span>Тарифы</span>
			</nav>
			<span class="winwidget-preview-site__header-action">Попробовать</span>
			<span class="winwidget-preview-site__menu"></span>
		</header>
		<main class="winwidget-preview-site__main">
			<section class="winwidget-preview-site__hero">
				<div>
					<span class="winwidget-preview-site__eyebrow">
						<span class="winwidget-preview-site__eyebrow-dot"></span>
						Всё для роста бизнеса
					</span>
					<h1 class="winwidget-preview-site__title">
						Больше клиентов.
						<span class="winwidget-preview-site__title-accent">Меньше рутины.</span>
					</h1>
					<p class="winwidget-preview-site__text">
						Помогаем бизнесу привлекать аудиторию, обрабатывать заявки
						и расти каждый день.
					</p>
					<div class="winwidget-preview-site__actions">
						<span class="winwidget-preview-site__primary-action">
							Начать бесплатно
						</span>
						<span class="winwidget-preview-site__secondary-action">
							Узнать больше →
						</span>
					</div>
				</div>
				<div class="winwidget-preview-site__visual">
					<div class="winwidget-preview-site__dashboard">
						<div class="winwidget-preview-site__dashboard-head">
							<span class="winwidget-preview-site__dashboard-avatar"></span>
							<div class="winwidget-preview-site__dashboard-heading">
								<strong>Обзор показателей</strong>
								<span>Актуальные данные</span>
							</div>
							<span class="winwidget-preview-site__period">30 дней</span>
						</div>
						<div class="winwidget-preview-site__chart">
							<span class="winwidget-preview-site__chart-bar"></span>
							<span class="winwidget-preview-site__chart-bar"></span>
							<span class="winwidget-preview-site__chart-bar"></span>
							<span class="winwidget-preview-site__chart-bar"></span>
							<span class="winwidget-preview-site__chart-bar"></span>
							<span class="winwidget-preview-site__chart-bar"></span>
						</div>
						<div class="winwidget-preview-site__metrics">
							<div class="winwidget-preview-site__metric">
								<strong>1 284</strong>
								<span>Посетителей</span>
							</div>
							<div class="winwidget-preview-site__metric">
								<strong>147</strong>
								<span>Новых заявок</span>
							</div>
							<div class="winwidget-preview-site__metric">
								<strong>11,4%</strong>
								<span>Конверсия</span>
							</div>
						</div>
					</div>
					<div class="winwidget-preview-site__growth">
						<span class="winwidget-preview-site__growth-icon">↗</span>
						<span>Рост +24%</span>
					</div>
				</div>
			</section>
			<section class="winwidget-preview-site__features">
				<div class="winwidget-preview-site__feature">
					<span class="winwidget-preview-site__feature-icon">01</span>
					<div class="winwidget-preview-site__feature-copy">
						<strong>Быстрый запуск</strong>
						<span>Без сложной настройки</span>
					</div>
				</div>
				<div class="winwidget-preview-site__feature">
					<span class="winwidget-preview-site__feature-icon">02</span>
					<div class="winwidget-preview-site__feature-copy">
						<strong>Живая аналитика</strong>
						<span>Главное всегда под рукой</span>
					</div>
				</div>
				<div class="winwidget-preview-site__feature">
					<span class="winwidget-preview-site__feature-icon">03</span>
					<div class="winwidget-preview-site__feature-copy">
						<strong>Поддержка рядом</strong>
						<span>Поможем на каждом этапе</span>
					</div>
				</div>
			</section>
		</main>
	</div>
	<script src="${scriptUrl}" data-key="${previewKey}" async></script>
</body>
</html>`
}

const getTypeLabel = (type: PreviewType) => {
	if (type === 'wheel') return 'Колесо'
	if (type === 'quiz') return 'Квиз'
	if (type === 'callback') return 'Звонок'
	if (type === 'stopOffer') return 'Стоп-оффер'
	if (type === 'onlineConsultant') return 'Онлайн-консультант'
	if (type === 'calculator') return 'Калькулятор'

	return 'Таймер'
}

const WidgetLivePreview = (props: WidgetLivePreviewProps) => {
	const { onConfigChange } = props
	const lastStableConfigRef = useRef(props.config)
	const stableConfig = stabilizeWidgetPreviewColors(
		props.config,
		lastStableConfigRef.current
	)
	lastStableConfigRef.current = stableConfig
	const serializedConfig = JSON.stringify(stableConfig)
	const previousSerializedConfigRef = useRef(serializedConfig)
	const debouncedSerializedConfig = useDebounce(serializedConfig, 300)
	const [previewRunId, setPreviewRunId] = useState(0)
	const [canRestartPreview, setCanRestartPreview] = useState(false)
	const [isCollapsed, setIsCollapsed] = useState(false)
	const [device, setDevice] = useState<PreviewDevice>('desktop')
	const [surface, setSurface] = useState<PreviewSurface>('dialog')
	const previewViewportRef = useRef<HTMLDivElement | null>(null)
	const previewFrameRef = useRef<HTMLIFrameElement | null>(null)
	const previewKey = `live-preview-${props.type}-${hashString(debouncedSerializedConfig)}-${props.isHardPlan ? 'hard' : 'base'}-${surface}-${previewRunId}`
	const [previewLayout, setPreviewLayout] = useState(
		DEFAULT_PREVIEW_LAYOUT
	)
	const previewProps = {
		...props,
		config: JSON.parse(debouncedSerializedConfig)
	} as WidgetLivePreviewProps
	const previewDocument = buildPreviewSandboxDocument(
		props.type,
		buildPreviewPublicConfig(previewProps),
		previewKey,
		surface
	)
	const cropStyle = {
		width: `${Math.floor(previewLayout.frameWidth * previewLayout.scale)}px`,
		height: `${Math.floor(previewLayout.frameHeight * previewLayout.scale)}px`
	} as CSSProperties
	const frameStyle = {
		width: `${previewLayout.frameWidth}px`,
		height: `${previewLayout.frameHeight}px`,
		transform: `scale(${previewLayout.scale})`
	} as CSSProperties

	useEffect(() => {
		if (
			window.matchMedia(`(max-width: ${MOBILE_PREVIEW_BREAKPOINT}px)`)
				.matches
		) {
			setDevice('mobile')
			setIsCollapsed(true)
		}
	}, [])

	useEffect(() => {
		if (props.autoCollapse) setIsCollapsed(true)
	}, [props.autoCollapse])

	useEffect(() => {
		if (previousSerializedConfigRef.current === serializedConfig) return

		previousSerializedConfigRef.current = serializedConfig
		onConfigChange?.()
	}, [onConfigChange, serializedConfig])

	useEffect(() => {
		if (isCollapsed) return

		const updateLayout = () => {
			const previewViewport = previewViewportRef.current
			const containerWidth = previewViewport?.clientWidth
			const containerHeight = Math.max(
				MIN_PREVIEW_VIEWPORT_HEIGHT,
				window.innerHeight - PREVIEW_VIEWPORT_WINDOW_INSET
			)

			if (!containerWidth || !containerHeight) return

			const nextLayout = getPreviewLayout(
				containerWidth,
				containerHeight,
				device
			)

			setPreviewLayout(currentLayout => {
				if (
					currentLayout.frameWidth === nextLayout.frameWidth &&
					currentLayout.frameHeight === nextLayout.frameHeight &&
					currentLayout.scale === nextLayout.scale
				) {
					return currentLayout
				}

				return nextLayout
			})
		}

		updateLayout()
		window.addEventListener('resize', updateLayout)

		const resizeObserver =
			typeof ResizeObserver === 'undefined'
				? null
				: new ResizeObserver(updateLayout)

		if (previewViewportRef.current) {
			resizeObserver?.observe(previewViewportRef.current)
		}

		return () => {
			window.removeEventListener('resize', updateLayout)
			resizeObserver?.disconnect()
		}
	}, [device, isCollapsed])

	useEffect(() => {
		setCanRestartPreview(false)

		const handleMessage = (event: MessageEvent) => {
			const data = event.data as
				| {
						source?: string
						previewKey?: string
						event?: string
						deltaY?: number
						inputType?: 'wheel' | 'touch'
				  }
				| undefined

			if (
				!data ||
				event.source !== previewFrameRef.current?.contentWindow ||
				data.source !== 'winwidget-live-preview' ||
				data.previewKey !== previewKey
			) {
				return
			}

			if (data.event === 'scroll-parent') {
				const deltaY =
					(data.deltaY || 0) *
					(data.inputType === 'touch' ? previewLayout.scale : 1)

				scrollNearestScrollableParent(
					previewViewportRef.current,
					deltaY,
					props.scrollTargetRef?.current
				)
				return
			}

			if (data.event !== 'ready-to-restart' || surface !== 'dialog') return

			setCanRestartPreview(true)
		}

		window.addEventListener('message', handleMessage)

		return () => window.removeEventListener('message', handleMessage)
	}, [previewKey, previewLayout.scale, props.scrollTargetRef, surface])

	const restartPreview = () => {
		setCanRestartPreview(false)
		setPreviewRunId(current => current + 1)
	}

	const selectDevice = (nextDevice: PreviewDevice) => {
		setDevice(nextDevice)
		props.onDeviceChange?.(nextDevice)
	}

	return (
		<section className={styles.preview} aria-label="Live preview виджета">
			<div className={styles.previewHeader}>
				<div>
					<p className={styles.previewTitle}>Предпросмотр</p>
					<span className={styles.previewBadge}>
						{getTypeLabel(props.type)}
					</span>
				</div>
				<div className={styles.previewControls}>
					{!isCollapsed && (
						<>
							<div
								className={styles.previewSegmented}
								role="group"
								aria-label="Состояние виджета"
							>
								<ActionTooltip
									content="Показывает раскрытое окно виджета, которое увидит посетитель."
									placement="bottom"
									align="start"
									className={styles.previewControlTooltip}
								>
									<button
										type="button"
										className={`${styles.previewControlBtn} ${
											surface === 'dialog'
												? styles.previewControlBtnActive
												: ''
										}`}
										onClick={() => setSurface('dialog')}
										aria-pressed={surface === 'dialog'}
									>
										Окно
									</button>
								</ActionTooltip>
								<ActionTooltip
									content="Показывает кнопку запуска до открытия основного окна виджета."
									placement="bottom"
									align="end"
									className={styles.previewControlTooltip}
								>
									<button
										type="button"
										className={`${styles.previewControlBtn} ${
											surface === 'launcher'
												? styles.previewControlBtnActive
												: ''
										}`}
										onClick={() => setSurface('launcher')}
										aria-pressed={surface === 'launcher'}
									>
										Кнопка
									</button>
								</ActionTooltip>
							</div>
							<div
								className={styles.previewSegmented}
								role="group"
								aria-label="Размер экрана"
							>
								<ActionTooltip
									content="Показывает виджет на моковом сайте внутри настольного монитора."
									placement="bottom"
									align="start"
									className={styles.previewControlTooltip}
								>
									<button
										type="button"
										className={`${styles.previewControlBtn} ${
											device === 'desktop'
												? styles.previewControlBtnActive
												: ''
										}`}
										onClick={() => selectDevice('desktop')}
										aria-pressed={device === 'desktop'}
									>
										Desktop
									</button>
								</ActionTooltip>
								<ActionTooltip
									content="Показывает виджет внутри телефона и отмечает проверку мобильной версии."
									placement="bottom"
									align="end"
									className={styles.previewControlTooltip}
								>
									<button
										type="button"
										className={`${styles.previewControlBtn} ${
											device === 'mobile'
												? styles.previewControlBtnActive
												: ''
										}`}
										onClick={() => selectDevice('mobile')}
										aria-pressed={device === 'mobile'}
									>
										Mobile
									</button>
								</ActionTooltip>
							</div>
						</>
					)}
					<button
						type="button"
						className={styles.previewToggle}
						onClick={() => setIsCollapsed(current => !current)}
						aria-expanded={!isCollapsed}
					>
						{isCollapsed ? 'Показать' : 'Свернуть'}
					</button>
				</div>
			</div>
			{!isCollapsed && (
				<>
					<div className={styles.previewViewport} ref={previewViewportRef}>
						<div
							className={`${styles.previewDevice} ${
								device === 'mobile' ? styles.previewDeviceMobile : ''
							}`}
						>
							{device === 'mobile' && (
								<>
									<span
										className={styles.mobileControlsLeft}
										aria-hidden="true"
									/>
									<span
										className={styles.mobileControlsRight}
										aria-hidden="true"
									/>
								</>
							)}
							{device === 'desktop' && (
								<span
									className={styles.desktopCamera}
									aria-hidden="true"
								/>
							)}
							<div
								className={`${styles.deviceScreen} ${
									device === 'mobile'
										? styles.deviceScreenMobile
										: styles.deviceScreenDesktop
								}`}
							>
								{canRestartPreview && surface === 'dialog' && (
									<ActionTooltip
										content="Перезапускает тестовый сценарий, чтобы пройти его ещё раз."
										className={styles.previewRestartTooltip}
									>
										<button
											type="button"
											className={styles.previewRestart}
											onClick={restartPreview}
										>
											Попробовать снова
										</button>
									</ActionTooltip>
								)}
								<div className={styles.previewCrop} style={cropStyle}>
									<iframe
										ref={previewFrameRef}
										key={previewKey}
										className={styles.previewFrame}
										title={`Предпросмотр: ${getTypeLabel(props.type)}`}
										srcDoc={previewDocument}
										sandbox="allow-scripts"
										scrolling="no"
										style={frameStyle}
									/>
								</div>
							</div>
							{device === 'desktop' && (
								<div className={styles.desktopStand} aria-hidden="true">
									<span className={styles.desktopStandNeck} />
									<span className={styles.desktopStandBase} />
								</div>
							)}
						</div>
					</div>
					<p className={styles.previewNotice}>
						Тестовый режим: заявки и интеграции не отправляются,
						ограничения повторного показа отключены.
					</p>
				</>
			)}
		</section>
	)
}

export default WidgetLivePreview
