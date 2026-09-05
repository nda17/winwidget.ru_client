import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	listWidgetCandidates,
	listWidgetSources,
	listWidgetTransfers,
	mutateWidgetSource,
	type ManagedWidgetSource,
	type WidgetCandidatesPage
} from '@/entities/widget-source'
import { useSessionStore, resetSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import {
	PendingCommandProvider,
	commandOwner
} from '@/shared/lib/pending-command'
import type { IntakeAccess } from '../model/use-intake-access'
import { WidgetSourcesPanel } from './WidgetSourcesPanel'
import { WidgetSourceEditor } from './WidgetSourceEditor'
import toast from 'react-hot-toast'
import type { ReactNode } from 'react'

vi.mock('@/entities/widget-source', () => ({
	listWidgetCandidates: vi.fn(),
	listWidgetSources: vi.fn(),
	listWidgetTransfers: vi.fn(),
	retryWidgetTransfer: vi.fn(),
	mutateWidgetSource: vi.fn()
}))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))
const workspaceId = '11111111-1111-4111-8111-111111111111'
const source: ManagedWidgetSource = {
	id: '22222222-2222-4222-8222-222222222222',
	workspaceId,
	kind: 'WIDGET',
	name: 'Квиз для отдела продаж',
	widgetType: 'QUIZ',
	widgetId: 'published-quiz',
	teamId: null,
	createdBySubject: 'owner',
	version: 1,
	controlVersion: 1,
	generation: 1,
	enabled: true,
	appliedControlVersion: null,
	appliedGeneration: null,
	syncState: 'PENDING',
	lastErrorCode: null,
	createdAt: '2026-09-05T00:00:00.000Z',
	updatedAt: '2026-09-05T00:00:00.000Z',
	syncedAt: null
}
const candidates: WidgetCandidatesPage = {
	schemaVersion: 1,
	workspaceId,
	page: 1,
	pageSize: 25,
	total: 3,
	eligibility: {
		eligible: true,
		reason: 'ELIGIBLE',
		plan: 'EASY',
		startsAt: '2026-09-01T00:00:00.000Z',
		expiresAt: '2026-10-01T00:00:00.000Z',
		checkedAt: '2026-09-05T00:00:00.000Z',
		validUntil: '2026-09-05T00:00:05.000Z'
	},
	items: [
		{
			widgetType: 'QUIZ',
			widgetId: 'published-quiz',
			name: 'Опубликованный квиз',
			isActive: true,
			publishedVersion: 1,
			createdAt: source.createdAt,
			connection: 'NONE',
			sourceId: null
		},
		{
			widgetType: 'CALLBACK',
			widgetId: 'draft-callback',
			name: 'Неопубликованный звонок',
			isActive: true,
			publishedVersion: 0,
			createdAt: source.createdAt,
			connection: 'NONE',
			sourceId: null
		},
		{
			widgetType: 'WHEEL',
			widgetId: 'connected-wheel',
			name: 'Занятое колесо',
			isActive: true,
			publishedVersion: 2,
			createdAt: source.createdAt,
			connection: 'OTHER_WORKSPACE',
			sourceId: null
		}
	]
}
const access = (overrides: Partial<IntakeAccess> = {}) =>
	({
		workspaceId,
		scopeKey: 'owner',
		session: { userId: 'owner', accessToken: 'test-session' },
		revision: 1,
		confirmed: true,
		online: true,
		sourceManager: true,
		canRead: true,
		canManageSources: true,
		canWrite: true,
		authorize: vi.fn().mockResolvedValue('test-session'),
		permissions: { isSuccess: true, isError: false, refetch: vi.fn() },
		...overrides
	}) as unknown as IntakeAccess
