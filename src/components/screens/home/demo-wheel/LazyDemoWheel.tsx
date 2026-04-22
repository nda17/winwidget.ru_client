'use client'

import dynamic from 'next/dynamic'
import { startTransition, useEffect, useState } from 'react'

const DemoWheel = dynamic(() => import('./DemoWheel'), {
	ssr: false
})

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

const LazyDemoWheel = () => {
	const [shouldLoad, setShouldLoad] = useState(false)

	useEffect(() => {
		if (shouldLoad) return

		const windowWithIdleCallback = window as WindowWithIdleCallback
		let idleCallbackId: IdleCallbackHandle | null = null
		let timeoutId: number | null = null

		const loadDemoWheel = () => {
			startTransition(() => {
				setShouldLoad(true)
			})
		}

		const handleFirstInteraction = () => {
			loadDemoWheel()
		}

		INTERACTION_EVENTS.forEach(eventName => {
			window.addEventListener(eventName, handleFirstInteraction, {
				passive: true,
				once: true
			})
		})

		if (windowWithIdleCallback.requestIdleCallback) {
			idleCallbackId = windowWithIdleCallback.requestIdleCallback(
				loadDemoWheel,
				{ timeout: 1800 }
			)
		} else {
			timeoutId = window.setTimeout(loadDemoWheel, 1200)
		}

		return () => {
			INTERACTION_EVENTS.forEach(eventName => {
				window.removeEventListener(eventName, handleFirstInteraction)
			})

			if (
				idleCallbackId !== null &&
				windowWithIdleCallback.cancelIdleCallback
			) {
				windowWithIdleCallback.cancelIdleCallback(idleCallbackId)
			}

			if (timeoutId !== null) {
				window.clearTimeout(timeoutId)
			}
		}
	}, [shouldLoad])

	if (!shouldLoad) return null

	return <DemoWheel />
}

export default LazyDemoWheel
