import styles from '@/components/layout/nav-menu/mobile/menu/menu-item/MenuItem.module.scss'
import { IMenuItem } from '@/components/layout/nav-menu/menu-item.interface'
import AppIcon from '@/components/ui/icons/AppIcon'
import { useHamburgerStore } from '@/store/hamburger-store/hamburger-store'
import { useVeilBackgroundStore } from '@/store/veil-background-store/veil-background-store'
import clsx from 'clsx'
import { NextPage } from 'next'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const MenuItem: NextPage<{ item: IMenuItem }> = ({ item }) => {
	const pathname = usePathname()
	const changeVisibleHamburger = useHamburgerStore(
		state => state.setVisible
	)
	const changeVisibleVeilBackground = useVeilBackgroundStore(
		state => state.setVisible
	)

	const closeMenu = () => {
		changeVisibleHamburger(false)
		changeVisibleVeilBackground(false)
	}

	return (
		<li
			className={clsx([styles.wrapper], {
				[styles.active]: pathname === item.link
			})}
		>
			<Link
				href={item.link}
				className={clsx(styles['link-button'])}
				onClick={closeMenu}
			>
				<AppIcon name={item.icon} />
				{item.title}
			</Link>
		</li>
	)
}

export default MenuItem
