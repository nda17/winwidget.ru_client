import { Subscription } from '@/services/widget/widget.types'

export interface CallbackIntegrations {
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

export interface CallbackConfig {
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
	bubbleEnabled?: boolean
	bubbleText?: string
	title: string
	subtitle: string
	submitButtonText: string
	successTitle: string
	successSubtitle: string
	privacyUrl: string
	developInfoActive: boolean
	filterDuplicates: boolean
	timeSlots: string[]
	integrations: CallbackIntegrations
}

export interface Callback {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	installDomain: string
	config: CallbackConfig
	createdAt: string
	updatedAt: string
	_count?: { leads: number }
}

export interface CallbackLead {
	id: string
	callbackId: string
	phone: string
	timeSlot: string
	timezone: string
	url: string | null
	createdAt: string
}

export interface CallbackLeadsResponse {
	leads: CallbackLead[]
	total: number
	page: number
	limit: number
}

export interface CallbacksResponse {
	callbacks: Callback[]
	subscription: Subscription | null
}
