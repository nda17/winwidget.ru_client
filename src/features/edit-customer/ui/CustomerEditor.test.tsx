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
	getCustomer,
	listCustomers,
	mutateCustomer,
	type Customer
} from '@/entities/customer'
import { useSessionStore } from '@/entities/session'
import { getCrmPermissions } from '@/entities/crm-access'
import {
	PendingCommandProvider,
	commandOwner
} from '@/shared/lib/pending-command'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import { CustomerEditor } from './CustomerEditor'

vi.mock('@/entities/customer', () => ({
	getCustomer: vi.fn(),
	listCustomers: vi.fn(),
	mutateCustomer: vi.fn(),
	findCustomerDuplicates: vi.fn()
}))
vi.mock('@/entities/crm-access', () => ({ getCrmPermissions: vi.fn() }))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))
const workspaceId = '11111111-1111-4111-8111-111111111111'
const contact: Customer = {
	kind: 'contacts',
	id: '22222222-2222-4222-8222-222222222222',
	workspaceId,
	name: 'Клиент QA',
	notes: null,
	createdBySubject: 'user-1',
	teamId: null,
	version: 3,
	archivedAt: null,
	createdAt: '2026-09-05T00:00:00.000Z',
	updatedAt: '2026-09-05T00:00:00.000Z',
	phone: null,
	email: null,
	companyId: null
}
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
		defaultOptions: {
			queries: { retry: false },
			mutations: { retry: false }
		}
	})
	useSessionStore.setState({
		session: { accessToken: 'token', userId: 'user-1' },
		status: 'authenticated',
		sessionRevision: 1
	})
	vi.mocked(listCustomers).mockResolvedValue({
		schemaVersion: 1,
		items: [],
		page: 1,
		pageSize: 25,
		total: 0
	})
	vi.mocked(getCustomer).mockResolvedValue(contact)
	vi.mocked(mutateCustomer).mockResolvedValue(contact)
	vi.mocked(getCrmPermissions).mockResolvedValue({
		subject: 'user-1',
		state: 'ACTIVE',
		permissions: ['customers:write']
	} as never)
})
afterEach(() => {
	cleanup()
	client.clear()
})
const mount = (canWrite = true, id?: string) => {
	const onSaved = vi.fn()
	const onClose = vi.fn()
	render(
		<QueryClientProvider client={client}>
			<PendingCommandProvider owner={commandOwner('user-1', 1)}>
				<CustomerEditor
					workspaceId={workspaceId}
					kind="contacts"
					id={id}
					canWrite={canWrite}
					onSaved={onSaved}
					onClose={onClose}
				/>
			</PendingCommandProvider>
		</QueryClientProvider>
	)
	return { onSaved, onClose }
}
describe('CustomerEditor', () => {
	it('loads real records and keeps read-only fields viewable without mutation controls', async () => {
		mount(false, contact.id)
		expect(
			await screen.findByRole('textbox', { name: 'Имя' })
		).toHaveProperty('readOnly', true)
		expect(screen.getByRole('textbox', { name: 'Имя' })).toHaveProperty(
			'value',
			'Клиент QA'
		)
		expect(screen.queryByRole('button', { name: 'Сохранить' })).toBeNull()
		expect(mutateCustomer).not.toHaveBeenCalled()
	})
	it('sends the current record version and closes only after confirmed success', async () => {
		const callbacks = mount(true, contact.id)
		fireEvent.change(await screen.findByRole('textbox', { name: 'Имя' }), {
			target: { value: 'Изменённое имя' }
		})
		fireEvent.submit(document.getElementById('customer-editor')!)
		await waitFor(() => expect(mutateCustomer).toHaveBeenCalledTimes(1))
		expect(vi.mocked(mutateCustomer).mock.calls[0][1]).toMatchObject({
			workspaceId,
			id: contact.id,
			expectedVersion: 3,
			fields: {
				name: 'Изменённое имя',
				phone: null,
				email: null,
				teamId: null
			}
		})
		await waitFor(() => expect(callbacks.onClose).toHaveBeenCalledTimes(1))
	})
	it('freezes an uncertain command and retries its exact id and payload', async () => {
		vi.mocked(mutateCustomer)
			.mockRejectedValueOnce(
				new AuthenticatedApiError('temporary', 'Сеть недоступна')
			)
			.mockResolvedValueOnce(contact)
		mount()
		fireEvent.change(screen.getByRole('textbox', { name: 'Имя' }), {
			target: { value: 'Новый клиент' }
		})
		fireEvent.submit(document.getElementById('customer-editor')!)
		await screen.findByRole('button', { name: 'Повторить запрос' })
		expect(screen.getByRole('textbox', { name: 'Имя' })).toHaveProperty(
			'readOnly',
			true
		)
		fireEvent.submit(document.getElementById('customer-editor')!)
		await waitFor(() => expect(mutateCustomer).toHaveBeenCalledTimes(2))
		expect(vi.mocked(mutateCustomer).mock.calls[1][1]).toEqual(
			vi.mocked(mutateCustomer).mock.calls[0][1]
		)
	})
	it('requires an explicit confirmation before archive', async () => {
		mount(true, contact.id)
		fireEvent.click(
			await screen.findByRole('button', { name: 'Архивировать запись' })
		)
		expect(mutateCustomer).not.toHaveBeenCalled()
		fireEvent.click(
			screen.getByRole('button', { name: 'Подтвердить архивирование' })
		)
		await waitFor(() => expect(mutateCustomer).toHaveBeenCalledTimes(1))
		expect(vi.mocked(mutateCustomer).mock.calls[0][1]).toMatchObject({
			archive: true,
			id: contact.id,
			expectedVersion: 3
		})
	})
	it('does not silently overwrite a concurrent edit', async () => {
		vi.mocked(mutateCustomer).mockRejectedValue(
			new AuthenticatedApiError('conflict', 'Версия изменилась')
		)
		mount(true, contact.id)
		await screen.findByRole('textbox', { name: 'Имя' })
		fireEvent.submit(document.getElementById('customer-editor')!)
		await screen.findByRole('button', {
			name: 'Загрузить актуальную версию'
		})
		expect(
			screen.getByRole('button', { name: 'Сохранить' })
		).toHaveProperty('disabled', true)
		expect(mutateCustomer).toHaveBeenCalledTimes(1)
	})
})
