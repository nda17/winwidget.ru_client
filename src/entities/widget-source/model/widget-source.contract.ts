import {
	hasExactKeys,
	isIsoDate,
	isRecord,
	isUuidV4
} from '@/shared/lib/contract'

export const widgetTypes = [
	'WHEEL',
	'QUIZ',
	'CALLBACK',
	'TIMER',
	'STOP_OFFER',
	'CALCULATOR'
] as const
export type WidgetType = (typeof widgetTypes)[number]
export type WidgetEligibilityReason =
	| 'ELIGIBLE'
	| 'NO_SUBSCRIPTION'
	| 'TRIAL'
	| 'INACTIVE'
	| 'NOT_STARTED'
	| 'EXPIRED'
export type WidgetControlError =
	| 'DELEGATION_REVOKED'
	| 'OWNER_CHANGED'
	| 'SUBSCRIPTION_REQUIRED'
	| 'WIDGET_UNAVAILABLE'
	| 'ALREADY_CONNECTED'
	| 'CONTROL_CONFLICT'
	| 'DEPENDENCY_UNAVAILABLE'
	| 'INVALID_RESPONSE'
export interface WidgetEligibility {
	eligible: boolean
	reason: WidgetEligibilityReason
	plan: 'TRIAL' | 'EASY' | 'HARD' | null
	startsAt: string | null
	expiresAt: string | null
	checkedAt: string
	validUntil: string
}
export interface WidgetCandidate {
	widgetType: WidgetType
	widgetId: string
	name: string
	isActive: boolean
	publishedVersion: number
	createdAt: string
	connection: 'NONE' | 'THIS_WORKSPACE' | 'OTHER_WORKSPACE'
	sourceId: string | null
}
export interface WidgetCandidatesPage {
	schemaVersion: 1
	workspaceId: string
	page: number
	pageSize: number
	total: number
	eligibility: WidgetEligibility
	items: WidgetCandidate[]
}
export interface ManagedWidgetSource {
	id: string
	workspaceId: string
	kind: 'WIDGET'
	name: string
	widgetType: WidgetType
	widgetId: string
	teamId: string | null
	createdBySubject: string
	version: number
	enabled: boolean
	generation: number
	controlVersion: number
	appliedControlVersion: number | null
	appliedGeneration: number | null
	syncState: 'PENDING' | 'SYNCED' | 'BLOCKED' | 'ERROR'
	lastErrorCode: WidgetControlError | null
	createdAt: string
	updatedAt: string
	syncedAt: string | null
}
export interface WidgetSourcesPage {
	schemaVersion: 1
	page: number
	pageSize: number
	total: number
	items: ManagedWidgetSource[]
}
interface WidgetCommandBase {
	readonly workspaceId: string
	readonly commandId: string
}
export type WidgetSourceCommand = WidgetCommandBase &
	(
		| {
				readonly operation: 'create'
				readonly name: string
				readonly widgetType: WidgetType
				readonly widgetId: string
				readonly teamId: string | null
		  }
		| {
				readonly operation: 'configure'
				readonly id: string
				readonly expectedVersion: number
				readonly enabled: boolean
		  }
		| {
				readonly operation: 'retry'
				readonly id: string
				readonly expectedVersion: number
		  }
	)
export interface WidgetSourceCommandResult {
	schemaVersion: 1
	source: ManagedWidgetSource
	command: { id: string; state: 'QUEUED' }
}

export const isWidgetSourceUuid = (value: unknown): value is string =>
	isUuidV4(value) && value === value.toLowerCase()
export const isWidgetSourceInteger = (
	value: unknown,
	min = 1,
	max = 2147483646
): value is number =>
	typeof value === 'number' &&
	Number.isSafeInteger(value) &&
	value >= min &&
	value <= max
export const isWidgetSourceText = (
	value: unknown,
	max: number
): value is string =>
	typeof value === 'string' &&
	value.length <= max &&
	!/[\x00-\x1f\x7f\ufffd\ud800-\udfff]/u.test(value)
export const isWidgetSourceIdentifier = (
	value: unknown,
	max = 256
): value is string =>
	isWidgetSourceText(value, max) && value.length > 0 && !/\s/u.test(value)
const date = (value: unknown): value is string =>
	isIsoDate(value) && value.length === 24
const nullableDate = (value: unknown) => value === null || date(value)
const oneOf = <T extends string>(
	value: unknown,
	allowed: readonly T[]
): value is T => typeof value === 'string' && allowed.includes(value as T)
const record = (value: unknown, keys: readonly string[]) =>
	isRecord(value) && hasExactKeys(value, keys)
