'use client'

import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import {
	canOpenCrmWorkspace,
	CrmWorkspaceAccessProvider
} from '@/entities/crm-access'
import { useSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import { Button, ScreenState, SelectField } from '@/shared/ui'

import {
	activateCrmTrial,
	getCrmAccessBootstrap
} from '../api/crm-access.api'
import { crmAccessQueryKey } from '../model/crm-access.queries'
import styles from './AccessGate.module.scss'
import { CrmOnboarding } from './onboarding/CrmOnboarding'

const RetryState = ({
	onRetry,
	isRetrying = false
}: {
	onRetry: () => void
	isRetrying?: boolean
}) => (
	<ScreenState
		variant="error"
		title="CRM временно недоступна"
		description="Не удалось безопасно подтвердить доступ. Рабочая область останется закрыта."
		action={
			<Button onClick={onRetry} isLoading={isRetrying}>
				Повторить
			</Button>
		}
	/>
)

const blockedCopy = {
	GRACE: [
		'Настройка WinCRM не завершена',
		'Не удалось подтвердить готовность рабочего пространства. Обновите статус.'
	],
	READ_ONLY: [
		'Доступ только для чтения',
		'Период редактирования завершён до настройки CRM. Данные сохраняются; завершить настройку можно после продления доступа.'
	],
	EXPIRED: [
		'Доступ завершён',
		'Срок доступа закончился. Рабочая область закрыта.'
	],
	CANCELLED: ['Подписка отменена', 'Рабочая область закрыта.'],
	SUSPENDED: ['Доступ приостановлен', 'Рабочая область закрыта.']
} as const

export const AccessGate = ({ children }: PropsWithChildren) => {
	const session = useSessionStore(state => state.session)
	const sessionRevision = useSessionStore(state => state.sessionRevision)
	const setAnonymous = useSessionStore(state => state.setAnonymous)
	const queryClient = useQueryClient()
	const [workspaceId, setWorkspaceId] = useState<string>()
	const [choice, setChoice] = useState('')
	const commandIdRef = useRef<string | undefined>(undefined)
	const accessKey = crmAccessQueryKey(
		session?.userId ?? '',
		sessionRevision,
		workspaceId
	)
	const access = useQuery({
		queryKey: accessKey,
		queryFn: () =>
			getCrmAccessBootstrap(session!.accessToken, workspaceId),
		enabled: Boolean(session),
		retry: false
	})

	useEffect(() => {
		if (
			access.error instanceof AuthenticatedApiError &&
			access.error.kind === 'unauthorized'
		)
			setAnonymous()
	}, [access.error, setAnonymous])

	const trial = useMutation({
		mutationFn: (command: { workspaceId: string; commandId: string }) =>
			activateCrmTrial(session!.accessToken, command),
		onSuccess: result => {
			queryClient.setQueryData(accessKey, result)
			commandIdRef.current = undefined
			toast.success(
				result.activated
					? 'Бесплатный период на 5 дней запущен'
					: 'Доступ уже активирован'
			)
		},
		onError: error => {
			if (
				error instanceof AuthenticatedApiError &&
				error.kind === 'unauthorized'
			)
				setAnonymous()
			else {
				if (
					error instanceof AuthenticatedApiError &&
					(error.kind === 'conflict' || error.kind === 'forbidden')
				) {
					commandIdRef.current = undefined
					void access.refetch()
				}
				toast.error('Не удалось запустить бесплатный период')
			}
		}
	})

	if (!session || access.isPending)
		return (
			<div className={styles.gate}>
				<ScreenState variant="loading" title="Проверяем доступ к WinCRM" />
			</div>
		)
	if (access.isError && !access.data)
		return (
			<div className={styles.gate}>
				<RetryState
					isRetrying={access.isFetching}
					onRetry={() => {
						toast('Повторяем проверку доступа')
						void access.refetch()
					}}
				/>
			</div>
		)

	const data = access.data
	if (access.isError && data.state !== 'ONBOARDING')
		return (
			<div className={styles.gate}>
				<RetryState
					isRetrying={access.isFetching}
					onRetry={() => {
						toast('Повторяем проверку доступа')
						void access.refetch()
					}}
				/>
			</div>
		)
	if (data.state === 'WORKSPACE_SELECTION_REQUIRED') {
		const selected = choice || data.workspaces[0]?.workspaceId || ''
		return (
			<div className={styles.gate}>
				<div className={styles.panel}>
					<h1>Выберите рабочее пространство</h1>
					<form
						className={styles.form}
						onSubmit={event => {
							event.preventDefault()
							if (
								access.isFetching ||
								!data.workspaces.some(
									item => item.workspaceId === selected
								)
							)
								return
							toast('Проверяем доступ рабочего пространства')
							if (workspaceId === selected) void access.refetch()
							else setWorkspaceId(selected)
						}}
					>
						<SelectField
							label="Рабочее пространство"
							value={selected}
							onChange={event => setChoice(event.target.value)}
						>
							{data.workspaces.map(item => (
								<option value={item.workspaceId} key={item.workspaceId}>
									{item.workspaceId} · {item.role}
								</option>
							))}
						</SelectField>
						<Button type="submit" isLoading={access.isFetching}>
							Продолжить
						</Button>
					</form>
				</div>
			</div>
		)
	}

	if (canOpenCrmWorkspace(data))
		return access.isFetching ? (
			<div className={styles.gate}>
				<ScreenState
					variant="loading"
					title="Подтверждаем доступ к WinCRM"
				/>
			</div>
		) : (
			<CrmWorkspaceAccessProvider access={data}>
				{children}
			</CrmWorkspaceAccessProvider>
		)
	if (data.state === 'ONBOARDING')
		return (
			<div className={styles.gate}>
				<CrmOnboarding
					access={data}
					accessRevalidating={access.isFetching}
					accessValidationFailed={access.isError}
					onInstalled={result => {
						queryClient.setQueryData(accessKey, result.access)
					}}
					onRevalidateAccess={() => {
						void access.refetch()
					}}
				/>
			</div>
		)
	if (data.state === 'NOT_ACTIVATED')
		return (
			<div className={styles.gate}>
				<ScreenState
					variant="permission"
					title="WinCRM ещё не активирована"
					description={
						trial.isError
							? 'Запустить бесплатный период не удалось. Повторите запрос: будет использован тот же идентификатор команды.'
							: data.membership.role === 'OWNER'
								? 'Бесплатный период запускается только по вашему явному действию.'
								: 'Запустить бесплатный период может только владелец рабочего пространства.'
					}
					action={
						<Button
							disabled={
								data.membership.role !== 'OWNER' || access.isFetching
							}
							isLoading={trial.isPending || access.isFetching}
							onClick={() => {
								if (access.isFetching) return
								commandIdRef.current ??= crypto.randomUUID()
								trial.mutate({
									workspaceId: data.selectedWorkspaceId,
									commandId: commandIdRef.current
								})
							}}
						>
							{trial.isError
								? 'Повторить запуск бесплатных 5 дней'
								: 'Попробовать бесплатно 5 дней'}
						</Button>
					}
				/>
			</div>
		)

	const copy =
		data.state === 'ACTIVE'
			? [
					'Не удалось подтвердить готовность WinCRM',
					'Обновите состояние доступа.'
				]
			: blockedCopy[data.state]
	return (
		<div className={styles.gate}>
			<ScreenState
				variant="permission"
				title={copy[0]}
				description={copy[1]}
				action={
					<Button
						variant="secondary"
						isLoading={access.isFetching}
						onClick={() => {
							toast('Обновляем состояние доступа')
							void access.refetch()
						}}
					>
						Обновить статус
					</Button>
				}
			/>
		</div>
	)
}
