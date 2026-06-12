'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

const BACKEND =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST || 'https://winwidget.ru'
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'

const OnlineConsultantPreviewPage = () => {
	const params = useParams<{ key: string }>()

	useEffect(() => {
		const key = params.key
		if (!key) return
		;(window as any).winonlineconsultantAutoOpen = true
		;(window as any).winonlineconsultant = key

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/online-consultant.js?v=${Date.now()}`
		script.async = true
		script.dataset.key = key
		document.body.appendChild(script)

		return () => {
			const widget = (window as any).winwidgetOnlineConsultant
			if (widget && typeof widget.destroy === 'function') {
				widget.destroy()
			}
			script.remove()
			document.getElementById('online-consultant-widget-host')?.remove()
			document
				.getElementById('online-consultant-widget-disabled')
				?.remove()
			delete (window as any).winonlineconsultantAutoOpen
			delete (window as any).winonlineconsultant
		}
	}, [params.key])

	return (
		<div
			style={{
				minHeight: '100vh',
				background: '#0d0d1a'
			}}
		/>
	)
}

export default OnlineConsultantPreviewPage
