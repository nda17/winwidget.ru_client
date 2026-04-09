'use client'
import styles from '@/components/screens/admin/user-list/UserList.module.scss'
import AdminActions from '@/components/ui/admin/admin-actions/AdminActions'
import AdminHeader from '@/components/ui/admin/admin-header/AdminHeader'
import AdminNavigation from '@/components/ui/admin/admin-navigation/AdminNavigation'
import AlertPopup from '@/components/ui/alert-popup/AlertPopup'
import CirclesLoader from '@/components/ui/circles-loader/CirclesLoader'
import Heading from '@/components/ui/heading/Heading'
import Pagination from '@/components/ui/pagination/Pagination'
import SubHeading from '@/components/ui/sub-heading/SubHeading'
import { ADMIN_PAGES } from '@/config/pages/admin.config'
import useUserList from '@/hooks/useUserList'
import clsx from 'clsx'
import { NextPage } from 'next'
import { useState } from 'react'

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
	const lastCardIndex = currentPage * itemQuantity
	const firstCardIndex = lastCardIndex - itemQuantity
	const activePage = data?.slice(firstCardIndex, lastCardIndex)
	const listPage = []
	for (let i = 1; i <= Math.ceil(data?.length / itemQuantity); i++) {
		listPage.push(i)
	}

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
		if (currentPage !== Math.ceil(data?.length / itemQuantity)) {
			setCurrentPage((prev) => prev + 1)
		} else {
			return
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
				<CirclesLoader />
			) : data?.length ? (
				<div className={clsx(styles['wrapper-table'])}>
					<div className={clsx(styles['row-table'])}>
						<p
							className={clsx(
								styles['column-item'],
								styles['column-item-title'],
								'border-t',
								'border-l',
								'border-b'
							)}
						>
							ID:
						</p>
						<p
							className={clsx(
								styles['column-item'],
								styles['column-item-title'],
								'border-t',
								'border-l',
								'border-b'
							)}
						>
							Имя:
						</p>
						<p
							className={clsx(
								styles['column-item'],
								styles['column-item-title'],
								'border-t',
								'border-l',
								'border-b'
							)}
						>
							Email:
						</p>
						<p
							className={clsx(
								styles['column-item'],
								styles['column-item-title'],
								'border-t',
								'border-l',
								'border-b'
							)}
						>
							Статус:
						</p>
						<p
							className={clsx(
								styles['column-item'],
								styles['column-item-title'],
								'border-t',
								'border-l',
								'border-b'
							)}
						>
							Роли:
						</p>
						<p
							className={clsx(
								styles['column-item'],
								styles['column-item-title'],
								'border-t',
								'border-l',
								'border-b'
							)}
						>
							Дата регистрации:
						</p>
						<p
							className={clsx(
								styles['column-item'],
								styles['column-item-title'],
								'border-t',
								'border-r',
								'border-l',
								'border-b'
							)}
						>
							Действия:
						</p>
					</div>

					{activePage.map((user) => (
						<div key={user.id} className={clsx(styles['row-table'])}>
							<p
								className={clsx(
									styles['column-item'],
									'border-l',
									'border-b'
								)}
							>
								{user.id || 'Нет данных'}
							</p>
							<p
								className={clsx(
									styles['column-item'],
									'border-l',
									'border-b'
								)}
							>
								{user.name || 'Нет данных'}
							</p>
							<p
								className={clsx(
									styles['column-item'],
									'border-l',
									'border-b'
								)}
							>
								{user.email || 'Нет данных'}
							</p>
							<p
								className={clsx(
									styles['column-item'],
									'border-l',
									'border-b'
								)}
							>
								{!user.verificationToken ? 'Подтвержден' : 'Не подтвержден'}
							</p>

							<p
								className={clsx(
									styles['column-item'],
									'border-l',
									'border-b'
								)}
							>
								{user.rights.length > 1
									? user.rights?.join(', ')
									: user.rights || 'Нет данных'}
							</p>
							<p
								className={clsx(
									styles['column-item'],
									'border-l',
									'border-b'
								)}
							>
								{user.createdAt.replace(/\T.*/, '') || 'Нет данных'}
							</p>
							<div
								className={clsx(
									styles['column-item'],
									styles['column-item-title'],
									'border-l',
									'border-r',
									'border-b',
									'flex',
									'justify-center',
									'items-center'
								)}
							>
								<AdminActions
									editUrl={`${ADMIN_PAGES.USER}/edit/${user.id}`}
									userId={user.id}
								/>
							</div>
						</div>
					))}

					{data.length > 10 && (
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
				<p>Not found!</p>
			)}
		</div>
	)
}

export default UserList
