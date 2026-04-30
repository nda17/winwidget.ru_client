export type Plan = 'TRIAL' | 'EASY' | 'HARD'
export type BillingPeriod = 'MONTHLY' | 'YEARLY'
export type SubscriptionStatus = 'ACTIVE' | 'EXPIRED' | 'CANCELLED'

export interface WidgetBonus {
	name: string
	active: boolean
	probability?: number
	color?: string
	neverWin?: boolean
}

export interface WidgetIntegrations {
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

export interface WidgetConfig {
	color: string
	bgColor: string
	autoOpenDelay: number | null
	spinDuration: number
	buttonSide: 'left' | 'right'
	buttonPulse: boolean
	buttonBottom: number
	buttonOffset: number
	buttonSize: number
	bubbleEnabled: boolean
	bubbleText: string
	alreadyPlayedTitle: string
	alreadyPlayedSubtitle: string
	hideIfPlayed: boolean
	dataType: 'PHONE' | 'EMAIL' | 'PHONE_AND_EMAIL' | 'NONE'
	title: string
	subtitle: string
	winMessage: string
	privacyUrl: string
	developInfoActive: boolean
	buttonText: string
	filterDuplicates: boolean
	buttonColor: string
	centerColor: string
	arrowColor: string
	spinCooldownDays: number
	spinResetToken: string
	actionButton: null | { type: 'url'; value: string }
	bonuses: WidgetBonus[]
	integrations: WidgetIntegrations
}

export interface Widget {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	installDomain: string
	config: WidgetConfig
	createdAt: string
	updatedAt: string
	_count?: { leads: number }
}

export interface Lead {
	id: string
	widgetId: string
	contact: string
	phone: string | null
	email: string | null
	bonus: string | null
	url: string | null
	createdAt: string
}

export interface Subscription {
	id: string
	userId: string
	plan: Plan
	billingPeriod: BillingPeriod | null
	status: SubscriptionStatus
	startsAt: string
	expiresAt: string | null
	leadsThisPeriod: number
	periodResetsAt: string | null
	createdAt: string
	updatedAt: string
}

export interface BonusStat {
	bonus: string
	count: number
	percent: number
}

export interface LeadsStatsResponse {
	stats: BonusStat[]
	total: number
}

export interface LeadsResponse {
	leads: Lead[]
	total: number
	page: number
	limit: number
}

export interface WidgetsResponse {
	widgets: Widget[]
	subscription: Subscription | null
}
