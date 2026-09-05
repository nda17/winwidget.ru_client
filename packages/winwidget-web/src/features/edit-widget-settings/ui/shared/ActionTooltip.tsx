'use client'

import {
	cloneElement,
	useCallback,
	useEffect,
	useId,
	useRef,
	useState,
	type AriaAttributes,
	type CSSProperties,
	type FocusEvent,
	type KeyboardEvent,
	type MouseEvent,
	type ReactElement,
	type ReactNode
} from 'react'
import { createPortal } from 'react-dom'
import styles from './ActionTooltip.module.scss'

type TooltipPlacement = 'top' | 'bottom'
type TooltipAlignment = 'start' | 'center' | 'end'

type DescribedElementProps = AriaAttributes & {
	disabled?: boolean
}

interface ActionTooltipProps {
	children: ReactElement<DescribedElementProps>
	content: ReactNode
	disabled?: boolean
	disabledContent?: ReactNode
	placement?: TooltipPlacement
	align?: TooltipAlignment
	responsiveFill?: boolean
	className?: string
}

interface TooltipPosition {
	top: number
	left: number
}

const TOOLTIP_GAP = 8
const VIEWPORT_INSET = 16

const ActionTooltip = ({
	children,
	content,
	disabled = false,
	disabledContent,
	placement = 'top',
	align = 'center',
	responsiveFill = false,
	className
}: ActionTooltipProps) => {
	const tooltipId = useId()
	const [isPointerOver, setIsPointerOver] = useState(false)
	const [isFocusedWithin, setIsFocusedWithin] = useState(false)
	const [position, setPosition] = useState<TooltipPosition | null>(null)
	const triggerRef = useRef<HTMLSpanElement | null>(null)
	const tooltipRef = useRef<HTMLSpanElement | null>(null)
	const isOpen = isPointerOver || isFocusedWithin
	const describedBy = [children.props['aria-describedby'], tooltipId]
		.filter(Boolean)
		.join(' ')
	const tooltipContent =
		disabled && disabledContent ? disabledContent : content

	const updatePosition = useCallback(() => {
		const trigger = triggerRef.current
		const tooltip = tooltipRef.current
		if (!trigger || !tooltip) return

		const triggerRect = trigger.getBoundingClientRect()
		const tooltipRect = tooltip.getBoundingClientRect()
		const preferredLeft =
			align === 'start'
				? triggerRect.left
				: align === 'end'
					? triggerRect.right - tooltipRect.width
					: triggerRect.left + (triggerRect.width - tooltipRect.width) / 2
		const clampedLeft = Math.min(
			Math.max(preferredLeft, VIEWPORT_INSET),
			Math.max(
				VIEWPORT_INSET,
				window.innerWidth - tooltipRect.width - VIEWPORT_INSET
			)
		)
		const topPosition = triggerRect.top - tooltipRect.height - TOOLTIP_GAP
		const bottomPosition = triggerRect.bottom + TOOLTIP_GAP
		const fitsAbove = topPosition >= VIEWPORT_INSET
		const fitsBelow =
			bottomPosition + tooltipRect.height <=
			window.innerHeight - VIEWPORT_INSET
		const shouldUseBottom =
			placement === 'bottom'
				? fitsBelow || !fitsAbove
				: !fitsAbove && fitsBelow
		const preferredTop = shouldUseBottom ? bottomPosition : topPosition
		const clampedTop = Math.min(
			Math.max(preferredTop, VIEWPORT_INSET),
			Math.max(
				VIEWPORT_INSET,
				window.innerHeight - tooltipRect.height - VIEWPORT_INSET
			)
		)

		setPosition({
			top: clampedTop,
			left: clampedLeft
		})
	}, [align, placement])

	useEffect(() => {
		if (!isOpen) {
			setPosition(null)
			return
		}

		updatePosition()
		window.addEventListener('resize', updatePosition)
		window.addEventListener('scroll', updatePosition, true)

		return () => {
			window.removeEventListener('resize', updatePosition)
			window.removeEventListener('scroll', updatePosition, true)
		}
	}, [isOpen, tooltipContent, updatePosition])

	const handleBlur = (event: FocusEvent<HTMLSpanElement>) => {
		if (
			event.relatedTarget instanceof Node &&
			event.currentTarget.contains(event.relatedTarget)
		) {
			return
		}

		setIsFocusedWithin(false)
	}

	const handleKeyDown = (event: KeyboardEvent<HTMLSpanElement>) => {
		if (event.key === 'Escape') {
			setIsPointerOver(false)
			setIsFocusedWithin(false)
			return
		}

		if (!disabled || (event.key !== 'Enter' && event.key !== ' ')) return

		event.preventDefault()
		event.stopPropagation()
	}

	const handleClick = (event: MouseEvent<HTMLSpanElement>) => {
		if (!disabled) return

		event.preventDefault()
		event.stopPropagation()
	}

	return (
		<span
			ref={triggerRef}
			className={[
				styles.trigger,
				disabled ? styles.triggerDisabled : '',
				responsiveFill ? styles.responsiveFill : '',
				className || ''
			]
				.filter(Boolean)
				.join(' ')}
			onPointerEnter={() => setIsPointerOver(true)}
			onPointerLeave={() => setIsPointerOver(false)}
			onFocusCapture={() => setIsFocusedWithin(true)}
			onBlurCapture={handleBlur}
			onKeyDownCapture={handleKeyDown}
			onClickCapture={handleClick}
		>
			{cloneElement(children, {
				'aria-describedby': describedBy || undefined,
				'aria-disabled':
					disabled || children.props['aria-disabled'] || undefined,
				disabled: disabled ? false : children.props.disabled
			})}
			{!isOpen && (
				<span id={tooltipId} className={styles.description}>
					{tooltipContent}
				</span>
			)}
			{isOpen &&
				typeof document !== 'undefined' &&
				createPortal(
					<span
						ref={tooltipRef}
						id={tooltipId}
						role="tooltip"
						className={`${styles.tooltip} ${
							position ? styles.tooltipOpen : ''
						}`}
						style={
							position
								? ({
										top: `${position.top}px`,
										left: `${position.left}px`
									} as CSSProperties)
								: undefined
						}
					>
						{tooltipContent}
					</span>,
					document.body
				)}
		</span>
	)
}

export default ActionTooltip
