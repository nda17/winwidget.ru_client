'use client'

import {
	useMutation,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import type { PropsWithChildren } from 'react'
import { useEffect, useRef, useState } from 'react'
import toast from 'react-hot-toast'

import type { CrmResolvedAccessResponse } from '@/entities/crm-access'
import { useSessionStore } from '@/entities/session'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import { Button, ScreenState, SelectField } from '@/shared/ui'

import {
	activateCrmTrial,
	getCrmAccessBootstrap,
	getPipelineTemplates
} from '../api/crm-access.api'
import {
	crmAccessQueryKey,
	pipelineTemplatesQueryKey
} from '../model/crm-access.queries'
import styles from './AccessGate.module.scss'

const RetryState = ({ onRetry }: { onRetry: () => void }) => (
	<ScreenState
		variant="error"
		title="CRM временно недоступна"
		description="Не удалось безопасно подтвердить доступ. Рабочая область останется закрыта."
		action={<Button onClick={onRetry}>Повторить</Button>}
	/>
)

const Onboarding = ({ access }: { access: CrmResolvedAccessResponse }) => {
	const session = useSessionStore(state => state.session)
	const setAnonymous = useSessionStore(state => state.setAnonymous)
	const templates = useQuery({
		queryKey: pipelineTemplatesQueryKey(
			session?.userId ?? '',
			access.selectedWorkspaceId
		),
		queryFn: () => getPipelineTemplates(session!.accessToken),
		enabled: Boolean(session),
		retry: false
	})

	useEffect(() => {
		if (
			templates.error instanceof AuthenticatedApiError &&
			templates.error.kind === 'unauthorized'
		)
			setAnonymous()
	}, [setAnonymous, templates.error])

	if (templates.isPending)
		return <ScreenState variant="loading" title="Загружаем шаблоны CRM" />
	if (templates.isError)
		return (
			<RetryState
				onRetry={() => {
					toast('Повторяем загрузку каталога')
					void templates.refetch()
				}}
			/>
		)

	return (
		<div className={styles.panel}>
			<h1>Настройка WinCRM</h1>
			<p>
				Выберите подходящий процесс после появления серверного контракта
				установки. Сейчас каталог доступен только для просмотра.
			</p>
			<div className={styles.catalog}>
				{templates.data.templates.map(template => (
					<article
						className={styles.card}
						key={`${template.key}:${template.version}`}
					>
						<h2 className={styles.cardTitle}>{template.name}</h2>
						<p className={styles.version}>Версия {template.version}</p>
						<p className={styles.description}>{template.description}</p>
						<div className={styles.tags}>
							{template.industryTags.map(tag => (
								<span className={styles.tag} key={tag}>
									{tag}
								</span>
							))}
						</div>
						<p className={styles.stages}>
							Этапы: {template.stages.map(stage => stage.name).join(' → ')}
						</p>
					</article>
				))}
			</div>
			<p className={styles.note}>
				Установка шаблона пока недоступна: выбор не сохраняется и рабочая
				область остаётся закрыта.
			</p>
		</div>
	)
}

const blockedCopy = {
	GRACE: [
		'Доступ в льготном периоде',
		'Коммерческая политика для этого состояния ещё не зафиксирована. Рабочая область закрыта.'
	],
	READ_ONLY: [
		'Доступ только для чтения',
		'Рабочая область закрыта до согласования разрешённых read-only сценариев.'
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
					error.kind === 'conflict'
				)
					commandIdRef.current = undefined
				toast.error('Не удалось запустить бесплатный период')
			}
		}
	})

	if (!session || access.isPending || access.isFetching)
		return (
			<div className={styles.gate}>
				<ScreenState variant="loading" title="Проверяем доступ к WinCRM" />
			</div>
		)
	if (access.isError)
		return (
			<div className={styles.gate}>
				<RetryState
					onRetry={() => {
						toast('Повторяем проверку доступа')
						void access.refetch()
					}}
				/>
			</div>
		)

	const data = access.data
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
						<Button type="submit">Продолжить</Button>
					</form>
				</div>
			</div>
		)
	}

	if (data.state === 'ACTIVE') return children
	if (data.state === 'ONBOARDING')
		return (
			<div className={styles.gate}>
				<Onboarding access={data} />
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
							disabled={data.membership.role !== 'OWNER'}
							isLoading={trial.isPending}
							onClick={() => {
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

	const copy = blockedCopy[data.state]
	return (
		<div className={styles.gate}>
			<ScreenState
				variant="permission"
				title={copy[0]}
				description={copy[1]}
				action={
					<Button
						variant="secondary"
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
