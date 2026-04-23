import { fullRoboto, fullUnbounded } from '@/app/fonts'
import type { PropsWithChildren } from 'react'

const FullFontScope = ({ children }: PropsWithChildren<unknown>) => {
	return (
		<div
			className={`${fullRoboto.variable} ${fullUnbounded.variable} w-full`}
		>
			{children}
		</div>
	)
}

export default FullFontScope
