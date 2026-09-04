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
import toast from 'react-hot-toast'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { useSessionStore } from '@/entities/session'
import { useCrmWorkspaceAccess } from '@/entities/crm-access'
import { CrmAppShell } from '@/widgets/crm-app-shell'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'

import {
	activateCrmTrial,
	getCrmAccessBootstrap,
	getPipelineTemplates,
	installCrmTemplate
} from '../api/crm-access.api'
import {
	crmAccessQueryKey,
	pipelineTemplatesQueryKey
} from '../model/crm-access.queries'
import { AccessGate } from './AccessGate'

vi.mock('../api/crm-access.api', () => ({
	activateCrmTrial: vi.fn(),
	getCrmAccessBootstrap: vi.fn(),
	getPipelineTemplates: vi.fn(),
	installCrmTemplate: vi.fn()
}))
vi.mock('next/navigation', () => ({ usePathname: () => '/inbox' }))
vi.mock('react-hot-toast', () => ({
	default: Object.assign(vi.fn(), {
		loading: vi.fn(() => 'install-toast'),
		success: vi.fn(),
		error: vi.fn()
	})
}))

const workspaceId = '11111111-1111-4111-8111-111111111111'
const membershipId = '22222222-2222-4222-8222-222222222222'
const base = {
	schemaVersion: 1 as const,
	selectedWorkspaceId: workspaceId,
	membership: { membershipId, role: 'OWNER' as const },
	workspaces: [{ workspaceId, membershipId, role: 'OWNER' as const }]
}
const entitlement = {
	id: '44444444-4444-4444-8444-444444444444',
	workspaceId,
	planCode: 'TRIAL',
	seatLimit: 5,
	policyVersion: 1,
	graceUntil: '2026-09-12T00:00:00.000Z',
	trialStartedAt: '2026-09-04T00:00:00.000Z',
	effectiveFrom: '2026-09-04T00:00:00.000Z',
	effectiveUntil: '2026-09-09T00:00:00.000Z',
	aggregateVersion: '1',
	sourceSequence: '1'
}
const onboardingAccess = {
	...base,
	state: 'ONBOARDING' as const,
	entitlementStatus: 'ACTIVE' as const,
	entitlement,
	access: null
}
const activeAccess = {
	...base,
	state: 'ACTIVE' as const,
	entitlementStatus: 'ACTIVE' as const,
	entitlement,
	access: { lifecycle: 'ACTIVE' as const }
}
const template = {
	key: 'appointment-services',
	version: 1,
	name: 'Услуги по записи',
	description: 'Приём заявок, подтверждение визита и оказание услуги.',
	industryTags: ['services'],
	isBlank: false,
	stages: [
		{ key: 'new', name: 'Новая запись', order: 1, state: 'OPEN' as const },
		{
			key: 'won',
			name: 'Услуга оказана',
			order: 2,
			state: 'WON' as const
		},
		{
			key: 'lost',
			name: 'Запись отменена',
			order: 3,
			state: 'LOST' as const
		}
	]
}
const catalog = {
	schemaVersion: 1 as const,
	catalogRevision: 1,
	templates: [template]
}
const templateRadioName = `${template.name} Версия ${template.version}`
const installationResponse = {
	schemaVersion: 1 as const,
	installation: {
		commandId: '55555555-5555-4555-8555-555555555555',
		workspaceId,
		pipelineId: '66666666-6666-4666-8666-666666666666',
		templateKey: template.key,
		templateVersion: template.version,
		templateFingerprint: 'a'.repeat(64)
	},
	access: activeAccess
}

let queryClient: QueryClient

const Wrapper = ({ children }: PropsWithChildren) => (
	<QueryClientProvider client={queryClient}>
		{children}
	</QueryClientProvider>
)

const WorkspacePermissions = () => {
	const { state, canWrite, canExport } = useCrmWorkspaceAccess()
	return (
		<div>
			<span>{state} workspace content</span>
			<button disabled={!canWrite}>Сохранить</button>
			<button disabled={!canExport}>Экспорт</button>
		</div>
	)
}

