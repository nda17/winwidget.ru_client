import FullFontScope from '@/app/FullFontScope'
import type { PropsWithChildren } from 'react'

const AuthLayout = ({ children }: PropsWithChildren<unknown>) => {
	return <FullFontScope>{children}</FullFontScope>
}

export default AuthLayout
