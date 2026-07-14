import { LegalPageContent } from '@/screens/legal-documentation'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Согласие на обработку персональных данных',
	description: 'Согласие на обработку персональных данных Winwidget.ru'
}

async function fetchContent(): Promise<string> {
	try {
		const res = await fetch(
			`${process.env.NEXT_PUBLIC_API_URL}/legal-pages/consent-processing`,
			{ next: { revalidate: 60 } }
		)
		if (!res.ok) return ''
		const data = await res.json()
		return data?.content ?? ''
	} catch {
		return ''
	}
}

const ConsentProcessingPage = async () => {
	const content = await fetchContent()
	return <LegalPageContent html={content} />
}

export default ConsentProcessingPage
