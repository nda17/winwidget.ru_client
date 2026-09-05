import { beforeEach, describe, expect, it, vi } from 'vitest'
import {
	AuthenticatedApiError,
	authenticatedRequest
} from '@/shared/api/authenticated-http-client'
import {
	getWidgetSource,
	listWidgetCandidates,
	listWidgetSources,
	mutateWidgetSource
} from './widget-source.api'
import type { WidgetSourceCommand } from '../model/widget-source.contract'

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
const id = '22222222-2222-4222-8222-222222222222'
const commandId = '33333333-3333-4333-8333-333333333333'
const other = '44444444-4444-4444-8444-444444444444'
const at = '2026-09-05T00:00:00.000Z'
const source = {
	id,
	workspaceId,
	kind: 'WIDGET',
	name: 'Наш квиз',
	widgetType: 'QUIZ',
	widgetId: 'cm-widget-1',
	teamId: null,
	createdBySubject: 'user-1',
	version: 1,
	controlVersion: 1,
	generation: 1,
	enabled: true,
	appliedControlVersion: null,
	appliedGeneration: null,
	syncState: 'PENDING',
	lastErrorCode: null,
	createdAt: at,
	updatedAt: at,
	syncedAt: null
}
const create = {
	operation: 'create' as const,
	workspaceId,
	commandId,
	name: ' Наш квиз ',
	widgetType: 'QUIZ' as const,
	widgetId: 'cm-widget-1',
	teamId: null
}
const result = {
	schemaVersion: 1,
	source,
	command: { id: commandId, state: 'QUEUED' }
}

