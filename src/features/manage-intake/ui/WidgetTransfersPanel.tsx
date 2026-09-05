'use client'

import {
	listWidgetTransfers,
	retryWidgetTransfer,
	type ManagedWidgetSource,
	type WidgetTransfer,
	type WidgetTransferReason,
	type WidgetTransferState,
	type WidgetTransferRetryCommand,
	type WidgetTransferCommandResult
} from '@/entities/widget-source'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import {
	commandOwner,
	usePendingCommand
} from '@/shared/lib/pending-command'
import { Button, Drawer, ScreenState, StatusBadge } from '@/shared/ui'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { IntakeAccess } from '../model/use-intake-access'
import { useIntakeCommand } from '../model/use-intake-command'
import { useWidgetSourceRead } from '../model/use-widget-source-read'
import styles from './WidgetTransfersPanel.module.scss'

const stateLabel: Record<WidgetTransferState, string> = {
	PROCESSING: 'Обрабатывается',
	RETRY_PENDING: 'Ожидает повтора',
	BLOCKED: 'Передача приостановлена',
	ERROR: 'Ошибка передачи',
	DELIVERED: 'В Inbox',
	SKIPPED: 'Пропущена'
}
const reasonLabel: Record<WidgetTransferReason, string> = {
	DELEGATION_REVOKED:
		'Права сотрудника, подключившего виджет, изменились.',
	OWNER_CHANGED: 'Владелец виджета изменился.',
	LOCAL_DISABLED: 'Подключение отключено в WinCRM.',
	GENERATION_CHANGED:
		'Заявка относится к предыдущему включению подключения.',
	PERIOD_EXPIRED: 'Исходный оплаченный период Widgets закончился.',
	BILLING_INELIGIBLE: 'Подписка Widgets больше не разрешает передачу.',
	BILLING_PERIOD_CHANGED:
		'Оплаченный период Widgets изменился; прежние заявки не переносятся.',
	CONNECTOR_DISABLED: 'Передача отключена в сервисе виджетов.',
	WIDGET_UNAVAILABLE: 'Виджет недоступен.',
	LEAD_UNAVAILABLE: 'Исходная заявка недоступна.',
	PAYLOAD_TOO_LARGE: 'Данные заявки превышают допустимый размер передачи.',
	PAYLOAD_SHAPE_UNSUPPORTED:
		'Формат данных заявки пока не поддерживается.',
	TEXT_UNSUPPORTED: 'Текст заявки не прошёл проверку безопасного формата.',
	SOURCE_PERIOD_INELIGIBLE:
		'На момент заявки не было подходящего оплаченного периода Widgets.',
	SOURCE_PERIOD_INVALID:
		'Исходный период подписки не удалось подтвердить.',
	BEFORE_ACTIVATION:
		'Заявка создана до включения подключения; история не переносится.',
	DEPENDENCY_UNAVAILABLE: 'Один из сервисов временно недоступен.',
	INVALID_RESPONSE: 'Сервис вернул неподтверждённый ответ.',
	CONTEXT_UNAVAILABLE:
		'Актуальные условия передачи не удалось подтвердить.'
}
const dateLabel = (value: string) =>
	new Date(value).toLocaleString('ru-RU')
interface Props {
	access: IntakeAccess
	source: ManagedWidgetSource
	onClose: () => void
}

