import styles from '@/components/screens/legal-documentation/consent-processing/ConsentProcessing.module.scss'
import Heading from '@/components/ui/heading/Heading'
import { NextPage } from 'next'

const navigationSections = [
	{ href: '#consent-order', label: '1. Порядок предоставления согласия' },
	{ href: '#awareness', label: '2. Добровольность и осознанность' },
	{ href: '#data-list', label: '3. Перечень персональных данных' },
	{ href: '#purpose', label: '4. Цель обработки' },
	{ href: '#methods', label: '5. Способы обработки' },
	{ href: '#conditions', label: '6. Условия обработки' },
	{ href: '#withdrawal', label: '7. Порядок отзыва согласия' },
	{ href: '#termination', label: '8. Прекращение обработки' },
	{ href: '#confirmation', label: '9. Подтверждения субъекта' },
	{ href: '#operator-details', label: 'Реквизиты оператора' }
]

const consentSteps = [
	{
		title: 'Шаг № 1',
		description:
			'Заполнение обязательных полей в доступных на сайтах формах, предусмотренных для сбора персональных данных.'
	},
	{
		title: 'Шаг № 2',
		description:
			'Направление персональных данных оператору путем нажатия на соответствующую кнопку.'
	}
]

const personalDataList = [
	'имя',
	'адрес электронной почты',
	'номер мобильного телефона'
]

const processingMethods = [
	'сбор',
	'запись',
	'систематизация',
	'предоставление',
	'хранение',
	'извлечение',
	'уточнение',
	'использование',
	'накопление',
	'удаление',
	'уничтожение'
]

const conditions = [
	'Оператор не осуществляет обработку биометрических и специальных категорий персональных данных.',
	'Оператор не проверяет полученные персональные данные и исходит из того, что я предоставил(-а) достоверную информацию. Все риски предоставления недостоверной или недостаточной информации лежат на мне.',
	'Обработка персональных данных может включать их передачу третьим лицам. В частности, лицам, которые заранее определены оператором в п. 5.5 политики.',
	'Я могу воспользоваться правами из раздела № 6 политики.',
	'Согласие действует до его отзыва, но не более 1 года с момента получения персональных данных оператором.'
]

const confirmations = [
	'Ознакомлен(-а) с политикой оператора в отношении обработки персональных данных, которая размещена в нижней части ("Подвал", "Footer") сайта, где доступна для ознакомления любому посетителю, а также в каждой форме для сбора персональных данных.',
	'Действую по своей воле и в своем интересе, а данное согласие является конкретным, информированным и сознательным.'
]

