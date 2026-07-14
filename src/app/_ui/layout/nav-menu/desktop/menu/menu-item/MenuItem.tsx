import styles from '@/app/_ui/layout/nav-menu/desktop/menu/menu-item/MenuItem.module.scss'
import { IMenuItem } from '@/app/_ui/layout/nav-menu/menu-item.interface'
import AppIcon from '@/shared/ui/icons/AppIcon'
import clsx from 'clsx'
import { NextPage } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MenuItem: NextPage<{ item: IMenuItem }> = ({ item }) => {
	const pathname = usePathname()

	return (
		<li
			className={clsx([styles.wrapper], {
				[styles.active]: pathname === item.link
			})}
		>
			<Link href={item.link} className={clsx(styles['link-button'])}>
				<AppIcon name={item.icon} />
				{item.title}
			</Link>
		</li>
	)
}

export default MenuItem