export const WidgetTransfersPanel = ({
	access,
	source,
	onClose
}: Props) => {
	const [page, setPage] = useState(1)
	const [selected, setSelected] = useState<WidgetTransfer | null>(null)
	const bound = source.workspaceId === access.workspaceId
	const visible = bound && access.confirmed && access.sourceManager
	const query = useWidgetSourceRead(
		{ ...access, sourceManager: access.sourceManager && bound },
		['transfers', source.id, page],
		token =>
			listWidgetTransfers(token, access.workspaceId, source.id, page, 25)
	)
	const denied =
		query.error instanceof AuthenticatedApiError &&
		['unauthorized', 'forbidden'].includes(query.error.kind)
	const missing =
		query.error instanceof AuthenticatedApiError &&
		query.error.kind === 'notFound'
	if (selected)
		return (
			<WidgetTransferRetry
				key={[
					access.workspaceId,
					access.revision,
					source.id,
					selected.id
				].join(':')}
				access={access}
				source={source}
				transfer={selected}
				onClose={() => setSelected(null)}
				onSaved={() => {
					setSelected(null)
					void query.refetch()
				}}
			/>
		)
	return (
		<Drawer
			isOpen
			onClose={() => {
				onClose()
				toast('История передач закрыта')
			}}
			title="Передачи заявок"
			description={visible ? source.name : undefined}
			size="lg"
		>
			<div className={styles.panel}>
				{!access.confirmed ? (
					<ScreenState
						variant={access.permissions.isError ? 'error' : 'loading'}
						description="Проверяем доступ к истории передач."
					/>
				) : !visible || denied ? (
					<ScreenState
						variant="permission"
						description="История передач доступна владельцу и CRM-администратору этого пространства."
					/>
				) : !access.online ? (
					<ScreenState
						variant="error"
						description="Нет подключения к сети. История появится после восстановления связи."
					/>
				) : missing ? (
					<ScreenState
						variant="error"
						description="История этого подключения сейчас недоступна. Это не означает, что передач не было."
					/>
				) : query.isError ? (
					<ScreenState variant="error" description={query.error.message} />
				) : query.isPending || query.isFetching ? (
					<ScreenState variant="loading" />
				) : (
					<>
						<p className={styles.notice}>
							Здесь показаны только передачи этого подключения. «Ожидает
							повтора» не означает доставку. История автоматически не
							импортируется; уже полученные записи Inbox сохраняются после
							отключения виджета.
						</p>
						{!access.canManageSources ? (
							<p className={styles.notice}>
								Доступен только просмотр. Повтор передачи запрещён для
								текущей роли или подписки WinCRM.
							</p>
						) : null}
						{query.data.items.length === 0 ? (
							<p className={styles.notice}>
								На этой странице передач пока нет.
							</p>
						) : (
							<div className={styles.entries}>
								{query.data.items.map(transfer => (
									<article className={styles.entry} key={transfer.id}>
										<div className={styles.entryHeader}>
											<h3 className={styles.title}>
												Заявка от {dateLabel(transfer.occurredAt)}
											</h3>
											<StatusBadge
												tone={
													transfer.state === 'DELIVERED'
														? 'success'
														: transfer.state === 'ERROR'
															? 'danger'
															: 'neutral'
												}
											>
												{stateLabel[transfer.state]}
											</StatusBadge>
										</div>
										{transfer.reason ? (
											<p className={styles.description}>
												{reasonLabel[transfer.reason]}
											</p>
										) : null}
										<dl className={styles.details}>
											<div>
												<dt>Получена сервисом</dt>
												<dd>{dateLabel(transfer.receivedAt)}</dd>
											</div>
											<div>
												<dt>Обновлена</dt>
												<dd>{dateLabel(transfer.updatedAt)}</dd>
											</div>
											{transfer.completedAt ? (
												<div>
													<dt>Обработка завершена</dt>
													<dd>{dateLabel(transfer.completedAt)}</dd>
												</div>
											) : null}
											<div>
												<dt>Номер передачи</dt>
												<dd className={styles.identifier}>
													{transfer.id}
												</dd>
											</div>
											{transfer.entryId ? (
												<div>
													<dt>Запись Inbox</dt>
													<dd className={styles.identifier}>
														{transfer.entryId}
													</dd>
												</div>
											) : null}
										</dl>
										<WidgetTransferAction
											access={access}
											source={source}
											transfer={transfer}
											onSelect={() => setSelected(transfer)}
										/>
									</article>
								))}
							</div>
						)}
						<div className={styles.pagination}>
							<span>Всего: {query.data.total}</span>
							<Button
								variant="secondary"
								disabled={page === 1}
								onClick={() => {
									setPage(value => value - 1)
									toast('Предыдущая страница передач')
								}}
							>
								Назад
							</Button>
							<span>
								{page} / {Math.max(1, Math.ceil(query.data.total / 25))}
							</span>
							<Button
								variant="secondary"
								disabled={page * 25 >= query.data.total || page >= 1000000}
								onClick={() => {
									setPage(value => value + 1)
									toast('Следующая страница передач')
								}}
							>
								Далее
							</Button>
						</div>
					</>
				)}
				{visible && !denied ? (
					<Button
						variant="secondary"
						disabled={!access.online || query.isFetching}
						onClick={() => {
							void query.refetch()
							toast('Обновляем историю передач')
						}}
					>
						Обновить передачи
					</Button>
				) : null}
			</div>
		</Drawer>
	)
}

const transferIntent = (sourceId: string, transferId: string) =>
	`widget-transfer:${sourceId}:${transferId}`
const WidgetTransferAction = ({
	access,
	source,
	transfer,
	onSelect
}: Omit<Props, 'onClose'> & {
	transfer: WidgetTransfer
	onSelect: () => void
}) => {
	const { snapshot } = usePendingCommand(
		{
			owner: commandOwner(access.session?.userId, access.revision),
			workspaceId: access.workspaceId,
			view: access.scopeKey
		},
		`intake:${transferIntent(source.id, transfer.id)}`
	)
	const recoverable =
		snapshot.uncertain ||
		snapshot.status === 'success' ||
		snapshot.status === 'running'
	if (!recoverable && !['BLOCKED', 'ERROR'].includes(transfer.state))
		return null
	return (
		<div className={styles.actions}>
			<Button
				variant="secondary"
				size="sm"
				disabled={
					!access.canManageSources ||
					snapshot.status === 'running' ||
					(!recoverable && !source.enabled)
				}
				onClick={() => {
					onSelect()
					toast(
						recoverable
							? 'Проверяем сохранённую команду повтора'
							: 'Проверьте условия перед повтором передачи'
					)
				}}
			>
				{recoverable
					? 'Проверить сохранённый повтор'
					: 'Повторить передачу'}
			</Button>
			{!source.enabled ? (
				<span className={styles.description}>Подключение выключено.</span>
			) : null}
		</div>
	)
}

