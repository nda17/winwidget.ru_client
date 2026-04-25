'use client'

import { useParams } from 'next/navigation'
import { useEffect } from 'react'

const BACKEND =
	(process.env.NEXT_PUBLIC_MODE === 'production'
		? process.env.NEXT_PUBLIC_PRODUCTION_HOST
		: process.env.NEXT_PUBLIC_DEVELOPMENT_HOST) || 'http://localhost:4200'

const QuizPreviewPage = () => {
	const { key } = useParams<{ key: string }>()

	useEffect(() => {
		if (!key) return
		;(window as any).winquizAutoOpen = true

		const script = document.createElement('script')
		script.src = `${BACKEND}/widgets/quiz.js`
		script.async = true
		script.dataset.key = key
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
	}, [key])

	return (
		<div
			style={{
				background: '#0d0d1a',
				minHeight: '100vh',
				width: '100%'
			}}
		/>
	)
}

export default QuizPreviewPage
