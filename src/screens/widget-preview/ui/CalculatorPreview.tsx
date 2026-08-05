'use client'

import { useEffect } from 'react'
import { WIDGETS_HOST } from '@/shared/config/api.config'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const CalculatorPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).wincalculatorAutoOpen = true
		;(window as any).wincalculator = widgetKey

		const script = document.createElement('script')
		script.src = `${WIDGETS_HOST}/widgets/calculator.js`
		script.async = true
		script.dataset.key = widgetKey
		document.body.appendChild(script)

		return () => {
			const widget = (window as any).winwidgetCalculator
			if (widget && typeof widget.destroy === 'function') widget.destroy()

			script.remove()
			document.getElementById('calculator-widget-host')?.remove()
			document.body.style.overflow = ''
			document.body.style.position = ''
			document.body.style.width = ''

			delete (window as any).wincalculatorAutoOpen
			delete (window as any).wincalculator
			delete (window as any).__wincalculatorScriptRunning
		}
	}, [widgetKey])

	return <div className={styles.page} />
}

export default CalculatorPreview
