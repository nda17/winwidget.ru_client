'use client'

import {
	listWidgetCandidates,
	mutateWidgetSource,
	type ManagedWidgetSource,
	type WidgetCandidate,
	type WidgetSourceCommand
} from '@/entities/widget-source'
import { Button, Drawer, ScreenState, TextField } from '@/shared/ui'
import { useState } from 'react'
import toast from 'react-hot-toast'
import type { IntakeAccess } from '../model/use-intake-access'
import { useIntakeCommand } from '../model/use-intake-command'
import { useWidgetSourceRead } from '../model/use-widget-source-read'
import { widgetTypeLabel } from '../model/widget-source-display'
import styles from './WidgetSourcesPanel.module.scss'

interface Props {
	access: IntakeAccess
	operation: 'create' | 'configure' | 'retry'
	source?: ManagedWidgetSource
	onClose: () => void
	onSaved: () => void
}

export const WidgetSourceEditor = ({
	access,
	operation,
	source,
	onClose,
	onSaved
}: Props) => {
	const [name, setName] = useState('')
	const [page, setPage] = useState(1)
	const [candidate, setCandidate] = useState<WidgetCandidate | null>(null)
	const [validation, setValidation] = useState('')
	const candidates = useWidgetSourceRead(
		{
			...access,
			canManageSources: access.canManageSources && operation === 'create'
		},
		['candidates', page],
		token => listWidgetCandidates(token, access.workspaceId, page, 25),
		true
	)
	const command = useIntakeCommand<WidgetSourceCommand, unknown>(
		access,
		'intake:manage-sources',
		mutateWidgetSource,
		() => {
			toast.success(
				'Запрос принят. Состояние подключения появится в списке.'
			)
			onSaved()
			onClose()
		},
		'widget-source:' + operation + ':' + (source?.id ?? 'new')
	)
	const denied =
		!command.uncertain &&
		!!command.error &&
		['unauthorized', 'forbidden'].includes(command.error.kind)
	const conflict = !command.uncertain && command.error?.kind === 'conflict'
	const editable =
		access.canManageSources && !command.locked && !denied && !conflict
	const close = () => {
		if (command.locked) {
			toast('Результат неизвестен. Сначала повторите сохранённый запрос.')
			return
		}
		onClose()
	}
	const submit = () => {
		if (command.uncertain) {
			void command.retry()
			return
		}
		if (!editable) return
		if (operation === 'create') {
			const available =
				candidates.data?.eligibility.eligible &&
				!candidates.isFetching &&
				!candidates.isError &&
				candidates.data.items.some(
					item =>
						item.widgetId === candidate?.widgetId &&
						item.widgetType === candidate?.widgetType &&
						item.isActive &&
						item.publishedVersion > 0 &&
						item.connection === 'NONE'
				)
			if (
				!available ||
				!name.trim() ||
				/[\x00-\x1f\x7f\ufffd\ud800-\udfff]/u.test(name)
			) {
				setValidation(
					'Выберите доступный виджет и укажите название подключения.'
				)
				toast.error('Проверьте виджет и название подключения')
				return
			}
		}
		void command.run(() => {
			const base = {
				workspaceId: access.workspaceId,
				commandId: crypto.randomUUID()
			}
			if (operation === 'create' && candidate)
				return {
					...base,
					operation,
					name: name.trim(),
					widgetType: candidate.widgetType,
					widgetId: candidate.widgetId,
					teamId: null
				}
			if (!source || source.workspaceId !== access.workspaceId)
				throw new Error('Widget source is unavailable')
			const versioned = {
				...base,
				id: source.id,
				expectedVersion: source.version
			}
			return operation === 'configure'
				? { ...versioned, operation, enabled: !source.enabled }
				: { ...versioned, operation: 'retry' }
		})
	}
	const title =
		operation === 'create'
			? 'Подключить виджет'
			: operation === 'retry'
				? 'Повторить синхронизацию'
				: source?.enabled
					? 'Отключить виджет'
					: 'Включить подключение'
	return (
		<Drawer
			isOpen
			onClose={close}
			title={title}
			description="WinWidget и WinCRM остаются отдельными продуктами."
		>
			{!access.sourceManager || !access.confirmed ? (
				<ScreenState
					variant={access.permissions.isError ? 'error' : 'permission'}
					description="Доступ к настройкам подключения сейчас не подтверждён."
					action={
						<Button onClick={() => void access.permissions.refetch()}>
							Проверить доступ
						</Button>
					}
				/>
			) : (
				<form
					className={styles.form}
					noValidate
					onSubmit={event => {
						event.preventDefault()
						submit()
					}}
				>
					{operation === 'create' ? (
						<>
							<p className={styles.notice}>
								Выберите свой опубликованный виджет с оплаченной подпиской
								EASY или HARD. Начнут поступать только новые заявки после
								включения. История не переносится.
							</p>
							<TextField
								label="Название подключения"
								required
								maxLength={200}
								readOnly={!editable}
								value={name}
								error={validation || undefined}
								onChange={event => {
									setName(event.target.value)
									setValidation('')
								}}
							/>
							{candidates.isError ? (
								<ScreenState
									variant="error"
									description={candidates.error.message}
									action={
										<Button
											disabled={!editable}
											onClick={() => void candidates.refetch()}
										>
											Обновить виджеты
										</Button>
									}
								/>
							) : candidates.isPending || candidates.isFetching ? (
								<ScreenState variant="loading" />
							) : !candidates.data.eligibility.eligible ? (
								<div className={styles.notice}>
									Для подключения нужна действующая оплаченная подписка
									Widgets EASY или HARD. Пробный период Widgets не
									подходит. WinCRM можно использовать без виджетов.
									<Button
										variant="secondary"
										disabled={!editable}
										onClick={() => void candidates.refetch()}
									>
										Проверить подписку
									</Button>
								</div>
							) : (
								<>
									<fieldset
										className={styles.fieldset}
										disabled={!editable}
									>
										<legend>Ваши виджеты</legend>
										<div className={styles.choices}>
											{candidates.data.items.length === 0 ? (
												<p className={styles.description}>
													Виджетов пока нет. Создайте и опубликуйте виджет
													в рабочем приложении WinWidget.
												</p>
											) : (
												candidates.data.items.map(item => {
													const available =
														item.isActive &&
														item.publishedVersion > 0 &&
														item.connection === 'NONE'
													return (
														<label
															className={styles.choice}
															key={item.widgetType + ':' + item.widgetId}
														>
															<input
																type="radio"
																name="widget"
																disabled={!available}
																checked={
																	candidate?.widgetType ===
																		item.widgetType &&
																	candidate.widgetId === item.widgetId
																}
																onChange={() => {
																	setCandidate(item)
																	setValidation('')
																	toast('Виджет выбран')
																}}
															/>
															<span className={styles.choiceText}>
																<strong>{item.name}</strong>
																<small>
																	{widgetTypeLabel[item.widgetType]}
																</small>
																{!available ? (
																	<small>
																		{item.connection === 'THIS_WORKSPACE'
																			? 'Уже подключён к этому пространству'
																			: item.connection ===
																				  'OTHER_WORKSPACE'
																				? 'Подключён к другому пространству'
																				: !item.isActive
																					? 'Виджет выключен'
																					: 'Виджет ещё не опубликован'}
																	</small>
																) : null}
															</span>
														</label>
													)
												})
											)}
										</div>
									</fieldset>
									<div className={styles.pagination}>
										<Button
											variant="secondary"
											disabled={!editable || page === 1}
											onClick={() => {
												setPage(value => value - 1)
												setCandidate(null)
											}}
										>
											Назад
										</Button>
										<span>
											{page} /{' '}
											{Math.max(1, Math.ceil(candidates.data.total / 25))}
										</span>
										<Button
											variant="secondary"
											disabled={
												!editable || page * 25 >= candidates.data.total
											}
											onClick={() => {
												setPage(value => value + 1)
												setCandidate(null)
											}}
										>
											Далее
										</Button>
									</div>
									<p className={styles.description}>
										Доступность проверена при загрузке списка. Перед
										включением сервер проверит её повторно.
									</p>
								</>
							)}
						</>
					) : (
						<>
							<p className={styles.cardTitle}>{source?.name}</p>
							<p className={styles.notice}>
								{operation === 'retry'
									? 'Повтор будет отправлен с исходными настройками, сотрудником и версией подключения. Уже полученные заявки сохранятся.'
									: source?.enabled
										? 'Новые заявки перестанут передаваться в WinCRM. Сам виджет и другие интеграции продолжат работать; уже полученные CRM-данные сохранятся.'
										: 'Будут передаваться только новые заявки. Сервер повторно проверит права, владельца виджета и подписку EASY / HARD. Пропущенная история не переносится.'}
							</p>
						</>
					)}
					{command.uncertain ? (
						<p className={styles.notice}>
							Результат неизвестен. UUID и настройки запроса сохранены в
							памяти. Повтор использует ту же команду.
						</p>
					) : null}
					{command.error ? (
						<div className={styles.error} role="alert">
							<p>{command.error.message}</p>
							{conflict ? (
								<Button
									variant="secondary"
									onClick={() => {
										onSaved()
										onClose()
										toast('Обновите подключение перед новой командой')
									}}
								>
									Перечитать подключения
								</Button>
							) : null}
						</div>
					) : null}
					{!access.online ? (
						<p className={styles.notice}>
							Нет подключения к сети. Отправка приостановлена.
						</p>
					) : null}
					{!access.canManageSources && access.online ? (
						<p className={styles.notice}>
							Изменения недоступны для текущей роли или подписки WinCRM.
						</p>
					) : null}
					<div className={styles.actions}>
						<Button
							variant="secondary"
							disabled={command.running}
							onClick={close}
						>
							Отмена
						</Button>
						<Button
							type="submit"
							isLoading={command.running}
							variant={
								operation === 'configure' && source?.enabled
									? 'danger'
									: 'primary'
							}
							disabled={!access.canManageSources || denied || conflict}
						>
							{command.uncertain ? 'Повторить тот же запрос' : title}
						</Button>
					</div>
				</form>
			)}
		</Drawer>
	)
}
