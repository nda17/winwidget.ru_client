import type { Subscription } from '@/entities/subscription/@x/site-widget'

export type AiConsultantOutcome = 'ANSWER' | 'OFF_TOPIC' | 'NO_INFORMATION'

export interface AiConsultantConfig {
	color: string
	bgColor: string
	textColor: string
	buttonColor: string
	openButtonColor: string
	buttonSide: 'left' | 'right'
	buttonPulse: boolean
	buttonBottom: number
	buttonOffset: number
	buttonSize: number
	buttonImageUrl: string
	autoOpenDelay: number | null
	operatorName: string
	greeting: string
	instructionsPrompt: string
	inactivityTimeoutMinutes: number
	farewellMessage: string
	inputPlaceholder: string
	privacyUrl: string
	developInfoActive: boolean
}

export interface AiConsultant {
	id: string
	userId: string
	publicKey: string
	name: string
	isActive: boolean
	installDomain: string
	config: AiConsultantConfig
	draftRevision: number
	publishedVersion: number
	publishedFromDraftRevision: number
	publishedAt: string | null
	createdAt: string
	updatedAt: string
}

export interface AiConsultantsResponse {
	aiConsultants: AiConsultant[]
	subscription: Subscription | null
}

export interface AiConsultantMessage {
	role: 'user' | 'assistant'
	content: string
}

export interface AiConsultantMessageRequest {
	requestId: string
	sessionId: string
	message: string
	history?: AiConsultantMessage[]
}

export interface AiConsultantMessageResponse {
	requestId: string
	reply: string
	outcome: AiConsultantOutcome
}
