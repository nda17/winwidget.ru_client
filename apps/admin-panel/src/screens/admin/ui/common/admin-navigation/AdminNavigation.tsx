'use client'

import AdminDangerBanner from '@/screens/admin/ui/common/admin-danger-banner/AdminDangerBanner'
import AdminNavItem from '@/screens/admin/ui/common/admin-navigation/AdminNavItem'
import styles from '@/screens/admin/ui/common/admin-navigation/AdminNavigation.module.scss'
import { navItems } from '@/screens/admin/ui/common/admin-navigation/data/admin-navigation.data'
import { useUser } from '@/entities/user'
import { UserRole } from '@/entities/user'
import clsx from 'clsx'
import { NextPage } from 'next'

const AdminNavigation: NextPage = () => {
	const { user } = useUser()
	const visibleItems = navItems.filter(
		item => !item.devOnly || user?.rights?.includes(UserRole.DEV)
	)

	return (
		<>
			<nav aria-label="Навигация администратора">
				<ul className={clsx(styles['nav-list'])}>
					{visibleItems.map(item => (
						<AdminNavItem key={item.link} item={item} />
					))}
				</ul>
			</nav>
			<AdminDangerBanner />
		</>
	)
}

export default AdminNavigation
