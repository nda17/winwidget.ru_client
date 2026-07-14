import { Subscription } from '@/services/widget/widget.types'

export type CalculatorContactPosition = 'BEFORE_RESULT' | 'AFTER_RESULT'
export type CalculatorDataType = 'PHONE' | 'EMAIL' | 'PHONE_AND_EMAIL'
export type CalculatorFieldType =
	| 'select'
	| 'number'
	| 'radio'
	| 'checkbox'

export interface CalculatorOption {
	id: string
	label: string
	add: number
	multiplier: number
}

export interface CalculatorField {
	id: string
	label: string
	type: CalculatorFieldType
	required: boolean
	options?: CalculatorOption[]
	min?: number
	max?: number
	step?: number
	defaultValue?: number
	unit?: string
	unitPrice?: number
}

export interface CalculatorIntegrations {
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

export interface CalculatorConfig {
	color: string
	bgColor: string
	glassEffect: boolean
	buttonColor: string
	openButtonColor: string
	textColor: string
	buttonSide: 'left' | 'right'
	buttonPulse: boolean
	buttonBottom: number
	buttonOffset: number
	buttonSize: number
	buttonImageUrl: string
	bubbleEnabled: boolean
	bubbleText: string
	autoOpenDelay: number | null
	title: string
	subtitle: string
	calculateButtonText: string
	contactTitle: string
	contactPosition: CalculatorContactPosition
	resultTitle: string
	dataType: CalculatorDataType
	privacyUrl: string
	developInfoActive: boolean
	filterDuplicates: boolean
	basePrice: number
	currency: string
	roundingStep: number
	fields: CalculatorField[]
	integrations: CalculatorIntegrations
}

export interface Calculator {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	installDomain: string
	config: CalculatorConfig
	createdAt: string
	updatedAt: string
	_count?: { leads: number }
}

export interface CalculatorLeadAnswer {
	fieldId: string
	fieldLabel?: string
	valueLabel?: string
	value: string | number | string[]
}

export interface CalculatorLead {
	id: string
	calculatorId: string
	contact: string
	phone: string | null
	email: string | null
	answers: CalculatorLeadAnswer[] | Record<string, unknown>
	calculatedPrice: string
	currency: string
	url: string | null
	createdAt: string
}

export interface CalculatorLeadsResponse {
	leads: CalculatorLead[]
	total: number
	page: number
	limit: number
	totalPages: number
}

export interface CalculatorsResponse {
	calculators: Calculator[]
	subscription: Subscription | null
}
