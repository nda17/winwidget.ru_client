export type WidgetExperienceType =
	| 'wheel'
	| 'quiz'
	| 'callback'
	| 'timer'
	| 'stop-offer'
	| 'online-consultant'
	| 'calculator'

export type WidgetPublicationStatus =
	| 'DRAFT_ONLY'
	| 'PUBLISHED'
	| 'CHANGES_PENDING'
	| 'INACTIVE'

export interface WidgetReadinessIssue {
	code: string
	message: string
}

export interface WidgetReadiness {
	ready: boolean
	blockers: WidgetReadinessIssue[]
	warnings: WidgetReadinessIssue[]
}

export interface WidgetLifecycleState<TConfig = unknown> {
	type: WidgetExperienceType
	id: string
	name: string
	publicKey: string
	isActive: boolean
	installDomain: string
	config: TConfig
	createdAt: string
	updatedAt: string
	draftRevision: number
	publishedVersion: number
	publishedFromDraftRevision: number
	publishedAt: string | null
	status: WidgetPublicationStatus
	hasUnpublishedChanges: boolean
	readiness: WidgetReadiness
}

export interface WidgetConfigVersion {
	version: number
	sourceVersion: number | null
	createdAt: string
}

export interface WidgetConfigVersionsResponse {
	items: WidgetConfigVersion[]
	page: number
	limit: number
	total: number
	totalPages: number
}

export interface WidgetCloneResponse {
	id: string
	type: WidgetExperienceType
	name: string
	warning?: string
}

export type WidgetInstallationState =
	| 'DOMAIN_REQUIRED'
	| 'NOT_SEEN'
	| 'SIGNAL_RECEIVED'

export interface WidgetRuntimeStatus {
	serverTime: string
	installation: {
		state: WidgetInstallationState
		domain: string
		firstSeenAt: string | null
		lastSeenAt: string | null
		runtimeVersion: string | null
	}
}

export interface WidgetAnalyticsDay {
	date: string
	impressions: number
	opens: number
	starts: number
	submits: number
}

export interface WidgetRuntimeAnalytics {
	from: string
	to: string
	days: number
	trackingStartedAt: string | null
	isPartialPeriod: boolean
	submitAvailable: boolean
	totals: {
		impressions: number
		opens: number
		starts: number
		submits: number
	}
	conversion: {
		openRate: number | null
		startRate: number | null
		submitRate: number | null
	}
	daily: WidgetAnalyticsDay[]
}
