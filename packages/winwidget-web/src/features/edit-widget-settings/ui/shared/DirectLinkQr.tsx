'use client'

import QRCode from 'qrcode'
import { useEffect, useRef } from 'react'
import styles from './DirectLinkQr.module.scss'

interface Props {
	value: string
	downloadName: string
}

const DirectLinkQr = ({ value, downloadName }: Props) => {
	const canvasRef = useRef<HTMLCanvasElement | null>(null)

	useEffect(() => {
		if (!canvasRef.current || !value) return

		void QRCode.toCanvas(canvasRef.current, value, {
			errorCorrectionLevel: 'M',
			margin: 2,
			width: 220,
			color: {
				dark: '#1a1a1a',
				light: '#ffffff'
			}
		}).catch(() => undefined)
	}, [value])

	const downloadQr = () => {
		const canvas = canvasRef.current
		if (!canvas) return

		const link = document.createElement('a')
		link.href = canvas.toDataURL('image/png')
		link.download = downloadName
		link.click()
	}

	return (
		<div className={styles.qrBox}>
			<div className={styles.qrCanvasWrap}>
				<canvas
					ref={canvasRef}
					className={styles.qrCanvas}
					role="img"
					aria-label="QR-код прямой ссылки"
				/>
			</div>
			<div className={styles.qrContent}>
				<p className={styles.qrTitle}>QR-код прямой ссылки</p>
				<p className={styles.qrHint}>
					Подходит для печатных материалов, вывесок, презентаций и быстрого
					открытия с телефона.
				</p>
				<button
					type="button"
					className={styles.qrDownloadBtn}
					onClick={downloadQr}
				>
					Скачать QR-код
				</button>
			</div>
		</div>
	)
}

export default DirectLinkQr
