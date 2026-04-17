import SignUp from '@/components/screens/(auth)/register/SignUp'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Регистрация',
	description:
		'Создайте аккаунт Winwidget и начните бесплатный пробный период на 7 дней'
}

const RegisterPage = async () => {
	return <SignUp />
}

export default RegisterPage
