'use client'
import VeilBackground from '@/shared/ui/veil-background/VeilBackground'
import Snowflakes from '@/shared/ui/snowflakes/Snowflakes'
import styles from '@/app/_ui/layout/Layout.module.scss'
import Footer from '@/app/_ui/layout/footer/Footer'
import Header from '@/app/_ui/layout/header/Header'
import { ILayout } from '@/app/_ui/layout/layout.interface'
import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import { useAuthStore } from '@/entities/user'
import { useVeilBackgroundStore } from '@/shared/lib/veil-background'
import { NextPage } from 'next'
import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

const WIDGET_SETTINGS_PATH_PATTERN =
	/^\/(?:cabinet|admin)\/widgets\/(?:wheel|quiz|callback|timer|stop-offer|online-consultant|calculator)\/[^/]+\/?$/

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
		pathname.startsWith('/page-online-consultant/') ||
		pathname.startsWith('/page-calculator/')
	const isWidgetSettings = WIDGET_SETTINGS_PATH_PATTERN.test(pathname)

	if (isWidgetPreview) {
		return <>{children}</>
	}

	return (
		<div
			className={`${styles.layout} ${
				isWidgetSettings ? styles.widgetSettingsLayout : ''
			}`}
		>
			{siteSettings?.snowflakeEnabled && <Snowflakes />}
			{siteSettings?.bannerEnabled && siteSettings.bannerText && (
				<div className={styles.banner}>
					<span>{siteSettings.bannerText}</span>
				</div>
			)}
			<Header isAbsolute={isLandingPage} />
			{visibleVeilBackground && <VeilBackground />}
			<main
				className={
					isWidgetSettings
						? styles.mainWidgetSettings
						: isLandingPage
							? styles.mainLanding
							: styles.main
				}
			>
				{children}
			</main>
			<Footer content={footerContent} />
		</div>
	)
}

export default Layout
