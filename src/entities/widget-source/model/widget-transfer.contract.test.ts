import { describe, expect, it } from 'vitest'
import {
	parseWidgetTransfer,
	parseWidgetTransfersPage,
	widgetTransferReasons,
	widgetTransferStates
} from './widget-transfer.contract'

const workspaceId = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'
const id = '33333333-3333-4333-8333-333333333333'
const entryId = '44444444-4444-4444-8444-444444444444'
const date = '2026-09-05T01:00:00.000Z'
const row = {
	id,
	workspaceId,
	sourceId,
	state: 'PROCESSING',
	version: 1,
	reason: null,
	entryId: null,
	occurredAt: '2026-09-04T00:00:00.000Z',
	receivedAt: date,
	updatedAt: date,
	completedAt: null
}
const parse = (value: unknown) =>
	parseWidgetTransfer(value, workspaceId, sourceId)
const page = {
	schemaVersion: 1,
	items: [row],
	page: 1,
	pageSize: 25,
	total: 1
}
const parsePage = (value: unknown) =>
	parseWidgetTransfersPage(value, workspaceId, sourceId, 1, 25)

describe('Widget transfer metadata contract', () => {
	it.each(widgetTransferStates)(
		'accepts %s with its exact terminal proof',
		state => {
			const value = {
				...row,
				state,
				reason: ['BLOCKED', 'ERROR', 'SKIPPED'].includes(state)
					? 'DEPENDENCY_UNAVAILABLE'
					: null,
				entryId: state === 'DELIVERED' ? entryId : null,
				completedAt: ['DELIVERED', 'SKIPPED'].includes(state) ? date : null
			}
			expect(parse(value)).toEqual(value)
		}
	)
	it.each(widgetTransferReasons)(
		'accepts bounded reason %s during retry',
		reason => {
			expect(parse({ ...row, reason })).not.toBeNull()
			expect(
				parse({ ...row, state: 'RETRY_PENDING', reason })
			).not.toBeNull()
		}
	)
	it.each([
		{ workspaceId: entryId },
		{ sourceId: entryId },
		{ id: 'not-uuid' },
		{ id: 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA' },
		{ state: ['ERROR'] },
		{ state: 'UNKNOWN' },
		{ reason: ['LOCAL_DISABLED'] },
		{ reason: 'UNKNOWN' },
		{ version: 0 },
		{ version: 1.1 },
		{ version: 2147483648 },
		{ entryId },
		{ completedAt: date },
		{ state: 'BLOCKED' },
		{ state: 'ERROR' },
		{ state: 'DELIVERED' },
		{ state: 'SKIPPED' },
		{
			state: 'DELIVERED',
			entryId,
			completedAt: date,
			reason: 'PERIOD_EXPIRED'
		},
		{
			state: 'SKIPPED',
			entryId,
			completedAt: date,
			reason: 'PERIOD_EXPIRED'
		},
		{ occurredAt: '2026-09-05T01:00:00Z' },
		{ receivedAt: 'bad' },
		{ updatedAt: '2026-09-05T00:59:59.000Z' },
		{ eventId: id },
		{ ownerSubject: 'owner' },
		{ payload: { phone: 'hidden' } }
	])('rejects invalid, private or cross-bound metadata %j', patch =>
		expect(parse({ ...row, ...patch })).toBeNull()
	)
	it('requires every nullable key and does not share the input object', () => {
		for (const key of Object.keys(row)) {
			const value = { ...row } as Record<string, unknown>
			delete value[key]
			expect(parse(value)).toBeNull()
		}
		expect(parse(row)).not.toBe(row)
		expect(parse({ ...row, version: 2147483647 })).not.toBeNull()
	})
	it('does not make client-clock assumptions about a delayed original lead', () => {
		expect(
			parse({ ...row, occurredAt: '2020-01-01T00:00:00.000Z' })
		).not.toBeNull()
	})
	it('parses the exact page without a top-level workspaceId', () => {
		expect(parsePage(page)).toEqual(page)
		expect(parsePage({ ...page, workspaceId })).toBeNull()
	})
	it.each([
		{ page: 2 },
		{ pageSize: 100 },
		{ schemaVersion: 2 },
		{ total: -1 },
		{ total: 1.5 },
		{ total: Number.MAX_SAFE_INTEGER + 1 },
		{ total: 0 },
		{ items: [row, row], total: 2 },
		{ items: [{ ...row, sourceId: entryId }] },
		{ items: null }
	])('rejects wrong pagination/scope %j', patch =>
		expect(parsePage({ ...page, ...patch })).toBeNull()
	)
	it('bounds pages and item counts even with otherwise valid data', () => {
		expect(
			parseWidgetTransfersPage(
				{ ...page, page: 1000001 },
				workspaceId,
				sourceId,
				1000001,
				25
			)
		).toBeNull()
		expect(
			parseWidgetTransfersPage(
				{ ...page, pageSize: 101 },
				workspaceId,
				sourceId,
				1,
				101
			)
		).toBeNull()
		expect(
			parseWidgetTransfersPage(
				{
					...page,
					items: [row, { ...row, id: entryId }],
					total: 2,
					pageSize: 1
				},
				workspaceId,
				sourceId,
				1,
				1
			)
		).toBeNull()
		expect(
			parseWidgetTransfersPage(page, 'bad', sourceId, 1, 25)
		).toBeNull()
	})
})
