import styles from '@/components/screens/legal-documentation/cookie-notice/CookieNotice.module.scss'
import Heading from '@/components/ui/heading/Heading'
import { NextPage } from 'next'

const navigationSections = [
	{ href: '#general', label: '1. Общие положения' },
	{ href: '#consent', label: '2. Согласие и условия обработки' },
	{ href: '#terms', label: '3. Основные понятия' }
]

const browserLinks = [
	{
		name: 'Google Chrome',
		url: 'https://support.google.com/chrome/answer/95647?hl=ru'
	},
	{
		name: 'Microsoft Edge',
		url: 'https://support.microsoft.com/ru-ru/windows/%D1%83%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5-%D1%84%D0%B0%D0%B9%D0%BB%D0%B0%D0%BC%D0%B8-cookie-%D0%B2-microsoft-edge-%D0%BF%D1%80%D0%BE%D1%81%D0%BC%D0%BE%D1%82%D1%80-%D1%80%D0%B0%D0%B7%D1%80%D0%B5%D1%88%D0%B5%D0%BD%D0%B8%D0%B5-%D0%B1%D0%BB%D0%BE%D0%BA%D0%B8%D1%80%D0%BE%D0%B2%D0%BA%D0%B0-%D1%83%D0%B4%D0%B0%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5-%D0%B8-%D0%B8%D1%81%D0%BF%D0%BE%D0%BB%D1%8C%D0%B7%D0%BE%D0%B2%D0%B0%D0%BD%D0%B8%D0%B5-168dab11-0753-043d-7c16-ede5947fc64d'
	},
	{
		name: 'Internet Explorer',
		url: 'https://support.microsoft.com/en-us/windows/manage-cookies-in-microsoft-edge-view-allow-block-delete-and-use-168dab11-0753-043d-7c16-ede5947fc64d'
	},
	{
		name: 'Opera',
		url: 'https://help.opera.com/ru/latest/web-preferences/#%D0%A3%D0%BF%D1%80%D0%B0%D0%B2%D0%BB%D0%B5%D0%BD%D0%B8%D0%B5-%D1%84%D0%B0%D0%B9%D0%BB%D0%B0%D0%BC%D0%B8-cookie'
	},
	{
		name: 'Mozilla Firefox',
		url: 'https://support.mozilla.org/ru/kb/kuki-informaciya-kotoruyu-veb-sajty-hranyat-na-vas'
	},
	{
		name: 'Safari',
		url: 'https://support.apple.com/ru-ru/105082'
	},
	{
		name: 'Samsung Browser',
		url: 'https://www.samsung.com/ru/support/mobile-devices/how-to-clear-the-cache-history-or-cookies/'
	}
]

const cookieTypes = [
	{
		title: 'Сеансовые cookie',
		description:
			'Сохраняются в браузере только на протяжении вашего сеанса в браузере, то есть до тех пор, пока вы не уйдете с сайта.'
	},
	{
		title: 'Постоянные cookie',
		description:
			'Сохраняются в вашем браузере после завершения сеанса, если вы не удалили их вручную.'
	},
	{
		title: 'Функциональные cookie',
		description:
			'Позволяют сайту запомнить ваши варианты выбора, узнавать вас при повторном посещении и персонализировать просмотр.'
	},
	{
		title: 'Cookie-сборщики информации',
		description:
			'Получают и накапливают информацию о посещенных страницах, наличии сообщений об ошибках и других технических данных. Такая информация используется анонимно для совершенствования работы сайта.'
	},
	{
		title: 'Cookie для аналитики и тестирования',
		description:
			'Позволяют выявлять и подсчитывать количество посетителей, отслеживать перемещение по сайту и тестировать различные версии функций и параметров сайта.'
	}
]

