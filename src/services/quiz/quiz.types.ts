import { Subscription } from '@/services/widget/widget.types'

export type QuizQuestionType = 'radio' | 'checkbox'

export interface QuizOption {
	id: string
	text: string
	scores: Record<string, number> // resultId → points
}

export interface QuizQuestion {
	id: string
	text: string
	type: QuizQuestionType
	options: QuizOption[]
}

export interface QuizResult {
	id: string
	title: string
	description: string
	promoCode: string
	buttonText: string
	buttonUrl: string
}

export interface QuizIntegrations {
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

export interface QuizConfig {
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
	title: string
	subtitle: string
	buttonText: string
	contactTitle: string
	dataType: 'PHONE' | 'EMAIL' | 'PHONE_AND_EMAIL' | 'NONE'
	phoneRegion: string
	privacyUrl: string
	filterDuplicates: boolean
	alreadyPlayedTitle: string
	alreadyPlayedSubtitle: string
	hideIfPlayed: boolean
	quizCooldownDays: number
	quizResetToken: string
	questions: QuizQuestion[]
	results: QuizResult[]
	integrations: QuizIntegrations
}

export interface Quiz {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	config: QuizConfig
	createdAt: string
	updatedAt: string
	_count?: { leads: number }
}

export interface QuizLead {
	id: string
	quizId: string
	contact: string
	phone: string | null
	email: string | null
	answers: { questionId: string; optionIds: string[] }[]
	result: string | null
	url: string | null
	createdAt: string
}

export interface QuizResultStat {
	result: string
	count: number
	percent: number
}

export interface QuizLeadsStatsResponse {
	stats: QuizResultStat[]
	total: number
}

export interface QuizLeadsResponse {
	leads: QuizLead[]
	total: number
	page: number
	limit: number
}

export interface QuizzesResponse {
	quizzes: Quiz[]
	subscription: Subscription | null
}