let client: QueryClient
const wrapper = ({ children }: { children: ReactNode }) => (
	<QueryClientProvider client={client}>
		<PendingCommandProvider owner={commandOwner('owner', 1)}>
			{children}
		</PendingCommandProvider>
	</QueryClientProvider>
)
beforeEach(() => {
	vi.clearAllMocks()
	resetSessionStore()
	useSessionStore
		.getState()
		.setAuthenticated({ userId: 'owner', accessToken: 'test-session' })
	client = new QueryClient({
		defaultOptions: { queries: { retry: false, gcTime: 0 } }
	})
	vi.mocked(listWidgetSources).mockResolvedValue({
		schemaVersion: 1,
		page: 1,
		pageSize: 25,
		total: 1,
		items: [source]
	})
	vi.mocked(listWidgetCandidates).mockResolvedValue(
		structuredClone(candidates)
	)
	vi.mocked(listWidgetTransfers).mockResolvedValue({
		schemaVersion: 1,
		page: 1,
		pageSize: 25,
		total: 0,
		items: []
	})
	vi.mocked(mutateWidgetSource).mockImplementation(
		async (_token, command) => ({
			schemaVersion: 1,
			source,
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

describe('Managed Widgets UI', () => {
	it('shows desired pending state, not connected success, and never activates a connector on mount', async () => {
		render(<WidgetSourcesPanel access={access()} />, { wrapper })
		await screen.findByRole('heading', { name: `${source.name} Квиз` })
		expect(screen.getByText('Подключается')).toBeTruthy()
		expect(screen.queryByText('Подключён')).toBeNull()
		expect(listWidgetCandidates).not.toHaveBeenCalled()
		expect(mutateWidgetSource).not.toHaveBeenCalled()
		expect(listWidgetSources).toHaveBeenCalledWith(
			'test-session',
			workspaceId,
			1,
			25
		)
	})
	it('keeps READ_ONLY metadata visible without candidate requests or writes', async () => {
		render(
			<WidgetSourcesPanel
				access={access({ canWrite: false, canManageSources: false })}
			/>,
			{ wrapper }
		)
		await screen.findByRole('heading', { name: `${source.name} Квиз` })
		expect(
			screen.getByRole('button', { name: 'Подключить виджет' })
		).toHaveProperty('disabled', true)
		expect(
			screen.getByRole('button', { name: 'Отключить' })
		).toHaveProperty('disabled', true)
		expect(listWidgetCandidates).not.toHaveBeenCalled()
		expect(mutateWidgetSource).not.toHaveBeenCalled()
	})
	it('opens scoped transfer history explicitly, including READ_ONLY', async () => {
		render(
			<WidgetSourcesPanel
				access={access({ canWrite: false, canManageSources: false })}
			/>,
			{ wrapper }
		)
		await screen.findByRole('heading', { name: `${source.name} Квиз` })
		expect(listWidgetTransfers).not.toHaveBeenCalled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Передачи заявок' })
		)
		await screen.findByText('На этой странице передач пока нет.')
		expect(listWidgetTransfers).toHaveBeenCalledWith(
			'test-session',
			workspaceId,
			source.id,
			1,
			25
		)
		expect(mutateWidgetSource).not.toHaveBeenCalled()
	})
	it('never reads connector metadata for a manager', () => {
		render(
			<WidgetSourcesPanel
				access={access({ sourceManager: false, canManageSources: false })}
			/>,
			{ wrapper }
		)
		expect(listWidgetSources).not.toHaveBeenCalled()
		expect(listWidgetCandidates).not.toHaveBeenCalled()
	})
	it('shows default-off endpoint explicitly, without pretending there are no sources', async () => {
		vi.mocked(listWidgetSources).mockRejectedValue(
			new AuthenticatedApiError('notFound', 'Unavailable')
		)
		render(<WidgetSourcesPanel access={access()} />, { wrapper })
		await screen.findByText(/пока не включено на сервере/)
		expect(screen.queryByText(/Подключений пока нет/)).toBeNull()
		expect(
			screen.getByRole('button', { name: 'Подключить виджет' })
		).toHaveProperty('disabled', true)
	})
	it('discards a response after logout before publishing it into the query cache', async () => {
		let resolve!: (
			value: Awaited<ReturnType<typeof listWidgetSources>>
		) => void
		vi.mocked(listWidgetSources).mockImplementation(
			() =>
				new Promise(done => {
					resolve = done
				})
		)
		render(<WidgetSourcesPanel access={access()} />, { wrapper })
		await waitFor(() => expect(listWidgetSources).toHaveBeenCalledOnce())
		await act(async () => {
			useSessionStore.getState().setAnonymous()
			resolve({
				schemaVersion: 1,
				page: 1,
				pageSize: 25,
				total: 1,
				items: [source]
			})
		})
		await waitFor(() => expect(screen.queryByText(source.name)).toBeNull())
		expect(
			client
				.getQueriesData({ queryKey: ['crm-widget-sources'] })
				.every(([, value]) => value === undefined)
		).toBe(true)
	})
	it('does not read candidates for configure and disables only after explicit confirmation', async () => {
		const onClose = vi.fn(),
			onSaved = vi.fn()
		render(
			<WidgetSourceEditor
				access={access()}
				operation="configure"
				source={source}
				onClose={onClose}
				onSaved={onSaved}
			/>,
			{ wrapper }
		)
		expect(listWidgetCandidates).not.toHaveBeenCalled()
		expect(mutateWidgetSource).not.toHaveBeenCalled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Отключить виджет' })
		)
		await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
		expect(vi.mocked(mutateWidgetSource).mock.calls[0][1]).toMatchObject({
			operation: 'configure',
			id: source.id,
			workspaceId,
			expectedVersion: 1,
			enabled: false
		})
		expect(toast.success).toHaveBeenCalledWith(
			expect.stringContaining('Запрос принят')
		)
	})
	it('permits only published unconnected candidates and sends an explicit create command', async () => {
		const onSaved = vi.fn()
		render(
			<WidgetSourceEditor
				access={access()}
				operation="create"
				onClose={vi.fn()}
				onSaved={onSaved}
			/>,
			{ wrapper }
		)
		const radio = await screen.findByRole('radio', {
			name: /Опубликованный квиз/
		})
		expect(
			screen.getByRole('radio', { name: /Неопубликованный звонок/ })
		).toHaveProperty('disabled', true)
		expect(
			screen.getByRole('radio', { name: /Занятое колесо/ })
		).toHaveProperty('disabled', true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Подключить виджет' })
		)
		expect(mutateWidgetSource).not.toHaveBeenCalled()
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Название подключения' }),
			{ target: { value: '  Новый канал  ' } }
		)
		fireEvent.click(radio)
		fireEvent.click(
			screen.getByRole('button', { name: 'Подключить виджет' })
		)
		await waitFor(() => expect(onSaved).toHaveBeenCalledOnce())
		const command = vi.mocked(mutateWidgetSource).mock.calls[0][1]
		expect(command).toMatchObject({
			operation: 'create',
			workspaceId,
			name: 'Новый канал',
			widgetType: 'QUIZ',
			widgetId: 'published-quiz',
			teamId: null
		})
		expect(Object.isFrozen(command)).toBe(true)
	})
	it('Widgets TRIAL cannot be selected even while CRM is writable', async () => {
		vi.mocked(listWidgetCandidates).mockResolvedValue({
			...candidates,
			items: [],
			eligibility: {
				...candidates.eligibility,
				eligible: false,
				reason: 'TRIAL',
				plan: 'TRIAL'
			}
		})
		render(
			<WidgetSourceEditor
				access={access()}
				operation="create"
				onClose={vi.fn()}
				onSaved={vi.fn()}
			/>,
			{ wrapper }
		)
		await screen.findByText(/Пробный период Widgets не подходит/)
		expect(screen.queryByRole('radio')).toBeNull()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подключить виджет' })
		)
		expect(mutateWidgetSource).not.toHaveBeenCalled()
	})
	it('retries an unknown configure outcome with the same frozen command and refuses closing meanwhile', async () => {
		vi.mocked(mutateWidgetSource).mockRejectedValueOnce(
			new AuthenticatedApiError('temporary', 'Неизвестный результат')
		)
		const onClose = vi.fn()
		render(
			<WidgetSourceEditor
				access={access()}
				operation="configure"
				source={source}
				onClose={onClose}
				onSaved={vi.fn()}
			/>,
			{ wrapper }
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Отключить виджет' })
		)
		await screen.findByRole('button', { name: 'Повторить тот же запрос' })
		const original = vi.mocked(mutateWidgetSource).mock.calls[0][1]
		fireEvent.click(screen.getByRole('button', { name: 'Закрыть панель' }))
		expect(onClose).not.toHaveBeenCalled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Повторить тот же запрос' })
		)
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
		expect(vi.mocked(mutateWidgetSource).mock.calls[1][1]).toBe(original)
	})
	it('uses server pagination without fetching the entire source catalog', async () => {
		vi.mocked(listWidgetSources).mockResolvedValue({
			schemaVersion: 1,
			page: 1,
			pageSize: 25,
			total: 26,
			items: [source]
		})
		render(<WidgetSourcesPanel access={access()} />, { wrapper })
		await screen.findByRole('heading', { name: `${source.name} Квиз` })
		const section = screen.getByRole('region', {
			name: 'Подключения WinWidget'
		})
		fireEvent.click(within(section).getByRole('button', { name: 'Далее' }))
		await waitFor(() =>
			expect(listWidgetSources).toHaveBeenLastCalledWith(
				'test-session',
				workspaceId,
				2,
				25
			)
		)
	})
})
