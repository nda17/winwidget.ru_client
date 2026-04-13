import CookieNotice from '@/components/screens/legal-documentation/cookie-notice/CookieNotice'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Политика в отношении файлов cookie',
	description: 'Политика в отношении файлов cookie Winwidget.ru'
}

const CookieNoticePage = () => {
	return <CookieNotice />
}

export default CookieNoticePage