const WidgetTransferRetry = ({
	access,
	source,
	transfer,
	onClose,
	onSaved
}: Props & { transfer: WidgetTransfer; onSaved: () => void }) => {
	const bound =
		source.workspaceId === access.workspaceId &&
		transfer.workspaceId === access.workspaceId &&
		transfer.sourceId === source.id
	const scopedAccess = {
		...access,
		canManageSources: access.canManageSources && bound
	}
	const command = useIntakeCommand<
		WidgetTransferRetryCommand,
		WidgetTransferCommandResult
	>(
		scopedAccess,
		'intake:manage-sources',
		retryWidgetTransfer,
		() => {
			toast.success(
				'Повтор поставлен в очередь. Доставка ещё не подтверждена.'
			)
			onSaved()
		},
		transferIntent(source.id, transfer.id)
	)
	const visible = bound && access.confirmed && access.sourceManager
	const conflict = !command.uncertain && command.error?.kind === 'conflict'
	const denied =
		!command.uncertain &&
		!!command.error &&
		['unauthorized', 'forbidden', 'notFound'].includes(command.error.kind)
	const close = () => {
		if (command.locked) {
			toast('Результат пока не подтверждён. Повторите сохранённый запрос.')
			return
		}
		onClose()
		toast('Возвращаемся к истории передач')
	}
	const submit = () => {
		if (
			!visible ||
			!access.canManageSources ||
			conflict ||
			denied ||
			command.running
		)
			return
		if (command.uncertain) {
			void command.retry()
			return
		}
		if (!source.enabled || !['BLOCKED', 'ERROR'].includes(transfer.state))
			return
		void command.run(() => ({
			workspaceId: access.workspaceId,
			sourceId: source.id,
			transferId: transfer.id,
			commandId: crypto.randomUUID(),
			expectedVersion: transfer.version
		}))
	}
	return (
		<Drawer
			isOpen
			title="Повтор передачи"
			description={visible ? source.name : undefined}
			onClose={close}
		>
			<div className={styles.panel}>
				{!visible ? (
					<ScreenState
						variant={access.permissions.isError ? 'error' : 'permission'}
						description="Доступ к передаче сейчас не подтверждён."
					/>
				) : (
					<>
						<p className={styles.notice}>
							Повтор относится только к этой заявке. Сервер заново проверит
							права, подключение и исходный оплаченный период. Продление
							подписки не возобновляет старые передачи.
						</p>
						<p className={styles.description}>
							Заявка от {dateLabel(transfer.occurredAt)} · версия{' '}
							{transfer.version}
						</p>
						{transfer.reason ? (
							<p className={styles.description}>
								{reasonLabel[transfer.reason]}
							</p>
						) : null}
						{command.uncertain ? (
							<p className={styles.notice}>
								Результат неизвестен. UUID и версия запроса сохранены в
								памяти. Повтор использует ту же команду; не создавайте
								новую.
							</p>
						) : null}
						{command.error ? (
							<div className={styles.error} role="alert">
								<p>{command.error.message}</p>
								{conflict ? (
									<p>
										Состояние изменилось или повтор больше недоступен.
										Перечитайте историю и проверьте заявку перед новой
										командой.
									</p>
								) : null}
							</div>
						) : null}
						{!access.canManageSources ? (
							<p className={styles.notice}>
								Повтор недоступен: права, подписка или соединение не
								подтверждены.
							</p>
						) : null}
						<div className={styles.actions}>
							<Button
								variant="secondary"
								disabled={command.running}
								onClick={close}
							>
								Назад к истории
							</Button>
							{conflict ? (
								<Button
									variant="secondary"
									onClick={() => {
										onSaved()
										toast('Перечитываем историю перед новой командой')
									}}
								>
									Перечитать передачи
								</Button>
							) : (
								<Button
									isLoading={command.running}
									disabled={
										!access.canManageSources ||
										denied ||
										(!command.uncertain && !source.enabled)
									}
									onClick={submit}
								>
									{command.uncertain
										? 'Повторить тот же запрос'
										: 'Подтвердить повтор'}
								</Button>
							)}
						</div>
					</>
				)}
			</div>
		</Drawer>
	)
}
