import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { ReactNode } from 'react'
import {
	listWidgetTransfers,
	retryWidgetTransfer,
	type ManagedWidgetSource,
	type WidgetTransfer,
	type WidgetTransfersPage
} from '@/entities/widget-source'
import { resetSessionStore, useSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import {
	commandOwner,
	PendingCommandProvider
} from '@/shared/lib/pending-command'
import toast from 'react-hot-toast'
import type { IntakeAccess } from '../model/use-intake-access'
import { WidgetTransfersPanel } from './WidgetTransfersPanel'

vi.mock('@/entities/widget-source', () => ({
	listWidgetTransfers: vi.fn(),
	retryWidgetTransfer: vi.fn()
}))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))
const workspaceId = '11111111-1111-4111-8111-111111111111'
const sourceId = '22222222-2222-4222-8222-222222222222'
const transferId = '33333333-3333-4333-8333-333333333333'
const date = '2026-09-05T00:00:00.000Z'
const source: ManagedWidgetSource = {
	id: sourceId,
	workspaceId,
	kind: 'WIDGET',
	name: 'Колесо для продаж',
	widgetType: 'WHEEL',
	widgetId: 'wheel-id',
	teamId: null,
	createdBySubject: 'owner',
	version: 1,
	enabled: true,
	generation: 1,
	controlVersion: 1,
	appliedControlVersion: 1,
	appliedGeneration: 1,
	syncState: 'SYNCED',
	lastErrorCode: null,
	createdAt: date,
	updatedAt: date,
	syncedAt: date
}
const transfer: WidgetTransfer = {
	id: transferId,
	workspaceId,
	sourceId,
	state: 'ERROR',
	version: 7,
	reason: 'DEPENDENCY_UNAVAILABLE',
	entryId: null,
	occurredAt: date,
	receivedAt: date,
	updatedAt: date,
	completedAt: null
}
const data: WidgetTransfersPage = {
	schemaVersion: 1,
	items: [transfer],
	page: 1,
	pageSize: 25,
	total: 1
}
const access = (changes: Partial<IntakeAccess> = {}) =>
	({
		workspaceId,
		scopeKey: 'owner',
		session: { userId: 'owner', accessToken: 'test-session' },
		revision: 1,
		confirmed: true,
		online: true,
		sourceManager: true,
		canRead: true,
		canWrite: true,
		canManageSources: true,
		authorize: vi.fn().mockResolvedValue('test-session'),
		permissions: { isSuccess: true, isError: false, refetch: vi.fn() },
		...changes
	}) as unknown as IntakeAccess
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={client}>
		<PendingCommandProvider owner={commandOwner('owner', 1)}>
			{children}
		</PendingCommandProvider>
	</QueryClientProvider>
)
const openRetry = async () => {
	fireEvent.click(
		await screen.findByRole('button', { name: 'Повторить передачу' })
	)
	expect(
		screen.getByRole('button', { name: 'Подтвердить повтор' })
	).toBeTruthy()
}
beforeEach(() => {
	vi.clearAllMocks()
	resetSessionStore()
	useSessionStore
		.getState()
		.setAuthenticated({ userId: 'owner', accessToken: 'test-session' })
	client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	})
	vi.mocked(listWidgetTransfers).mockResolvedValue(structuredClone(data))
	vi.mocked(retryWidgetTransfer).mockImplementation(
		async (_token, command) => ({
			schemaVersion: 1,
			transfer: {
				...transfer,
				state: 'RETRY_PENDING',
				reason: null,
				version: command.expectedVersion + 1
			},
			command: { id: command.commandId, state: 'QUEUED' }
		})
	)
	Object.defineProperties(HTMLDialogElement.prototype, {
		showModal: {
			configurable: true,
			value: function (this: HTMLDialogElement) {
				this.open = true
			}
		},
		close: {
			configurable: true,
			value: function (this: HTMLDialogElement) {
				this.open = false
			}
		}
	})
})
afterEach(() => {
	cleanup()
	client.clear()
	resetSessionStore()
})

