'use client'
import styles from '@/components/screens/admin/user-list/UserList.module.scss'
import AdminActions from '@/components/ui/admin/admin-actions/AdminActions'
import AdminHeader from '@/components/ui/admin/admin-header/AdminHeader'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AlertPopup from '@/components/ui/alert-popup/AlertPopup'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SkeletonLoader from '@/components/ui/skeleton-loader/SkeletonLoader'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import { ADMIN_PAGES } from '@/config/pages/admin.config'
import useUserList from '@/hooks/useUserList'
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

	const textPopup =
		'The data will be deleted without the possibility of recovery.'

	//Pagination settings
	const [currentPage, setCurrentPage] = useState(1)
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
			setCurrentPage((prev) => prev - 1)
		} else {
			return
		}
	}

	const changeActivePage = (activePage: number) =>
		setCurrentPage(activePage)

	const nextPage = () => {
		if (currentPage !== totalPages) {
			setCurrentPage((prev) => prev + 1)
		} else {
			return
		}
	}

	const getUserStatus = (user: (typeof activePage)[number]) => {
		if (user.email) {
			return {
				label: 'Email подтвержден',
				tone: 'success'
			}
		}

		return user.isPhoneVerified
			? {
					label: 'Телефон подтвержден',
					tone: 'success'
				}
			: {
					label: 'Телефон не подтвержден',
					tone: 'pending'
				}
	}

	return (
		<div className={styles.wrapper}>
			<Heading text="Панель администратора" />
			<AlertPopup removeHandler={deleteAsync} text={textPopup} />
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
						{loadingRows.map((item) => (
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
							<thead>
								<tr>
									<th>ID</th>
									<th>Имя</th>
									<th>Email</th>
									<th>Телефон</th>
									<th>Статус</th>
									<th>Роли</th>
									<th>Дата регистрации</th>
									<th>Действия</th>
								</tr>
							</thead>
							<tbody>
								{loadingRows.map((item) => (
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
						{activePage.map((user) => {
							const status = getUserStatus(user)

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
											<span className={styles['card-label']}>Статус</span>
											<span
												className={clsx(
													styles['status-badge'],
													status.tone === 'success'
														? styles['status-badge-success']
														: styles['status-badge-pending']
												)}
											>
												{status.label}
											</span>
										</div>
										<div className={styles['user-card-row']}>
											<span className={styles['card-label']}>Роли</span>
											<div className={styles['roles-list']}>
												{user.rights.length ? (
													user.rights.map((role) => (
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
							<thead>
								<tr>
									<th>ID</th>
									<th>Имя</th>
									<th>Email</th>
									<th>Телефон</th>
									<th>Статус</th>
									<th>Роли</th>
									<th>Дата регистрации</th>
									<th>Действия</th>
								</tr>
							</thead>
							<tbody>
								{activePage.map((user) => {
									const status = getUserStatus(user)

									return (
										<tr key={user.id}>
											<td title={user.id}>
												<span className={styles.truncate}>
													{user.id}
												</span>
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
												<span
													className={clsx(
														styles['status-badge'],
														status.tone === 'success'
															? styles['status-badge-success']
															: styles['status-badge-pending']
													)}
												>
													{status.label}
												</span>
											</td>
											<td>
												<div className={styles['roles-list']}>
													{user.rights.length ? (
														user.rights.map((role) => (
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
		</div>
	)
}

export default UserList
