import clsx from 'clsx'
import type { Key, ReactNode } from 'react'

import styles from './DataTable.module.scss'

export type DataTableAlignment = 'left' | 'center' | 'right'

export interface DataTableColumn<T> {
	id: string
	header: ReactNode
	render: (row: T, rowIndex: number) => ReactNode
	align?: DataTableAlignment
	headerClassName?: string
	cellClassName?: string
}

export interface DataTableProps<T> {
	caption: string
	columns: readonly DataTableColumn<T>[]
	rows: readonly T[]
	getRowKey: (row: T, rowIndex: number) => Key
	emptyMessage?: ReactNode
	embedded?: boolean
	rowClassName?:
		| string
		| ((row: T, rowIndex: number) => string | undefined)
	className?: string
}

const alignmentClassNames: Record<DataTableAlignment, string> = {
	left: styles.alignLeft,
	center: styles.alignCenter,
	right: styles.alignRight
}

export const DataTable = <T,>({
	caption,
	columns,
	rows,
	getRowKey,
	emptyMessage = 'Данных пока нет',
	embedded = false,
	rowClassName,
	className
}: DataTableProps<T>) => {
	return (
		<div
			className={clsx(
				styles.wrapper,
				embedded && styles.embedded,
				className
			)}
		>
			<div
				className={styles.scrollArea}
				role="region"
				aria-label={caption}
				tabIndex={0}
			>
				<table className={styles.table}>
					<caption className={styles.caption}>{caption}</caption>
					<thead>
						<tr className={styles.headerRow}>
							{columns.map(column => (
								<th
									key={column.id}
									scope="col"
									className={clsx(
										styles.headerCell,
										alignmentClassNames[column.align ?? 'left'],
										column.headerClassName
									)}
								>
									{column.header}
								</th>
							))}
						</tr>
					</thead>
					<tbody>
						{rows.length ? (
							rows.map((row, rowIndex) => {
								const resolvedRowClassName =
									typeof rowClassName === 'function'
										? rowClassName(row, rowIndex)
										: rowClassName

								return (
									<tr
										key={getRowKey(row, rowIndex)}
										className={clsx(styles.bodyRow, resolvedRowClassName)}
									>
										{columns.map(column => (
											<td
												key={column.id}
												className={clsx(
													styles.cell,
													alignmentClassNames[column.align ?? 'left'],
													column.cellClassName
												)}
											>
												{column.render(row, rowIndex)}
											</td>
										))}
									</tr>
								)
							})
						) : (
							<tr>
								<td
									className={styles.emptyCell}
									colSpan={columns.length || 1}
								>
									{emptyMessage}
								</td>
							</tr>
						)}
					</tbody>
				</table>
			</div>
		</div>
	)
}
