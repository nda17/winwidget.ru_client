import { PUBLIC_PAGES } from '@/config/pages/public.config'
import styles from '@/components/screens/(auth)/login/SignIn.module.scss'
import RestorePasswordForm from '@/components/screens/(auth)/restore-password-form/RestorePasswordForm'
import Link from 'next/link'
import { NextPage } from 'next'

const RestorePassword: NextPage = () => {
	return (
		<div className={styles.wrapper}>
			<div className={styles.form}>
				<h2 className={styles.title}>Восстановление пароля</h2>
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
		</div>
	)
}

export default RestorePassword
