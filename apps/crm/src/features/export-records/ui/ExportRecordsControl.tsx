'use client'

import {
	crmPermissionScope,
	getCrmPermissions,
	useCrmPermissions,
	useCrmWorkspaceAccess,
	type CrmPermissions
} from '@/entities/crm-access'
import { useSessionStore } from '@/entities/session'
import {
	AuthenticatedApiError,
	invalidContractError
} from '@/shared/api/authenticated-http-client'
import type { DownloadFormat } from '@/shared/api/authenticated-download'
import { downloadFile } from '@/shared/lib/download-file'
import { Button, Drawer, SelectField } from '@/shared/ui'
import { useQueryClient } from '@tanstack/react-query'
import {
	useLayoutEffect,
	useRef,
	useState,
	useSyncExternalStore
} from 'react'
import toast from 'react-hot-toast'
import { prepareRecordExport } from '../api/export.api'
import { exportNames, type ExportEntity } from '../model/export.contract'
import styles from './ExportRecordsControl.module.scss'

const subscribe = (notify: () => void) => {
	window.addEventListener('online', notify)
	window.addEventListener('offline', notify)
	return () => {
		window.removeEventListener('online', notify)
		window.removeEventListener('offline', notify)
	}
}
const permissionPrefix = (entity: ExportEntity) =>
	entity === 'contacts' || entity === 'companies'
		? 'customers'
		: entity === 'inbox'
			? 'intake'
			: 'sales'
const permitted = (
	data: CrmPermissions | undefined,
	entity: ExportEntity,
	subject?: string
) =>
	!!data &&
	data.subject === subject &&
	data.role === 'OWNER' &&
	['ACTIVE', 'GRACE', 'READ_ONLY'].includes(data.state) &&
	data.permissions.includes(`${permissionPrefix(entity)}:read`) &&
	data.permissions.includes(`${permissionPrefix(entity)}:export`)

