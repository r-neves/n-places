import { Restaurant } from "@/lib/places/domain/restaurant";
import styles from "./placeCard.module.css";
import { UserRole } from "@/lib/constants/enums";
import { PriceMap, RatingMap, RestaurantTypeMap } from "./restaurant-items";
import { JSX } from "react";
import { EditIcon, GoogleMapsMarker } from "@/lib/constants/svg";

export default function PlaceCard({
    place,
    userRole,
}: {
    place: Restaurant | null;
    userRole: string;
}) {
    if (place === null) {
        return null;
    }

    let typeElems: JSX.Element[] = [];
    place.tags.forEach((t) => {
        const foundItem = RestaurantTypeMap[t.tag.toLocaleLowerCase()];
        typeElems.push(
            <span
                key={t.tag}
                className={styles.type}
                style={{ backgroundColor: foundItem.color }}
            >
                {t.tag}
            </span>
        );
    });

    let ambienceElems: JSX.Element[] = [];
    place.ambience.forEach((t) => {
        ambienceElems.push(
            <span key={t.tag} className={styles.ambience}>
                {t.tag}
            </span>
        );
    });

    let rating = "Not Visited";
    let ratingColor = RatingMap["Not Visited"].color;
    if (RatingMap[place.rating] !== undefined) {
        rating = place.rating;
        ratingColor = RatingMap[place.rating].color;
    }

    let dishPrice = "Not Set";
    let dishPriceColor = PriceMap["undefined"].color;
    if (PriceMap[place.dishPrice] !== undefined) {
        dishPrice = place.dishPrice;
        dishPriceColor = PriceMap[place.dishPrice].color;
    }

    return (
        <div className={styles.placeCard}>
            <div className={styles.spacedRow}>
                <h2>{place.name}</h2>
                {userRole === UserRole.ADMIN && (
                    <button
                        className={styles.editBtn}
                        onClick={() => {
                            window.location.href = `/restaurants/editRating?placeId=${place.id}`;
                        }}
                    >
                        <EditIcon />
                        Edit
                    </button>
                )}
            </div>
            <div className={styles.spacedRow}>
                <div className={styles.row}>
                    <div className={styles.column}>
                        <p className={styles.caption}>RATING</p>
                        <p
                            className={styles.rating}
                            style={{ backgroundColor: ratingColor }}
                        >
                            {rating}
                        </p>
                    </div>
                    <div className={styles.column}>
                        <p className={styles.caption}>PRICING</p>
                        <p
                            className={styles.pricing}
                            style={{ backgroundColor: dishPriceColor }}
                        >
                            {dishPrice}
                        </p>
                    </div>
                </div>
                {userRole === UserRole.ADMIN && place.recommender !== "" && (
                    <div className={styles.column}>
                        <p className={styles.caption}>Recommender</p>
                        <p className={styles.body}>{place.recommender}</p>
                    </div>
                )}
            </div>
            <div>
                <p className={styles.caption}>LOCATION</p>
                <p className={styles.body}>{place.location}</p>
            </div>
            <div>
                <p className={styles.caption}>NOTES</p>
                <p className={styles.body}>{place.description}</p>
            </div>
            <div>
                <p className={styles.caption}>REVIEW</p>
                <p className={styles.body}>{place.review}</p>
            </div>
            <div>
                <p className={styles.caption}>TYPE</p>
                <div className={`${styles.body} ${styles.tagList}`}>
                    {typeElems}
                </div>
            </div>
            <div>
                <p className={styles.caption}>AMBIENCE</p>
                <div className={`${styles.body} ${styles.tagList}`}>
                    {ambienceElems}
                </div>
            </div>
            <a href={place.mapsUrl} className={styles.mapsBtn}>
                <GoogleMapsMarker />
                <p>Go to Google Maps</p>
            </a>
        </div>
    );
}
