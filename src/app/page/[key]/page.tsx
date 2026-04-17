'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

const BACKEND =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST

const WidgetPreviewPage = () => {
	const { key } = useParams<{ key: string }>()

	useEffect(() => {
		if (!key) return

		const scriptSrc = `${BACKEND}/widgets/wheel.js`

		;(window as any).winwidget = key
		;(window as any).winwidgetAutoOpen = true

		const script = document.createElement('script')
		script.src = scriptSrc
		script.async = true
		document.head.appendChild(script)

		return () => {
			if (document.head.contains(script)) {
				document.head.removeChild(script)
			}
			const host = document.getElementById('wheel-widget-host')
			if (host) host.remove()
			delete (window as any).winwidget
			delete (window as any).winwidgetAutoOpen
			delete (window as any).__winwidgetScriptRunning
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

export default WidgetPreviewPage
