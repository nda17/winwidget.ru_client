import SignIn from '@/components/screens/(auth)/login/SignIn'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Вход',
	description: 'Войдите в личный кабинет Winwidget'
}

const LOGIN_ERROR_MESSAGES: Record<string, string> = {
	account_deactivated:
		'Учетная запись деактивирована, обработка персональных данных отозвана. Для повторной активации аккаунта обратитесь в техподдержку info@winwidget.ru'
}

interface ILoginPageProps {
	searchParams?: {
		error?: string | string[]
	}
}

const LoginPage = async ({ searchParams }: ILoginPageProps) => {
	const errorCode = Array.isArray(searchParams?.error)
		? searchParams?.error[0]
		: searchParams?.error

	return (
		<SignIn
			authMessage={errorCode ? LOGIN_ERROR_MESSAGES[errorCode] : undefined}
		/>
	)
}

export default LoginPage
