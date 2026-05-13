import { Subscription } from '@/services/widget/widget.types'

export interface StopOfferIntegrations {
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

export interface StopOfferConfig {
	color: string
	bgColor: string
	buttonColor: string
	autoOpenDelay: number | null
	desktopExitIntent: boolean
	mobileAutoOpenDelay: number
	scrollPercent: number
	showOnce: boolean
	displayCooldownDays: number
	displayResetToken: string
	hideIfSubmitted: boolean
	badgeText: string
	title: string
	subtitle: string
	offerText: string
	dataType: 'PHONE' | 'EMAIL' | 'PHONE_AND_EMAIL' | 'NONE'
	contactTitle: string
	submitButtonText: string
	successTitle: string
	successSubtitle: string
	actionButtonEnabled: boolean
	actionButtonText: string
	actionButtonUrl: string
	privacyUrl: string
	developInfoActive: boolean
	filterDuplicates: boolean
	submissionCooldownDays: number
	submissionResetToken: string
	integrations: StopOfferIntegrations
}

export interface StopOffer {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	installDomain: string
	config: StopOfferConfig
	createdAt: string
	updatedAt: string
	_count?: { leads: number }
}

export interface StopOfferLead {
	id: string
	stopOfferId: string
	phone: string | null
	email: string | null
	url: string | null
	createdAt: string
}

export interface StopOfferLeadsResponse {
	leads: StopOfferLead[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface StopOffersResponse {
	stopOffers: StopOffer[]
	subscription: Subscription | null
}
