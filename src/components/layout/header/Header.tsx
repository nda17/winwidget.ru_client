'use client'
import styles from '@/components/layout/header/Header.module.scss'
import DesktopNavBar from '@/components/layout/nav-menu/desktop/DesktopNavBar'
import MobileNavBar from '@/components/layout/nav-menu/mobile/MobileNavBar'
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
				<MobileNavBar isDark={isAbsolute} />
				<DesktopNavBar />
			</div>
		</header>
	)
}

export default Header
