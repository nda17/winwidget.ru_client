import styles from './LegalPageContent.module.scss'

interface Props {
	html: string
}

const LegalPageContent = ({ html }: Props) => {
	return (
		<div className={styles.wrapper}>
			<div
				className={styles.content}
				dangerouslySetInnerHTML={{ __html: html }}
			/>
		</div>
	)
}

export default LegalPageContent
