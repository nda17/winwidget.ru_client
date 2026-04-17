import LegalPageContent from '@/components/screens/legal-documentation/LegalPageContent'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Политика обработки персональных данных',
	description: 'Политика обработки персональных данных Winwidget.ru'
}

async function fetchContent(): Promise<string> {
	try {
		const res = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL}/legal-pages/personal-policy`,
			{ next: { revalidate: 60 } }
		)
		if (!res.ok) return ''
		const data = await res.json()
		return data?.content ?? ''
	} catch {
		return ''
	}
}

const PersonalPolicyPage = async () => {
	const content = await fetchContent()
	return <LegalPageContent html={content} />
}

export default PersonalPolicyPage
