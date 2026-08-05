'use client'

import { useEffect } from 'react'
import { WIDGETS_HOST } from '@/shared/config/api.config'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const OnlineConsultantPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).winonlineconsultantAutoOpen = true
		;(window as any).winonlineconsultant = widgetKey

		const script = document.createElement('script')
		script.src = `${WIDGETS_HOST}/widgets/online-consultant.js?v=${Date.now()}`
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
