import { beforeEach, describe, expect, it, vi } from 'vitest'
import { authenticatedRequest } from '@/shared/api/authenticated-http-client'
import { getWidgetEntryDetails } from './widget-details.api'

vi.mock('@/shared/api/authenticated-http-client', () => ({
	authenticatedRequest: vi.fn(),
	invalidContractError: () => new Error('invalid contract')
}))
const workspaceId = '11111111-1111-4111-8111-111111111111'
const entryId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const payload = {
	schemaVersion: 1,
	widget: {
		type: 'TIMER',
		id: 'widget',
		name: 'Таймер',
		publishedVersion: 1
	},
	lead: {
		id: 'lead',
		createdAt: '2026-09-05T00:00:00.000Z',
		contactName: null,
		contactRaw: null,
		phoneRaw: null,
		phoneE164: null,
		email: null,
		pageUrl: null,
		redactions: []
	},
	details: { type: 'TIMER' }
}
beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(authenticatedRequest).mockResolvedValue({
		schemaVersion: 1,
		workspaceId,
		entryId,
		sourceId,
		payload
	})
})
describe('stored widget details API', () => {
	it('uses only the scoped Intake GET with an in-memory bearer, not Widgets/Billing', async () => {
		expect(
			(
				await getWidgetEntryDetails(
					'synthetic',
					workspaceId,
					entryId,
					sourceId
				)
			).payload
		).toEqual(payload)
		expect(authenticatedRequest).toHaveBeenCalledExactlyOnceWith({
			accessToken: 'synthetic',
			method: 'GET',
			url: `/crm/intake/inbox/${entryId}/widget-details`,
			params: { workspaceId }
		})
	})
	it.each([
		[sourceId, entryId, '../escape'],
		[workspaceId, 'bad', sourceId],
		['bad', entryId, sourceId]
	])(
		'rejects invalid request binding before HTTP',
		async (workspace, entry, source) => {
			await expect(
				getWidgetEntryDetails('synthetic', workspace, entry, source)
			).rejects.toThrow('invalid contract')
			expect(authenticatedRequest).not.toHaveBeenCalled()
		}
	)
	it.each([
		{ workspaceId: sourceId },
		{ entryId: sourceId },
		{ sourceId: entryId },
		{ payload: { ...payload, token: 'not-allowed' } },
		{ token: 'not-allowed' }
	])(
		'rejects foreign or unexpected data without returning partial details',
		async patch => {
			vi.mocked(authenticatedRequest).mockResolvedValue({
				schemaVersion: 1,
				workspaceId,
				entryId,
				sourceId,
				payload,
				...patch
			})
			await expect(
				getWidgetEntryDetails('synthetic', workspaceId, entryId, sourceId)
			).rejects.toThrow('invalid contract')
		}
	)
})
