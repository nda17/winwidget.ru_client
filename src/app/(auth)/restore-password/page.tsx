import RestorePassword from '@/components/screens/(auth)/restore-password/RestorePassword'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Восстановление пароля',
	description: 'Восстановление доступа к аккаунту Winwidget'
}

const RestorePasswordPage = async () => {
	return <RestorePassword />
}

export default RestorePasswordPage
