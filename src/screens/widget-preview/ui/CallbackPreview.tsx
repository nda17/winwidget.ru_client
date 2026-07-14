'use client'

import { useEffect } from 'react'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const CallbackPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return

		const previousWinwidget = (window as any).winwidget

		;(window as any).wincallbackAutoOpen = true
		;(window as any).winwidgetCallbackAutoOpen = true
		;(window as any).winwidget = { autoOpen: true }

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/callback.js`
		script.async = true
		script.dataset.key = widgetKey
		document.head.appendChild(script)

		return () => {
			const widget = (window as any).winwidgetCallback
			if (widget?.destroy) widget.destroy()

			if (document.head.contains(script)) {
				document.head.removeChild(script)
			}

			const button = document.getElementById('callback-widget-button')
			if (button) button.remove()

			const overlay = document.getElementById('callback-widget-overlay')
			if (overlay) overlay.remove()

			const host = document.getElementById('callback-widget-host')
			if (host) host.remove()

			delete (window as any).wincallbackAutoOpen
			delete (window as any).winwidgetCallbackAutoOpen
			delete (window as any).__wincallbackScriptRunning

			if (previousWinwidget === undefined) {
				delete (window as any).winwidget
			} else {
				;(window as any).winwidget = previousWinwidget
			}
		}
	}, [widgetKey])

	return <div className={styles.page} />
}

export default CallbackPreview
