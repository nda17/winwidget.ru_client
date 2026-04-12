import PersonalPolicy from '@/components/screens/legal-documentation/personal-policy/PersonalPolicy'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Политика обработки персональных данных',
	description: 'Политика обработки персональных данных Winwidget.ru'
}

const PersonalPolicyPage = () => {
	return <PersonalPolicy />
}

export default PersonalPolicyPage
