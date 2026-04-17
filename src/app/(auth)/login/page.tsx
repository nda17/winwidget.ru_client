import SignIn from '@/components/screens/(auth)/login/SignIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Вход',
	description: 'Войдите в личный кабинет Winwidget'
}

const LoginPage = async () => {
	return <SignIn />
}

export default LoginPage
