import FullFontScope from '@/app/FullFontScope'
import type { PropsWithChildren } from 'react'

const PaymentLayout = ({ children }: PropsWithChildren<unknown>) => {
	return <FullFontScope>{children}</FullFontScope>
}

export default PaymentLayout
