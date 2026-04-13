'use client'
import { useEffect, useState } from 'react'

declare global {
	interface Window {
		grecaptcha?: {
			ready: (callback: () => void) => void
			execute: (
				siteKey: string,
				options: { action: string }
			) => Promise<string>
		}
	}
}

let recaptchaScriptPromise: Promise<void> | null = null

const resolveRecaptchaHost = () =>
	process.env.NEXT_PUBLIC_RECAPTCHA_HOST || 'https://www.recaptcha.net'

const loadRecaptchaScript = (siteKey: string) => {
	if (typeof window === 'undefined') {
		return Promise.resolve()
	}

	const recaptchaHost = resolveRecaptchaHost()

	if (window.grecaptcha) {
		return Promise.resolve()
	}

	if (!recaptchaScriptPromise) {
		recaptchaScriptPromise = new Promise<void>((resolve, reject) => {
			const existingScript = document.querySelector<HTMLScriptElement>(
				`script[src^="${recaptchaHost}/recaptcha/api.js?render="], script[src^="https://www.google.com/recaptcha/api.js?render="], script[src^="https://www.recaptcha.net/recaptcha/api.js?render="]`
			)

			if (existingScript) {
				existingScript.addEventListener('load', () => resolve(), {
					once: true
				})
				existingScript.addEventListener(
					'error',
					() => reject(new Error('Не удалось загрузить reCAPTCHA')),
					{ once: true }
				)
				return
			}

			const script = document.createElement('script')
			script.src = `${recaptchaHost}/recaptcha/api.js?render=${siteKey}&hl=ru`
			script.async = true
			script.defer = true
			script.onload = () => resolve()
			script.onerror = () => {
				recaptchaScriptPromise = null
				reject(new Error('Не удалось загрузить reCAPTCHA'))
			}
			document.head.appendChild(script)
		})
	}

	return recaptchaScriptPromise
}

const waitForRecaptchaReady = () => {
	if (!window.grecaptcha) {
		return Promise.reject(new Error('reCAPTCHA не инициализирована'))
	}

	return new Promise<void>((resolve, reject) => {
		const timeout = window.setTimeout(() => {
			reject(new Error('reCAPTCHA не готова'))
		}, 5000)

		window.grecaptcha?.ready(() => {
			window.clearTimeout(timeout)
			resolve()
		})
	})
}

export const useRecaptchaV3 = () => {
	const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY
	const [isReady, setIsReady] = useState(false)

	useEffect(() => {
		if (!siteKey) {
			return
		}

		let ignore = false

		void loadRecaptchaScript(siteKey)
			.then(() => {
				if (!window.grecaptcha || ignore) {
					return
				}

				window.grecaptcha.ready(() => {
					if (!ignore) {
						setIsReady(true)
					}
				})
			})
			.catch(() => {
				if (!ignore) {
					setIsReady(false)
				}
			})

		return () => {
			ignore = true
		}
	}, [siteKey])

	const executeRecaptcha = async (action: string) => {
		if (!siteKey) {
			throw new Error('Не задан NEXT_PUBLIC_RECAPTCHA_SITE_KEY')
		}

		await loadRecaptchaScript(siteKey)
		await waitForRecaptchaReady()

		return new Promise<string>((resolve, reject) => {
			window.grecaptcha
				?.execute(siteKey, { action })
				.then(resolve)
				.catch(reject)
		})
	}

	return {
		executeRecaptcha,
		isRecaptchaReady: isReady
	}
}
