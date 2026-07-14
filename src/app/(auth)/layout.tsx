import FullFontScope from '@/app/_ui/FullFontScope'
import type { PropsWithChildren } from 'react'

const AuthLayout = ({ children }: PropsWithChildren<unknown>) => {
	return <FullFontScope>{children}</FullFontScope>
}

export default AuthLayout
