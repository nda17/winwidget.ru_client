'use client'

import { useEffect } from 'react'
import { WIDGETS_HOST } from '@/shared/config/api.config'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const AiConsultantPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).winAiConsultantAutoOpen = true
		;(window as any).winAiConsultant = widgetKey

		const script = document.createElement('script')
		script.src = `${WIDGETS_HOST}/widgets/ai-consultant.js?v=${Date.now()}`
		script.async = true
		script.dataset.key = widgetKey
		document.body.appendChild(script)

		return () => {
			const widget = (window as any).winAiConsultantWidget
			if (widget && typeof widget.destroy === 'function') {
				widget.destroy()
			}
			script.remove()
			document.getElementById('ai-consultant-widget-host')?.remove()
			document.getElementById('ai-consultant-widget-disabled')?.remove()
			delete (window as any).__winAiConsultantScriptRunning
			delete (window as any).winAiConsultantWidget
			delete (window as any).winAiConsultantAutoOpen
			delete (window as any).winAiConsultant
		}
	}, [widgetKey])

	return <div className={styles.page} />
}

export default AiConsultantPreview