const controlErrors: readonly WidgetControlError[] = [
	'DELEGATION_REVOKED',
	'OWNER_CHANGED',
	'SUBSCRIPTION_REQUIRED',
	'WIDGET_UNAVAILABLE',
	'ALREADY_CONNECTED',
	'CONTROL_CONFLICT',
	'DEPENDENCY_UNAVAILABLE',
	'INVALID_RESPONSE'
]

/** Server timestamps describe a snapshot, never a browser-side authorization grant. */
export const parseWidgetEligibility = (
	value: unknown
): WidgetEligibility | null => {
	if (
		!isRecord(value) ||
		!record(value, [
			'eligible',
			'reason',
			'plan',
			'startsAt',
			'expiresAt',
			'checkedAt',
			'validUntil'
		]) ||
		typeof value.eligible !== 'boolean' ||
		!oneOf(value.reason, [
			'ELIGIBLE',
			'NO_SUBSCRIPTION',
			'TRIAL',
			'INACTIVE',
			'NOT_STARTED',
			'EXPIRED'
		]) ||
		!(
			value.plan === null || oneOf(value.plan, ['TRIAL', 'EASY', 'HARD'])
		) ||
		!nullableDate(value.startsAt) ||
		!nullableDate(value.expiresAt) ||
		!date(value.checkedAt) ||
		!date(value.validUntil)
	)
		return null
	const checked = Date.parse(value.checkedAt),
		until = Date.parse(value.validUntil)
	if (until < checked || until > checked + 5000) return null
	if (value.reason === 'NO_SUBSCRIPTION') {
		if (
			value.eligible ||
			value.plan !== null ||
			value.startsAt !== null ||
			value.expiresAt !== null
		)
			return null
	} else if (value.plan === null) return null
	if (value.eligible) {
		if (
			value.reason !== 'ELIGIBLE' ||
			!oneOf(value.plan, ['EASY', 'HARD']) ||
			!date(value.startsAt) ||
			!date(value.expiresAt) ||
			Date.parse(value.startsAt) > checked ||
			Date.parse(value.expiresAt) <= checked ||
			until <= checked ||
			until > Date.parse(value.expiresAt)
		)
			return null
	} else if (value.reason === 'ELIGIBLE' || until !== checked) return null
	if (value.reason === 'TRIAL' && value.plan !== 'TRIAL') return null
	if (
		value.reason === 'NOT_STARTED' &&
		(!date(value.startsAt) ||
			!date(value.expiresAt) ||
			Date.parse(value.startsAt) <= checked ||
			Date.parse(value.expiresAt) <= Date.parse(value.startsAt))
	)
		return null
	if (
		value.reason === 'EXPIRED' &&
		(!date(value.startsAt) ||
			!date(value.expiresAt) ||
			Date.parse(value.expiresAt) > checked ||
			Date.parse(value.startsAt) >= Date.parse(value.expiresAt))
	)
		return null
	return { ...value } as unknown as WidgetEligibility
}

export const parseWidgetCandidate = (
	value: unknown
): WidgetCandidate | null => {
	if (
		!isRecord(value) ||
		!record(value, [
			'widgetType',
			'widgetId',
			'name',
			'isActive',
			'publishedVersion',
			'createdAt',
			'connection',
			'sourceId'
		]) ||
		!oneOf(value.widgetType, widgetTypes) ||
		!isWidgetSourceIdentifier(value.widgetId, 255) ||
		!isWidgetSourceText(value.name, 200) ||
		typeof value.isActive !== 'boolean' ||
		!isWidgetSourceInteger(value.publishedVersion, 0) ||
		!date(value.createdAt) ||
		!oneOf(value.connection, [
			'NONE',
			'THIS_WORKSPACE',
			'OTHER_WORKSPACE'
		]) ||
		(value.connection === 'THIS_WORKSPACE'
			? !isWidgetSourceUuid(value.sourceId)
			: value.sourceId !== null)
	)
		return null
	return { ...value } as unknown as WidgetCandidate
}

