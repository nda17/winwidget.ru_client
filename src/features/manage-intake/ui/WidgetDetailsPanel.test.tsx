import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import toast from 'react-hot-toast'
import {
	crmPermissionScope,
	type CrmPermissions
} from '@/entities/crm-access'
import {
	getWidgetEntryDetails,
	type InboxEntry,
	type WidgetEntryDetails,
	type WidgetLeadSnapshot
} from '@/entities/intake'
import { resetSessionStore, useSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import type { IntakeAccess } from '../model/use-intake-access'
import { WidgetDetailsPanel } from './WidgetDetailsPanel'

vi.mock('@/entities/intake', async original => ({
	...(await original<typeof import('@/entities/intake')>()),
	getWidgetEntryDetails: vi.fn()
}))
vi.mock('react-hot-toast', () => ({
	default: { success: vi.fn(), error: vi.fn() }
}))
const workspaceId = '11111111-1111-4111-8111-111111111111'
const entryId = '22222222-2222-4222-8222-222222222222'
const sourceId = '33333333-3333-4333-8333-333333333333'
const foreignWorkspace = '44444444-4444-4444-8444-444444444444'
const date = '2026-09-05T10:00:00.000Z'
const entry: Extract<InboxEntry, { origin: 'WIDGET' }> = {
	id: entryId,
	workspaceId,
	sourceId,
	origin: 'WIDGET',
	name: null,
	title: 'Заявка из виджета',
	phone: null,
	email: null,
	message: null,
	status: 'NEW',
	createdBySubject: 'owner',
	teamId: null,
	version: 1,
	contactId: null,
	dealId: null,
	rejectionReason: null,
	receivedAt: date,
	updatedAt: date,
	acceptedAt: null,
	rejectedAt: null
}
const payload: WidgetLeadSnapshot = {
	schemaVersion: 1,
	widget: {
		type: 'WHEEL',
		id: 'widget',
		name: 'Колесо на сайте',
		publishedVersion: 7
	},
	lead: {
		id: 'lead',
		createdAt: date,
		contactName: null,
		contactRaw: '+7 (900) 123-45-67',
		phoneRaw: '+7 (900) 123-45-67',
		phoneE164: null,
		email: null,
		pageUrl: 'https://example.test/form',
		redactions: ['URL_QUERY_REMOVED']
	},
	details: { type: 'WHEEL', bonus: 'Скидка 10%' }
}
let client: QueryClient
let permissions: CrmPermissions
let access: IntakeAccess
const response = (
	snapshot = payload,
	workspace = workspaceId
): WidgetEntryDetails => ({
	schemaVersion: 1,
	workspaceId: workspace,
	entryId,
	sourceId,
	payload: snapshot
})
const syncAccess = () => {
	const state = useSessionStore.getState()
	access = {
		workspaceId: permissions.workspaceId,
		scopeKey: crmPermissionScope(permissions),
		session: state.session,
		revision: state.sessionRevision,
		canRead: permissions.permissions.includes('intake:read'),
		canWrite: false,
		online: true,
		permissions: { isSuccess: true, isFetching: false, data: permissions }
	} as IntakeAccess
	client.setQueryData(
		[
			'crm-permissions',
			permissions.workspaceId,
			permissions.subject,
			state.sessionRevision
		],
		permissions
	)
}
beforeEach(() => {
	vi.resetAllMocks()
	Object.defineProperty(navigator, 'onLine', {
		configurable: true,
		value: true
	})
	client = new QueryClient({
		defaultOptions: { queries: { retry: false } }
	})
	useSessionStore.setState({
		status: 'authenticated',
		session: { userId: 'owner', accessToken: 'synthetic' },
		sessionRevision: 1
	})
	permissions = {
		schemaVersion: 1,
		workspaceId,
		subject: 'owner',
		state: 'READ_ONLY',
		role: 'OWNER',
		dataScope: 'ALL',
		teamIds: [],
		permissions: ['intake:read']
	}
	syncAccess()
	vi.mocked(getWidgetEntryDetails).mockResolvedValue(response())
})
afterEach(() => {
	cleanup()
	client.clear()
	resetSessionStore()
})
const view = (visible = true) => (
	<QueryClientProvider client={client}>
		<p>Основная карточка доступна</p>
		{visible ? (
			<WidgetDetailsPanel
				access={access}
				entry={{ ...entry, workspaceId: access.workspaceId }}
			/>
		) : null}
	</QueryClientProvider>
)
const deferred = () => {
	let resolve!: (value: WidgetEntryDetails) => void
	let reject!: (error: Error) => void
	const promise = new Promise<WidgetEntryDetails>((yes, no) => {
		resolve = yes
		reject = no
	})
	return { resolve, reject, promise }
}
describe('stored widget details scoped read-only UI', () => {
	it('shows the source snapshot in READ_ONLY without inventing a name or loading URLs', async () => {
		render(view())
		await screen.findByText('Колесо на сайте')
		expect(screen.getByText('Имя не передано')).toBeTruthy()
		expect(screen.getByText('Скидка 10%')).toBeTruthy()
		expect(screen.getByText('https://example.test/form')).toBeTruthy()
		expect(screen.queryByRole('link')).toBeNull()
		expect(document.querySelector('img, iframe, script')).toBeNull()
		expect(screen.getByText(/параметры удалены/)).toBeTruthy()
		expect(getWidgetEntryDetails).toHaveBeenCalledExactlyOnceWith(
			'synthetic',
			workspaceId,
			entryId,
			sourceId
		)
		expect(
			screen.getByRole('button', { name: 'Обновить данные виджета' })
		).toHaveProperty('disabled', false)
	})
	it.each([
		[
			{
				type: 'QUIZ',
				result: 'Подходит ремонт',
				answers: [
					{
						questionId: 'q',
						questionText: 'Какой ремонт?',
						options: [{ id: 'a', text: 'Косметический' }]
					}
				]
			},
			'Косметический'
		],
		[
			{
				type: 'CALLBACK',
				timeSlot: '12:00–14:00',
				timezone: 'Europe/Moscow'
			},
			'12:00–14:00'
		],
		[{ type: 'TIMER' }, 'Таймер'],
		[{ type: 'STOP_OFFER' }, 'Стоп-оффер'],
		[
			{
				type: 'CALCULATOR',
				calculatedPrice: '999999999999.99',
				currency: 'RUB',
				answers: [
					{
						fieldId: 'f',
						fieldLabel: 'Площадь',
						type: 'number',
						value: 100,
						valueLabel: '100 м²'
					}
				]
			},
			'999999999999.99 RUB'
		]
	] as const)(
		'renders typed details without flattening or rounding',
		async (details, expected) => {
			vi.mocked(getWidgetEntryDetails).mockResolvedValue(
				response({
					...payload,
					widget: { ...payload.widget, type: details.type },
					details: structuredClone(
						details
					) as WidgetLeadSnapshot['details']
				})
			)
			render(view())
			expect(await screen.findByText(expected)).toBeTruthy()
		}
	)
	it('keeps the main card available on errors and uses an explicit toasted retry without logging out', async () => {
		vi.mocked(getWidgetEntryDetails)
			.mockRejectedValueOnce(
				new AuthenticatedApiError(
					'unauthorized',
					'synthetic private error'
				)
			)
			.mockResolvedValueOnce(response())
		render(view())
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Повторить загрузку данных'
			})
		)
		await screen.findByText('Колесо на сайте')
		expect(toast.success).toHaveBeenCalledExactlyOnceWith(
			'Данные виджета загружены'
		)
		expect(screen.getByText('Основная карточка доступна')).toBeTruthy()
		expect(screen.queryByText('synthetic private error')).toBeNull()
		expect(useSessionStore.getState().status).toBe('authenticated')
	})
	it('does not toast an initial error and protects cached details during a failed explicit refresh', async () => {
		render(view())
		await screen.findByText('Колесо на сайте')
		vi.mocked(getWidgetEntryDetails).mockRejectedValue(
			new AuthenticatedApiError('temporary', 'private')
		)
		fireEvent.click(
			screen.getByRole('button', { name: 'Обновить данные виджета' })
		)
		await screen.findByText('Данные виджета пока недоступны')
		expect(screen.queryByText('Колесо на сайте')).toBeNull()
		expect(toast.error).toHaveBeenCalledExactlyOnceWith(
			'Не удалось загрузить данные виджета'
		)
	})
	it.each([
		'anonymous',
		'unconfirmed',
		'foreign-subject',
		'no-read'
	] as const)('does not start reads for %s access', scenario => {
		if (scenario === 'anonymous') useSessionStore.getState().setAnonymous()
		if (scenario === 'unconfirmed') access = { ...access, canRead: false }
		if (scenario === 'foreign-subject')
			access = {
				...access,
				permissions: {
					...access.permissions,
					data: { ...permissions, subject: 'foreign' }
				} as IntakeAccess['permissions']
			}
		if (scenario === 'no-read') {
			permissions = { ...permissions, permissions: [] }
			syncAccess()
		}
		render(view())
		expect(getWidgetEntryDetails).not.toHaveBeenCalled()
	})
	it('does not cache or toast a response after the drawer unmounts', async () => {
		const pending = deferred()
		vi.mocked(getWidgetEntryDetails).mockReturnValue(pending.promise)
		const rendered = render(view())
		await waitFor(() =>
			expect(getWidgetEntryDetails).toHaveBeenCalledOnce()
		)
		rendered.rerender(view(false))
		await act(async () => pending.resolve(response()))
		expect(screen.queryByText('Колесо на сайте')).toBeNull()
		expect(
			client
				.getQueriesData({ queryKey: ['crm-intake-widget-details'] })
				.every(([, data]) => data === undefined)
		).toBe(true)
		expect(toast.success).not.toHaveBeenCalled()
		expect(toast.error).not.toHaveBeenCalled()
	})
	it('never resumes another workspace response or leaves old ALL data visible after scope changes', async () => {
		const pending = deferred()
		vi.mocked(getWidgetEntryDetails)
			.mockReturnValueOnce(pending.promise)
			.mockResolvedValueOnce(
				response(
					{
						...payload,
						widget: { ...payload.widget, name: 'Доступные новые данные' }
					},
					foreignWorkspace
				)
			)
		const rendered = render(view())
		await waitFor(() =>
			expect(getWidgetEntryDetails).toHaveBeenCalledOnce()
		)
		permissions = {
			...permissions,
			workspaceId: foreignWorkspace,
			role: 'MANAGER',
			dataScope: 'OWN'
		}
		syncAccess()
		rendered.rerender(view())
		await screen.findByText('Доступные новые данные')
		await act(async () => pending.resolve(response()))
		expect(screen.queryByText('Колесо на сайте')).toBeNull()
		expect(
			client
				.getQueriesData({
					queryKey: ['crm-intake-widget-details', workspaceId]
				})
				.every(([, data]) => data === undefined)
		).toBe(true)
	})
	it('checks the fresh permission cache before accepting a late result even before a parent rerender', async () => {
		const pending = deferred()
		vi.mocked(getWidgetEntryDetails).mockReturnValue(pending.promise)
		render(view())
		await waitFor(() =>
			expect(getWidgetEntryDetails).toHaveBeenCalledOnce()
		)
		client.setQueryData(['crm-permissions', workspaceId, 'owner', 1], {
			...permissions,
			role: 'MANAGER',
			dataScope: 'OWN'
		})
		await act(async () => pending.resolve(response()))
		expect(screen.queryByText('Колесо на сайте')).toBeNull()
		expect(
			client
				.getQueriesData({ queryKey: ['crm-intake-widget-details'] })
				.every(([, data]) => data === undefined)
		).toBe(true)
	})
	it('a late refresh 401 cannot log out or notify the next session', async () => {
		const pending = deferred()
		vi.mocked(getWidgetEntryDetails)
			.mockResolvedValueOnce(response())
			.mockReturnValueOnce(pending.promise)
		render(view())
		await screen.findByText('Колесо на сайте')
		fireEvent.click(
			screen.getByRole('button', { name: 'Обновить данные виджета' })
		)
		await waitFor(() =>
			expect(getWidgetEntryDetails).toHaveBeenCalledTimes(2)
		)
		await act(async () =>
			useSessionStore.getState().setAuthenticated({
				userId: 'another',
				accessToken: 'new-synthetic'
			})
		)
		await act(async () =>
			pending.reject(
				new AuthenticatedApiError('unauthorized', 'private old session')
			)
		)
		expect(useSessionStore.getState().session?.userId).toBe('another')
		expect(screen.queryByText('Колесо на сайте')).toBeNull()
		expect(toast.success).not.toHaveBeenCalled()
		expect(toast.error).not.toHaveBeenCalled()
	})
	it('checks navigator online immediately before a click, even before an offline event rerender', async () => {
		render(view())
		await screen.findByText('Колесо на сайте')
		Object.defineProperty(navigator, 'onLine', {
			configurable: true,
			value: false
		})
		fireEvent.click(
			screen.getByRole('button', { name: 'Обновить данные виджета' })
		)
		expect(getWidgetEntryDetails).toHaveBeenCalledOnce()
	})
})
