import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor,
	within
} from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSalesAnalytics, type SalesAnalytics } from '@/entities/sales'
import { useSalesSession } from '@/features/manage-sales'
import { resetSessionStore, useSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import AnalyticsScreen from './AnalyticsScreen'

vi.mock('@/entities/sales', () => ({ getSalesAnalytics: vi.fn() }))
vi.mock('@/features/manage-sales', () => ({
	useSalesSession: vi.fn(),
	salesMoney: (amount: number) => `${amount / 100} ₽`
}))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))

const workspaceId = '11111111-1111-4111-8111-111111111111'
const response: SalesAnalytics = {
	schemaVersion: 1,
	currency: 'RUB',
	items: [
		{ status: 'OPEN', count: 2, amountMinor: 55000 },
		{ status: 'WON', count: 3, amountMinor: 200000 },
		{ status: 'LOST', count: 1, amountMinor: 15000 }
	]
}
const makeContext = () => ({
	session: { userId: 'analyst', accessToken: 'local-session' },
	sessionRevision: 1,
	workspace: { workspaceId, canWrite: false },
	key: [workspaceId, 'analyst', 1],
	canRead: false,
	canWrite: false,
	permissions: {
		isPending: false,
		isError: false,
		isFetching: false,
		data: {
			role: 'ANALYST',
			state: 'READ_ONLY',
			dataScope: 'ALL',
			teamIds: [],
			permissions: ['sales:analytics']
		},
		refetch: vi.fn()
	}
})
let context: ReturnType<typeof makeContext>
let client: QueryClient
beforeEach(() => {
	vi.clearAllMocks()
	context = makeContext()
	context.permissions.refetch.mockImplementation(async () => ({
		isError: false,
		data: context.permissions.data
	}))
	vi.mocked(useSalesSession).mockImplementation(
		() => context as unknown as ReturnType<typeof useSalesSession>
	)
	vi.mocked(getSalesAnalytics).mockResolvedValue(response)
	client = new QueryClient({
		defaultOptions: { queries: { retry: false } }
	})
	resetSessionStore()
})
afterEach(() => {
	cleanup()
	client.clear()
	resetSessionStore()
})
const mount = () =>
	render(
		<QueryClientProvider client={client}>
			<AnalyticsScreen />
		</QueryClientProvider>
	)

describe('AnalyticsScreen live scoped aggregates', () => {
	it('allows the aggregate-only ANALYST role in READ_ONLY without contact/deal permissions', async () => {
		mount()
		const won = await screen.findByRole('article', {
			name: 'Успешно закрыты'
		})
		expect(within(won).getByText('3')).toBeTruthy()
		expect(within(won).getByText('2000 ₽')).toBeTruthy()
		expect(screen.getByText('75%')).toBeTruthy()
		expect(screen.getByText('Без ограничения по дате')).toBeTruthy()
		expect(screen.queryByText(/Синтетический показатель/)).toBeNull()
		expect(getSalesAnalytics).toHaveBeenCalledExactlyOnceWith(
			'local-session',
			workspaceId
		)
	})
	it('shows a genuine empty state only after a successful zero-count report', async () => {
		vi.mocked(getSalesAnalytics).mockResolvedValue({
			...response,
			items: response.items.map(item => ({
				...item,
				count: 0,
				amountMinor: 0
			}))
		})
		mount()
		await screen.findByText('Пока нет сделок для отчёта')
		expect(screen.queryByRole('article')).toBeNull()
	})
	it('does not invent a win percentage before any deal has closed', async () => {
		vi.mocked(getSalesAnalytics).mockResolvedValue({
			...response,
			items: response.items.map(item =>
				item.status === 'OPEN'
					? item
					: { ...item, count: 0, amountMinor: 0 }
			)
		})
		mount()
		await screen.findByText('Закрытых сделок пока нет')
		expect(screen.queryByText('0%')).toBeNull()
	})
	it('hides aggregates and sends no request if permission is missing', async () => {
		context.permissions.data.permissions = []
		mount()
		await screen.findByText('Аналитика недоступна')
		expect(getSalesAnalytics).not.toHaveBeenCalled()
	})
	it('hides data during permission revalidation', async () => {
		context.permissions.isFetching = true
		mount()
		await screen.findByText('Проверяем доступ к аналитике')
		expect(getSalesAnalytics).not.toHaveBeenCalled()
	})
	it('shows error, never fake zero values, and refreshes through authorization', async () => {
		vi.mocked(getSalesAnalytics).mockRejectedValueOnce(
			new AuthenticatedApiError('temporary', 'Unavailable')
		)
		mount()
		await screen.findByText('Отчёт временно недоступен')
		expect(screen.queryByRole('article')).toBeNull()
		fireEvent.click(screen.getByRole('button', { name: 'Обновить' }))
		await screen.findByRole('article', { name: 'В работе' })
		expect(context.permissions.refetch).toHaveBeenCalledTimes(1)
	})
	it('does not sign out a newer session after an old request returns 401', async () => {
		useSessionStore.setState({
			status: 'authenticated',
			sessionRevision: 2,
			session: { userId: 'new-user', accessToken: 'new-session' }
		})
		vi.mocked(getSalesAnalytics).mockRejectedValue(
			new AuthenticatedApiError('unauthorized', 'Expired')
		)
		mount()
		await screen.findByText('Отчёт временно недоступен')
		expect(useSessionStore.getState().session?.accessToken).toBe(
			'new-session'
		)
	})
	it('does not reuse ALL aggregate data after scope changes to OWN', async () => {
		const view = mount()
		await screen.findByText('75%')
		vi.mocked(getSalesAnalytics).mockImplementation(
			() => new Promise(() => {})
		)
		context.permissions.data.dataScope = 'OWN'
		context.permissions.data.role = 'MANAGER'
		view.rerender(
			<QueryClientProvider client={client}>
				<AnalyticsScreen />
			</QueryClientProvider>
		)
		await waitFor(() => expect(getSalesAnalytics).toHaveBeenCalledTimes(2))
		expect(screen.queryByText('75%')).toBeNull()
	})
})
