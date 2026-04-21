'use client'
import styles from '@/components/screens/admin/user-list/UserList.module.scss'
import AdminActions from '@/components/ui/admin/admin-actions/AdminActions'
import AdminHeader from '@/components/ui/admin/admin-header/AdminHeader'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import ConfirmDialog from '@/components/ui/confirm-dialog/ConfirmDialog'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import { ADMIN_PAGES } from '@/config/pages/admin.config'
import useUserList from '@/hooks/useUserList'
import { UserLoginMethod } from '@/shared/types/user.types'
import clsx from 'clsx'
import { NextPage } from 'next'
import { useEffect, useState } from 'react'

const UserList: NextPage = () => {
	const {
		data,
		isLoading,
		handleSearch,
		handleClear,
		searchTerm,
		deleteAsync
	} = useUserList()

	//Pagination settings
	const [currentPage, setCurrentPage] = useState(1)
	const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null)
	const itemQuantity = 10
	const totalItems = data?.length ?? 0
	const totalPages = Math.max(1, Math.ceil(totalItems / itemQuantity))
	const loadingRows = Array.from({ length: 5 }, (_, index) => index)
	const lastCardIndex = currentPage * itemQuantity
	const firstCardIndex = lastCardIndex - itemQuantity
	const activePage = data?.slice(firstCardIndex, lastCardIndex) ?? []
	const listPage = []
	for (let i = 1; i <= totalPages; i++) {
		listPage.push(i)
	}

	useEffect(() => {
		setCurrentPage(1)
	}, [searchTerm])

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
		YANDEX: 'Яндекс'
	}

	const getLoginMethods = (user: (typeof activePage)[number]) => {
		return (
			user.loginMethods?.map(method => loginMethodLabels[method]) ?? []
		)
	}

	const getRoleLabels = (user: (typeof activePage)[number]) => {
		return user.rights
	}

	const deleteTarget = data?.find(user => user.id === deleteTargetId)
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

	return (
		<section className={styles.wrapper}>
			{deleteTargetId && (
				<ConfirmDialog
					title="Удалить пользователя?"
					message={`Пользователь ${deleteTargetLabel} будет удалён без возможности восстановления.`}
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
			<SubHeading text="Список пользователей" />
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
			) : data?.length ? (
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
