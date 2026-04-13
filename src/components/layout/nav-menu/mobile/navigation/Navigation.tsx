import styles from '@/components/layout/nav-menu/mobile/navigation/Navigation.module.scss'
import Hamburger from '@/components/ui/hamburger/Hamburger'
import LogoImage from '@/components/ui/logo-image/LogoImage'
import clsx from 'clsx'
import { NextPage } from 'next'

const Navigation: NextPage = () => {
	return (
		<div className={styles.wrapper}>
			<div className={clsx(styles['layout-container'])}>
				<div className={styles.brand}>
					<LogoImage />
					<div className={styles['brand-copy']}>
						<span className={styles['brand-title']}>Winwidget</span>
						<span className={styles['brand-subtitle']}>
							Виджеты для сайта
						</span>
					</div>
				</div>
				<div className={styles['menu-toggle']}>
					<Hamburger />
				</div>
			</div>
		</div>
	)
}

export default Navigation
