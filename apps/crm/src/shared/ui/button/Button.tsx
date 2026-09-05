import clsx from 'clsx'
import { forwardRef } from 'react'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

import styles from './Button.module.scss'

export type ButtonVariant =
	| 'primary'
	| 'accent'
	| 'secondary'
	| 'ghost'
	| 'danger'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
	variant?: ButtonVariant
	size?: ButtonSize
	fullWidth?: boolean
	isLoading?: boolean
	leadingIcon?: ReactNode
	trailingIcon?: ReactNode
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	(
		{
			variant = 'primary',
			size = 'md',
			fullWidth = false,
			isLoading = false,
			leadingIcon,
			trailingIcon,
			className,
			children,
			disabled,
			type = 'button',
			...props
		},
		ref
	) => {
		return (
			<button
				ref={ref}
				type={type}
				className={clsx(
					styles.button,
					styles[variant],
					styles[size],
					fullWidth && styles.fullWidth,
					className
				)}
				disabled={disabled || isLoading}
				aria-busy={isLoading || undefined}
				{...props}
			>
				{isLoading ? (
					<span className={styles.spinner} aria-hidden="true" />
				) : (
					leadingIcon
				)}
				<span className={styles.label}>{children}</span>
				{isLoading ? null : trailingIcon}
			</button>
		)
	}
)

Button.displayName = 'Button'
