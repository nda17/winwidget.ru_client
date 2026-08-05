'use client'

import { useEffect } from 'react'
import { WIDGETS_HOST } from '@/shared/config/api.config'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const TimerPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).wintimerAutoOpen = true

		const script = document.createElement('script')
		script.src = `${WIDGETS_HOST}/widgets/timer.js?v=${Date.now()}`
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
