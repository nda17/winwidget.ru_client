import FullFontScope from '@/app/FullFontScope'
import type { PropsWithChildren } from 'react'

const LegalDocumentationLayout = ({
	children
}: PropsWithChildren<unknown>) => {
	return <FullFontScope>{children}</FullFontScope>
}

export default LegalDocumentationLayout