describe('managed widget source API', () => {
	beforeEach(() => vi.clearAllMocks())
	it('uses exact scoped read routes and server pagination', async () => {
		const page = {
			schemaVersion: 1,
			page: 2,
			pageSize: 25,
			total: 26,
			items: [source]
		}
		vi.mocked(authenticatedRequest)
			.mockResolvedValueOnce(page)
			.mockResolvedValueOnce({ schemaVersion: 1, source })
		expect(
			await listWidgetSources('session-token', workspaceId, 2)
		).toEqual(page)
		expect(
			await getWidgetSource('session-token', workspaceId, id)
		).toEqual(source)
		expect(authenticatedRequest).toHaveBeenNthCalledWith(1, {
			accessToken: 'session-token',
			method: 'GET',
			url: '/crm/intake/widget-sources',
			params: { workspaceId, page: '2', pageSize: '25' }
		})
		expect(authenticatedRequest).toHaveBeenNthCalledWith(2, {
			accessToken: 'session-token',
			method: 'GET',
			url: `/crm/intake/widget-sources/${id}`,
			params: { workspaceId }
		})
	})
	it('reads candidates with only their public eligibility fields', async () => {
		const page = {
			schemaVersion: 1,
			workspaceId,
			page: 1,
			pageSize: 20,
			total: 0,
			items: [],
			eligibility: {
				eligible: false,
				reason: 'NO_SUBSCRIPTION',
				plan: null,
				startsAt: null,
				expiresAt: null,
				checkedAt: at,
				validUntil: at
			}
		}
		vi.mocked(authenticatedRequest).mockResolvedValue(page)
		expect(
			await listWidgetCandidates('token', workspaceId, 1, 20)
		).toEqual(page)
		expect(authenticatedRequest).toHaveBeenCalledWith({
			accessToken: 'token',
			method: 'GET',
			url: '/crm/intake/widget-sources/candidates',
			params: { workspaceId, page: '1', pageSize: '20' }
		})
	})
	it('sends exact immutable create DTO and preserves UUID/payload on replay', async () => {
		vi.mocked(authenticatedRequest).mockResolvedValue(result)
		for (let i = 0; i < 2; i++)
			expect(await mutateWidgetSource('token', create)).toEqual(result)
		const expected = {
			accessToken: 'token',
			method: 'POST',
			url: '/crm/intake/widget-sources',
			headers: { 'Idempotency-Key': commandId },
			data: {
				schemaVersion: 1,
				workspaceId,
				commandId,
				name: create.name,
				widgetType: 'QUIZ',
				widgetId: create.widgetId,
				teamId: null
			}
		}
		expect(authenticatedRequest).toHaveBeenNthCalledWith(1, expected)
		expect(authenticatedRequest).toHaveBeenNthCalledWith(2, expected)
		expect(
			Object.isFrozen(
				vi.mocked(authenticatedRequest).mock.calls[0][0].data
			)
		).toBe(true)
	})
	it('sends configure CAS, while retry leaves source.version unchanged', async () => {
		const configured = {
			...source,
			version: 2,
			controlVersion: 2,
			enabled: false
		}
		vi.mocked(authenticatedRequest).mockResolvedValue({
			...result,
			source: configured
		})
		await mutateWidgetSource('token', {
			operation: 'configure',
			workspaceId,
			commandId,
			id,
			expectedVersion: 1,
			enabled: false
		})
		expect(authenticatedRequest).toHaveBeenLastCalledWith({
			accessToken: 'token',
			method: 'POST',
			url: `/crm/intake/widget-sources/${id}/configure`,
			headers: { 'Idempotency-Key': commandId },
			data: {
				schemaVersion: 1,
				workspaceId,
				commandId,
				expectedVersion: 1,
				enabled: false
			}
		})
		expect(
			(
				await mutateWidgetSource('token', {
					operation: 'retry',
					workspaceId,
					commandId,
					id,
					expectedVersion: 2
				})
			).source.version
		).toBe(2)
		expect(authenticatedRequest).toHaveBeenLastCalledWith({
			accessToken: 'token',
			method: 'POST',
			url: `/crm/intake/widget-sources/${id}/retry`,
			headers: { 'Idempotency-Key': commandId },
			data: {
				schemaVersion: 1,
				workspaceId,
				commandId,
				expectedVersion: 2
			}
		})
	})
	it('captures response binding before an asynchronous caller draft change', async () => {
		let resolve!: (value: unknown) => void
		vi.mocked(authenticatedRequest).mockImplementationOnce(
			() =>
				new Promise(done => {
					resolve = done
				})
		)
		const draft = { ...create }
		const pending = mutateWidgetSource('token', draft)
		draft.name = 'New name'
		draft.workspaceId = other
		draft.commandId = other
		resolve(result)
		expect(await pending).toEqual(result)
		expect(
			vi.mocked(authenticatedRequest).mock.calls[0][0].data
		).toMatchObject({ workspaceId, commandId, name: create.name })
	})
	it.each([
		'notFound',
		'forbidden',
		'unauthorized',
		'validation',
		'conflict',
		'temporary'
	] as const)(
		'does not swallow %s or fake an empty/success response',
		async kind => {
			const error = new AuthenticatedApiError(kind, 'safe failure')
			vi.mocked(authenticatedRequest).mockRejectedValue(error)
			await expect(
				listWidgetSources('token', workspaceId, 1)
			).rejects.toBe(error)
			await expect(
				listWidgetCandidates('token', workspaceId, 1)
			).rejects.toBe(error)
			await expect(mutateWidgetSource('token', create)).rejects.toBe(error)
			expect(authenticatedRequest).toHaveBeenCalledTimes(3)
		}
	)
	it.each([
		{ ...create, ownerSubject: 'forged' },
		{ ...create, schemaVersion: 2 },
		{ ...create, teamId: undefined },
		{ ...create, commandId: '../unsafe' },
		{ ...create, widgetType: 'AI_CONSULTANT' },
		{ ...create, widgetId: 'bad id' },
		{ ...create, name: '\uD800' },
		{ ...create, name: ' ' },
		{ ...create, operation: 'delete' },
		{ operation: 'retry', workspaceId, commandId, id, expectedVersion: 0 },
		{
			operation: 'retry',
			workspaceId,
			commandId,
			id,
			expectedVersion: 2147483646
		},
		{
			operation: 'retry',
			workspaceId,
			commandId,
			id: '../unsafe',
			expectedVersion: 1
		},
		{
			operation: 'configure',
			workspaceId,
			commandId,
			id,
			expectedVersion: 1,
			enabled: 'true'
		}
	])('rejects invalid or expanded mutation before HTTP %j', command =>
		expect(
			mutateWidgetSource(
				'token',
				command as unknown as WidgetSourceCommand
			)
		)
			.rejects.toBeInstanceOf(AuthenticatedApiError)
			.then(() => expect(authenticatedRequest).not.toHaveBeenCalled())
	)
	it('rejects unsafe read parameters before HTTP', async () => {
		await expect(
			listWidgetSources('token', '../unsafe', 1)
		).rejects.toThrow()
		await expect(
			listWidgetCandidates('token', workspaceId, 0)
		).rejects.toThrow()
		await expect(
			listWidgetCandidates('token', workspaceId, 1, 101)
		).rejects.toThrow()
		await expect(
			getWidgetSource('token', workspaceId, '../unsafe')
		).rejects.toThrow()
		expect(authenticatedRequest).not.toHaveBeenCalled()
	})
	it.each([
		{ command: { id: other, state: 'QUEUED' } },
		{ command: { id: commandId, state: 'SYNCED' } },
		{ command: { id: commandId, state: 'QUEUED', token: 'private' } },
		{ schemaVersion: 2 },
		{ source: { ...source, workspaceId: other } },
		{ source: { ...source, widgetId: 'other-widget' } },
		{ source: { ...source, name: 'Wrong source' } },
		{ source: { ...source, teamId: other } },
		{ source: { ...source, enabled: false } },
		{ source: { ...source, version: 2, controlVersion: 2 } },
		{
			source: {
				...source,
				syncState: 'SYNCED',
				appliedControlVersion: 1,
				appliedGeneration: 1,
				syncedAt: at
			}
		}
	])(
		'rejects unbound or optimistic command acknowledgment %j',
		async change => {
			vi.mocked(authenticatedRequest).mockResolvedValue({
				...result,
				...change
			})
			await expect(
				mutateWidgetSource('token', create)
			).rejects.toBeInstanceOf(AuthenticatedApiError)
		}
	)
})
