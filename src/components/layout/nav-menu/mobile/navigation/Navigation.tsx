import styles from '@/components/layout/nav-menu/mobile/navigation/Navigation.module.scss'
import Hamburger from '@/components/ui/hamburger/Hamburger'
import LogoImage from '@/components/ui/logo-image/LogoImage'
import clsx from 'clsx'
import { NextPage } from 'next'

interface NavigationProps {
	isDark?: boolean
}

const Navigation: NextPage<NavigationProps> = ({ isDark }) => {
	return (
		<div className={styles.wrapper}>
			<div className={clsx(styles['layout-container'])}>
				<div className={styles.brand}>
					<LogoImage />
				</div>
				<div className={styles.right}>
					<div
						className={clsx(
							styles['menu-toggle'],
							!isDark && styles['menu-toggle--light']
						)}
					>
						<Hamburger />
					</div>
				</div>
			</div>
		</div>
	)
}

export default Navigation
