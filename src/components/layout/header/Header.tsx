import styles from '@/components/layout/header/Header.module.scss'
import DesktopNavBar from '@/components/layout/nav-menu/desktop/DesktopNavBar'
import MobileNavBar from '@/components/layout/nav-menu/mobile/MobileNavBar'
import LogoImage from '@/components/ui/logo-image/LogoImage'
import { NextPage } from 'next'

interface HeaderProps {
	isAbsolute?: boolean
}

const Header: NextPage<HeaderProps> = ({ isAbsolute }) => {
	return (
		<header
			className={`${styles.header} ${isAbsolute ? styles.headerAbsolute : ''}`}
		>
			<div className={styles['header-shell']}>
				<div className={styles.brand}>
					<LogoImage isLight={isAbsolute} />
				</div>
				<MobileNavBar isDark={isAbsolute} />
				<DesktopNavBar />
			</div>
		</header>
	)
}

export default Header
