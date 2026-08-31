import clsx from 'clsx'
import Link from 'next/link'

import styles from './BrandLogo.module.scss'

export interface BrandLogoProps {
	href?: string
	compact?: boolean
	className?: string
}

const LogoContent = ({ compact }: Pick<BrandLogoProps, 'compact'>) => {
	return (
		<>
			<svg className={styles.mark} viewBox="0 0 36 36" aria-hidden="true">
				<rect width="36" height="36" rx="11" />
				<path d="m8.5 10 4.25 16h3.5L18 18.9 19.75 26h3.5L27.5 10h-3.7l-2.4 10.1L19.25 10h-2.5L14.6 20.1 12.2 10z" />
			</svg>
			<span
				className={clsx(
					styles.wordmark,
					compact && styles.compactWordmark
				)}
			>
				<span>WinWidget</span>
				<span className={styles.product}>CRM</span>
			</span>
			{compact ? (
				<span className={styles.srOnly}>WinWidget CRM</span>
			) : null}
		</>
	)
}

export const BrandLogo = ({
	href,
	compact = false,
	className
}: BrandLogoProps) => {
	const logoClassName = clsx(
		styles.logo,
		compact && styles.compact,
		className
	)

	if (href) {
		return (
			<Link
				href={href}
				className={logoClassName}
				aria-label="WinWidget CRM"
			>
				<LogoContent compact={compact} />
			</Link>
		)
	}

	return (
		<span className={logoClassName}>
			<LogoContent compact={compact} />
		</span>
	)
}
