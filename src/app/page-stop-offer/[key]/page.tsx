'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const StopOfferPreviewPage = () => {
	const { key } = useParams<{ key: string }>()

	useEffect(() => {
		if (!key) return
		;(window as any).winstopofferAutoOpen = true

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/stop-offer.js?v=${Date.now()}`
		script.async = true
		script.dataset.key = key
		document.head.appendChild(script)

		return () => {
			const widget = (window as any).winwidgetStopOffer
			if (widget?.destroy) widget.destroy()

			if (document.head.contains(script)) document.head.removeChild(script)
			document.getElementById('stop-offer-widget-host')?.remove()
			document.getElementById('stop-offer-widget-disabled')?.remove()

			delete (window as any).winstopofferAutoOpen
			delete (window as any).__winstopofferScriptRunning
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

export default StopOfferPreviewPage
