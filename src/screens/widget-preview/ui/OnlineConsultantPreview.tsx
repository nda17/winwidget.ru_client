'use client'

import { useEffect } from 'react'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const BACKEND =
	process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST || 'https://winwidget.ru'
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST || 'http://localhost:4200'

const OnlineConsultantPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).winonlineconsultantAutoOpen = true
		;(window as any).winonlineconsultant = widgetKey

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/online-consultant.js?v=${Date.now()}`
		script.async = true
		script.dataset.key = widgetKey
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
	}, [widgetKey])

	return <div className={styles.page} />
}

export default OnlineConsultantPreview
