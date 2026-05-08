'use client'
import styles from '@/components/screens/admin/user-list/UserList.module.scss'
import AdminActions from '@/components/ui/admin/admin-actions/AdminActions'
import AdminHeader from '@/components/ui/admin/admin-header/AdminHeader'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AdminSectionHeading from '@/components/ui/admin/admin-section-heading/AdminSectionHeading'
import ConfirmDialog from '@/components/ui/confirm-dialog/ConfirmDialog'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import { ADMIN_PAGES } from '@/config/pages/admin.config'
import useUserList from '@/hooks/useUserList'
import { IAdminUserListFilters } from '@/services/user/user.service'
import { UserLoginMethod } from '@/shared/types/user.types'
import clsx from 'clsx'
import { NextPage } from 'next'
import { FormEvent, useEffect, useState } from 'react'
import toast from 'react-hot-toast'

type UserRoleFilter = IAdminUserListFilters['role'] | 'ALL'
type UserSubscriptionFilter = IAdminUserListFilters['subscription'] | 'ALL'

interface UserFilterDraft {
	role: UserRoleFilter
	subscription: UserSubscriptionFilter
	registeredFrom: string
	registeredTo: string
}

const DEFAULT_USER_FILTERS: UserFilterDraft = {
	role: 'ALL',
	subscription: 'ALL',
	registeredFrom: '',
	registeredTo: ''
}

const ROLE_FILTER_OPTIONS: Array<{
	value: UserRoleFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все роли' },
	{ value: 'USER', label: 'USER' },
	{ value: 'ADMIN', label: 'ADMIN' }
]

const SUBSCRIPTION_FILTER_OPTIONS: Array<{
	value: UserSubscriptionFilter
	label: string
}> = [
	{ value: 'ALL', label: 'Все пользователи' },
	{ value: 'HAS', label: 'Есть подписка' },
	{ value: 'NONE', label: 'Нет подписки' }
]

const normalizeUserFilters = (
	draft: UserFilterDraft
): IAdminUserListFilters => ({
	role: draft.role === 'ALL' ? undefined : draft.role,
	subscription:
		draft.subscription === 'ALL' ? undefined : draft.subscription,
	registeredFrom: draft.registeredFrom || undefined,
	registeredTo: draft.registeredTo || undefined
})

