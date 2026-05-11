'use client'

import AdminDangerBanner from '@/components/ui/admin/admin-danger-banner/AdminDangerBanner'
import AdminNavItem from '@/components/ui/admin/admin-navigation/AdminNavItem'
import styles from '@/components/ui/admin/admin-navigation/AdminNavigation.module.scss'
import { navItems } from '@/components/ui/admin/admin-navigation/data/admin-navigation.data'
import useUser from '@/hooks/useUser'
import { UserRole } from '@/services/auth/auth.types'
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
