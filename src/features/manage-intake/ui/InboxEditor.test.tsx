import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
	getInboxEntry,
	listIntakeActivities,
	mutateInbox,
	type InboxEntry
} from '@/entities/intake'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import type { IntakeAccess } from '../model/use-intake-access'
import { InboxEditor } from './InboxEditor'
import {
	PendingCommandProvider,
	commandOwner
} from '@/shared/lib/pending-command'

vi.mock('@/entities/intake', () => ({
	getInboxEntry: vi.fn(),
	listIntakeActivities: vi.fn(),
	mutateInbox: vi.fn()
}))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))
const workspaceId = '11111111-1111-4111-8111-111111111111'
const entry: InboxEntry = {
	id: '22222222-2222-4222-8222-222222222222',
	workspaceId,
	title: 'Запрос QA',
	name: 'Клиент',
	phone: null,
	email: null,
	message: 'Комментарий',
	origin: 'MANUAL',
	sourceId: null,
	status: 'NEW',
	createdBySubject: 'owner',
	teamId: null,
	version: 4,
	contactId: null,
	dealId: null,
	rejectionReason: null,
	receivedAt: '2026-09-05T00:00:00.000Z',
	updatedAt: '2026-09-05T00:00:00.000Z',
	acceptedAt: null,
	rejectedAt: null
}
const access = (write = true) =>
	({
		workspaceId,
		canRead: true,
		canWrite: write,
		online: true,
		session: { userId: 'owner', accessToken: 'session-token' },
		revision: 1,
		authorize: vi.fn().mockResolvedValue('session-token'),
		permissions: {
			isSuccess: true,
			isError: false,
			refetch: vi.fn(),
			data: { teamIds: [] }
		}
	}) as unknown as IntakeAccess
let client: QueryClient
beforeEach(() => {
	vi.clearAllMocks()
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
	client = new QueryClient({
		defaultOptions: { queries: { retry: false } }
	})
	vi.mocked(getInboxEntry).mockResolvedValue(entry)
	vi.mocked(listIntakeActivities).mockResolvedValue({
		schemaVersion: 1,
		page: 1,
		pageSize: 25,
		total: 0,
		items: []
	})
	vi.mocked(mutateInbox).mockResolvedValue(entry)
})
afterEach(() => {
	cleanup()
	client.clear()
})
const mount = (id?: string, write = true) => {
	const onClose = vi.fn()
	render(
		<QueryClientProvider client={client}>
			<PendingCommandProvider owner={commandOwner('owner', 1)}>
				<InboxEditor
					access={access(write)}
					id={id}
					onClose={onClose}
					onSaved={vi.fn()}
				/>
			</PendingCommandProvider>
		</QueryClientProvider>
	)
	return onClose
}
describe('InboxEditor real command states', () => {
	it('keeps read-only record/history visible and never offers fake acceptance', async () => {
		mount(entry.id, false)
		await screen.findByText('Запрос QA')
		expect(
			screen.getByRole('button', { name: 'Принять в работу — скоро' })
		).toHaveProperty('disabled', true)
		expect(screen.queryByRole('button', { name: 'Отклонить' })).toBeNull()
		expect(mutateInbox).not.toHaveBeenCalled()
		await waitFor(() =>
			expect(listIntakeActivities).toHaveBeenCalledWith(
				'session-token',
				workspaceId,
				entry.id,
				1
			)
		)
	})
	it('validates and retries exact manual-create fields without generating another UUID', async () => {
		vi.mocked(mutateInbox)
			.mockRejectedValueOnce(
				new AuthenticatedApiError('temporary', 'Временно недоступно')
			)
			.mockResolvedValueOnce(entry)
		const onClose = mount()
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Тема обращения' }),
			{ target: { value: 'Запрос QA' } }
		)
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Имя клиента' }),
			{ target: { value: 'Клиент' } }
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Создать обращение' })
		)
		await screen.findByRole('button', { name: 'Повторить тот же запрос' })
		const command = vi.mocked(mutateInbox).mock.calls[0][1]
		expect(command).toMatchObject({
			operation: 'create',
			workspaceId,
			title: 'Запрос QA',
			name: 'Клиент',
			teamId: null
		})
		expect(
			screen.getByRole('textbox', { name: 'Тема обращения' })
		).toHaveProperty('readOnly', true)
		fireEvent.click(
			screen.getByRole('button', { name: 'Повторить тот же запрос' })
		)
		await waitFor(() => expect(onClose).toHaveBeenCalledOnce())
		expect(vi.mocked(mutateInbox).mock.calls[1][1]).toBe(command)
	})
	it('rejects with explicit reason and current version; conflicts cannot silently rebase', async () => {
		vi.mocked(mutateInbox).mockRejectedValue(
			new AuthenticatedApiError('conflict', 'Запись изменена')
		)
		const onClose = mount(entry.id)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Отклонить' })
		)
		fireEvent.change(
			screen.getByRole('textbox', { name: 'Причина отклонения' }),
			{ target: { value: 'Дубликат' } }
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить отклонение' })
		)
		await screen.findByRole('button', { name: 'Перечитать карточку' })
		expect(vi.mocked(mutateInbox).mock.calls[0][1]).toMatchObject({
			operation: 'reject',
			workspaceId,
			id: entry.id,
			expectedVersion: 4,
			reason: 'Дубликат'
		})
		expect(
			screen.getByRole('button', { name: 'Подтвердить отклонение' })
		).toHaveProperty('disabled', true)
		expect(onClose).not.toHaveBeenCalled()
	})
})
