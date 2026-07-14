'use client'

import { CallbackConfig } from '@/entities/site-widget'
import { CalculatorConfig } from '@/entities/site-widget'
import { CountdownTimerConfig } from '@/entities/site-widget'
import { OnlineConsultantConfig } from '@/entities/site-widget'
import { QuizConfig } from '@/entities/site-widget'
import { StopOfferConfig } from '@/entities/site-widget'
import { WidgetConfig } from '@/entities/site-widget'
import type { CSSProperties } from 'react'
import { useEffect, useRef, useState } from 'react'
import styles from './WidgetLivePreview.module.scss'

type PreviewType =
	| 'wheel'
	| 'quiz'
	| 'callback'
	| 'timer'
	| 'stopOffer'
	| 'onlineConsultant'
	| 'calculator'

type WidgetLivePreviewProps =
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
	height: 680
}
const MOBILE_PREVIEW_BREAKPOINT = 600
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

const getPreviewLayout = (containerWidth: number) => {
	const frame =
		containerWidth <= MOBILE_PREVIEW_BREAKPOINT
			? MOBILE_PREVIEW_FRAME
			: DESKTOP_PREVIEW_FRAME
	const scale = Math.min(1, containerWidth / frame.width)

	return {
		frameWidth: frame.width,
		frameHeight: frame.height,
		scale
	}
}