const ConsentProcessing: NextPage = () => {
	return (
		<div className={styles.wrapper}>
			<div className={styles.hero}>
				<Heading text="Согласие на обработку персональных данных" />
				<p className={styles.lead}>
					Формы для связи с субъектом персональных данных. Я даю свое
					согласие на обработку персональных данных оператору, которым
					является ООО ЮБС ОГРН 1232700016460 ИНН 2700019628.
				</p>

				<div className={styles.heroMeta}>
					<div className={styles.heroMetaItem}>
						<span className={styles.heroMetaLabel}>Оператор</span>
						<span className={styles.heroMetaValue}>ООО ЮБС</span>
					</div>
					<div className={styles.heroMetaItem}>
						<span className={styles.heroMetaLabel}>Сайт</span>
						<span className={styles.heroMetaValue}>winwidget.ru</span>
					</div>
					<div className={styles.heroMetaItem}>
						<span className={styles.heroMetaLabel}>Срок действия</span>
						<span className={styles.heroMetaValue}>
							До отзыва, но не более 1 года
						</span>
					</div>
				</div>

				<div className={styles.notice}>
					<p className={styles.noticeTitle}>Кратко</p>
					<p className={styles.paragraph}>
						Согласие предоставляется при заполнении формы связи на сайте{' '}
						<a className={styles.link} href="https://winwidget.ru/">
							https://winwidget.ru/
						</a>{' '}
						(включая поддомены и интернет-страницы) и используется для
						связи с субъектом персональных данных по электронной почте и
						(или) телефону.
					</p>
				</div>
			</div>

			<nav className={styles.contents} aria-label="Навигация по согласию">
				<div className={styles.contentsHeader}>
					<h2 className={styles.contentsTitle}>Содержание</h2>
					<p className={styles.contentsText}>
						Быстрый переход по основным условиям согласия.
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

			<section id="consent-order" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					1. Порядок предоставления согласия
				</h2>
				<p className={styles.paragraph}>
					Обработка персональных данных начинается с момента их получения
					оператором путем совершения мной следующей совокупности
					конклюдентных действий на любом из следующих интернет-сайтов{' '}
					<a className={styles.link} href="https://winwidget.ru/">
						https://winwidget.ru/
					</a>{' '}
					(включая их поддомены и интернет-страницы):
				</p>

				<div className={styles.infoGrid}>
					{consentSteps.map(step => (
						<div key={step.title} className={styles.infoCard}>
							<h3 className={styles.cardTitle}>{step.title}</h3>
							<p className={styles.cardText}>{step.description}</p>
						</div>
					))}
				</div>
			</section>

			<section id="awareness" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					2. Добровольность и осознанность согласия
				</h2>
				<p className={styles.paragraph}>
					Совершая действия из п. 1 согласия, я действую свободно, своей
					волей и в своем интересе, а также подтверждаю свою
					дееспособность. Согласие является информированным и осознанным.
				</p>
			</section>

			<section id="data-list" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					3. Перечень персональных данных
				</h2>
				<p className={styles.paragraph}>
					Согласие может предоставляться в отношении следующего перечня
					персональных данных:
				</p>
				<div className={styles.pillGrid}>
					{personalDataList.map(item => (
						<div key={item} className={styles.pill}>
							{item}
						</div>
					))}
				</div>
			</section>

			<section id="purpose" className={styles.section}>
				<h2 className={styles.sectionTitle}>4. Цель обработки</h2>
				<div className={styles.infoCard}>
					<p className={styles.cardText}>
						Связь с субъектом персональных данных через электронную
						переписку и (или) звонок.
					</p>
				</div>
			</section>

			<section id="methods" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					5. Способы автоматизированной обработки персональных данных
				</h2>
				<div className={styles.pillGrid}>
					{processingMethods.map(method => (
						<div key={method} className={styles.pill}>
							{method}
						</div>
					))}
				</div>
			</section>

			<section id="conditions" className={styles.section}>
				<h2 className={styles.sectionTitle}>6. Условия обработки</h2>
				<p className={styles.paragraph}>
					Я уведомлен и согласен со следующими условиями обработки
					персональных данных:
				</p>

				<div className={styles.infoGrid}>
					{conditions.map((condition, index) => (
						<div key={condition} className={styles.infoCard}>
							<h3 className={styles.cardTitle}>{`6.${index + 1}`}</h3>
							<p className={styles.cardText}>{condition}</p>
						</div>
					))}
				</div>
			</section>

			<section id="withdrawal" className={styles.section}>
				<h2 className={styles.sectionTitle}>7. Порядок отзыва согласия</h2>
				<p className={styles.paragraph}>
					Предоставленное мною согласие может быть отозвано путем
					направления оператору обращения на адрес электронной почты
					оператора:{' '}
					<a className={styles.link} href="mailto:info@winwidget.ru">
						info@winwidget.ru
					</a>{' '}
					с темой письма «Персональные данные».
				</p>
			</section>

			<section id="termination" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					8. Прекращение обработки и уничтожение персональных данных
				</h2>
				<p className={styles.paragraph}>
					Оператор прекращает обработку моих персональных данных и
					уничтожает их в срок, не превышающий 30 календарных дней с даты
					поступления обращения об отзыве.
				</p>
				<p className={styles.paragraph}>
					При этом оператор вправе после получения отзыва согласия, а равно
					после истечения срока действия согласия, продолжить обработку
					моих персональных данных в той части, в которой для ее
					осуществления согласие не требуется или не будет требоваться с
					учетом положений Закона о персональных данных.
				</p>
			</section>

			<section id="confirmation" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					9. Подтверждения субъекта персональных данных
				</h2>
				<div className={styles.infoGrid}>
					{confirmations.map((item, index) => (
						<div key={item} className={styles.infoCard}>
							<h3 className={styles.cardTitle}>{`9.${index + 1}`}</h3>
							<p className={styles.cardText}>{item}</p>
						</div>
					))}
				</div>
			</section>

			<section id="operator-details" className={styles.section}>
				<h2 className={styles.sectionTitle}>
					Реквизиты оператора персональных данных
				</h2>
				<div className={styles.infoCard}>
					<p className={styles.cardText}>
						ООО ЮБС ОГРН 1232700016460 ИНН 2700019628
					</p>
					<p className={styles.cardText}>
						Адрес электронной почты:{' '}
						<a className={styles.link} href="mailto:info@winwidget.ru">
							info@winwidget.ru
						</a>
					</p>
					<p className={styles.cardText}>
						Юридический адрес: Россия, 680035, г. Хабаровск, ул.
						Хабаровская, д. 15, оф. 33
					</p>
				</div>
			</section>
		</div>
	)
}

export default ConsentProcessing
