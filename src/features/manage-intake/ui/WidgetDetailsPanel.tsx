'use client'

import {
	crmPermissionScope,
	type CrmPermissions
} from '@/entities/crm-access'
import {
	getWidgetEntryDetails,
	widgetTypeLabels,
	type InboxEntry,
	type WidgetLeadSnapshot
} from '@/entities/intake'
import {
	useSessionStore,
	type AuthenticatedSession
} from '@/entities/session'
import { Button, ScreenState } from '@/shared/ui'
import {
	CancelledError,
	useQuery,
	useQueryClient
} from '@tanstack/react-query'
import { useLayoutEffect, useRef } from 'react'
import toast from 'react-hot-toast'
import type { IntakeAccess } from '../model/use-intake-access'
import styles from './WidgetDetailsPanel.module.scss'

export const WidgetDetailsPanel = ({
	access,
	entry
}: {
	access: IntakeAccess
	entry: Extract<InboxEntry, { origin: 'WIDGET' }>
}) => {
	const owner = useSessionStore()
	const permissions = access.permissions.data
	if (
		!access.canRead ||
		!access.session ||
		owner.status !== 'authenticated' ||
		owner.session?.userId !== access.session.userId ||
		owner.session.accessToken !== access.session.accessToken ||
		owner.sessionRevision !== access.revision ||
		!access.permissions.isSuccess ||
		access.permissions.isFetching ||
		permissions?.subject !== owner.session.userId ||
		permissions.workspaceId !== entry.workspaceId ||
		entry.workspaceId !== access.workspaceId
	)
		return null
	return (
		<WidgetDetails
			key={JSON.stringify([
				entry.workspaceId,
				entry.id,
				entry.sourceId,
				owner.session.userId,
				access.revision,
				access.scopeKey,
				permissions.state
			])}
			workspaceId={entry.workspaceId}
			entryId={entry.id}
			sourceId={entry.sourceId}
			session={owner.session}
			revision={access.revision}
			scope={access.scopeKey}
			accessState={permissions.state}
			online={access.online}
		/>
	)
}

function WidgetDetails({
	workspaceId,
	entryId,
	sourceId,
	session,
	revision,
	scope,
	accessState,
	online
}: {
	workspaceId: string
	entryId: string
	sourceId: string
	session: AuthenticatedSession
	revision: number
	scope: string
	accessState: CrmPermissions['state']
	online: boolean
}) {
	const client = useQueryClient()
	const mounted = useRef(false)
	useLayoutEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
		}
	}, [])
	const current = () => {
		const owner = useSessionStore.getState()
		const confirmed = client.getQueryState<CrmPermissions>([
			'crm-permissions',
			workspaceId,
			session.userId,
			revision
		])
		return (
			mounted.current &&
			owner.status === 'authenticated' &&
			owner.session?.userId === session.userId &&
			owner.session.accessToken === session.accessToken &&
			owner.sessionRevision === revision &&
			confirmed?.status === 'success' &&
			confirmed.fetchStatus === 'idle' &&
			confirmed.data?.subject === session.userId &&
			confirmed.data.workspaceId === workspaceId &&
			confirmed.data.state === accessState &&
			crmPermissionScope(confirmed.data) === scope &&
			confirmed.data.permissions.includes('intake:read')
		)
	}
	const query = useQuery({
		queryKey: [
			'crm-intake-widget-details',
			workspaceId,
			session.userId,
			revision,
			scope,
			accessState,
			entryId,
			sourceId
		],
		queryFn: async ({ signal }) => {
			const guard = () => {
				if (signal.aborted || !current()) throw new CancelledError()
			}
			guard()
			try {
				const details = await getWidgetEntryDetails(
					session.accessToken,
					workspaceId,
					entryId,
					sourceId
				)
				guard()
				return details
			} catch (error) {
				guard()
				throw error
			}
		},
		retry: false,
		gcTime: 0,
		staleTime: 0,
		refetchOnWindowFocus: false,
		refetchOnReconnect: 'always'
	})
	const refresh = async () => {
		if (!current() || !online || !navigator.onLine || query.isFetching)
			return
		const result = await query.refetch()
		if (!current()) return
		if (result.isError || !result.data)
			toast.error('Не удалось загрузить данные виджета')
		else toast.success('Данные виджета загружены')
	}
	const payload =
		!query.isError && !query.isFetching ? query.data?.payload : undefined
	return (
		<section className={styles.panel} aria-label="Данные виджета">
			<div className={styles.header}>
				<div>
					<h3>Данные виджета</h3>
					<p>
						Снимок на момент заявки. Исходные данные не меняются при
						принятии в работу.
					</p>
				</div>
				<Button
					variant="secondary"
					size="sm"
					disabled={!online || query.isFetching}
					onClick={() => void refresh()}
				>
					{query.isError
						? 'Повторить загрузку данных'
						: 'Обновить данные виджета'}
				</Button>
			</div>
			{!online ? (
				<p className={styles.notice} role="status">
					Нет подключения к сети. Обновление доступно после восстановления
					связи.
				</p>
			) : null}
			{query.isError ? (
				<ScreenState
					compact
					variant="error"
					title="Данные виджета пока недоступны"
					description="Не удалось проверить подробности обращения. Основная карточка и история доступны отдельно."
				/>
			) : !payload ? (
				<ScreenState
					compact
					variant="loading"
					title="Загружаем данные виджета"
				/>
			) : (
				<SnapshotDetails payload={payload} />
			)}
		</section>
	)
}

