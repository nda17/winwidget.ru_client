import { Subscription } from '@/services/widget/widget.types'

export type CountdownTimerMode = 'FIXED_DATE' | 'EVERGREEN'
export type CountdownTimerExpiredBehavior =
	| 'showExpired'
	| 'hide'
	| 'disableForm'

export interface CountdownTimerIntegrations {
	email?: string
	webhookUrl?: string
	telegramChatId?: string
	yandexMetrikaId?: string
	vkPixelId?: string
	bitrix24WebhookUrl?: string
	roistatEnabled?: boolean
	amoCrmDomain?: string
	amoCrmToken?: string
}

export interface CountdownTimerConfig {
	color: string
	bgColor: string
	buttonColor: string
	openButtonColor: string
	buttonSide: 'left' | 'right'
	buttonPulse: boolean
	buttonBottom: number
	buttonOffset: number
	buttonSize: number
	autoOpenDelay: number | null
	bubbleText: string
	title: string
	subtitle: string
	timerMode: CountdownTimerMode
	deadlineAt: string
	evergreenDurationMinutes: number
	expiredBehavior: CountdownTimerExpiredBehavior
	expiredTitle: string
	expiredSubtitle: string
	dataType: 'PHONE' | 'EMAIL' | 'PHONE_AND_EMAIL' | 'NONE'
	contactTitle: string
	submitButtonText: string
	successTitle: string
	successSubtitle: string
	actionButtonText: string
	actionButtonUrl: string
	privacyUrl: string
	developInfoActive: boolean
	filterDuplicates: boolean
	submissionCooldownDays: number
	timerResetToken: string
	integrations: CountdownTimerIntegrations
}

export interface CountdownTimer {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	config: CountdownTimerConfig
	createdAt: string
	updatedAt: string
	_count?: { leads: number }
}

export interface CountdownTimerLead {
	id: string
	countdownTimerId: string
	phone: string | null
	email: string | null
	url: string | null
	createdAt: string
}

export interface CountdownTimerLeadsResponse {
	leads: CountdownTimerLead[]
	total: number
	page: number
	limit: number
}

export interface CountdownTimersResponse {
	countdownTimers: CountdownTimer[]
	subscription: Subscription | null
}
