'use client'

import { useEffect } from 'react'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const TimerPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).wintimerAutoOpen = true

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/timer.js?v=${Date.now()}`
		script.async = true
		script.dataset.key = widgetKey
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
	}, [widgetKey])

	return <div className={styles.page} />
}

export default TimerPreview
