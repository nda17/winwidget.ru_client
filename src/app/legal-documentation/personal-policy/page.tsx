import PersonalPolicy from '@/components/screens/legal-documentation/personal-policy/PersonalPolicy'
import { Metadata } from 'next'

export const metadata: Metadata = {
	title: 'Privacy Policy',
	description: 'Privacy Policy page'
}

const PersonalPolicyPage = () => {
	return <PersonalPolicy />
}

export default PersonalPolicyPage
