import type { Subscription } from '@/entities/subscription/@x/site-widget'

export interface OnlineConsultantIntegrations {
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

export interface OnlineConsultantQuickAction {
	id: string
	label: string
	answer: string
	buttonText: string
	buttonUrl: string
}

export interface OnlineConsultantConfig {
	color: string
	bgColor: string
	buttonColor: string
	openButtonColor: string
	buttonSide: 'left' | 'right'
	buttonPulse: boolean
	buttonBottom: number
	buttonOffset: number
	buttonSize: number
	buttonImageUrl: string
	autoOpenDelay: number | null
	bubbleEnabled: boolean
	bubbleText: string
	title: string
	subtitle: string
	dataType: 'PHONE' | 'EMAIL' | 'PHONE_AND_EMAIL' | 'NONE'
	contactTitle: string
	submitButtonText: string
	successTitle: string
	successSubtitle: string
	privacyUrl: string
	developInfoActive: boolean
	filterDuplicates: boolean
	quickActions: OnlineConsultantQuickAction[]
	integrations: OnlineConsultantIntegrations
}

export interface OnlineConsultant {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	installDomain: string
	config: OnlineConsultantConfig
	createdAt: string
	updatedAt: string
	_count?: { leads: number }
}

export interface OnlineConsultantLead {
	id: string
	onlineConsultantId: string
	phone: string | null
	email: string | null
	actionLabel: string
	actionValue: string
	url: string | null
	createdAt: string
}

export interface OnlineConsultantLeadsResponse {
	leads: OnlineConsultantLead[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface OnlineConsultantsResponse {
	onlineConsultants: OnlineConsultant[]
	subscription: Subscription | null
}
