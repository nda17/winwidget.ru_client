import styles from '@/components/layout/nav-menu/desktop/DesktopNavBar.module.scss'
import Menu from '@/components/layout/nav-menu/desktop/menu/Menu'
import clsx from 'clsx'
import { NextPage } from 'next'

const DesktopNavBar: NextPage = () => {
	return (
		<nav className={styles.wrapper} aria-label="Основная навигация">
			<div className={clsx(styles['layout-container'])}>
				{/* <div className={styles.logo}>
					<LogoImage />
				</div> */}
				<Menu />
			</div>
		</nav>
	)
}

export default DesktopNavBar
