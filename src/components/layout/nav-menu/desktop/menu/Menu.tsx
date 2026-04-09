import styles from '@/components/layout/nav-menu/desktop/menu/Menu.module.scss'
import DesktopStaticMenu from '@/components/layout/nav-menu/desktop/menu/desktop-static-menu/DesktopStaticMenu'
import { NextPage } from 'next'
import dynamic from 'next/dynamic'
const DesktopDynamicMenu = dynamic(
	() =>
		import(
			'@/components/layout/nav-menu/desktop/menu/desktop-dynamic-menu/DesktopDynamicMenu'
		),
	{
		loading: () => null,
		ssr: false
	}
)

const Menu: NextPage = () => {
	return (
		<div className={styles.wrapper}>
			<DesktopStaticMenu />
			<DesktopDynamicMenu />
		</div>
	)
}

export default Menu
