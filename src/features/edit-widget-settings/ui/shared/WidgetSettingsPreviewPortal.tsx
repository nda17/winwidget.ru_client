'use client'

import type { ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface WidgetSettingsPreviewPortalProps {
	children: ReactNode
	inline: boolean
	target?: HTMLElement | null
}

const WidgetSettingsPreviewPortal = ({
	children,
	inline,
	target
}: WidgetSettingsPreviewPortalProps) => {
	if (target) return createPortal(children, target)

	return inline ? children : null
}

export default WidgetSettingsPreviewPortal
