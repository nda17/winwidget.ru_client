'use client'

import AdminDangerBanner from '@/components/ui/admin/admin-danger-banner/AdminDangerBanner'
import AdminNavItem from '@/components/ui/admin/admin-navigation/AdminNavItem'
import styles from '@/components/ui/admin/admin-navigation/AdminNavigation.module.scss'
import { navItems } from '@/components/ui/admin/admin-navigation/data/admin-navigation.data'
import clsx from 'clsx'
import { NextPage } from 'next'

const AdminNavigation: NextPage = () => {
	return (
		<>
			<nav aria-label="Навигация администратора">
				<ul className={clsx(styles['nav-list'])}>
					{navItems?.map(item => (
						<AdminNavItem key={item.link} item={item} />
					))}
				</ul>
			</nav>
			<AdminDangerBanner />
		</>
	)
}

export default AdminNavigation
