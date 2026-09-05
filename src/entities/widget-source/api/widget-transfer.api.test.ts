import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	authenticatedRequest,
	AuthenticatedApiError
} from '@/shared/api/authenticated-http-client'
import {
	listWidgetTransfers,
	retryWidgetTransfer
} from './widget-transfer.api'
import type { WidgetTransferRetryCommand } from '../model/widget-transfer.contract'

vi.mock(
	'@/shared/api/authenticated-http-client',
	async importOriginal => ({
		...(await importOriginal<
			typeof import('@/shared/api/authenticated-http-client')
		>()),
		authenticatedRequest: vi.fn()
	})
)
const workspaceId = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'
const transferId = '33333333-3333-4333-8333-333333333333'
const commandId = '44444444-4444-4444-8444-444444444444'
const command = {
	workspaceId,
	sourceId,
	transferId,
	commandId,
	expectedVersion: 3
}
const date = '2026-09-05T00:00:00.000Z'
const transfer = {
	id: transferId,
	workspaceId,
	sourceId,
	state: 'RETRY_PENDING',
	version: 4,
	reason: null,
	entryId: null,
	occurredAt: date,
	receivedAt: date,
	updatedAt: date,
	completedAt: null
}
const result = {
	schemaVersion: 1,
	transfer,
	command: { id: commandId, state: 'QUEUED' }
}
const body = {
	schemaVersion: 1,
	workspaceId,
	commandId,
	expectedVersion: 3
}
beforeEach(() => {
	vi.clearAllMocks()
	vi.mocked(authenticatedRequest).mockResolvedValue(result)
})

describe('Widget transfer API', () => {
	it('uses server pagination and binds every item to its requested source', async () => {
		const page = {
			schemaVersion: 1,
			items: [transfer],
			page: 2,
			pageSize: 25,
			total: 26
		}
		vi.mocked(authenticatedRequest).mockResolvedValue(page)
		expect(
			await listWidgetTransfers('session', workspaceId, sourceId, 2)
		).toEqual(page)
		expect(authenticatedRequest).toHaveBeenCalledWith({
			accessToken: 'session',
			method: 'GET',
			url: `/crm/intake/widget-sources/${sourceId}/transfers`,
			params: { workspaceId, page: '2', pageSize: '25' }
		})
	})
	it('sends exact immutable retry body and replays the original UUID', async () => {
		await expect(retryWidgetTransfer('session', command)).resolves.toEqual(
			result
		)
		await expect(retryWidgetTransfer('session', command)).resolves.toEqual(
			result
		)
		for (const [request] of vi.mocked(authenticatedRequest).mock.calls)
			expect(request).toEqual({
				accessToken: 'session',
				method: 'POST',
				url: `/crm/intake/widget-sources/${sourceId}/transfers/${transferId}/retry`,
				headers: { 'Idempotency-Key': commandId },
				data: body
			})
		expect(
			Object.isFrozen(
				vi.mocked(authenticatedRequest).mock.calls[0][0].data
			)
		).toBe(true)
	})
	it('snapshots command binding before the asynchronous request', async () => {
		let finish!: (value: unknown) => void
		vi.mocked(authenticatedRequest).mockImplementation(
			() =>
				new Promise(resolve => {
					finish = resolve
				})
		)
		const draft = { ...command }
		const response = retryWidgetTransfer('session', draft)
		draft.sourceId = transferId
		draft.expectedVersion = 9
		draft.commandId = transferId
		finish(result)
		await expect(response).resolves.toEqual(result)
		expect(vi.mocked(authenticatedRequest).mock.calls[0][0].data).toEqual(
			body
		)
	})
	it.each([
		{ transfer: { ...transfer, workspaceId: commandId } },
		{ transfer: { ...transfer, sourceId: commandId } },
		{ transfer: { ...transfer, id: commandId } },
		{ transfer: { ...transfer, version: 3 } },
		{ transfer: { ...transfer, state: 'PROCESSING' } },
		{ transfer: { ...transfer, reason: 'DEPENDENCY_UNAVAILABLE' } },
		{ command: { id: sourceId, state: 'QUEUED' } },
		{ command: { id: commandId, state: 'DELIVERED' } },
		{ schemaVersion: 2 },
		{ token: 'unexpected' }
	])(
		'rejects a mismatched or nonhistorical command receipt %j',
		async patch => {
			vi.mocked(authenticatedRequest).mockResolvedValue({
				...result,
				...patch
			})
			await expect(
				retryWidgetTransfer('session', command)
			).rejects.toMatchObject({ kind: 'temporary' })
		}
	)
	it.each([
		{ workspaceId: 'bad' },
		{ sourceId: '../other' },
		{ transferId: 'bad' },
		{ commandId: 'bad' },
		{ expectedVersion: 0 },
		{ expectedVersion: 2147483647 },
		{ expectedVersion: 1.5 },
		{ actor: 'another-user' }
	])('rejects invalid input before network %j', async patch => {
		await expect(
			retryWidgetTransfer('session', {
				...command,
				...patch
			} as WidgetTransferRetryCommand)
		).rejects.toMatchObject({ kind: 'temporary' })
		expect(authenticatedRequest).not.toHaveBeenCalled()
	})
	it('accepts the final PostgreSQL Int version without confusing source-version limits', async () => {
		vi.mocked(authenticatedRequest).mockResolvedValue({
			...result,
			transfer: { ...transfer, version: 2147483647 }
		})
		await expect(
			retryWidgetTransfer('session', {
				...command,
				expectedVersion: 2147483646
			})
		).resolves.toMatchObject({ transfer: { version: 2147483647 } })
	})
	it.each([
		'notFound',
		'unauthorized',
		'forbidden',
		'conflict',
		'temporary',
		'validation'
	] as const)('preserves %s and never fakes an empty list', async kind => {
		const error = new AuthenticatedApiError(kind, 'Test failure')
		vi.mocked(authenticatedRequest).mockRejectedValue(error)
		await expect(
			listWidgetTransfers('session', workspaceId, sourceId, 1)
		).rejects.toBe(error)
		await expect(retryWidgetTransfer('session', command)).rejects.toBe(
			error
		)
	})
	it('rejects bad query bounds before requesting and mismatched page responses afterward', async () => {
		await expect(
			listWidgetTransfers('session', workspaceId, sourceId, 0)
		).rejects.toMatchObject({ kind: 'temporary' })
		await expect(
			listWidgetTransfers('session', workspaceId, sourceId, 1, 101)
		).rejects.toMatchObject({ kind: 'temporary' })
		expect(authenticatedRequest).not.toHaveBeenCalled()
		vi.mocked(authenticatedRequest).mockResolvedValue({
			schemaVersion: 1,
			items: [transfer],
			page: 2,
			pageSize: 25,
			total: 1
		})
		await expect(
			listWidgetTransfers('session', workspaceId, sourceId, 1)
		).rejects.toMatchObject({ kind: 'temporary' })
	})
})
