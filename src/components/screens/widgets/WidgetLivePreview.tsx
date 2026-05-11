'use client'

import { CallbackConfig } from '@/services/callback/callback.types'
import { CountdownTimerConfig } from '@/services/countdown-timer/countdown-timer.types'
import { QuizConfig } from '@/services/quiz/quiz.types'
import { WidgetConfig } from '@/services/widget/widget.types'
import type { CSSProperties } from 'react'
import { useEffect, useState } from 'react'
import styles from './WidgetLivePreview.module.scss'

type PreviewType = 'wheel' | 'quiz' | 'callback' | 'timer'

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

const API_URL =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST || 'https://winwidget.ru'
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'

const SCRIPT_BY_TYPE: Record<PreviewType, string> = {
	wheel: 'wheel.js',
	quiz: 'quiz.js',
	callback: 'callback.js',
	timer: 'timer.js'
}

const CONFIG_PATH_BY_TYPE: Record<PreviewType, string> = {
	wheel: 'widget',
	quiz: 'quiz',
	callback: 'callback',
	timer: 'countdown-timer'
}

const PREVIEW_FRAME_WIDTH = 940
const PREVIEW_FRAME_HEIGHT = 520
const DEFAULT_PREVIEW_SCALE = 0.62

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

const getPreviewScale = () => {
	if (typeof window === 'undefined') return DEFAULT_PREVIEW_SCALE
	if (window.matchMedia('(max-width: 420px)').matches) return 0.35
	if (window.matchMedia('(max-width: 480px)').matches) return 0.39
	if (window.matchMedia('(max-width: 600px)').matches) return 0.46

	return DEFAULT_PREVIEW_SCALE
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
			var previewStoragePrefixes = [
				'winwidget_played_',
				'wintimer_submitted_'
			];
			var sandboxStageLayouts = {
				wheel: {
					host: 'wheel-widget-host',
					css: '#main-wrapper{align-items:center!important;justify-content:center!important;padding-left:52px!important;padding-right:52px!important}#banner-wrapper{max-width:calc(100vw - 104px)!important}'
				},
				quiz: {
					host: 'quiz-widget-host',
					css: '#wq-wrap{align-items:center!important;justify-content:center!important;padding-left:52px!important;padding-right:52px!important}#wq-card{max-width:min(520px, calc(100vw - 104px))!important}'
				},
				callback: {
					host: 'callback-widget-host',
					css: '#callback-widget-overlay{align-items:center!important;justify-content:center!important;padding-left:52px!important;padding-right:52px!important}'
				},
				timer: {
					host: 'timer-widget-host',
					css: '#timer-widget-overlay{align-items:center!important;justify-content:center!important;padding-left:52px!important;padding-right:52px!important}'
				}
			};

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

	return 'Таймер'
}

const WidgetLivePreview = (props: WidgetLivePreviewProps) => {
	const serializedConfig = JSON.stringify(props.config)
	const [previewRunId, setPreviewRunId] = useState(0)
	const [canRestartPreview, setCanRestartPreview] = useState(false)
	const previewKey = `live-preview-${props.type}-${hashString(serializedConfig)}-${props.isHardPlan ? 'hard' : 'base'}-${previewRunId}`
	const [previewScale, setPreviewScale] = useState(DEFAULT_PREVIEW_SCALE)
	const previewDocument = buildPreviewSandboxDocument(
		props.type,
		buildPreviewPublicConfig(props),
		previewKey
	)
	const cropStyle = {
		width: `${Math.ceil(PREVIEW_FRAME_WIDTH * previewScale)}px`,
		height: `${Math.ceil(PREVIEW_FRAME_HEIGHT * previewScale)}px`
	} as CSSProperties
	const frameStyle = {
		width: `${PREVIEW_FRAME_WIDTH}px`,
		height: `${PREVIEW_FRAME_HEIGHT}px`,
		transform: `scale(${previewScale})`
	} as CSSProperties

	useEffect(() => {
		const updateScale = () => setPreviewScale(getPreviewScale())

		updateScale()
		window.addEventListener('resize', updateScale)

		return () => window.removeEventListener('resize', updateScale)
	}, [])

	useEffect(() => {
		setCanRestartPreview(false)

		const handleMessage = (event: MessageEvent) => {
			const data = event.data as
				| {
						source?: string
						previewKey?: string
						event?: string
				  }
				| undefined

			if (
				!data ||
				data.source !== 'winwidget-live-preview' ||
				data.previewKey !== previewKey ||
				data.event !== 'ready-to-restart'
			) {
				return
			}

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
			<div className={styles.previewViewport}>
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
						style={frameStyle}
					/>
				</div>
			</div>
		</section>
	)
}

export default WidgetLivePreview
