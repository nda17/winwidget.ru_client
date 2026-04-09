import styles from '@/components/layout/footer/Footer.module.scss'
import FontAwesomeIcon from '@/components/ui/icons/FontAwesomeIcon'
import LogoImage from '@/components/ui/logo-image/LogoImage'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import clsx from 'clsx'
import { NextPage } from 'next'
import Link from 'next/link'

const Footer: NextPage = () => {
	const year = 2023
	const currentYear = new Date().getFullYear()

	return (
		<footer className={styles.footer}>
			<div className={clsx(styles['layout-container'])}>
				<LogoImage />
				<div className={clsx(styles['information-wrapper'])}>
					<div className={clsx(styles['socials-wrapper'])}>
						<h4 className={clsx(styles['title-block'])}>Мы в соцсетях:</h4>

						<div className={clsx(styles['link-icon-wrapper'])}>
							<Link
								href={PUBLIC_PAGES.SOCIALS_LINK_VK}
								className={clsx(styles['link-icon'])}
							>
								<FontAwesomeIcon name="FaVk" fill="gray" />
							</Link>
							<Link
								href={PUBLIC_PAGES.SOCIALS_LINK_TG}
								className={clsx(styles['link-icon'])}
							>
								<FontAwesomeIcon name="FaTelegram" fill="gray" />
							</Link>
						</div>
					</div>

					<div className={clsx(styles['contacts-wrapper'])}>
						<h4 className={clsx(styles['title-block'])}>Контакты:</h4>
						<p className={clsx(styles['info-llc'])}>ООО ЮБС</p>

						<a
							href="tel:88008008888"
							className={clsx(styles['link-contact'])}
						>
							88008008888
						</a>

						<a
							href="mailto:info@winwidget.ru"
							className={clsx(styles['link-contact'])}
						>
							info@info.com
						</a>
					</div>

					<div className={clsx(styles['legal-wrapper'])}>
						<h4 className={clsx(styles['title-block'])}>Документы:</h4>
						<Link
							href={PUBLIC_PAGES.PRIVACY_POLICY}
							className={clsx(styles['link-legal'])}
						>
							Политика конфиденциальности
						</Link>
						<Link
							href={PUBLIC_PAGES.COOKIE_NOTICE}
							className={clsx(styles['link-legal'])}
						>
							Уведомление о cookie
						</Link>
					</div>
				</div>

				<div className={clsx(styles['inform-wrapper'])}>
					<p className={clsx(styles['text-inform'])}>
						Все права защищены ©
					</p>
					<p className={clsx(styles['date-inform'])}>
						{year === currentYear
							? currentYear
							: `${year} - ${currentYear}`}
					</p>
				</div>
			</div>
		</footer>
	)
}

export default Footer