export const parseManagedWidgetSource = (
	value: unknown,
	workspaceId: string
): ManagedWidgetSource | null => {
	if (
		!isWidgetSourceUuid(workspaceId) ||
		!isRecord(value) ||
		!record(value, [
			'id',
			'workspaceId',
			'kind',
			'name',
			'widgetType',
			'widgetId',
			'teamId',
			'createdBySubject',
			'version',
			'enabled',
			'generation',
			'controlVersion',
			'appliedControlVersion',
			'appliedGeneration',
			'syncState',
			'lastErrorCode',
			'createdAt',
			'updatedAt',
			'syncedAt'
		]) ||
		!isWidgetSourceUuid(value.id) ||
		value.workspaceId !== workspaceId ||
		value.kind !== 'WIDGET' ||
		!isWidgetSourceText(value.name, 200) ||
		!value.name.trim() ||
		value.name !== value.name.trim() ||
		!oneOf(value.widgetType, widgetTypes) ||
		!isWidgetSourceIdentifier(value.widgetId, 255) ||
		!(value.teamId === null || isWidgetSourceUuid(value.teamId)) ||
		!isWidgetSourceIdentifier(value.createdBySubject) ||
		!isWidgetSourceInteger(value.version) ||
		value.controlVersion !== value.version ||
		!isWidgetSourceInteger(value.generation, 1, value.controlVersion) ||
		typeof value.enabled !== 'boolean' ||
		!oneOf(value.syncState, ['PENDING', 'SYNCED', 'BLOCKED', 'ERROR']) ||
		!(
			value.lastErrorCode === null ||
			oneOf(value.lastErrorCode, controlErrors)
		) ||
		!date(value.createdAt) ||
		!date(value.updatedAt)
	)
		return null
	if (value.appliedControlVersion === null) {
		if (value.appliedGeneration !== null || value.syncedAt !== null)
			return null
	} else if (
		!isWidgetSourceInteger(
			value.appliedControlVersion,
			1,
			value.controlVersion
		) ||
		!isWidgetSourceInteger(
			value.appliedGeneration,
			1,
			Math.min(value.generation, value.appliedControlVersion)
		) ||
		!date(value.syncedAt)
	)
		return null
	if (
		value.syncState === 'SYNCED' &&
		(value.appliedControlVersion !== value.controlVersion ||
			value.appliedGeneration !== value.generation ||
			value.lastErrorCode !== null)
	)
		return null
	return { ...value } as unknown as ManagedWidgetSource
}

const pageEnvelope = (
	value: unknown,
	keys: readonly string[],
	page: number,
	pageSize: number
): value is Record<string, unknown> & {
	items: unknown[]
	total: number
} =>
	isWidgetSourceInteger(page, 1, 1000000) &&
	isWidgetSourceInteger(pageSize, 1, 100) &&
	isRecord(value) &&
	record(value, keys) &&
	value.schemaVersion === 1 &&
	value.page === page &&
	value.pageSize === pageSize &&
	isWidgetSourceInteger(value.total, 0, Number.MAX_SAFE_INTEGER) &&
	Array.isArray(value.items) &&
	value.items.length <= pageSize &&
	value.items.length <= value.total

export const parseWidgetSourcesPage = (
	value: unknown,
	workspaceId: string,
	page: number,
	pageSize: number
): WidgetSourcesPage | null => {
	if (
		!isWidgetSourceUuid(workspaceId) ||
		!pageEnvelope(
			value,
			['schemaVersion', 'items', 'page', 'pageSize', 'total'],
			page,
			pageSize
		)
	)
		return null
	const items = value.items.map(item =>
		parseManagedWidgetSource(item, workspaceId)
	)
	if (
		items.some(item => item === null) ||
		new Set(items.map(item => item?.id)).size !== items.length
	)
		return null
	return {
		schemaVersion: 1,
		page,
		pageSize,
		total: value.total,
		items: items as ManagedWidgetSource[]
	}
}
export const parseWidgetCandidatesPage = (
	value: unknown,
	workspaceId: string,
	page: number,
	pageSize: number
): WidgetCandidatesPage | null => {
	if (
		!isWidgetSourceUuid(workspaceId) ||
		!pageEnvelope(
			value,
			[
				'schemaVersion',
				'workspaceId',
				'page',
				'pageSize',
				'total',
				'eligibility',
				'items'
			],
			page,
			pageSize
		) ||
		value.workspaceId !== workspaceId
	)
		return null
	const eligibility = parseWidgetEligibility(value.eligibility)
	const items = value.items.map(parseWidgetCandidate)
	if (
		!eligibility ||
		items.some(item => item === null) ||
		new Set(
			items.map(item => item && `${item.widgetType}:${item.widgetId}`)
		).size !== items.length
	)
		return null
	return {
		schemaVersion: 1,
		workspaceId,
		page,
		pageSize,
		total: value.total,
		eligibility,
		items: items as WidgetCandidate[]
	}
}
export const parseWidgetSourceResult = (
	value: unknown,
	workspaceId: string,
	id?: string
): ManagedWidgetSource | null => {
	if (
		!isRecord(value) ||
		!record(value, ['schemaVersion', 'source']) ||
		value.schemaVersion !== 1 ||
		(id !== undefined && !isWidgetSourceUuid(id))
	)
		return null
	const source = parseManagedWidgetSource(value.source, workspaceId)
	return source && (id === undefined || source.id === id) ? source : null
}
