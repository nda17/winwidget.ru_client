import HomeSectionHeader from '@/screens/home/ui/_components/HomeSectionHeader'
import type { HomePageTariffComparisonContent } from '@/entities/home-page-content'
import styles from './HomeTariffComparison.module.scss'

interface HomeTariffComparisonProps {
	content: HomePageTariffComparisonContent
}

const HomeTariffComparison = ({ content }: HomeTariffComparisonProps) => {
	if (!content.enabled) return null

	return (
		<section className={styles.section}>
			<HomeSectionHeader
				title={content.title}
				subtitle={content.subtitle}
			/>
			<div className={styles.tableWrap}>
				<table className={styles.table}>
					<thead>
						<tr>
							<th scope="col">Возможность</th>
							<th scope="col">Easy</th>
							<th scope="col">Hard</th>
						</tr>
					</thead>
					<tbody>
						{content.rows.map((row, index) => (
							<tr key={`${row.feature}-${index}`}>
								<td data-label="Возможность">{row.feature}</td>
								<td data-label="Easy">{row.easy}</td>
								<td data-label="Hard">{row.hard}</td>
							</tr>
						))}
					</tbody>
				</table>
			</div>
		</section>
	)
}

export default HomeTariffComparison
