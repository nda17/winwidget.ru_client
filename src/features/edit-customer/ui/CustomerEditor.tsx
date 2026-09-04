'use client'

import { useSessionStore } from '@/entities/session'
import {
	findCustomerDuplicates,
	getCustomer,
	listCustomers,
	mutateCustomer,
	type Customer,
	type CustomerKind,
	type CustomerMutation
} from '@/entities/customer'
import { AuthenticatedApiError } from '@/shared/api/authenticated-http-client'
import {
	Button,
	Drawer,
	ScreenState,
	SelectField,
	TextField,
	TextareaField
} from '@/shared/ui'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useRef, useState, type FormEvent } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import toast from 'react-hot-toast'
import styles from './CustomerEditor.module.scss'

interface EditorProps {
	workspaceId: string
	kind: CustomerKind
	id?: string
	canWrite: boolean
	onClose: () => void
	onSaved: () => void
}

interface Draft {
	name: string
	phone: string
	email: string
	companyId: string
	notes: string
	inn: string
	website: string
}

export const CustomerEditor = (props: EditorProps) => {
	const session = useSessionStore(state => state.session)
	const revision = useSessionStore(state => state.sessionRevision)
	const record = useQuery({
		queryKey: [
			'crm-customer-detail',
			props.workspaceId,
			session?.userId,
			revision,
			props.kind,
			props.id
		],
		enabled: !!props.id && !!session,
		queryFn: () =>
			getCustomer(
				session!.accessToken,
				props.kind,
				props.workspaceId,
				props.id!
			),
		retry: false,
		gcTime: 0,
		staleTime: 0,
		refetchOnWindowFocus: false
	})
	if (props.id && (!record.data || record.isError || record.isFetching))
		return (
			<Drawer isOpen onClose={props.onClose} title="Карточка клиента">
				<ScreenState
					variant={
						record.isError
							? record.error instanceof AuthenticatedApiError &&
								record.error.kind === 'forbidden'
								? 'permission'
								: 'error'
							: 'loading'
					}
					description={record.error?.message}
					action={
						record.isError ? (
							<Button
								variant="secondary"
								onClick={() => void record.refetch()}
							>
								Повторить
							</Button>
						) : undefined
					}
				/>
			</Drawer>
		)
	return (
		<CustomerForm
			key={
				record.data
					? `${record.data.id}:${record.data.version}`
					: `new:${props.kind}`
			}
			{...props}
			record={record.data}
			reload={() => void record.refetch()}
		/>
	)
}

