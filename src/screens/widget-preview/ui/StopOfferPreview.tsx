'use client'

import { useEffect } from 'react'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const StopOfferPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).winstopofferAutoOpen = true

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/stop-offer.js?v=${Date.now()}`
		script.async = true
		script.dataset.key = widgetKey
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
	}, [widgetKey])

	return <div className={styles.page} />
}

export default StopOfferPreview
