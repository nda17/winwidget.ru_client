import AdminTelegramBot from '@/components/screens/admin/telegram-bot/AdminTelegramBot'
import type { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Telegram-бот',
	description: 'Admin panel Telegram bot settings page'
}

const AdminTelegramBotPage = () => {
	return <AdminTelegramBot />
}

export default AdminTelegramBotPage