describe('AccessGate', () => {
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
		queryClient = new QueryClient({
			defaultOptions: {
				queries: { retry: false },
				mutations: { retry: false }
			}
		})
		useSessionStore.setState({
			status: 'authenticated',
			session: { accessToken: 'token', userId: 'user-1' },
			errorMessage: null,
			sessionRevision: 1
		})
	})

	afterEach(() => {
		cleanup()
		Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
		Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
		queryClient.clear()
	})

	it('renders confirmed ACTIVE content', async () => {
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

	it.each(['ACTIVE', 'GRACE'] as const)(
		'opens a writable %s workspace',
		async state => {
			vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
				...activeAccess,
				state,
				entitlementStatus: state
			})
			render(
				<AccessGate>
					<WorkspacePermissions />
				</AccessGate>,
				{ wrapper: Wrapper }
			)
			expect(
				await screen.findByText(`${state} workspace content`)
			).toBeTruthy()
			expect(
				screen.getByRole('button', { name: 'Сохранить' })
			).toHaveProperty('disabled', false)
			expect(
				screen.getByRole('button', { name: 'Экспорт' })
			).toHaveProperty('disabled', false)
			expect(activateCrmTrial).not.toHaveBeenCalled()
		}
	)

	it('opens read-only data and owner export while disabling mutations', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...activeAccess,
			state: 'READ_ONLY',
			entitlementStatus: 'READ_ONLY'
		})
		render(
			<AccessGate>
				<WorkspacePermissions />
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(
			await screen.findByText('READ_ONLY workspace content')
		).toBeTruthy()
		expect(
			screen.getByRole('button', { name: 'Сохранить' })
		).toHaveProperty('disabled', true)
		expect(screen.getByRole('button', { name: 'Экспорт' })).toHaveProperty(
			'disabled',
			false
		)
	})

	it('shows the GRACE deadline while keeping the workspace available', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...activeAccess,
			state: 'GRACE',
			entitlementStatus: 'GRACE'
		})
		render(
			<AccessGate>
				<CrmAppShell>
					<div>workspace data</div>
				</CrmAppShell>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(
			await screen.findByText('Дополнительные 3 дня доступа')
		).toBeTruthy()
		expect(screen.getByText('workspace data')).toBeTruthy()
		expect(document.querySelector('time')?.dateTime).toBe(
			entitlement.graceUntil
		)
	})

	it('shows a persistent read-only notice without hiding workspace data', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...activeAccess,
			state: 'READ_ONLY',
			entitlementStatus: 'READ_ONLY'
		})
		render(
			<AccessGate>
				<CrmAppShell>
					<div>workspace data</div>
				</CrmAppShell>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(
			await screen.findByText('WinCRM доступна только для чтения')
		).toBeTruthy()
		expect(screen.getByText('workspace data')).toBeTruthy()
	})

	it('does not infer export rights for a workspace member', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...activeAccess,
			membership: { membershipId, role: 'MEMBER' },
			workspaces: [{ workspaceId, membershipId, role: 'MEMBER' }]
		})
		render(
			<AccessGate>
				<WorkspacePermissions />
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		await screen.findByText('ACTIVE workspace content')
		expect(screen.getByRole('button', { name: 'Экспорт' })).toHaveProperty(
			'disabled',
			true
		)
	})

	it('keeps GRACE onboarding available without automatically installing a template', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...onboardingAccess,
			entitlementStatus: 'GRACE'
		})
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(await screen.findByText('Настройка WinCRM')).toBeTruthy()
		expect(screen.queryByText('hidden')).toBeNull()
		expect(activateCrmTrial).not.toHaveBeenCalled()
		expect(installCrmTemplate).not.toHaveBeenCalled()
	})

	it('keeps unfinished read-only onboarding closed', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...onboardingAccess,
			state: 'READ_ONLY',
			entitlementStatus: 'READ_ONLY'
		})
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(
			await screen.findByText('Доступ только для чтения')
		).toBeTruthy()
		expect(screen.queryByText('hidden')).toBeNull()
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

	it.each(['ACTIVE', 'GRACE', 'READ_ONLY'] as const)(
		'closes cached %s content when background access validation fails',
		async state => {
			const resolvedAccess = {
				...activeAccess,
				state,
				entitlementStatus: state
			}
			vi.mocked(getCrmAccessBootstrap)
				.mockResolvedValueOnce(resolvedAccess)
				.mockRejectedValueOnce(new Error('access unavailable'))
				.mockResolvedValueOnce(resolvedAccess)
			render(
				<AccessGate>
					<div>workspace content</div>
				</AccessGate>,
				{ wrapper: Wrapper }
			)
			expect(await screen.findByText('workspace content')).toBeTruthy()

			act(() => {
				void queryClient.invalidateQueries({
					queryKey: crmAccessQueryKey('user-1', 1)
				})
			})

			expect(
				await screen.findByRole('heading', {
					name: 'CRM временно недоступна'
				})
			).toBeTruthy()
			expect(screen.queryByText('workspace content')).toBeNull()
			fireEvent.click(screen.getByRole('button', { name: 'Повторить' }))
			expect(await screen.findByText('workspace content')).toBeTruthy()
		}
	)

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

	it('revalidates access and disables Trial after a forbidden response', async () => {
		const notActivated = {
			...base,
			state: 'NOT_ACTIVATED' as const,
			entitlementStatus: 'NOT_ACTIVATED' as const,
			entitlement: null,
			access: null
		}
		vi.mocked(getCrmAccessBootstrap)
			.mockResolvedValueOnce(notActivated)
			.mockResolvedValueOnce({
				...notActivated,
				membership: { membershipId, role: 'MEMBER' },
				workspaces: [{ workspaceId, membershipId, role: 'MEMBER' }]
			})
		vi.mocked(activateCrmTrial).mockRejectedValue(
			new AuthenticatedApiError('forbidden', 'role changed')
		)
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

		await waitFor(() =>
			expect(getCrmAccessBootstrap).toHaveBeenCalledTimes(2)
		)
		expect(
			screen.getByRole('button', {
				name: 'Повторить запуск бесплатных 5 дней'
			})
		).toHaveProperty('disabled', true)
	})

	it('keeps workspace closed and exposes an accessible catalog without automatic installation', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue(onboardingAccess)
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)
		expect(await screen.findByText('Настройка WinCRM')).toBeTruthy()
		expect(getPipelineTemplates).toHaveBeenCalledWith('token')
		expect(screen.queryByText('hidden')).toBeNull()
		expect(
			screen.getByRole('group', { name: 'Выберите бизнес-процесс' })
		).toBeTruthy()
		const radio = screen.getByRole('radio', { name: templateRadioName })
		expect(radio).toHaveProperty('checked', false)
		expect(
			screen.getByRole('button', { name: 'Выберите шаблон' })
		).toHaveProperty('disabled', true)
		expect(installCrmTemplate).not.toHaveBeenCalled()
	})

	it('installs the selected exact revision and opens only confirmed active access', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue(onboardingAccess)
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		vi.mocked(installCrmTemplate).mockImplementation(
			async (_token, command) => ({
				...installationResponse,
				installation: {
					...installationResponse.installation,
					commandId: command.commandId
				}
			})
		)
		render(
			<AccessGate>
				<div>workspace content</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)

		fireEvent.click(
			await screen.findByRole('radio', { name: templateRadioName })
		)
		fireEvent.click(
			screen.getByRole('button', {
				name: `Создать воронку «${template.name}»`
			})
		)

		await waitFor(() =>
			expect(installCrmTemplate).toHaveBeenCalledTimes(1)
		)
		const command = vi.mocked(installCrmTemplate).mock.calls[0][1]
		expect(command).toMatchObject({
			workspaceId,
			templateKey: template.key,
			templateVersion: template.version
		})
		expect(command.commandId).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
		)
		expect(await screen.findByText('workspace content')).toBeTruthy()
		expect(toast.loading).toHaveBeenCalledWith(
			`Создаём воронку «${template.name}»`
		)
		expect(toast.success).toHaveBeenCalledWith(
			`Воронка «${template.name}» создана`,
			{ id: 'install-toast' }
		)
	})

	it('keeps selection frozen and reuses the command id after an unknown result', async () => {
		let finishAccessRevalidation: (() => void) | undefined
		vi.mocked(getCrmAccessBootstrap)
			.mockResolvedValueOnce(onboardingAccess)
			.mockImplementationOnce(
				() =>
					new Promise(resolve => {
						finishAccessRevalidation = () => resolve(onboardingAccess)
					})
			)
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		vi.mocked(installCrmTemplate).mockRejectedValue(
			new AuthenticatedApiError('temporary', 'network')
		)
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)

		const radio = await screen.findByRole('radio', {
			name: templateRadioName
		})
		fireEvent.click(radio)
		fireEvent.click(
			screen.getByRole('button', {
				name: `Создать воронку «${template.name}»`
			})
		)

		const alert = await screen.findByRole('alert')
		expect(alert).toHaveProperty(
			'textContent',
			expect.stringContaining('Безопасно повторите запрос')
		)
		expect(document.activeElement).toBe(alert)
		expect(radio).toHaveProperty('disabled', true)
		const firstCommand = vi.mocked(installCrmTemplate).mock.calls[0][1]
		act(() => {
			queryClient.setQueryData(
				pipelineTemplatesQueryKey('user-1', workspaceId),
				{ ...catalog, catalogRevision: 2, templates: [] }
			)
		})
		await waitFor(() =>
			expect(
				screen.queryByRole('radio', { name: templateRadioName })
			).toBeNull()
		)
		expect(
			screen.getByRole('button', {
				name: 'Безопасно повторить установку'
			})
		).toHaveProperty('disabled', false)
		act(() => {
			void queryClient.invalidateQueries({
				queryKey: crmAccessQueryKey('user-1', 1)
			})
		})
		await waitFor(() =>
			expect(getCrmAccessBootstrap).toHaveBeenCalledTimes(2)
		)
		expect(
			screen.getByRole('button', {
				name: 'Безопасно повторить установку'
			})
		).toHaveProperty('disabled', true)
		expect(
			screen.getByText('Проверяем актуальное состояние доступа.')
		).toBeTruthy()
		act(() => finishAccessRevalidation?.())
		await waitFor(() =>
			expect(
				screen.getByRole('button', {
					name: 'Безопасно повторить установку'
				})
			).toHaveProperty('disabled', false)
		)
		fireEvent.click(
			screen.getByRole('button', {
				name: 'Безопасно повторить установку'
			})
		)

		await waitFor(() =>
			expect(installCrmTemplate).toHaveBeenCalledTimes(2)
		)
		expect(vi.mocked(installCrmTemplate).mock.calls[1][1]).toEqual(
			firstCommand
		)
		expect(screen.queryByText('hidden')).toBeNull()
	})

	it('keeps onboarding locked after failed access revalidation and preserves the safe retry', async () => {
		vi.mocked(getCrmAccessBootstrap)
			.mockResolvedValueOnce(onboardingAccess)
			.mockRejectedValueOnce(new Error('access unavailable'))
			.mockResolvedValueOnce(onboardingAccess)
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		vi.mocked(installCrmTemplate).mockRejectedValue(
			new AuthenticatedApiError('temporary', 'network')
		)
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)

		fireEvent.click(
			await screen.findByRole('radio', { name: templateRadioName })
		)
		fireEvent.click(
			screen.getByRole('button', {
				name: `Создать воронку «${template.name}»`
			})
		)
		await screen.findByRole('button', {
			name: 'Безопасно повторить установку'
		})
		const originalCommand = vi.mocked(installCrmTemplate).mock.calls[0][1]

		act(() => {
			void queryClient.invalidateQueries({
				queryKey: crmAccessQueryKey('user-1', 1)
			})
		})
		expect(
			await screen.findByRole('heading', {
				name: 'Не удалось подтвердить доступ'
			})
		).toBeTruthy()
		expect(
			screen.queryByRole('button', {
				name: 'Безопасно повторить установку'
			})
		).toBeNull()

		fireEvent.click(
			screen.getByRole('button', { name: 'Повторить проверку' })
		)
		fireEvent.click(
			await screen.findByRole('button', {
				name: 'Безопасно повторить установку'
			})
		)
		await waitFor(() =>
			expect(installCrmTemplate).toHaveBeenCalledTimes(2)
		)
		expect(vi.mocked(installCrmTemplate).mock.calls[1][1]).toEqual(
			originalCommand
		)
	})

	it('blocks duplicate submits while the installation is pending', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue(onboardingAccess)
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		let finishInstallation: (() => void) | undefined
		vi.mocked(installCrmTemplate).mockImplementation(
			(_token, command) =>
				new Promise(resolve => {
					finishInstallation = () =>
						resolve({
							...installationResponse,
							installation: {
								...installationResponse.installation,
								commandId: command.commandId
							}
						})
				})
		)
		render(
			<AccessGate>
				<div>workspace content</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)

		fireEvent.click(
			await screen.findByRole('radio', { name: templateRadioName })
		)
		const install = screen.getByRole('button', {
			name: `Создать воронку «${template.name}»`
		})
		fireEvent.click(install)
		const pending = await screen.findByRole('button', {
			name: 'Создаём воронку…'
		})
		expect(pending).toHaveProperty('disabled', true)
		expect(pending.getAttribute('aria-busy')).toBe('true')
		fireEvent.click(pending)
		expect(installCrmTemplate).toHaveBeenCalledTimes(1)

		act(() => finishInstallation?.())
		expect(await screen.findByText('workspace content')).toBeTruthy()
	})

	it('allows only the workspace owner to choose and install a template', async () => {
		vi.mocked(getCrmAccessBootstrap).mockResolvedValue({
			...onboardingAccess,
			membership: { membershipId, role: 'MEMBER' },
			workspaces: [{ workspaceId, membershipId, role: 'MEMBER' }]
		})
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		render(
			<AccessGate>
				<div>hidden</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)

		expect(
			await screen.findByText(
				'Завершить настройку может только владелец рабочего пространства.'
			)
		).toBeTruthy()
		expect(
			screen.getByRole('radio', { name: templateRadioName })
		).toHaveProperty('disabled', true)
		expect(
			screen.getByRole('button', { name: 'Требуются права владельца' })
		).toHaveProperty('disabled', true)
		expect(installCrmTemplate).not.toHaveBeenCalled()
	})

	it('does not blindly retry a conflict and revalidates active access', async () => {
		vi.mocked(getCrmAccessBootstrap)
			.mockResolvedValueOnce(onboardingAccess)
			.mockResolvedValueOnce(activeAccess)
		vi.mocked(getPipelineTemplates).mockResolvedValue(catalog)
		vi.mocked(installCrmTemplate).mockRejectedValue(
			new AuthenticatedApiError('conflict', 'already installed')
		)
		render(
			<AccessGate>
				<div>workspace content</div>
			</AccessGate>,
			{ wrapper: Wrapper }
		)

		fireEvent.click(
			await screen.findByRole('radio', { name: templateRadioName })
		)
		fireEvent.click(
			screen.getByRole('button', {
				name: `Создать воронку «${template.name}»`
			})
		)

		expect(await screen.findByText('workspace content')).toBeTruthy()
		expect(installCrmTemplate).toHaveBeenCalledTimes(1)
		expect(getCrmAccessBootstrap).toHaveBeenCalledTimes(2)
		expect(toast.error).toHaveBeenCalledWith(
			'Настройка WinCRM уже изменилась',
			{ id: 'install-toast' }
		)
	})
})
