//Icons
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faImage } from '@fortawesome/free-solid-svg-icons'
//Styles
import styles from './Card.module.css'
import ImageListItem from '@mui/material/ImageListItem'

type DonationCardProps = {
    category: string | null | undefined
    brand: string | null | undefined
    model: string | null | undefined
    description: string | null | undefined
    active: boolean | null | undefined
    images: Array<string>
}

export default function DonationCard({ category, brand, model, description, active, images}: DonationCardProps) {
    const image = "'url(" + images[0] + "')"
    return (
        <div className={styles['grid__item']} key={image}>
            <h3 className={styles['grid__item__title']}>
                {brand} {model}
            </h3>
            <FontAwesomeIcon icon={faImage} className={styles['thumbnail__image']} />
        </div>
    )
}
