import styles from '@/app/page.module.scss'

const HomePage = () => {
	return (
		<main className={styles.page}>
			<section className={styles.card} aria-labelledby="page-title">
				<p className={styles.badge}>WinWidget CRM</p>
				<h1 id="page-title" className={styles.title}>
					Локальная основа CRM-клиента готова
				</h1>
				<p className={styles.description}>
					Продуктовый интерфейс, авторизация и интеграции будут добавляться
					отдельными согласованными этапами после завершения платформенного
					backlog.
				</p>
				<p className={styles.status}>
					Публичный релиз и развёртывание на VPS пока не настроены.
				</p>
			</section>
		</main>
	)
}

export default HomePage
