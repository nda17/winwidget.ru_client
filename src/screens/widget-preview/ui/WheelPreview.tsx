'use client'

import { useEffect } from 'react'
import { WIDGETS_HOST } from '@/shared/config/api.config'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const WheelPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).winwidget = widgetKey
		;(window as any).winwidgetAutoOpen = true

		const script = document.createElement('script')
		script.src = `${WIDGETS_HOST}/widgets/wheel.js`
		script.async = true
		script.dataset.key = widgetKey
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
	}, [widgetKey])

	return <div className={styles.page} />
}

export default WheelPreview