describe('Widget transfer history UI', () => {
	it('reads only the selected source with server pagination, without any automatic retry', async () => {
		vi.mocked(listWidgetTransfers).mockImplementation(
			async (_token, _workspaceId, _sourceId, page) => ({
				...data,
				page,
				total: 26
			})
		)
		render(
			<WidgetTransfersPanel
				access={access()}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await screen.findByText('Ошибка передачи')
		expect(listWidgetTransfers).toHaveBeenCalledWith(
			'test-session',
			workspaceId,
			sourceId,
			1,
			25
		)
		expect(retryWidgetTransfer).not.toHaveBeenCalled()
		fireEvent.click(screen.getByRole('button', { name: 'Далее' }))
		await waitFor(() =>
			expect(listWidgetTransfers).toHaveBeenCalledWith(
				'test-session',
				workspaceId,
				sourceId,
				2,
				25
			)
		)
		await screen.findByText('2 / 2')
	})
	it('shows terminal and pending states honestly and offers no retry for delivered/skipped/processing', async () => {
		vi.mocked(listWidgetTransfers).mockResolvedValue({
			...data,
			total: 3,
			items: [
				{
					...transfer,
					state: 'DELIVERED',
					entryId: sourceId,
					completedAt: date,
					reason: null
				},
				{
					...transfer,
					id: sourceId,
					state: 'SKIPPED',
					completedAt: date,
					reason: 'PERIOD_EXPIRED'
				},
				{
					...transfer,
					id: workspaceId,
					state: 'RETRY_PENDING',
					reason: null
				}
			]
		})
		render(
			<WidgetTransfersPanel
				access={access()}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await screen.findByText('В Inbox')
		expect(screen.getByText('Пропущена')).toBeTruthy()
		expect(screen.getByText('Ожидает повтора')).toBeTruthy()
		expect(
			screen.getByText('Исходный оплаченный период Widgets закончился.')
		).toBeTruthy()
		expect(
			screen.queryByRole('button', { name: 'Повторить передачу' })
		).toBeNull()
		expect(retryWidgetTransfer).not.toHaveBeenCalled()
	})
	it('preserves read-only history while disabling retry', async () => {
		render(
			<WidgetTransfersPanel
				access={access({ canWrite: false, canManageSources: false })}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		expect(
			await screen.findByRole('button', { name: 'Повторить передачу' })
		).toHaveProperty('disabled', true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Повторить передачу' })
		)
		expect(retryWidgetTransfer).not.toHaveBeenCalled()
	})
	it('keeps existing history after disconnect and disables new retry', async () => {
		render(
			<WidgetTransfersPanel
				access={access()}
				source={{ ...source, enabled: false }}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await screen.findByText('Ошибка передачи')
		expect(
			screen.getByRole('button', { name: 'Повторить передачу' })
		).toHaveProperty('disabled', true)
	})
	it.each(['manager', 'other-workspace', 'unconfirmed'] as const)(
		'does not read or expose source metadata for %s',
		mode => {
			render(
				<WidgetTransfersPanel
					access={access(
						mode === 'manager'
							? { sourceManager: false, canManageSources: false }
							: mode === 'unconfirmed'
								? { confirmed: false }
								: {}
					)}
					source={
						mode === 'other-workspace'
							? { ...source, workspaceId: transferId }
							: source
					}
					onClose={vi.fn()}
				/>,
				{ wrapper }
			)
			expect(listWidgetTransfers).not.toHaveBeenCalled()
			expect(screen.queryByText(source.name)).toBeNull()
		}
	)
	it('shows 404 as unavailable, never as a successful empty history', async () => {
		vi.mocked(listWidgetTransfers).mockRejectedValue(
			new AuthenticatedApiError('notFound', 'Missing')
		)
		render(
			<WidgetTransfersPanel
				access={access()}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await screen.findByText(/Это не означает, что передач не было/)
		expect(
			screen.queryByText('На этой странице передач пока нет.')
		).toBeNull()
	})
	it('asks for explicit confirmation, reauthorizes and only acknowledges the queued command', async () => {
		const permissions = access()
		render(
			<WidgetTransfersPanel
				access={permissions}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await openRetry()
		expect(retryWidgetTransfer).not.toHaveBeenCalled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить повтор' })
		)
		await waitFor(() =>
			expect(toast.success).toHaveBeenCalledWith(
				'Повтор поставлен в очередь. Доставка ещё не подтверждена.'
			)
		)
		expect(permissions.authorize).toHaveBeenCalledWith(
			'intake:manage-sources'
		)
		expect(retryWidgetTransfer).toHaveBeenCalledWith('test-session', {
			workspaceId,
			sourceId,
			transferId,
			expectedVersion: 7,
			commandId: expect.any(String)
		})
		expect(listWidgetTransfers).toHaveBeenCalledTimes(2)
	})
	it('keeps exact UUID/version through unknown -> 401 -> retry, without logout or unsafe close', async () => {
		vi.mocked(retryWidgetTransfer)
			.mockRejectedValueOnce(
				new AuthenticatedApiError('temporary', 'Unknown')
			)
			.mockRejectedValueOnce(
				new AuthenticatedApiError('unauthorized', 'Recheck')
			)
		const onClose = vi.fn(),
			permissions = access()
		render(
			<WidgetTransfersPanel
				access={permissions}
				source={source}
				onClose={onClose}
			/>,
			{ wrapper }
		)
		await openRetry()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить повтор' })
		)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Повторить тот же запрос'
			})
		)
		await screen.findByText('Recheck')
		fireEvent.click(
			screen.getByRole('button', { name: 'Назад к истории' })
		)
		expect(
			screen.getByRole('button', { name: 'Повторить тот же запрос' })
		).toBeTruthy()
		expect(onClose).not.toHaveBeenCalled()
		expect(useSessionStore.getState().session?.userId).toBe('owner')
		fireEvent.click(
			screen.getByRole('button', { name: 'Повторить тот же запрос' })
		)
		await waitFor(() => expect(toast.success).toHaveBeenCalledOnce())
		const calls = vi.mocked(retryWidgetTransfer).mock.calls
		expect(calls).toHaveLength(3)
		expect(calls[1]).toEqual(calls[0])
		expect(calls[2]).toEqual(calls[0])
		expect(permissions.authorize).toHaveBeenCalledTimes(3)
	})
	it('recovers an unknown command after remount even if the transfer has finished and source is disabled', async () => {
		vi.mocked(retryWidgetTransfer).mockRejectedValueOnce(
			new AuthenticatedApiError('temporary', 'Unknown')
		)
		const permissions = access()
		const view = render(
			<WidgetTransfersPanel
				access={permissions}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await openRetry()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить повтор' })
		)
		await screen.findByRole('button', { name: 'Повторить тот же запрос' })
		view.rerender(<div>Другой раздел</div>)
		vi.mocked(listWidgetTransfers).mockResolvedValue({
			...data,
			items: [
				{
					...transfer,
					state: 'DELIVERED',
					version: 10,
					entryId: sourceId,
					completedAt: date,
					reason: null
				}
			]
		})
		view.rerender(
			<WidgetTransfersPanel
				access={permissions}
				source={{ ...source, enabled: false }}
				onClose={vi.fn()}
			/>
		)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Проверить сохранённый повтор'
			})
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Повторить тот же запрос' })
		)
		await waitFor(() => expect(toast.success).toHaveBeenCalledOnce())
		const calls = vi.mocked(retryWidgetTransfer).mock.calls
		expect(calls).toHaveLength(2)
		expect(calls[1]).toEqual(calls[0])
		expect(calls[1][1].expectedVersion).toBe(7)
	})
	it('requires an explicit reread on CAS conflict before using a new version and UUID', async () => {
		vi.mocked(retryWidgetTransfer).mockRejectedValueOnce(
			new AuthenticatedApiError('conflict', 'Changed')
		)
		render(
			<WidgetTransfersPanel
				access={access()}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await openRetry()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить повтор' })
		)
		await screen.findByRole('button', { name: 'Перечитать передачи' })
		expect(
			screen.queryByRole('button', { name: 'Подтвердить повтор' })
		).toBeNull()
		vi.mocked(listWidgetTransfers).mockResolvedValue({
			...data,
			items: [{ ...transfer, version: 9 }]
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Перечитать передачи' })
		)
		await openRetry()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить повтор' })
		)
		await waitFor(() =>
			expect(retryWidgetTransfer).toHaveBeenCalledTimes(2)
		)
		const [first, second] = vi
			.mocked(retryWidgetTransfer)
			.mock.calls.map(([, command]) => command)
		expect(second.expectedVersion).toBe(9)
		expect(second.commandId).not.toBe(first.commandId)
	})
	it('discards list responses after a session change', async () => {
		let finish!: (value: WidgetTransfersPage) => void
		vi.mocked(listWidgetTransfers).mockImplementation(
			() =>
				new Promise(resolve => {
					finish = resolve
				})
		)
		render(
			<WidgetTransfersPanel
				access={access()}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await waitFor(() => expect(listWidgetTransfers).toHaveBeenCalledOnce())
		await act(async () => {
			useSessionStore.getState().setAnonymous()
			finish(data)
		})
		expect(screen.queryByText('Ошибка передачи')).toBeNull()
		expect(
			client
				.getQueriesData({ queryKey: ['crm-widget-sources'] })
				.every(([, value]) => value === undefined)
		).toBe(true)
	})
	it('does not show a late mutation success or old data after role loss', async () => {
		let finish!: (
			value: Awaited<ReturnType<typeof retryWidgetTransfer>>
		) => void
		vi.mocked(retryWidgetTransfer).mockImplementation(
			() =>
				new Promise(resolve => {
					finish = resolve
				})
		)
		const current = access()
		const view = render(
			<WidgetTransfersPanel
				access={current}
				source={source}
				onClose={vi.fn()}
			/>,
			{ wrapper }
		)
		await openRetry()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить повтор' })
		)
		await waitFor(() => expect(retryWidgetTransfer).toHaveBeenCalledOnce())
		view.rerender(
			<WidgetTransfersPanel
				access={{
					...current,
					scopeKey: 'manager',
					sourceManager: false,
					canManageSources: false
				}}
				source={source}
				onClose={vi.fn()}
			/>
		)
		await act(async () =>
			finish({
				schemaVersion: 1,
				transfer: {
					...transfer,
					state: 'RETRY_PENDING',
					version: 8,
					reason: null
				},
				command: {
					id: vi.mocked(retryWidgetTransfer).mock.calls[0][1].commandId,
					state: 'QUEUED'
				}
			})
		)
		expect(toast.success).not.toHaveBeenCalled()
		expect(screen.queryByText(source.name)).toBeNull()
		expect(listWidgetTransfers).toHaveBeenCalledOnce()
	})
})
