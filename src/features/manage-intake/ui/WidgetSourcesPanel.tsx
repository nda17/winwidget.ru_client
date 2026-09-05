'use client'

import {
	listWidgetSources,
	type ManagedWidgetSource
} from '@/entities/widget-source'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import { Button, ScreenState, StatusBadge } from '@/shared/ui'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { IntakeAccess } from '../model/use-intake-access'
import { useWidgetSourceRead } from '../model/use-widget-source-read'
import {
	widgetSourceError,
	widgetSourceState,
	widgetTypeLabel
} from '../model/widget-source-display'
import { WidgetSourceEditor } from './WidgetSourceEditor'
import styles from './WidgetSourcesPanel.module.scss'
import { WidgetTransfersPanel } from './WidgetTransfersPanel'

export const WidgetSourcesPanel = ({
	access
}: {
	access: IntakeAccess
}) => {
	const [page, setPage] = useState(1)
	const [transferSource, setTransferSource] =
		useState<ManagedWidgetSource | null>(null)
	const [selected, setSelected] = useState<{
		operation: 'create' | 'configure' | 'retry'
		source?: ManagedWidgetSource
	} | null>(null)
	const query = useWidgetSourceRead(access, ['list', page], token =>
		listWidgetSources(token, access.workspaceId, page, 25)
	)
	const unavailable =
		query.error instanceof AuthenticatedApiError &&
		query.error.kind === 'notFound'
	const denied =
		query.error instanceof AuthenticatedApiError &&
		['unauthorized', 'forbidden'].includes(query.error.kind)
	const edit = (
		operation: 'create' | 'configure' | 'retry',
		source?: ManagedWidgetSource
	) => {
		if (!access.canManageSources || query.isError || query.isFetching)
			return
		setSelected({ operation, source })
		toast(
			operation === 'create'
				? 'Выберите виджет для подключения'
				: 'Открываем настройки подключения'
		)
	}
	return (
		<section className={styles.panel} aria-label="Подключения WinWidget">
			<header className={styles.header}>
				<div className={styles.heading}>
					<h2>Виджеты WinWidget</h2>
					<p className={styles.description}>
						Заявки из ваших виджетов — в общей Inbox. Подключение
						опционально и доступно на оплаченных EASY / HARD; история
						автоматически не переносится.
					</p>
				</div>
				<div className={styles.actions}>
					<Button
						variant="secondary"
						disabled={
							!access.sourceManager || !access.online || query.isFetching
						}
						onClick={() => {
							void query.refetch()
							toast('Обновляем подключения')
						}}
					>
						Обновить
					</Button>
					<Button
						disabled={
							!access.canManageSources ||
							!query.isSuccess ||
							query.isFetching
						}
						onClick={() => edit('create')}
					>
						Подключить виджет
					</Button>
				</div>
			</header>
			{!access.confirmed ? (
				<ScreenState
					variant={access.permissions.isError ? 'error' : 'loading'}
					description="Проверяем доступ к подключениям."
				/>
			) : !access.sourceManager || denied ? (
				<ScreenState
					variant="permission"
					description="Подключения доступны владельцу рабочего пространства и CRM-администратору."
				/>
			) : !access.online ? (
				<ScreenState
					variant="error"
					description="Нет подключения к сети. Проверьте соединение и обновите список."
				/>
			) : unavailable ? (
				<p className={styles.notice}>
					Подключение WinWidget пока не включено на сервере. Заявки
					виджетов и прежние интеграции продолжают работать независимо от
					WinCRM.
				</p>
			) : query.isError ? (
				<ScreenState variant="error" description={query.error.message} />
			) : query.isPending || query.isFetching ? (
				<ScreenState variant="loading" />
			) : (
				<>
					{!access.canManageSources ? (
						<p className={styles.notice}>
							Доступен просмотр подключений. Изменения сейчас недоступны
							для вашей роли или подписки WinCRM.
						</p>
					) : null}
					{query.data.items.length === 0 ? (
						<p className={styles.notice}>
							Подключений пока нет. Можно работать в WinCRM без виджетов
							или явно подключить нужный виджет.
						</p>
					) : (
						<div className={styles.cards}>
							{query.data.items.map(source => (
								<article className={styles.card} key={source.id}>
									<div className={styles.cardHeader}>
										<h3 className={styles.cardTitle}>
											{source.name}
											<span className={styles.kind}>
												{widgetTypeLabel[source.widgetType]}
											</span>
										</h3>
										<StatusBadge
											tone={
												source.syncState === 'SYNCED' && source.enabled
													? 'success'
													: source.syncState === 'PENDING'
														? 'accent'
														: 'neutral'
											}
										>
											{widgetSourceState(source)}
										</StatusBadge>
									</div>
									{source.lastErrorCode ? (
										<p className={styles.description}>
											{widgetSourceError(source.lastErrorCode)}
										</p>
									) : null}
									{source.syncState === 'PENDING' ? (
										<p className={styles.description}>
											Запрос ожидает подтверждения сервиса. Обновите список
											через несколько секунд; повторно создавать
											подключение не нужно.
										</p>
									) : null}
									<p className={styles.description}>
										Версия {source.version} ·{' '}
										{source.syncedAt
											? 'Синхронизировано ' +
												new Date(source.syncedAt).toLocaleString('ru-RU')
											: 'Подтверждение ещё не получено'}
									</p>
									<div className={styles.actions}>
										<Button
											size="sm"
											variant="secondary"
											onClick={() => {
												setTransferSource(source)
												toast('Открываем передачи заявок')
											}}
										>
											Передачи заявок
										</Button>
										<Button
											size="sm"
											variant={source.enabled ? 'danger' : 'secondary'}
											disabled={!access.canManageSources}
											onClick={() => edit('configure', source)}
										>
											{source.enabled ? 'Отключить' : 'Включить'}
										</Button>
										{['BLOCKED', 'ERROR'].includes(source.syncState) ? (
											<Button
												size="sm"
												variant="secondary"
												disabled={!access.canManageSources}
												onClick={() => edit('retry', source)}
											>
												Повторить синхронизацию
											</Button>
										) : null}
									</div>
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
								toast('Предыдущая страница подключений')
							}}
						>
							Назад
						</Button>
						<span>
							{page} / {Math.max(1, Math.ceil(query.data.total / 25))}
						</span>
						<Button
							variant="secondary"
							disabled={page * 25 >= query.data.total}
							onClick={() => {
								setPage(value => value + 1)
								toast('Следующая страница подключений')
							}}
						>
							Далее
						</Button>
					</div>
				</>
			)}
			{transferSource ? (
				<WidgetTransfersPanel
					key={[
						access.workspaceId,
						access.session?.userId,
						access.revision,
						access.scopeKey,
						transferSource.id
					].join(':')}
					access={access}
					source={
						query.data?.items.find(
							item => item.id === transferSource.id
						) ?? transferSource
					}
					onClose={() => setTransferSource(null)}
				/>
			) : null}
			{selected ? (
				<WidgetSourceEditor
					key={[
						access.workspaceId,
						access.session?.userId,
						access.revision,
						access.scopeKey,
						selected.operation,
						selected.source?.id ?? 'new'
					].join(':')}
					access={access}
					{...selected}
					onClose={() => setSelected(null)}
					onSaved={() => {
						void query.refetch()
					}}
				/>
			) : null}
		</section>
	)
}
