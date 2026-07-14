import { PUBLIC_PAGES } from '@/shared/config/pages/public.config'
import styles from '@/screens/auth/ui/login/SignIn.module.scss'
import { RestorePasswordForm } from '@/features/auth'
import Link from 'next/link'
import { NextPage } from 'next'

const RestorePassword: NextPage = () => {
	return (
		<section
			className={styles.wrapper}
			aria-labelledby="restore-password-title"
		>
			<div className={styles.form}>
				<h1 id="restore-password-title" className={styles.title}>
					Восстановление пароля
				</h1>
				<p className={styles.subtitle}>
					Укажите email или телефон, и мы отправим дальнейшие инструкции.
				</p>
				<RestorePasswordForm />
				<div className={styles['auth-actions']}>
					<Link href={PUBLIC_PAGES.LOGIN} className={styles['auth-link']}>
						Назад
					</Link>
				</div>
			</div>
		</section>
	)
}

export default RestorePassword
