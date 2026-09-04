'use client'

import { mutateIntakeSource, type IntakeSource } from '@/entities/intake'
import { Button, Drawer, ScreenState, TextField } from '@/shared/ui'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import {
	generateSourceCredential,
	sourceWebhookUrl
} from '../model/source-credential'
import type { IntakeAccess } from '../model/use-intake-access'
import { useIntakeCommand } from '../model/use-intake-command'
import styles from './IntakeForms.module.scss'

interface Props {
	access: IntakeAccess
	source?: IntakeSource
	operation: 'create' | 'rotate' | 'revoke'
	onClose: () => void
	onSaved: () => void
}

export const SourceEditor = ({
	access,
	source,
	operation,
	onClose,
	onSaved
}: Props) => {
	const [credential, setCredential] = useState<{
		token: string
		source: IntakeSource
	} | null>(null)
	const [revealed, setRevealed] = useState(false)
	const form = useForm<{ name: string }>({ defaultValues: { name: '' } })
	const command = useIntakeCommand(
		access,
		'intake:manage-sources',
		mutateIntakeSource,
		(result, sent) => {
			onSaved()
			if (sent.operation === 'revoke') {
				toast.success('Источник отозван')
				onClose()
				return
			}
			setCredential({ source: result, token: sent.token })
			toast.success(
				sent.operation === 'create'
					? 'Источник создан. Сохраните секретный ключ.'
					: 'Ключ заменён. Старый ключ больше не действует.'
			)
		}
	)
	const denied =
		!!command.error &&
		['unauthorized', 'forbidden'].includes(command.error.kind)
	const conflict = command.error?.kind === 'conflict'
	const editable =
		access.canManageSources && !command.locked && !denied && !conflict
	const close = () => {
		if (command.locked) {
			toast(
				'Результат неизвестен. Повторите ту же команду перед закрытием.'
			)
			return
		}
		if (credential) {
			if (!access.sourceManager) {
				setCredential(null)
				setRevealed(false)
				onClose()
				return
			}
			toast(
				'Сохраните ключ и нажмите «Закрыть и скрыть ключ». После закрытия восстановить его нельзя.'
			)
			return
		}
		onClose()
	}
	const copy = async (value: string, isSecret: boolean) => {
		try {
			await navigator.clipboard.writeText(value)
			toast.success(
				isSecret
					? 'Ключ скопирован. Передавайте его только вашему серверу.'
					: 'Адрес приёма скопирован'
			)
		} catch {
			toast.error(
				'Не удалось скопировать. Разрешите доступ к буферу обмена или скопируйте вручную.'
			)
		}
	}
	const submit = form.handleSubmit(
		draft => {
			if (!access.canManageSources || denied || conflict || credential)
				return
			void command.run(() => {
				const base = {
					workspaceId: access.workspaceId,
					commandId: crypto.randomUUID()
				}
				if (operation === 'create')
					return {
						...base,
						operation,
						name: draft.name.trim(),
						token: generateSourceCredential(),
						teamId: null
					}
				if (
					!source ||
					source.workspaceId !== access.workspaceId ||
					source.revokedAt
				)
					throw new Error('Source is unavailable')
				const versioned = {
					...base,
					id: source.id,
					expectedVersion: source.version
				}
				return operation === 'rotate'
					? { ...versioned, operation, token: generateSourceCredential() }
					: { ...versioned, operation }
			})
		},
		() => toast.error('Укажите название источника')
	)
	return (
		<Drawer
			isOpen
			onClose={close}
			title={
				credential
					? 'Сохраните секретный ключ'
					: operation === 'create'
						? 'Новый API-источник'
						: operation === 'rotate'
							? 'Заменить ключ источника'
							: 'Отозвать источник'
			}
		>
			<div className={styles.form}>
				{!access.sourceManager ? (
					<ScreenState
						variant={access.permissions.isError ? 'error' : 'permission'}
						description="Доступ к источнику сейчас не подтверждён. Ключ не раскрывается."
						action={
							<Button onClick={() => void access.permissions.refetch()}>
								Проверить доступ
							</Button>
						}
					/>
				) : credential ? (
					<div className={styles.credential}>
						<p className={styles.notice}>
							Ключ доступен только сейчас, в этой панели. WinCRM не хранит
							его открытый текст и не сможет показать повторно. Если ключ
							потерян, выполните новую ротацию. Не добавляйте его в код
							виджета, браузерный JavaScript или URL.
						</p>
						<p>
							Источник: <strong>{credential.source.name}</strong>
						</p>
						<code
							className={styles.secret}
							aria-label="Секретный ключ источника"
						>
							{revealed
								? credential.token
								: '••••••••••••••••••••••••••••••••'}
						</code>
						<div className={styles.actions}>
							<Button
								variant="secondary"
								onClick={() => {
									setRevealed(value => !value)
									toast(
										revealed
											? 'Ключ скрыт'
											: 'Ключ показан. Не демонстрируйте его посторонним.'
									)
								}}
							>
								{revealed ? 'Скрыть ключ' : 'Показать ключ'}
							</Button>
							<Button onClick={() => void copy(credential.token, true)}>
								Скопировать ключ
							</Button>
						</div>
						<p>Адрес приёма POST:</p>
						<code className={styles.secret}>
							{sourceWebhookUrl(credential.source.id)}
						</code>
						<Button
							variant="secondary"
							onClick={() =>
								void copy(sourceWebhookUrl(credential.source.id), false)
							}
						>
							Скопировать адрес
						</Button>
						<p className={styles.notice}>
							Передавайте ключ в заголовке{' '}
							<code>Authorization: Bearer &lt;ключ&gt;</code>. Для каждого
							события используйте UUIDv4 в <code>Idempotency-Key</code>;
							при повторе события сохраняйте его и тело запроса. Реальная
							доставка подтверждается только успешным ответом API.
						</p>
						<Button
							variant="secondary"
							onClick={() => {
								setCredential(null)
								setRevealed(false)
								toast('Ключ скрыт. Повторный просмотр недоступен.')
								onClose()
							}}
						>
							Закрыть и скрыть ключ
						</Button>
					</div>
				) : (
					<form
						className={styles.form}
						onSubmit={event => void submit(event)}
						noValidate
					>
						{operation === 'create' ? (
							<TextField
								label="Название источника"
								required
								maxLength={200}
								readOnly={!editable}
								error={form.formState.errors.name?.message}
								{...form.register('name', {
									required: 'Укажите название',
									validate: value => !!value.trim() || 'Укажите название'
								})}
							/>
						) : (
							<p>
								Источник: <strong>{source?.name}</strong>
							</p>
						)}
						<p className={styles.notice}>
							{operation === 'create'
								? 'Ключ будет сгенерирован безопасно на этом устройстве. После подтверждения команды сохраните его в секретах вашего сервера.'
								: operation === 'rotate'
									? 'После подтверждения старый ключ перестанет действовать. Обновите ключ на отправляющем сервере. Уже полученные обращения сохранятся.'
									: 'После подтверждения новые обращения из источника приниматься не будут. Восстановить отозванный источник нельзя; существующие обращения сохранятся.'}
						</p>
						{command.uncertain ? (
							<p className={styles.notice}>
								Результат пока неизвестен. Ключ, версия и UUID команды
								зафиксированы в памяти. Повтор не создаёт новый ключ и не
								дублирует изменение.
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
											toast('Перечитайте источник перед новой командой.')
										}}
									>
										Перечитать список источников
									</Button>
								) : null}
							</div>
						) : null}
						{!access.online ? (
							<p className={styles.notice}>
								Нет подключения к сети. Отправка приостановлена.
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
								variant={operation === 'revoke' ? 'danger' : 'primary'}
								isLoading={command.running}
								disabled={!access.canManageSources || denied || conflict}
							>
								{command.uncertain
									? 'Повторить тот же запрос'
									: operation === 'create'
										? 'Создать источник'
										: operation === 'rotate'
											? 'Подтвердить замену ключа'
											: 'Подтвердить отзыв'}
							</Button>
						</div>
					</form>
				)}
			</div>
		</Drawer>
	)
}
