'use client'

import { useEffect } from 'react'
import { WIDGETS_HOST } from '@/shared/config/api.config'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const StopOfferPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).winstopofferAutoOpen = true

		const script = document.createElement('script')
		script.src = `${WIDGETS_HOST}/widgets/stop-offer.js?v=${Date.now()}`
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
