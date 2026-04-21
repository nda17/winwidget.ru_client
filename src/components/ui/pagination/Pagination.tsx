import AppIcon from '@/components/ui/icons/AppIcon'
import styles from '@/components/ui/pagination/Pagination.module.scss'
import { IPagination } from '@/components/ui/pagination/paginate.interface'
import clsx from 'clsx'
import { NextPage } from 'next'

const Pagination: NextPage<IPagination> = ({
	listPage,
	currentPage,
	prevPage,
	nextPage,
	changeActivePage
}) => {
	return (
		<div className={styles.pagination}>
			<button onClick={prevPage} type="button">
				<AppIcon name="navigate-before" />
			</button>
			<ul>
				{listPage.map(page => (
					<li key={page}>
						<span
							className={clsx({
								[styles.active]: page === currentPage
							})}
							key={page}
							onClick={() => changeActivePage(page)}
						>
							{page}
						</span>
					</li>
				))}
			</ul>
			<button onClick={nextPage} type="button">
				<AppIcon name="navigate-next" />
			</button>
		</div>
	)
}

export default Pagination
