import FullFontScope from '@/app/FullFontScope'
import type { PropsWithChildren } from 'react'

const AdminLayout = ({ children }: PropsWithChildren<unknown>) => {
	return <FullFontScope>{children}</FullFontScope>
}

export default AdminLayout
