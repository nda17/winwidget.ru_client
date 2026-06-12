'use client'
import VeilBackground from '@/components/ui/veil-background/VeilBackground'
import Snowflakes from '@/components/ui/snowflakes/Snowflakes'
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

const Layout: NextPage<ILayout> = ({
	children,
	siteSettings,
	footerContent
}) => {
	const visibleVeilBackground = useVeilBackgroundStore(
		state => state.visible
	)
	const auth = useAuthStore(state => state.auth)
	const pathname = usePathname()
	const isRecaptchaPage =
		pathname === PUBLIC_PAGES.LOGIN ||
		pathname === PUBLIC_PAGES.REGISTER ||
		pathname === PUBLIC_PAGES.RESTORE_PASSWORD

	useEffect(() => {
		const shouldHideRecaptchaBadge =
			auth || !isRecaptchaPage || siteSettings?.recaptchaEnabled === false

		document.body.classList.toggle(
			'hide-recaptcha-badge',
			shouldHideRecaptchaBadge
		)

		return () => {
			document.body.classList.remove('hide-recaptcha-badge')
		}
	}, [auth, isRecaptchaPage, siteSettings?.recaptchaEnabled])

	const isLandingPage = pathname === PUBLIC_PAGES.HOME
	const isWidgetPreview =
		pathname.startsWith('/page-wheel/') ||
		pathname.startsWith('/page-quiz/') ||
		pathname.startsWith('/page-callback/') ||
		pathname.startsWith('/page-timer/') ||
		pathname.startsWith('/page-stop-offer/') ||
		pathname.startsWith('/page-online-consultant/')

	if (isWidgetPreview) {
		return <>{children}</>
	}

	return (
		<div className={styles.layout}>
			{siteSettings?.snowflakeEnabled && <Snowflakes />}
			{siteSettings?.bannerEnabled && siteSettings.bannerText && (
				<div className={styles.banner}>
					<span>{siteSettings.bannerText}</span>
				</div>
			)}
			<Header isAbsolute={isLandingPage} />
			{visibleVeilBackground && <VeilBackground />}
			<main className={isLandingPage ? styles.mainLanding : styles.main}>
				{children}
			</main>
			<Footer content={footerContent} />
		</div>
	)
}

export default Layout