const scrollNearestScrollableParent = (
	element: HTMLElement | null,
	deltaY: number
) => {
	if (!element || !Number.isFinite(deltaY) || Math.abs(deltaY) < 1) return

	let parent = element.parentElement

	while (parent) {
		const style = window.getComputedStyle(parent)
		const canScroll =
			/(auto|scroll)/.test(style.overflowY) &&
			parent.scrollHeight > parent.clientHeight

		if (canScroll) {
			parent.scrollBy({ top: deltaY, behavior: 'auto' })
			return
		}

		parent = parent.parentElement
	}

	window.scrollBy({ top: deltaY, behavior: 'auto' })
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
			contactPosition: props.config.contactPosition || 'AFTER_RESULT',
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
	previewKey: string
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
			background: #0d0d1a;
			overflow: hidden;
			overscroll-behavior: none;
		}

		body::-webkit-scrollbar {
			display: none;
		}
	</style>
	<script>
		(function () {
			var previewKey = ${JSON.stringify(previewKey)};
			var previewType = ${JSON.stringify(type)};
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
					css: '#main-wrapper{align-items:center!important;justify-content:center!important;overflow:hidden!important;overscroll-behavior:none!important;padding-left:clamp(16px,8vw,52px)!important;padding-right:clamp(16px,8vw,52px)!important}#main-wrapper::-webkit-scrollbar{display:none!important}#banner-wrapper{max-width:calc(100vw - 32px)!important;max-height:calc(100vh - 32px)!important;overflow:hidden!important}'
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

			function sendParentScroll(deltaY) {
				if (!deltaY || Math.abs(deltaY) < 1) return;

				window.parent.postMessage(
					{
						source: 'winwidget-live-preview',
						previewKey: previewKey,
						event: 'scroll-parent',
						deltaY: deltaY
					},
					'*'
				);
			}

			window.addEventListener(
				'wheel',
				function (event) {
					sendParentScroll(event.deltaY);
				},
				{ passive: true }
			);

			window.addEventListener(
				'touchstart',
				function (event) {
					if (!event.touches || !event.touches.length) return;

					previewTouchLastY = event.touches[0].clientY;
				},
				{ passive: true }
			);

			window.addEventListener(
				'touchmove',
				function (event) {
					if (
						!event.touches ||
						!event.touches.length ||
						previewTouchLastY === null
					) {
						return;
					}

					var nextY = event.touches[0].clientY;
					sendParentScroll(previewTouchLastY - nextY);
					previewTouchLastY = nextY;
				},
				{ passive: true }
			);

			window.addEventListener(
				'touchend',
				function () {
					previewTouchLastY = null;
				},
				{ passive: true }
			);

			window.addEventListener(
				'touchcancel',
				function () {
					previewTouchLastY = null;
				},
				{ passive: true }
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

			window.winwidget = previewType === 'wheel'
				? previewKey
				: { autoOpen: true };
			window.winwidgetAutoOpen = previewType === 'wheel';
			window.winquizAutoOpen = previewType === 'quiz';
			window.wincallbackAutoOpen = previewType === 'callback';
			window.winwidgetCallbackAutoOpen = previewType === 'callback';
			window.wintimerAutoOpen = previewType === 'timer';
			window.winwidgetTimerAutoOpen = previewType === 'timer';
			window.wintimer = previewType === 'timer' ? previewKey : undefined;
			window.winstopofferAutoOpen = previewType === 'stopOffer';
			window.winwidgetStopOfferAutoOpen = previewType === 'stopOffer';
			window.winstopoffer =
				previewType === 'stopOffer' ? previewKey : undefined;
			window.winonlineconsultantAutoOpen =
				previewType === 'onlineConsultant';
			window.winwidgetOnlineConsultantAutoOpen =
				previewType === 'onlineConsultant';
			window.winonlineconsultant =
				previewType === 'onlineConsultant' ? previewKey : undefined;
			window.wincalculatorAutoOpen = previewType === 'calculator';
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
					url.indexOf('/api/' + configPath + '/' + previewKey + '/config') !== -1
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
					(
						url.indexOf('/' + previewKey + '/lead') !== -1 ||
						(method !== 'GET' && url.indexOf('/api/') !== -1)
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
	const serializedConfig = JSON.stringify(props.config)
	const [previewRunId, setPreviewRunId] = useState(0)
	const [canRestartPreview, setCanRestartPreview] = useState(false)
	const previewViewportRef = useRef<HTMLDivElement | null>(null)
	const previewKey = `live-preview-${props.type}-${hashString(serializedConfig)}-${props.isHardPlan ? 'hard' : 'base'}-${previewRunId}`
	const [previewLayout, setPreviewLayout] = useState(
		DEFAULT_PREVIEW_LAYOUT
	)
	const previewDocument = buildPreviewSandboxDocument(
		props.type,
		buildPreviewPublicConfig(props),
		previewKey
	)
	const cropStyle = {
		width: `${Math.ceil(previewLayout.frameWidth * previewLayout.scale)}px`,
		height: `${Math.ceil(previewLayout.frameHeight * previewLayout.scale)}px`
	} as CSSProperties
	const frameStyle = {
		width: `${previewLayout.frameWidth}px`,
		height: `${previewLayout.frameHeight}px`,
		transform: `scale(${previewLayout.scale})`
	} as CSSProperties

	useEffect(() => {
		const updateLayout = () => {
			const containerWidth = previewViewportRef.current?.clientWidth

			if (!containerWidth) return

			const nextLayout = getPreviewLayout(containerWidth)

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
	}, [])

	useEffect(() => {
		setCanRestartPreview(false)

		const handleMessage = (event: MessageEvent) => {
			const data = event.data as
				| {
						source?: string
						previewKey?: string
						event?: string
						deltaY?: number
				  }
				| undefined

			if (
				!data ||
				data.source !== 'winwidget-live-preview' ||
				data.previewKey !== previewKey
			) {
				return
			}

			if (data.event === 'scroll-parent') {
				scrollNearestScrollableParent(
					previewViewportRef.current,
					data.deltaY || 0
				)
				return
			}

			if (data.event !== 'ready-to-restart') return

			setCanRestartPreview(true)
		}

		window.addEventListener('message', handleMessage)

		return () => window.removeEventListener('message', handleMessage)
	}, [previewKey])

	const restartPreview = () => {
		setCanRestartPreview(false)
		setPreviewRunId(current => current + 1)
	}

	return (
		<section className={styles.preview} aria-label="Live preview виджета">
			<div className={styles.previewHeader}>
				<p className={styles.previewTitle}>Предпросмотр</p>
				<span className={styles.previewBadge}>
					{getTypeLabel(props.type)}
				</span>
			</div>
			<div className={styles.previewViewport} ref={previewViewportRef}>
				{canRestartPreview && (
					<button
						type="button"
						className={styles.previewRestart}
						onClick={restartPreview}
					>
						Попробовать снова
					</button>
				)}
				<div className={styles.previewCrop} style={cropStyle}>
					<iframe
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
		</section>
	)
}

export default WidgetLivePreview