export const ExportRecordsControl = ({
	entity,
	disabled = false
}: {
	entity: ExportEntity
	disabled?: boolean
}) => {
	const workspace = useCrmWorkspaceAccess()
	const { session, sessionRevision } = useSessionStore()
	const permissions = useCrmPermissions(
		workspace.workspaceId,
		session,
		sessionRevision
	)
	const scopeKey = crmPermissionScope(permissions.data)
	const online = useSyncExternalStore(
		subscribe,
		() => navigator.onLine,
		() => true
	)
	const available =
		!disabled &&
		online &&
		permissions.isSuccess &&
		!permissions.isFetching &&
		permitted(permissions.data, entity, session?.userId)
	return (
		<ExportPanel
			key={JSON.stringify([
				workspace.workspaceId,
				session?.userId,
				sessionRevision,
				scopeKey,
				entity
			])}
			entity={entity}
			workspaceId={workspace.workspaceId}
			session={session}
			revision={sessionRevision}
			scopeKey={scopeKey}
			available={available}
		/>
	)
}
const ExportPanel = ({
	entity,
	workspaceId,
	session,
	revision,
	scopeKey,
	available
}: {
	entity: ExportEntity
	workspaceId: string
	session: { userId: string; accessToken: string } | null
	revision: number
	scopeKey: string
	available: boolean
}) => {
	const client = useQueryClient()
	const [open, setOpen] = useState(false)
	const [format, setFormat] = useState<DownloadFormat>('json')
	const [loading, setLoading] = useState(false)
	const [error, setError] = useState<string | null>(null)
	const [completed, setCompleted] = useState<{
		rowCount: number
		snapshotAt: string
	} | null>(null)
	const mounted = useRef(false)
	const active = useRef<AbortController | null>(null)
	useLayoutEffect(() => {
		mounted.current = true
		return () => {
			mounted.current = false
			active.current?.abort()
			active.current = null
		}
	}, [])
	useLayoutEffect(() => {
		if (!available) active.current?.abort()
	}, [available])
	const current = (request: AbortController) => {
		const state = useSessionStore.getState()
		return (
			mounted.current &&
			active.current === request &&
			!request.signal.aborted &&
			state.status === 'authenticated' &&
			state.session?.userId === session?.userId &&
			state.session?.accessToken === session?.accessToken &&
			state.sessionRevision === revision
		)
	}
	const close = () => {
		active.current?.abort()
		active.current = null
		setOpen(false)
		setLoading(false)
		setError(null)
		setCompleted(null)
		toast(
			loading ? 'Подготовка выгрузки отменена' : 'Панель экспорта закрыта'
		)
	}
	const authorize = async (request: AbortController) => {
		if (!session || !current(request) || !navigator.onLine)
			throw invalidContractError()
		const fresh = await getCrmPermissions(session.accessToken, workspaceId)
		if (
			!current(request) ||
			fresh.subject !== session.userId ||
			fresh.workspaceId !== workspaceId
		)
			throw invalidContractError()
		const key = ['crm-permissions', workspaceId, session.userId, revision]
		await client.cancelQueries({ queryKey: key, exact: true })
		if (!current(request)) throw invalidContractError()
		client.setQueryData(key, fresh)
		if (
			!permitted(fresh, entity, session.userId) ||
			crmPermissionScope(fresh) !== scopeKey
		)
			throw new AuthenticatedApiError(
				'forbidden',
				'Права изменились. Выгрузка не сохранена; доступ раздела обновлён.'
			)
	}
	const start = async () => {
		if (!available || !session || active.current || !navigator.onLine)
			return
		const request = new AbortController()
		active.current = request
		setLoading(true)
		setError(null)
		setCompleted(null)
		toast('Подготавливаем выгрузку выбранного раздела')
		try {
			await authorize(request)
			if (!current(request)) return
			const result = await prepareRecordExport(
				session.accessToken,
				entity,
				workspaceId,
				session.userId,
				format,
				request.signal
			)
			if (!current(request)) return
			await authorize(request)
			if (!current(request)) return
			downloadFile(
				result.bytes,
				result.metadata.filename,
				result.metadata.mediaType
			)
			setCompleted({
				rowCount: result.metadata.rowCount,
				snapshotAt: result.metadata.snapshotAt
			})
			toast.success(
				`Выгрузка проверена: ${result.metadata.rowCount} записей. Скачивание начато.`
			)
		} catch (cause) {
			if (!current(request)) return
			const message =
				cause instanceof AuthenticatedApiError
					? cause.message
					: 'Не удалось безопасно подготовить файл. Повторите экспорт.'
			setError(message)
			toast.error(message)
		} finally {
			if (mounted.current && active.current === request) {
				active.current = null
				setLoading(false)
			}
		}
	}
	return (
		<>
			<Button
				variant="secondary"
				disabled={!available}
				title={
					available
						? `Экспорт ${exportNames[entity]}`
						: 'Экспорт доступен только владельцу с подтверждёнными правами'
				}
				onClick={() => {
					setOpen(true)
					toast('Выберите формат выгрузки')
				}}
			>
				Экспорт
			</Button>
			{open ? (
				<Drawer
					isOpen
					onClose={close}
					title={`Экспорт ${exportNames[entity]}`}
					description="Полная выгрузка выбранного раздела рабочего пространства; текущие фильтры списка не применяются."
				>
					<div className={styles.content}>
						<p className={styles.notice}>
							Выгружаются все записи, включая архивные; для задач — все
							статусы. До 10 000 записей и 16 МиБ. При превышении лимита
							частичный файл не создаётся.
						</p>
						<p className={styles.note}>
							Экспорт доступен владельцу, в том числе в режиме чтения.
							Разные разделы выгружаются независимо, это не единая
							резервная копия всех сервисов.
						</p>
						<SelectField
							label="Формат файла"
							value={format}
							disabled={loading || !available}
							onChange={event =>
								setFormat(event.target.value as DownloadFormat)
							}
						>
							<option value="json">JSON — структурированные данные</option>
							<option value="csv">CSV — для электронных таблиц</option>
						</SelectField>
						{format === 'csv' ? (
							<p className={styles.note}>
								CSV защищён от исполнения формул. Некоторые значения
								экранированы; обратный импорт без преобразований не
								гарантируется.
							</p>
						) : null}
						{loading ? (
							<p role="status">Получаем и проверяем полный файл…</p>
						) : null}
						{!available ? (
							<p role="status">
								Право на скачивание сейчас не подтверждено.
							</p>
						) : null}
						{error ? (
							<p role="alert" className={styles.error}>
								{error}
							</p>
						) : null}
						{completed ? (
							<p role="status">
								Проверено записей: {completed.rowCount}. Состояние на{' '}
								{new Date(completed.snapshotAt).toLocaleString('ru-RU')}.
							</p>
						) : null}
						<div className={styles.actions}>
							<Button variant="secondary" onClick={close}>
								{loading ? 'Отменить' : 'Закрыть'}
							</Button>
							<Button
								disabled={!available || loading}
								isLoading={loading}
								onClick={() => void start()}
							>
								{error ? 'Повторить экспорт' : 'Скачать файл'}
							</Button>
						</div>
					</div>
				</Drawer>
			) : null}
		</>
	)
}
