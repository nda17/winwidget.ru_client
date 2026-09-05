'use client'

import type { HomePageDemoWidgetsContent } from '@/entities/home-page-content'
import dynamic from 'next/dynamic'
import { startTransition, useEffect, useState } from 'react'

const DemoWidgets = dynamic(() => import('./DemoWidgets'), { ssr: false })

type IdleCallbackHandle = number
type WindowWithIdleCallback = Window & {
	requestIdleCallback?: (
		callback: () => void,
		options?: { timeout: number }
	) => IdleCallbackHandle
	cancelIdleCallback?: (handle: IdleCallbackHandle) => void
}

const INTERACTION_EVENTS: Array<keyof WindowEventMap> = [
	'pointerdown',
	'touchstart',
	'keydown',
	'scroll'
]

interface Props {
	content: HomePageDemoWidgetsContent
}

const LazyDemoWidgets = ({ content }: Props) => {
	const [shouldLoad, setShouldLoad] = useState(false)

	useEffect(() => {
		if (shouldLoad) return

		const windowWithIdleCallback = window as WindowWithIdleCallback
		let idleCallbackId: IdleCallbackHandle | null = null
		let timeoutId: number | null = null

		const load = () => {
			startTransition(() => setShouldLoad(true))
		}

		INTERACTION_EVENTS.forEach(e => {
			window.addEventListener(e, load, { passive: true, once: true })
		})

		if (windowWithIdleCallback.requestIdleCallback) {
			idleCallbackId = windowWithIdleCallback.requestIdleCallback(load, {
				timeout: 1800
			})
		} else {
			timeoutId = window.setTimeout(load, 1200)
		}

		return () => {
			INTERACTION_EVENTS.forEach(e => window.removeEventListener(e, load))
			if (
				idleCallbackId !== null &&
				windowWithIdleCallback.cancelIdleCallback
			)
				windowWithIdleCallback.cancelIdleCallback(idleCallbackId)
			if (timeoutId !== null) window.clearTimeout(timeoutId)
		}
	}, [shouldLoad])

	if (!shouldLoad) return null

	return <DemoWidgets content={content} />
}

export default LazyDemoWidgets
