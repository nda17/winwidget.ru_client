import { staticMenu } from '@/app/_ui/layout/nav-menu/data/menu.data'
import MenuItem from '@/app/_ui/layout/nav-menu/mobile/menu/menu-item/MenuItem'
import { IMenuItem } from '@/app/_ui/layout/nav-menu/menu-item.interface'
import styles from '@/app/_ui/layout/nav-menu/mobile/menu/mobile-static-menu/MobileStaticMenu.module.scss'
import { NextPage } from 'next'

const MobileStaticMenu: NextPage = () => {
	if (!staticMenu.items?.length) return null

	return (
		<ul className={styles.wrapper}>
			{staticMenu.items?.map((item: IMenuItem) => (
				<MenuItem item={item} key={item.link} />
			))}
		</ul>
	)
}

export default MobileStaticMenu
