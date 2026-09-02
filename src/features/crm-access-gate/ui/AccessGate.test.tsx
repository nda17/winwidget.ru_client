import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
	act,
	cleanup,
	fireEvent,
	render,
	screen,
	waitFor
} from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'

import {
	activateCrmTrial,
	getCrmAccessBootstrap,
	getPipelineTemplates
} from '../api/crm-access.api'
import { AccessGate } from './AccessGate'

vi.mock('../api/crm-access.api', () => ({
	activateCrmTrial: vi.fn(),
	getCrmAccessBootstrap: vi.fn(),
	getPipelineTemplates: vi.fn()
}))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() })
}))

const workspaceId = '11111111-1111-4111-8111-111111111111'
const membershipId = '22222222-2222-4222-8222-222222222222'
const base = {
	schemaVersion: 1 as const,
	selectedWorkspaceId: workspaceId,
	membership: { membershipId, role: 'OWNER' as const },
	workspaces: [{ workspaceId, membershipId, role: 'OWNER' as const }]
}

const Wrapper = ({ children }: PropsWithChildren) => (
	<QueryClientProvider
		client={
			new QueryClient({
				defaultOptions: {
					queries: { retry: false },
					mutations: { retry: false }
				}
			})
		}
	>
		{children}
	</QueryClientProvider>
)

describe('AccessGate', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		useSessionStore.setState({
			status: 'authenticated',
			session: { accessToken: 'token', userId: 'user-1' },
			errorMessage: null,
			sessionRevision: 1
		})
	})

	afterEach(() => {
		cleanup()
	})

	it('renders children only for ACTIVE', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...base,
			state: 'ACTIVE',
			entitlementStatus: 'ACTIVE',
			entitlement: {} as never,
			access: { lifecycle: 'ACTIVE' }
		})
		render(
			<AccessGate>
				<div>workspace content</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(await screen.findByText('workspace content')).toBeTruthy()
	})

	it('revalidates access before reopening a workspace for a new session', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValueOnce({
			...base,
			state: 'ACTIVE',
			entitlementStatus: 'ACTIVE',
			entitlement: {} as never,
			access: { lifecycle: 'ACTIVE' }
		})
		let resolveRevalidation: (() => void) | undefined
		vi.mocked(getCrmAccessBootstrap).mockImplementationOnce(
			() =>
				new Promise(resolve => {
					resolveRevalidation = () =>
						resolve({
							...base,
							state: 'ACTIVE',
							entitlementStatus: 'ACTIVE',
							entitlement: {} as never,
							access: { lifecycle: 'ACTIVE' }
						})
				})
		)

		render(
			<AccessGate>
				<div>workspace content</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(await screen.findByText('workspace content')).toBeTruthy()

		act(() => {
			useSessionStore.getState().setAuthenticated({
				accessToken: 'new-token',
				userId: 'user-1'
			})
		})

		await waitFor(() =>
			expect(getCrmAccessBootstrap).toHaveBeenCalledWith(
				'new-token',
				undefined
			)
		)
		await waitFor(() =>
			expect(screen.queryByText('workspace content')).toBeNull()
		)

		act(() => resolveRevalidation?.())
		expect(await screen.findByText('workspace content')).toBeTruthy()
	})

	it('never starts trial automatically and reuses command id after a failed attempt', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...base,
			state: 'NOT_ACTIVATED',
			entitlementStatus: 'NOT_ACTIVATED',
			entitlement: null,
			access: null
		})
		vi.mocked(activateCrmTrial).mockRejectedValue(new Error('network'))
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		const start = await screen.findByRole('button', {
			name: 'Попробовать бесплатно 5 дней'
		})
		expect(activateCrmTrial).not.toHaveBeenCalled()
		fireEvent.click(start)
		await screen.findByRole('button', {
			name: 'Повторить запуск бесплатных 5 дней'
		})
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Повторить запуск бесплатных 5 дней'
			})
		)
		await waitFor(() => expect(activateCrmTrial).toHaveBeenCalledTimes(2))
		expect(vi.mocked(activateCrmTrial).mock.calls[0][1].commandId).toBe(
			vi.mocked(activateCrmTrial).mock.calls[1][1].commandId
		)
		expect(screen.queryByText('hidden')).toBeNull()
	})

	it('uses a new command id after a deterministic idempotency conflict', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...base,
			state: 'NOT_ACTIVATED',
			entitlementStatus: 'NOT_ACTIVATED',
			entitlement: null,
			access: null
		})
		vi.mocked(activateCrmTrial)
			.mockRejectedValueOnce(
				new AuthenticatedApiError('conflict', 'conflicting command')
			)
			.mockRejectedValueOnce(new Error('network'))
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)

		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Попробовать бесплатно 5 дней'
			})
		)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Повторить запуск бесплатных 5 дней'
			})
		)

		await waitFor(() => expect(activateCrmTrial).toHaveBeenCalledTimes(2))
		expect(
			vi.mocked(activateCrmTrial).mock.calls[0][1].commandId
		).not.toBe(vi.mocked(activateCrmTrial).mock.calls[1][1].commandId)
	})

	it('keeps workspace closed during onboarding and loads the real catalog', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...base,
			state: 'ONBOARDING',
			entitlementStatus: 'ACTIVE',
			entitlement: {} as never,
			access: null
		})
		vi.mocked(getPipelineTemplates).mockResolvedValue({
			schemaVersion: 1,
			catalogRevision: 1,
			templates: []
		})
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(await screen.findByText('Настройка WinCRM')).toBeTruthy()
		expect(getPipelineTemplates).toHaveBeenCalledWith('token')
		expect(screen.queryByText('hidden')).toBeNull()
		expect(screen.queryByRole('button', { name: /установ/i })).toBeNull()
	})
})
