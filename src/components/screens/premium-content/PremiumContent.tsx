import styles from '@/components/screens/premium-content/PremiumContent.module.scss'
import Heading from '@/components/ui/heading/Heading'
import { PUBLIC_PAGES } from '@/config/pages/public.config'
import { NextPage } from 'next'
import Link from 'next/link'

const PremiumContent: NextPage = () => {
	// В реальном проекте здесь будет запрос к серверу и генерация списка на основе полученных данных.

	return (
		<div className={styles.wrapper}>
			<Heading text="Платный Premium контент" />

			<div className={styles.text}>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=1`}
					className={styles.link}
				>
					Премиум-материал № 1
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=2`}
					className={styles.link}
				>
					Премиум-материал № 2
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=3`}
					className={styles.link}
				>
					Премиум-материал № 3
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=4`}
					className={styles.link}
				>
					Премиум-материал № 4
				</Link>
				<Link
					href={`${PUBLIC_PAGES.PREMIUM_CONTENT}/content?id=5`}
					className={styles.link}
				>
					Премиум-материал № 5
				</Link>
				Lorem ipsum dolor sit amet, consectetur adipisicing elit. Laborum
				numquam perferendis explicabo tempora cumque fugit id deleniti
				officiis, aperiam quae eveniet nesciunt iste aliquid cum quas
				molestiae necessitatibus debitis consequatur. Quisquam fuga in
				quidem aliquid, tenetur non dolor accusamus quod obcaecati optio
				beatae, eligendi debitis quia commodi ratione doloribus molestiae
				libero adipisci. Illo nam odio sequi explicabo et dolores incidunt.
				Minus rerum sed vel dolore voluptates obcaecati repellat pariatur
				et, distinctio nobis laboriosam porro eveniet fugiat at sint
				cupiditate optio dolores repellendus. Maiores aliquam velit tenetur
				sed nostrum. Commodi, iusto? Ad eveniet vero, tempora porro
				aspernatur perspiciatis consectetur rerum non pariatur veritatis
				minima, quisquam culpa itaque facere quod cupiditate. Perferendis
				provident iusto ea quae expedita doloremque. Deserunt, quas
				expedita. Quae. Nesciunt, in nihil quos laboriosam necessitatibus
				culpa autem nam, aliquid laudantium reiciendis vero harum
				consequuntur ipsam? Modi deleniti earum sequi delectus autem
				aperiam, itaque dolor ex, repellendus blanditiis cupiditate natus!
				Possimus cum praesentium ratione laborum veniam magni eaque
				voluptatibus voluptatem sunt, velit aut nulla at adipisci impedit
				quod facere ipsum assumenda et, rem in eius. Ex tenetur ea aperiam
				magnam. Minus repellendus inventore perspiciatis labore cumque
				velit deleniti sapiente voluptatem voluptate delectus ipsam magni
				laudantium est, corrupti excepturi esse error quia hic! Eligendi,
				sequi quibusdam tempore culpa ipsum excepturi ipsam! Eligendi aut
				laborum ad optio, quasi molestias dolorum voluptatum nobis
				cupiditate dignissimos nam et! Tempora fugiat saepe voluptas,
				asperiores cum ipsam corrupti corporis eligendi eaque, ratione
				laborum culpa magnam mollitia. Facere quas dolor consequatur vitae
				voluptatum asperiores ipsum iste est totam officia, vero eveniet
				incidunt libero accusantium tempora saepe recusandae repellat error
				at natus debitis. Veritatis ex id nobis inventore. Fugiat quisquam
				harum quos praesentium debitis error, necessitatibus ut nemo! Enim
				ratione autem, libero dicta aperiam quae eius laudantium
				repellendus est molestiae eum odit voluptate expedita. Repellendus
				voluptas debitis cupiditate. Lorem ipsum dolor sit amet
				consectetur, adipisicing elit. Eligendi repellendus hic saepe modi,
				sit doloremque aspernatur vel iusto veniam adipisci eos odit rem,
				velit similique cumque beatae dolorem distinctio laudantium?
				Aperiam laboriosam, et ipsa ratione placeat accusantium, possimus
				optio magnam repellat, id officia assumenda velit consequatur
				quidem? Error iste quibusdam nemo dolore quam? Tempore voluptate
				veniam tenetur rem quaerat esse. Omnis consequuntur, ipsa incidunt
				sed, quam blanditiis et, est laboriosam numquam accusamus
				explicabo! Ad architecto nemo dolorem laborum et molestiae adipisci
				repellendus, distinctio nisi sint harum necessitatibus! Placeat, ex
				eligendi.
			</div>
		</div>
	)
}

export default PremiumContent
