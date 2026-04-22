import FullFontScope from '@/app/FullFontScope'
import type { PropsWithChildren } from 'react'

const CabinetLayout = ({ children }: PropsWithChildren<unknown>) => {
	return <FullFontScope>{children}</FullFontScope>
}

export default CabinetLayout
