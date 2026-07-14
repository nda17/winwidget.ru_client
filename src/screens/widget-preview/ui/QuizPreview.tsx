'use client'

import { useEffect } from 'react'
import styles from './WidgetPreview.module.scss'
import { IWidgetPreview } from './widget-preview.interface'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const QuizPreview = ({ widgetKey }: IWidgetPreview) => {
	useEffect(() => {
		if (!widgetKey) return
		;(window as any).winquizAutoOpen = true

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/quiz.js`
		script.async = true
		script.dataset.key = widgetKey
		document.head.appendChild(script)

		return () => {
			if (document.head.contains(script)) {
				document.head.removeChild(script)
			}

			const host = document.getElementById('quiz-widget-host')
			if (host) host.remove()

			document.body.style.overflow = ''
			document.body.style.position = ''
			document.body.style.width = ''

			delete (window as any).winquizAutoOpen
			delete (window as any).__winquizScriptRunning
		}
	}, [widgetKey])

	return <div className={styles.page} />
}

export default QuizPreview
