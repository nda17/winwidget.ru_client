import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listInbox, type InboxEntry } from '@/entities/intake'
import { useIntakeAccess } from '@/features/manage-intake'
import InboxScreen from './InboxScreen'

vi.mock('@/entities/intake', async original => ({
	...(await original<typeof import('@/entities/intake')>()),
	listInbox: vi.fn()
}))
vi.mock('@/features/manage-intake', () => ({
	useIntakeAccess: vi.fn(),
	InboxEditor: () => <div>Inbox editor</div>,
	SourcesPanel: () => <div>Sources panel</div>,
	CsvImportDrawer: ({
		onSaved,
		onClose
	}: {
		onSaved: () => void
		onClose: () => void
	}) => (
		<button
			onClick={() => {
				onSaved()
				onClose()
			}}
		>
			Подтвердить тестовый импорт
		</button>
	)
}))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))
vi.mock('@/features/export-records', () => ({
	ExportRecordsControl: () => <button>Экспорт</button>
}))
const workspaceId = '11111111-1111-4111-8111-111111111111'
const id = '22222222-2222-4222-8222-222222222222'
const entry: InboxEntry = {
	id,
	workspaceId,
	title: 'CSV обращение',
	name: 'Клиент',
	phone: null,
	email: null,
	message: null,
	origin: 'CSV',
	sourceId: null,
	status: 'NEW',
	createdBySubject: 'owner',
	teamId: null,
	version: 1,
	contactId: null,
	dealId: null,
	rejectionReason: null,
	receivedAt: '2026-09-05T00:00:00.000Z',
	updatedAt: '2026-09-05T00:00:00.000Z',
	acceptedAt: null,
	rejectedAt: null
}
let client: QueryClient
let access: ReturnType<typeof useIntakeAccess>
beforeEach(() => {
	vi.resetAllMocks()
	client = new QueryClient({
		defaultOptions: { queries: { retry: false } }
	})
	access = {
		workspaceId,
		session: { userId: 'owner', accessToken: 'token' },
		revision: 1,
		scopeKey: 'owner',
		canRead: true,
		canWrite: true,
		permissions: {
			isSuccess: true,
			data: { role: 'OWNER' },
			refetch: vi.fn()
		}
	} as unknown as ReturnType<typeof useIntakeAccess>
	vi.mocked(useIntakeAccess).mockImplementation(() => access)
	vi.mocked(listInbox).mockResolvedValue({
		schemaVersion: 1,
		page: 1,
		pageSize: 25,
		total: 1,
		items: [entry]
	})
})
afterEach(() => {
	cleanup()
	client.clear()
})
const view = () => (
	<QueryClientProvider client={client}>
		<InboxScreen />
	</QueryClientProvider>
)
describe('Inbox CSV integration', () => {
	it('labels native entries without fabricating an absent customer name or fetching detail payloads', async () => {
		vi.mocked(listInbox).mockResolvedValue({
			schemaVersion: 1,
			page: 1,
			pageSize: 25,
			total: 1,
			items: [{ ...entry, origin: 'WIDGET', sourceId: id, name: null }]
		})
		render(view())
		expect(await screen.findByText('Имя не передано')).toBeTruthy()
		expect(screen.getByText('Виджет')).toBeTruthy()
		expect(screen.queryByText('Данные виджета')).toBeNull()
	})
	it('shows CSV as a distinct origin and refreshes the real server list after import', async () => {
		render(view())
		await screen.findByText('CSV обращение')
		expect(screen.getByText('CSV')).toBeTruthy()
		expect(listInbox).toHaveBeenCalledWith(
			'token',
			workspaceId,
			1,
			25,
			'',
			'NEW'
		)
		fireEvent.click(screen.getByRole('button', { name: 'Импорт CSV' }))
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить тестовый импорт' })
		)
		await waitFor(() => expect(listInbox).toHaveBeenCalledTimes(2))
		expect(
			screen.queryByRole('button', { name: 'Подтвердить тестовый импорт' })
		).toBeNull()
	})
	it('disables import for read-only users and the sources tab', async () => {
		access = { ...access, canWrite: false }
		const rendered = render(view())
		expect(
			screen.getByRole('button', { name: 'Импорт CSV' })
		).toHaveProperty('disabled', true)
		access = { ...access, canWrite: true }
		rendered.rerender(view())
		fireEvent.click(screen.getByRole('button', { name: 'Источники' }))
		expect(
			screen.getByRole('button', { name: 'Импорт CSV' })
		).toHaveProperty('disabled', true)
	})
	it('does not reuse the old ALL rows when permission scope changes', async () => {
		const rendered = render(view())
		await screen.findByText('CSV обращение')
		vi.mocked(listInbox).mockResolvedValue({
			schemaVersion: 1,
			page: 1,
			pageSize: 25,
			total: 0,
			items: []
		})
		access = { ...access, scopeKey: 'manager:own' }
		rendered.rerender(view())
		expect(screen.queryByText('CSV обращение')).toBeNull()
		await screen.findByText('Обращений с выбранным статусом пока нет')
		expect(listInbox).toHaveBeenCalledTimes(2)
	})
})