const CustomerForm = ({
	workspaceId,
	kind,
	id,
	canWrite,
	onClose,
	onSaved,
	record,
	reload
}: EditorProps & { record?: Customer; reload: () => void }) => {
	const session = useSessionStore(state => state.session)
	const revision = useSessionStore(state => state.sessionRevision)
	const [command, setCommand] = useState<CustomerMutation | null>(null)
	const [archiveConfirm, setArchiveConfirm] = useState(false)
	const [companySearch, setCompanySearch] = useState('')
	const [companyTerm, setCompanyTerm] = useState('')
	const [companyPage, setCompanyPage] = useState(1)
	const immediateLock = useRef(false)
	const form = useForm<Draft>({
		defaultValues: {
			name: record?.name ?? '',
			notes: record?.notes ?? '',
			phone: record?.kind === 'contacts' ? (record.phone ?? '') : '',
			email: record?.kind === 'contacts' ? (record.email ?? '') : '',
			companyId:
				record?.kind === 'contacts' ? (record.companyId ?? '') : '',
			inn: record?.kind === 'companies' ? (record.inn ?? '') : '',
			website: record?.kind === 'companies' ? (record.website ?? '') : ''
		}
	})
	const companies = useQuery({
		queryKey: [
			'crm-company-picker',
			workspaceId,
			session?.userId,
			revision,
			companyTerm,
			companyPage
		],
		enabled: kind === 'contacts' && canWrite && !!session,
		queryFn: () =>
			listCustomers(
				session!.accessToken,
				'companies',
				workspaceId,
				companyPage,
				25,
				companyTerm
			),
		retry: false,
		gcTime: 0
	})
	const linkedCompanyId =
		record?.kind === 'contacts' ? record.companyId : null
	const linkedCompany = useQuery({
		queryKey: [
			'crm-company-link',
			workspaceId,
			session?.userId,
			revision,
			linkedCompanyId
		],
		enabled: !!linkedCompanyId && !!session,
		queryFn: () =>
			getCustomer(
				session!.accessToken,
				'companies',
				workspaceId,
				linkedCompanyId!
			),
		retry: false,
		gcTime: 0
	})
	const mutation = useMutation({
		mutationFn: (pending: CustomerMutation) =>
			mutateCustomer(session!.accessToken, pending),
		retry: false,
		onSuccess: (_, completed) => {
			setCommand(null)
			toast.success(
				completed.archive ? 'Запись архивирована' : 'Изменения сохранены'
			)
			onSaved()
			onClose()
		},
		onError: error => {
			if (
				error instanceof AuthenticatedApiError &&
				error.kind !== 'temporary'
			)
				setCommand(null)
			toast.error(error.message)
		},
		onSettled: () => {
			immediateLock.current = false
		}
	})
	const duplicates = useMutation({
		mutationFn: ({ phone, email }: { phone: string; email: string }) =>
			findCustomerDuplicates(
				session!.accessToken,
				workspaceId,
				phone,
				email
			),
		onError: error => toast.error(error.message)
	})
	const authorizationDenied =
		mutation.error instanceof AuthenticatedApiError &&
		['unauthorized', 'forbidden'].includes(mutation.error.kind)
	const locked = mutation.isPending || command !== null
	const editable = canWrite && !locked && !authorizationDenied
	const close = () => {
		if (locked) {
			toast(
				'Сначала повторите запрос с неизвестным результатом. Повтор безопасен.'
			)
			return
		}
		onClose()
	}
	const dispatch = (pending: CustomerMutation) => {
		if (
			!canWrite ||
			authorizationDenied ||
			!session ||
			immediateLock.current
		)
			return
		immediateLock.current = true
		setCommand(pending)
		mutation.mutate(pending)
	}
	const submit = (event: FormEvent<HTMLFormElement>) => {
		void form.handleSubmit(
			draft => {
				if (!canWrite || authorizationDenied || conflict) return
				if (command) {
					dispatch(command)
					return
				}
				const nullable = (value: string) => value.trim() || null
				dispatch({
					kind,
					workspaceId,
					id,
					commandId: crypto.randomUUID(),
					...(record ? { expectedVersion: record.version } : {}),
					fields: {
						name: draft.name.trim(),
						notes: nullable(draft.notes),
						teamId: record?.teamId ?? null,
						...(kind === 'contacts'
							? {
									phone: nullable(draft.phone),
									email: nullable(draft.email)?.toLowerCase() ?? null,
									companyId: nullable(draft.companyId)
								}
							: {
									inn: nullable(draft.inn),
									website: nullable(draft.website)
								})
					}
				})
			},
			() => toast.error('Проверьте выделенные поля')
		)(event)
	}
	const checkDuplicates = async () => {
		if (!(await form.trigger(['phone', 'email']))) return
		const phone = form.getValues('phone').trim()
		const email = form.getValues('email').trim()
		if (!phone && !email) {
			toast('Укажите телефон или email для поиска совпадений')
			return
		}
		duplicates.mutate({ phone, email })
	}
	const title = id
		? (record?.name ?? 'Карточка клиента')
		: kind === 'contacts'
			? 'Новый контакт'
			: 'Новая компания'
	const selectedCompanyId = useWatch({
		control: form.control,
		name: 'companyId'
	})
	const conflict =
		mutation.error instanceof AuthenticatedApiError &&
		mutation.error.kind === 'conflict'
	return (
		<Drawer
			isOpen
			onClose={close}
			title={title}
			description={
				canWrite
					? 'Изменения сохраняются в клиентской базе вашей команды.'
					: 'Доступен только просмотр карточки.'
			}
			footer={
				<>
					<Button variant="secondary" onClick={close} disabled={locked}>
						Закрыть
					</Button>
					{canWrite ? (
						<Button
							form="customer-editor"
							type="submit"
							isLoading={mutation.isPending}
							disabled={conflict || authorizationDenied}
						>
							{command ? 'Повторить запрос' : 'Сохранить'}
						</Button>
					) : null}
				</>
			}
		>
			<form id="customer-editor" className={styles.form} onSubmit={submit}>
				{mutation.error ? (
					<div className={styles.notice} role="alert">
						<p>{mutation.error.message}</p>
						{command ? (
							<p>
								Ответ не подтверждён. Поля временно заблокированы;
								повторная отправка использует ту же команду и не создаст
								дубль.
							</p>
						) : null}
						{conflict ? (
							<Button
								variant="secondary"
								size="sm"
								onClick={() => {
									if (
										window.confirm(
											'Загрузить актуальную карточку? Несохранённый черновик будет сброшен.'
										)
									)
										reload()
								}}
							>
								Загрузить актуальную версию
							</Button>
						) : null}
					</div>
				) : null}
				<TextField
					label={kind === 'contacts' ? 'Имя' : 'Название компании'}
					required
					maxLength={200}
					readOnly={!editable}
					error={form.formState.errors.name?.message}
					{...form.register('name', {
						validate: value => !!value.trim() || 'Укажите имя или название'
					})}
				/>
				{kind === 'contacts' ? (
					<>
						<TextField
							label="Телефон"
							type="tel"
							placeholder="+79001234567"
							hint="Международный формат: + и от 7 до 15 цифр, без пробелов."
							maxLength={16}
							readOnly={!editable}
							error={form.formState.errors.phone?.message}
							{...form.register('phone', {
								pattern: {
									value: /^\+[1-9][0-9]{6,14}$/,
									message: 'Пример формата: +79001234567'
								}
							})}
						/>
						<TextField
							label="Email"
							type="email"
							maxLength={254}
							readOnly={!editable}
							error={form.formState.errors.email?.message}
							{...form.register('email', {
								pattern: {
									value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
									message: 'Укажите корректный email'
								}
							})}
						/>
						<div className={styles.secondarySection}>
							<Button
								variant="secondary"
								size="sm"
								isLoading={duplicates.isPending}
								disabled={!editable}
								onClick={() => void checkDuplicates()}
							>
								Проверить совпадения
							</Button>
							{duplicates.data ? (
								<div role="status" className={styles.hint}>
									{duplicates.data.items.filter(item => item.id !== id)
										.length ? (
										<>
											<p>
												Найдены похожие контакты. Автоматически записи не
												объединяются.
											</p>
											<ul>
												{duplicates.data.items
													.filter(item => item.id !== id)
													.map(item => (
														<li key={item.id}>
															{item.name}
															{item.kind === 'contacts'
																? ` · ${item.phone ?? item.email ?? 'без контактов'}`
																: ''}
														</li>
													))}
											</ul>
											{duplicates.data.total > 25 ? (
												<p>Показаны первые 25 совпадений.</p>
											) : null}
										</>
									) : (
										'Других совпадений не найдено.'
									)}
								</div>
							) : null}
						</div>
						{canWrite ? (
							<div className={styles.companySearch}>
								<TextField
									label="Найти компанию"
									maxLength={200}
									value={companySearch}
									readOnly={!editable}
									onChange={event => setCompanySearch(event.target.value)}
								/>
								<Button
									variant="secondary"
									size="sm"
									disabled={!editable}
									onClick={() => {
										setCompanyTerm(companySearch.trim())
										setCompanyPage(1)
									}}
								>
									Найти
								</Button>
							</div>
						) : null}
						<SelectField
							label="Компания"
							disabled={!editable}
							{...form.register('companyId')}
						>
							<option value="">Без компании</option>
							{selectedCompanyId &&
							!companies.data?.items.some(
								item => item.id === selectedCompanyId
							) ? (
								<option value={selectedCompanyId}>
									{linkedCompany.data?.id === selectedCompanyId
										? linkedCompany.data.name
										: 'Выбранная компания'}
								</option>
							) : null}
							{!companies.isError
								? companies.data?.items.map(item => (
										<option value={item.id} key={item.id}>
											{item.name}
										</option>
									))
								: null}
						</SelectField>
						{canWrite ? (
							<div className={styles.pickerNavigation}>
								{companies.isError ? (
									<span role="alert">
										Компании не загружены.{' '}
										<Button
											size="sm"
											variant="ghost"
											onClick={() => void companies.refetch()}
										>
											Повторить
										</Button>
									</span>
								) : (
									<>
										<span className={styles.hint}>
											{companies.isFetching
												? 'Загрузка компаний…'
												: `Страница ${companyPage} · найдено ${companies.data?.total ?? 0}`}
										</span>
										<Button
											size="sm"
											variant="ghost"
											disabled={
												!editable ||
												companyPage === 1 ||
												companies.isFetching
											}
											onClick={() => setCompanyPage(page => page - 1)}
										>
											Назад
										</Button>
										<Button
											size="sm"
											variant="ghost"
											disabled={
												!editable ||
												companies.isFetching ||
												!companies.data ||
												companyPage * 25 >= companies.data.total
											}
											onClick={() => setCompanyPage(page => page + 1)}
										>
											Далее
										</Button>
									</>
								)}
							</div>
						) : null}
					</>
				) : (
					<>
						<TextField
							label="ИНН"
							inputMode="numeric"
							maxLength={12}
							readOnly={!editable}
							error={form.formState.errors.inn?.message}
							{...form.register('inn', {
								pattern: {
									value: /^(?:[0-9]{10}|[0-9]{12})$/,
									message: 'ИНН должен содержать 10 или 12 цифр'
								}
							})}
						/>
						<TextField
							label="Сайт"
							type="url"
							maxLength={2048}
							placeholder="https://example.ru"
							readOnly={!editable}
							error={form.formState.errors.website?.message}
							{...form.register('website', {
								validate: value => {
									if (!value) return true
									try {
										const url = new URL(value)
										return (
											(['http:', 'https:'].includes(url.protocol) &&
												!url.username &&
												!url.password) ||
											'Укажите http(s) адрес без логина и пароля'
										)
									} catch {
										return 'Укажите полный адрес сайта'
									}
								}
							})}
						/>
					</>
				)}
				<TextareaField
					label="Заметки"
					rows={5}
					maxLength={5000}
					readOnly={!editable}
					{...form.register('notes')}
				/>
				{record ? (
					<div className={styles.metadata}>
						<span>
							Создано: {new Date(record.createdAt).toLocaleString('ru-RU')}
						</span>
						<span>
							Обновлено:{' '}
							{new Date(record.updatedAt).toLocaleString('ru-RU')} · версия{' '}
							{record.version}
						</span>
					</div>
				) : null}
				{record && canWrite ? (
					<div className={styles.archive}>
						{archiveConfirm ? (
							<>
								<p>
									Архивировать запись? Она исчезнет из активного списка, но
									история сохранится.
								</p>
								<div className={styles.pickerNavigation}>
									<Button
										variant="danger"
										size="sm"
										disabled={!editable}
										onClick={() =>
											dispatch({
												kind,
												workspaceId,
												id,
												expectedVersion: record.version,
												commandId: crypto.randomUUID(),
												archive: true
											})
										}
									>
										Подтвердить архивирование
									</Button>
									<Button
										variant="ghost"
										size="sm"
										disabled={!editable}
										onClick={() => setArchiveConfirm(false)}
									>
										Отмена
									</Button>
								</div>
							</>
						) : (
							<Button
								variant="ghost"
								size="sm"
								disabled={!editable}
								onClick={() => setArchiveConfirm(true)}
							>
								Архивировать запись
							</Button>
						)}
					</div>
				) : null}
			</form>
		</Drawer>
	)
}