const CookieNotice: NextPage = () => {
	return (
		<div className={styles.wrapper}>
			<div className={styles.hero}>
				<Heading text="Политика в отношении файлов cookie" />
				<p className={styles.lead}>
					Сервис{' '}
					<a className={styles.link} href="https://winwidget.ru/">
						https://winwidget.ru/
					</a>{' '}
					использует технические, маркетинговые и аналитические cookie,
					включая файлы партнеров, чтобы обеспечивать корректную работу
					сайта, улучшать пользовательский опыт и анализировать
					посещаемость.
				</p>

				<div className={styles.heroMeta}>
					<div className={styles.heroMetaItem}>
						<span className={styles.heroMetaLabel}>Сайт</span>
						<span className={styles.heroMetaValue}>winwidget.ru</span>
					</div>
					<div className={styles.heroMetaItem}>
						<span className={styles.heroMetaLabel}>Поддержка</span>
						<span className={styles.heroMetaValue}>info@winwidget.ru</span>
					</div>
					<div className={styles.heroMetaItem}>
						<span className={styles.heroMetaLabel}>Аналитика</span>
						<span className={styles.heroMetaValue}>Яндекс.Метрика</span>
					</div>
				</div>

				<div className={styles.notice}>
					<p className={styles.noticeTitle}>Важно</p>
					<p className={styles.paragraph}>
						Если вы не принимаете условия политики, вы можете изменить
						настройки браузера или прекратить использование сайта.
						Блокировка всех cookie может ограничить доступ к отдельным
						функциям и разделам сайта.
					</p>
				</div>
			</div>

			<nav
				className={styles.contents}
				aria-label="Навигация по cookie policy"
			>
				<div className={styles.contentsHeader}>
					<h2 className={styles.contentsTitle}>Содержание</h2>
					<p className={styles.contentsText}>
						Быстрый переход к основным разделам политики.
					</p>
				</div>
				<div className={styles.contentsGrid}>
					{navigationSections.map(section => (
						<a
							key={section.href}
							href={section.href}
							className={styles.contentsLink}
						>
							{section.label}
						</a>
					))}
				</div>
			</nav>

			<section id="general" className={styles.section}>
				<h2 className={styles.sectionTitle}>1. Общие положения</h2>
				<p className={styles.paragraph}>
					Сервис{' '}
					<a className={styles.link} href="https://winwidget.ru/">
						https://winwidget.ru/
					</a>{' '}
					использует собственные технические и маркетинговые файлы cookie,
					а также файлы cookie партнеров (третьих лиц, установленных в
					Политике конфиденциальности по адресу{' '}
					<a
						className={styles.link}
						href="https://winwidget.ru/documents/privacy.pdf"
					>
						https://winwidget.ru/documents/privacy.pdf
					</a>
					, в пункте 8 настоящей Политики), чтобы предоставлять
					пользователям возможности для просмотра и использования страниц
					сайта.
				</p>
				<p className={styles.paragraph}>
					Часть cookie позволяет проверять качество работы сайта, улучшать
					его характеристики, собирать статистику посещений, принимать меры
					по развитию сервиса и показывать рекламный контент с учетом
					интересов пользователей.
				</p>
				<p className={styles.paragraph}>
					Большинство интернет-браузеров настроены принимать файлы cookie
					автоматически. При этом пользователь может самостоятельно
					изменить настройки браузера: отключить или ограничить
					использование cookie и получать уведомления об их использовании.
				</p>
				<p className={styles.paragraph}>
					Если используются разные устройства, необходимо убедиться, что на
					каждом из них браузер настроен в соответствии с вашим решением по
					использованию файлов cookie. Для этого следует воспользоваться
					инструкцией соответствующего браузера.
				</p>
			</section>

			<section id="consent" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					2. Согласие и условия обработки файлов cookie
				</h2>
				<p className={styles.paragraph}>
					Продолжая просмотр страниц сайта{' '}
					<a className={styles.link} href="https://winwidget.ru/">
						https://winwidget.ru/
					</a>
					, вы принимаете условия политики в отношении использования
					cookie, а также соглашаетесь с передачей полученных с помощью
					cookie данных третьим лицам и с получением маркетинговых
					материалов, размещаемых на сайте.
				</p>
				<p className={styles.paragraph}>
					Если вы не принимаете условия политики, вы можете изменить
					настройки браузера или прекратить просмотр страниц сайта. При
					этом блокирование всех cookie, включая важные, может закрыть
					доступ к сайту, его отдельным функциям или разделам.
				</p>

				<h3 className={styles.sectionSubtitle}>
					Как изменить настройки cookie
				</h3>
				<p className={styles.paragraph}>
					Определите, какой браузер используется на вашем устройстве, и
					перейдите по соответствующей ссылке, чтобы узнать, как управлять
					настройками cookie.
				</p>
				<div className={styles.browserGrid}>
					{browserLinks.map(browser => (
						<a
							key={browser.name}
							className={styles.browserLink}
							href={browser.url}
							target="_blank"
							rel="noreferrer"
						>
							{browser.name}
						</a>
					))}
				</div>
				<p className={styles.paragraph}>
					Если вашего программного обеспечения нет в списке, пожалуйста,
					напишите в службу поддержки на адрес{' '}
					<a className={styles.link} href="mailto:info@winwidget.ru">
						info@winwidget.ru
					</a>
					.
				</p>
			</section>

			<section id="terms" className={styles.section}>
				<h2 className={styles.sectionTitle}>3. Основные понятия</h2>
				<p className={styles.paragraph}>
					Cookie - это небольшой файл, создаваемый сайтом и хранящийся
					локально в интернет-браузере или файловой системе вашего
					компьютера или мобильного устройства.
				</p>

				<div className={styles.infoGrid}>
					{cookieTypes.map(item => (
						<div key={item.title} className={styles.infoCard}>
							<h3 className={styles.cardTitle}>{item.title}</h3>
							<p className={styles.cardText}>{item.description}</p>
						</div>
					))}
				</div>

				<p className={styles.paragraph}>
					Чтобы узнать, как используют cookie наши партнеры, ознакомьтесь с
					их политиками конфиденциальности, размещенными на их официальных
					веб-сайтах.
				</p>

				<div className={styles.infoCard}>
					<h3 className={styles.cardTitle}>Яндекс.Метрика</h3>
					<p className={styles.cardText}>
						Мы используем сервис Яндекс.Метрика, который позволяет
						анализировать активность посетителей сайта и улучшать его
						работу. Сервис получает данные на анонимной основе, не собирает
						сведения о личности посетителя сайта и не идентифицирует его
						как физическое лицо.
					</p>
					<p className={styles.cardText}>
						Полученные сведения могут использоваться владельцем сайта и
						нашими партнерами для улучшения работы сайта и его разделов.
					</p>
					<p className={styles.cardText}>
						<a
							className={styles.link}
							href="https://yandex.ru/legal/metrica_api/?lang=ru"
							target="_blank"
							rel="noreferrer"
						>
							Условия использования сервиса API Яндекс.Метрики
						</a>
					</p>
				</div>
			</section>
		</div>
	)
}

export default CookieNotice
