import AuthForm from '@/components/screens/(auth)/auth-form/AuthForm'
import styles from '@/components/screens/(auth)/login/SignIn.module.scss'
import { NextPage } from 'next'

interface ISignInProps {
	authMessage?: string
}

const SignIn: NextPage<ISignInProps> = ({ authMessage }) => {
	return (
		<section className={styles.wrapper} aria-labelledby="sign-in-title">
			<div className={styles.form}>
				<h1 id="sign-in-title" className={styles.title}>
					Вход
				</h1>
				<p className={styles.subtitle}>
					Войдите в личный кабинет и управляйте виджетами в одной панели.
				</p>
				<AuthForm isLogin authMessage={authMessage} />
			</div>
		</section>
	)
}

export default SignIn
