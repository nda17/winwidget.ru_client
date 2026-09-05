import { hasExactKeys, isIsoDate, isRecord } from '@/shared/lib/contract'
import {
	isWidgetSourceInteger,
	isWidgetSourceUuid
} from './widget-source.contract'

export const widgetTransferStates = [
	'PROCESSING',
	'RETRY_PENDING',
	'BLOCKED',
	'ERROR',
	'DELIVERED',
	'SKIPPED'
] as const
export const widgetTransferReasons = [
	'DELEGATION_REVOKED',
	'OWNER_CHANGED',
	'LOCAL_DISABLED',
	'GENERATION_CHANGED',
	'PERIOD_EXPIRED',
	'BILLING_INELIGIBLE',
	'BILLING_PERIOD_CHANGED',
	'CONNECTOR_DISABLED',
	'WIDGET_UNAVAILABLE',
	'LEAD_UNAVAILABLE',
	'PAYLOAD_TOO_LARGE',
	'PAYLOAD_SHAPE_UNSUPPORTED',
	'TEXT_UNSUPPORTED',
	'SOURCE_PERIOD_INELIGIBLE',
	'SOURCE_PERIOD_INVALID',
	'BEFORE_ACTIVATION',
	'DEPENDENCY_UNAVAILABLE',
	'INVALID_RESPONSE',
	'CONTEXT_UNAVAILABLE'
] as const
export type WidgetTransferState = (typeof widgetTransferStates)[number]
export type WidgetTransferReason = (typeof widgetTransferReasons)[number]
export interface WidgetTransfer {
	id: string
	workspaceId: string
	sourceId: string
	state: WidgetTransferState
	version: number
	reason: WidgetTransferReason | null
	entryId: string | null
	occurredAt: string
	receivedAt: string
	updatedAt: string
	completedAt: string | null
}
export interface WidgetTransfersPage {
	schemaVersion: 1
	items: WidgetTransfer[]
	page: number
	pageSize: number
	total: number
}
export interface WidgetTransferRetryCommand {
	readonly workspaceId: string
	readonly sourceId: string
	readonly transferId: string
	readonly commandId: string
	readonly expectedVersion: number
}
export interface WidgetTransferCommandResult {
	schemaVersion: 1
	transfer: WidgetTransfer
	command: { id: string; state: 'QUEUED' }
}
const keys = [
	'id',
	'workspaceId',
	'sourceId',
	'state',
	'version',
	'reason',
	'entryId',
	'occurredAt',
	'receivedAt',
	'updatedAt',
	'completedAt'
] as const
const date = (value: unknown): value is string =>
	isIsoDate(value) && value.length === 24
const member = <T extends string>(
	value: unknown,
	values: readonly T[]
): value is T => typeof value === 'string' && values.includes(value as T)

/** Metadata only: never accepts raw lead data or another workspace/source binding. */
export const parseWidgetTransfer = (
	value: unknown,
	workspaceId: string,
	sourceId: string
): WidgetTransfer | null => {
	if (
		!isWidgetSourceUuid(workspaceId) ||
		!isWidgetSourceUuid(sourceId) ||
		!isRecord(value) ||
		!hasExactKeys(value, keys) ||
		!isWidgetSourceUuid(value.id) ||
		value.workspaceId !== workspaceId ||
		value.sourceId !== sourceId ||
		!member(value.state, widgetTransferStates) ||
		!isWidgetSourceInteger(value.version, 1, 2147483647) ||
		!(
			value.reason === null || member(value.reason, widgetTransferReasons)
		) ||
		!(value.entryId === null || isWidgetSourceUuid(value.entryId)) ||
		!date(value.occurredAt) ||
		!date(value.receivedAt) ||
		!date(value.updatedAt) ||
		!(value.completedAt === null || date(value.completedAt)) ||
		value.updatedAt < value.receivedAt
	)
		return null
	if (value.state === 'DELIVERED') {
		if (
			value.entryId === null ||
			value.completedAt === null ||
			value.reason !== null
		)
			return null
	} else if (value.state === 'SKIPPED') {
		if (
			value.entryId !== null ||
			value.completedAt === null ||
			value.reason === null
		)
			return null
	} else if (
		value.entryId !== null ||
		value.completedAt !== null ||
		(['BLOCKED', 'ERROR'].includes(value.state) && value.reason === null)
	)
		return null
	return { ...value } as unknown as WidgetTransfer
}
export const parseWidgetTransfersPage = (
	value: unknown,
	workspaceId: string,
	sourceId: string,
	page: number,
	pageSize: number
): WidgetTransfersPage | null => {
	if (
		!isWidgetSourceUuid(workspaceId) ||
		!isWidgetSourceUuid(sourceId) ||
		!isWidgetSourceInteger(page, 1, 1000000) ||
		!isWidgetSourceInteger(pageSize, 1, 100) ||
		!isRecord(value) ||
		!hasExactKeys(value, [
			'schemaVersion',
			'items',
			'page',
			'pageSize',
			'total'
		]) ||
		value.schemaVersion !== 1 ||
		value.page !== page ||
		value.pageSize !== pageSize ||
		!isWidgetSourceInteger(value.total, 0, Number.MAX_SAFE_INTEGER) ||
		!Array.isArray(value.items) ||
		value.items.length > pageSize ||
		value.items.length > value.total
	)
		return null
	const items: WidgetTransfer[] = []
	const ids = new Set<string>()
	for (const candidate of value.items) {
		const item = parseWidgetTransfer(candidate, workspaceId, sourceId)
		if (!item || ids.has(item.id)) return null
		ids.add(item.id)
		items.push(item)
	}
	return { schemaVersion: 1, items, page, pageSize, total: value.total }
}