const UserList: NextPage = () => {
	const [currentPage, setCurrentPage] = useState(1)
	const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
	const [filterDraft, setFilterDraft] = useState(DEFAULT_USER_FILTERS)
	const [filters, setFilters] = useState<IAdminUserListFilters>({})
	const itemQuantity = 10
	const {
		data,
		isLoading,
		handleSearch,
		handleClear,
		searchTerm,
		deleteAsync
	} = useUserList(currentPage, itemQuantity, filters)

	//Pagination settings
	const activePage = data?.items ?? []
	const totalItems = data?.total ?? 0
	const totalPages = data?.totalPages ?? currentPage
	const loadingRows = Array.from({ length: 5 }, (_, index) => index)
	const listPage = Array.from({ length: totalPages }, (_, i) => i + 1)

	useEffect(() => {
		setCurrentPage(1)
	}, [filters, searchTerm])

	useEffect(() => {
		if (currentPage > totalPages) {
			setCurrentPage(totalPages)
		}
	}, [currentPage, totalPages])

	const prevPage = () => {
		if (currentPage !== 1) {
			setCurrentPage(prev => prev - 1)
		} else {
			return
		}
	}

	const changeActivePage = (activePage: number) =>
		setCurrentPage(activePage)

	const nextPage = () => {
		if (currentPage !== totalPages) {
			setCurrentPage(prev => prev + 1)
		} else {
			return
		}
	}

	const loginMethodLabels: Record<UserLoginMethod, string> = {
		EMAIL: 'Email',
		PHONE: 'Телефон',
		GOOGLE: 'Google',
		GITHUB: 'GitHub',
		YANDEX: 'Яндекс',
		TELEGRAM: 'Telegram'
	}

	const getLoginMethods = (user: (typeof activePage)[number]) => {
		return (
			user.loginMethods?.map(method => loginMethodLabels[method]) ?? []
		)
	}

	const getRoleLabels = (user: (typeof activePage)[number]) => {
		return user.rights
	}

	const deleteTarget = activePage.find(user => user.id === deleteTargetId)
	const deleteTargetLabel =
		deleteTarget?.name ||
		deleteTarget?.email ||
		deleteTarget?.phone ||
		deleteTargetId ||
		'пользователя'

	const confirmDelete = () => {
		if (!deleteTargetId) return

		void deleteAsync(deleteTargetId)
		setDeleteTargetId(null)
	}

	const applyFilters = (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()
		setFilters(normalizeUserFilters(filterDraft))
		setCurrentPage(1)
		toast.success('Фильтры пользователей применены')
	}

	const resetFilters = () => {
		setFilterDraft(DEFAULT_USER_FILTERS)
		setFilters({})
		setCurrentPage(1)
		toast.success('Фильтры пользователей сброшены')
	}

	return (
		<section className={styles.wrapper}>
			{deleteTargetId && (
				<ConfirmDialog
					title="Удалить пользователя?"
					message={`Данное действие необратимо. Пользователь ${deleteTargetLabel} будет удалён без возможности восстановления. Этим действием вы можете остановить работу всей системы. Продолжайте только если уверены в своих действиях.`}
					confirmLabel="Удалить"
					cancelLabel="Отмена"
					onConfirm={confirmDelete}
					onCancel={() => setDeleteTargetId(null)}
				/>
			)}
			<Heading text="Панель администратора" />
			<AdminNavigation />
			<AdminHeader
				handleSearch={handleSearch}
				searchTerm={searchTerm}
				handleClear={handleClear}
			/>
			<AdminSectionHeading
				text="Список пользователей"
				title="Управление пользователями"
				description="Список аккаунтов с контактами, способами входа, ролями и действиями администратора."
				risk="high"
				riskText="Удаление пользователя необратимо и может сломать доступ, подписки или связанные данные. Перед удалением проверяй ID и контакт."
			/>
			<form className={styles.filters} onSubmit={applyFilters}>
				<div className={styles['filter-grid']}>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Роль</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.role}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									role: event.target.value as UserRoleFilter
								}))
							}
						>
							{ROLE_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Подписка</span>
						<select
							className={styles['filter-input']}
							value={filterDraft.subscription}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									subscription: event.target
										.value as UserSubscriptionFilter
								}))
							}
						>
							{SUBSCRIPTION_FILTER_OPTIONS.map(option => (
								<option key={option.value} value={option.value}>
									{option.label}
								</option>
							))}
						</select>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Регистрация с</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={filterDraft.registeredFrom}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									registeredFrom: event.target.value
								}))
							}
						/>
					</label>
					<label className={styles['filter-field']}>
						<span className={styles['filter-label']}>Регистрация по</span>
						<input
							className={styles['filter-input']}
							type="date"
							value={filterDraft.registeredTo}
							onChange={event =>
								setFilterDraft(prev => ({
									...prev,
									registeredTo: event.target.value
								}))
							}
						/>
					</label>
				</div>
				<div className={styles['filter-actions']}>
					<button type="submit" className={styles['filter-apply']}>
						Применить
					</button>
					<button
						type="button"
						className={styles['filter-reset']}
						onClick={resetFilters}
					>
						Сбросить
					</button>
				</div>
			</form>
			{isLoading ? (
				<div className={styles['list-section']}>
					<div className={styles['list-meta']}>
						<div className={styles['loading-meta-block']}>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-title']}
							/>
							<SkeletonLoader
								count={1}
								className={styles['loading-meta-subtitle']}
							/>
						</div>
						<SkeletonLoader
							count={1}
							className={styles['loading-meta-side']}
						/>
					</div>
					<div className={styles['mobile-list']}>
						{loadingRows.map(item => (
							<div key={item} className={styles['loading-card']}>
								<div className={styles['loading-card-header']}>
									<div className={styles['loading-card-main']}>
										<SkeletonLoader
											count={1}
											className={styles['loading-card-title']}
										/>
										<SkeletonLoader
											count={1}
											className={styles['loading-card-id']}
										/>
									</div>
									<SkeletonLoader
										count={1}
										className={styles['loading-card-actions']}
									/>
								</div>
								<div className={styles['loading-card-body']}>
									<SkeletonLoader
										count={1}
										className={styles['loading-card-line']}
									/>
									<SkeletonLoader
										count={1}
										className={styles['loading-card-line']}
									/>
									<SkeletonLoader
										count={1}
										className={styles['loading-card-line-short']}
									/>
									<SkeletonLoader
										count={1}
										className={styles['loading-card-line']}
									/>
									<SkeletonLoader
										count={1}
										className={styles['loading-card-line-short']}
									/>
								</div>
							</div>
						))}
					</div>
					<div className={styles['table-scroll']}>
						<table className={styles.table}>
							<caption className="srOnly">
								Заглушка списка пользователей в состоянии загрузки
							</caption>
							<thead>
								<tr>
									<th scope="col">ID</th>
									<th scope="col">Имя</th>
									<th scope="col">Email</th>
									<th scope="col">Телефон</th>
									<th scope="col">Способы входа</th>
									<th scope="col">Роли</th>
									<th scope="col">Дата регистрации</th>
									<th scope="col">Действия</th>
								</tr>
							</thead>
							<tbody>
								{loadingRows.map(item => (
									<tr key={item}>
										<td>
											<SkeletonLoader
												count={1}
												className={styles['loading-table-line']}
											/>
										</td>
										<td>
											<SkeletonLoader
												count={1}
												className={styles['loading-table-line-short']}
											/>
										</td>
										<td>
											<SkeletonLoader
												count={1}
												className={styles['loading-table-line']}
											/>
										</td>
										<td>
											<SkeletonLoader
												count={1}
												className={styles['loading-table-line-short']}
											/>
										</td>
										<td>
											<SkeletonLoader
												count={1}
												className={styles['loading-badge']}
											/>
										</td>
										<td>
											<div className={styles['loading-roles']}>
												<SkeletonLoader
													count={1}
													className={styles['loading-role']}
												/>
												<SkeletonLoader
													count={1}
													className={styles['loading-role']}
												/>
											</div>
										</td>
										<td>
											<SkeletonLoader
												count={1}
												className={styles['loading-table-line-short']}
											/>
										</td>
										<td>
											<SkeletonLoader
												count={1}
												className={styles['loading-card-actions']}
											/>
										</td>
									</tr>
								))}
							</tbody>
						</table>
					</div>
				</div>
			) : totalItems ? (
				<div className={styles['list-section']}>
					<div className={styles['list-meta']}>
						<div>
							<p className={styles['meta-title']}>Пользователи</p>
							<p className={styles['meta-subtitle']}>
								Всего записей: {totalItems}
							</p>
						</div>
						<p className={styles['meta-subtitle']}>
							Показано {activePage.length} из {totalItems}
						</p>
					</div>
					<div className={styles['mobile-list']}>
						{activePage.map(user => {
							const loginMethods = getLoginMethods(user)
							const roles = getRoleLabels(user)

							return (
								<div key={user.id} className={styles['user-card']}>
									<div className={styles['user-card-header']}>
										<div className={styles['user-card-main']}>
											<p className={styles['user-card-title']}>
												{user.name || 'Пользователь без имени'}
											</p>
											<p
												className={styles['user-card-id']}
												title={user.id}
											>
												ID: {user.id}
											</p>
										</div>
										<AdminActions
											editUrl={`${ADMIN_PAGES.USER}/edit/${user.id}`}
											userId={user.id}
											onDelete={setDeleteTargetId}
										/>
									</div>
									<div className={styles['user-card-body']}>
										<div className={styles['user-card-row']}>
											<span className={styles['card-label']}>Email</span>
											<span
												className={styles['card-value']}
												title={user.email || 'Нет данных'}
											>
												{user.email || 'Нет данных'}
											</span>
										</div>
										<div className={styles['user-card-row']}>
											<span className={styles['card-label']}>Телефон</span>
											<span
												className={styles['card-value']}
												title={user.phone || 'Нет данных'}
											>
												{user.phone || 'Нет данных'}
											</span>
										</div>
										<div className={styles['user-card-row']}>
											<span className={styles['card-label']}>
												Способы входа
											</span>
											<div className={styles['methods-list']}>
												{loginMethods.length ? (
													loginMethods.map(method => (
														<span
															key={`${user.id}-${method}`}
															className={styles['method-badge']}
														>
															{method}
														</span>
													))
												) : (
													<span
														className={clsx(
															styles['method-badge'],
															styles['method-badge-empty']
														)}
													>
														Не привязаны
													</span>
												)}
											</div>
										</div>
										<div className={styles['user-card-row']}>
											<span className={styles['card-label']}>Роли</span>
											<div className={styles['roles-list']}>
												{roles.length ? (
													roles.map(role => (
														<span
															key={role}
															className={styles['role-badge']}
														>
															{role}
														</span>
													))
												) : (
													<span className={styles['card-value']}>
														Нет данных
													</span>
												)}
											</div>
										</div>
										<div className={styles['user-card-row']}>
											<span className={styles['card-label']}>
												Дата регистрации
											</span>
											<span className={styles['card-value']}>
												{user.createdAt.replace(/\T.*/, '')}
											</span>
										</div>
									</div>
								</div>
							)
						})}
					</div>
					<div className={styles['table-scroll']}>
						<table className={styles.table}>
							<caption className="srOnly">Таблица пользователей</caption>
							<thead>
								<tr>
									<th scope="col">ID</th>
									<th scope="col">Имя</th>
									<th scope="col">Email</th>
									<th scope="col">Телефон</th>
									<th scope="col">Способы входа</th>
									<th scope="col">Роли</th>
									<th scope="col">Дата регистрации</th>
									<th scope="col">Действия</th>
								</tr>
							</thead>
							<tbody>
								{activePage.map(user => {
									const loginMethods = getLoginMethods(user)
									const roles = getRoleLabels(user)

									return (
										<tr key={user.id}>
											<td title={user.id}>
												<span className={styles.truncate}>{user.id}</span>
											</td>
											<td title={user.name || 'Нет данных'}>
												<span className={styles.truncate}>
													{user.name || 'Нет данных'}
												</span>
											</td>
											<td title={user.email || 'Нет данных'}>
												<span className={styles.truncate}>
													{user.email || 'Нет данных'}
												</span>
											</td>
											<td title={user.phone || 'Нет данных'}>
												<span className={styles.truncate}>
													{user.phone || 'Нет данных'}
												</span>
											</td>
											<td>
												<div className={styles['methods-list']}>
													{loginMethods.length ? (
														loginMethods.map(method => (
															<span
																key={`${user.id}-${method}`}
																className={styles['method-badge']}
															>
																{method}
															</span>
														))
													) : (
														<span
															className={clsx(
																styles['method-badge'],
																styles['method-badge-empty']
															)}
														>
															Не привязаны
														</span>
													)}
												</div>
											</td>
											<td>
												<div className={styles['roles-list']}>
													{roles.length ? (
														roles.map(role => (
															<span
																key={role}
																className={styles['role-badge']}
															>
																{role}
															</span>
														))
													) : (
														<span className={styles.truncate}>
															Нет данных
														</span>
													)}
												</div>
											</td>
											<td>{user.createdAt.replace(/\T.*/, '')}</td>
											<td>
												<div className={styles['actions-cell']}>
													<AdminActions
														editUrl={`${ADMIN_PAGES.USER}/edit/${user.id}`}
														userId={user.id}
														onDelete={setDeleteTargetId}
													/>
												</div>
											</td>
										</tr>
									)
								})}
							</tbody>
						</table>
					</div>
					{totalItems > itemQuantity && (
						<Pagination
							listPage={listPage}
							currentPage={currentPage}
							prevPage={prevPage}
							nextPage={nextPage}
							changeActivePage={changeActivePage}
						/>
					)}
				</div>
			) : (
				<div className={styles['empty-state']}>
					<p className={styles['meta-title']}>Пользователи не найдены</p>
					<p className={styles['meta-subtitle']}>
						Попробуйте изменить строку поиска или очистить фильтр.
					</p>
				</div>
			)}
		</section>
	)
}

export default UserList
