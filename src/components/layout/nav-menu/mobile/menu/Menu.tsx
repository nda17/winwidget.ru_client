'use client'

import styles from '@/components/layout/nav-menu/mobile/menu/Menu.module.scss'
import MobileDynamicMenu from '@/components/layout/nav-menu/mobile/menu/mobile-dynamic-menu/MobileDynamicMenu'
import MobileStaticMenu from '@/components/layout/nav-menu/mobile/menu/mobile-static-menu/MobileStaticMenu'
import LogoImage from '@/components/ui/logo-image/LogoImage'
import { useHamburgerStore } from '@/store/hamburger-store/hamburger-store'
import { useVeilBackgroundStore } from '@/store/veil-background-store/veil-background-store'
import { NextPage } from 'next'

const Menu: NextPage = () => {
	const setHamburger = useHamburgerStore(state => state.setVisible)
	const setVeil = useVeilBackgroundStore(state => state.setVisible)

	const close = () => {
		setHamburger(false)
		setVeil(false)
	}

	return (
		<aside
			id="mobile-navigation-menu"
			className={styles.wrapper}
			aria-label="Мобильное меню"
		>
			<div className={styles.header}>
				<LogoImage />
				<button
					className={styles.closeBtn}
					onClick={close}
					aria-label="Закрыть меню"
				>
					<svg
						width="18"
						height="18"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						strokeWidth="2.5"
						strokeLinecap="round"
					>
						<line x1="18" y1="6" x2="6" y2="18" />
						<line x1="6" y1="6" x2="18" y2="18" />
					</svg>
				</button>
			</div>
			<MobileStaticMenu />
			<MobileDynamicMenu />
		</aside>
	)
}

export default Menu