function SnapshotDetails({ payload }: { payload: WidgetLeadSnapshot }) {
	const { widget, lead, details } = payload
	return (
		<>
			<div className={styles.source}>
				<span className={styles.badge}>
					{widgetTypeLabels[widget.type]}
				</span>
				<strong>{widget.name || 'Название виджета не передано'}</strong>
				<span>Опубликованная версия {widget.publishedVersion}</span>
			</div>
			<dl className={styles.fields}>
				{[
					[
						'Создано в виджете',
						new Date(lead.createdAt).toLocaleString('ru-RU')
					],
					[
						'Имя в источнике',
						lead.contactName?.trim() ? lead.contactName : 'Имя не передано'
					],
					['Исходный контакт', lead.contactRaw ?? 'Не передан'],
					['Исходный телефон', lead.phoneRaw ?? 'Не передан'],
					['Телефон в формате E.164', lead.phoneE164 ?? 'Не определён'],
					['Email в источнике', lead.email ?? 'Не передан'],
					['Страница заявки', lead.pageUrl ?? 'Не передана']
				].map(([label, value]) => (
					<div key={label}>
						<dt>{label}</dt>
						<dd>{value}</dd>
					</div>
				))}
			</dl>
			{lead.redactions.length ? (
				<p className={styles.notice}>
					Адрес страницы очищен от служебных данных:{' '}
					{lead.redactions
						.map(
							item =>
								({
									URL_USERINFO_REMOVED: 'данные авторизации удалены',
									URL_QUERY_REMOVED: 'параметры удалены',
									URL_FRAGMENT_REMOVED: 'фрагмент удалён',
									URL_REJECTED: 'адрес не сохранён'
								})[item]
						)
						.join('; ')}
					.
				</p>
			) : null}
			{details.type === 'WHEEL' ? (
				<dl className={styles.fields}>
					<div>
						<dt>Бонус</dt>
						<dd>{details.bonus ?? 'Не передан'}</dd>
					</div>
				</dl>
			) : null}
			{details.type === 'CALLBACK' ? (
				<dl className={styles.fields}>
					<div>
						<dt>Время звонка</dt>
						<dd>{details.timeSlot ?? 'Не выбрано'}</dd>
					</div>
					<div>
						<dt>Часовой пояс</dt>
						<dd>{details.timezone ?? 'Не передан'}</dd>
					</div>
				</dl>
			) : null}
			{details.type === 'QUIZ' ? (
				<>
					<dl className={styles.fields}>
						<div>
							<dt>Результат квиза</dt>
							<dd>{details.result ?? 'Не передан'}</dd>
						</div>
					</dl>
					<h4>Ответы на вопросы</h4>
					{details.answers.length ? (
						<ol className={styles.answers}>
							{details.answers.map((answer, index) => (
								<li key={answer.questionId}>
									<strong>
										{answer.questionText ||
											`Вопрос ${index + 1}: подпись не передана`}
									</strong>
									{answer.options.length ? (
										<ul>
											{answer.options.map(option => (
												<li key={option.id}>
													{option.text || 'Подпись ответа не передана'}
												</li>
											))}
										</ul>
									) : (
										<p>Варианты не выбраны</p>
									)}
								</li>
							))}
						</ol>
					) : (
						<p className={styles.notice}>Ответы не переданы.</p>
					)}
				</>
			) : null}
			{details.type === 'CALCULATOR' ? (
				<>
					<dl className={styles.fields}>
						<div>
							<dt>Расчёт виджета</dt>
							<dd className={styles.amount}>
								{details.calculatedPrice} {details.currency}
							</dd>
						</div>
					</dl>
					<p className={styles.notice}>
						Расчёт сохранён как исходная информация. Он не задаёт сумму
						сделки и не является предложением к оплате.
					</p>
					<h4>Параметры расчёта</h4>
					{details.answers.length ? (
						<ol className={styles.answers}>
							{details.answers.map(answer => (
								<li key={answer.fieldId}>
									<strong>
										{answer.fieldLabel || 'Подпись поля не передана'}
									</strong>
									<p>
										{answer.valueLabel || 'Подпись значения не передана'}
									</p>
									<span className={styles.raw}>
										Значение:{' '}
										{Array.isArray(answer.value)
											? answer.value.join(', ') || 'Не выбрано'
											: String(answer.value)}
									</span>
								</li>
							))}
						</ol>
					) : (
						<p className={styles.notice}>Параметры не переданы.</p>
					)}
				</>
			) : null}
		</>
	)
}
