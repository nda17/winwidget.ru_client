import { AuthForm } from '@/features/auth'
import styles from '@/screens/auth/ui/register/SignUp.module.scss'
import { NextPage } from 'next'

const SignUp: NextPage = () => {
	return (
		<section className={styles.wrapper} aria-labelledby="sign-up-title">
			<div className={styles.form}>
				<h1 id="sign-up-title" className={styles.title}>
					Регистрация
				</h1>
				<p className={styles.subtitle}>
					Создайте аккаунт и настройте удобный способ входа для работы с
					сервисом.
				</p>
				<AuthForm isLogin={false} />
			</div>
		</section>
	)
}

export default SignUp
