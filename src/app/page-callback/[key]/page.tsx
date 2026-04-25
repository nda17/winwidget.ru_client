'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const CallbackPreviewPage = () => {
	const { key } = useParams<{ key: string }>()

	useEffect(() => {
		if (!key) return

		const previousWinwidget = (window as any).winwidget

		;(window as any).wincallbackAutoOpen = true
		;(window as any).winwidgetCallbackAutoOpen = true
		;(window as any).winwidget = { autoOpen: true }

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/callback.js`
		script.async = true
		script.dataset.key = key
		document.head.appendChild(script)

		return () => {
			if (document.head.contains(script)) {
				document.head.removeChild(script)
			}

			const button = document.getElementById('callback-widget-button')
			if (button) button.remove()

			const overlay = document.getElementById('callback-widget-overlay')
			if (overlay) overlay.remove()

			delete (window as any).wincallbackAutoOpen
			delete (window as any).winwidgetCallbackAutoOpen
			delete (window as any).__wincallbackScriptRunning

			if (previousWinwidget === undefined) {
				delete (window as any).winwidget
			} else {
				;(window as any).winwidget = previousWinwidget
			}
		}
	}, [key])

	return (
		<div
			style={{
				background: '#0d0d1a',
				minHeight: '100vh',
				width: '100%'
			}}
		/>
	)
}

export default CallbackPreviewPage
