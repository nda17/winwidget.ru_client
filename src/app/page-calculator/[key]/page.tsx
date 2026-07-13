'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'
import styles from './page.module.scss'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const CalculatorPreviewPage = () => {
	const { key } = useParams<{ key: string }>()

	useEffect(() => {
		if (!key) return
		;(window as any).wincalculatorAutoOpen = true
		;(window as any).wincalculator = key

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/calculator.js`
		script.async = true
		script.dataset.key = key
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
	}, [key])

	return <div className={styles.page} />
}

export default CalculatorPreviewPage
