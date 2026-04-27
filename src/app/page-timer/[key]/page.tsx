'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const TimerPreviewPage = () => {
	const { key } = useParams<{ key: string }>()

	useEffect(() => {
		if (!key) return
		;(window as any).wintimerAutoOpen = true

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/timer.js?v=${Date.now()}`
		script.async = true
		script.dataset.key = key
		document.head.appendChild(script)

		return () => {
			const widget = (window as any).winwidgetTimer
			if (widget?.destroy) widget.destroy()

			if (document.head.contains(script)) document.head.removeChild(script)
			document.getElementById('timer-widget-button')?.remove()
			document.getElementById('timer-widget-overlay')?.remove()
			document.getElementById('timer-widget-style')?.remove()

			delete (window as any).wintimerAutoOpen
			delete (window as any).__wintimerScriptRunning
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

export default TimerPreviewPage
