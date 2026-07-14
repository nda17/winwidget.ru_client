import styles from '@/screens/admin/ui/common/admin-navigation/AdminNavigation.module.scss'
import { INavItem } from '@/screens/admin/ui/common/admin-navigation/admin-navigation.interface'
import clsx from 'clsx'
import { NextPage } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const AdminNavItem: NextPage<{ item: INavItem }> = ({
	item: { link, title, option }
}) => {
	const pathname = usePathname()
	const isActive =
		pathname === link || Boolean(option && pathname.startsWith(option))

	return (
		<li>
			<Link href={link}>
				<span
					className={clsx({
						[styles.active]: isActive
					})}
				>
					{title}
				</span>
			</Link>
		</li>
	)
}

export default AdminNavItem
