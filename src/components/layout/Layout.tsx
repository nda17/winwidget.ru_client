'use client'
import VeilBackground from '@/components//ui/veil-background/VeilBackground'
import styles from '@/components/layout/Layout.module.scss'
import Footer from '@/components/layout/footer/Footer'
import Header from '@/components/layout/header/Header'
import { ILayout } from '@/components/layout/layout.interface'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { useAuthStore } from '@/store/auth-store/auth-store'
import { useVeilBackgroundStore } from '@/store/veil-background-store/veil-background-store'
import { NextPage } from 'next'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const Layout: NextPage<ILayout> = ({ children }) => {
	const visibleVeilBackground = useVeilBackgroundStore(
		(state) => state.visible
	)
	const auth = useAuthStore((state) => state.auth)
	const pathname = usePathname()
	const isRecaptchaPage =
		pathname === PUBLIC_PAGES.LOGIN ||
		pathname === PUBLIC_PAGES.REGISTER ||
		pathname === PUBLIC_PAGES.RESTORE_PASSWORD

	useEffect(() => {
		const shouldHideRecaptchaBadge = auth || !isRecaptchaPage

		document.body.classList.toggle(
			'hide-recaptcha-badge',
			shouldHideRecaptchaBadge
		)

		return () => {
			document.body.classList.remove('hide-recaptcha-badge')
		}
	}, [auth, isRecaptchaPage])

	return (
		<div className={styles.layout}>
			<Header />
			{visibleVeilBackground && <VeilBackground />}
			<main className={styles.main}>{children}</main>
			<Footer />
		</div>
	)
}

export default Layout
