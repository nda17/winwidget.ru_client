import styles from '@/components/layout/nav-menu/desktop/DesktopNavBar.module.scss'
import Menu from '@/components/layout/nav-menu/desktop/menu/Menu'
import LogoImage from '@/components/ui/logo-image/LogoImage'
import clsx from 'clsx'
import { NextPage } from 'next'

const DesktopNavBar: NextPage = () => {
	return (
		<div className={styles.wrapper}>
			<div className={clsx(styles['layout-container'])}>
				<div className={styles.brand}>
					<LogoImage />
					<div className={styles['brand-copy']}>
						<span className={styles['brand-title']}>WinWidget</span>
						<span className={styles['brand-subtitle']}>
							Виджеты для роста заявок
						</span>
					</div>
				</div>
				<Menu />
			</div>
		</div>
	)
}

export default DesktopNavBar
