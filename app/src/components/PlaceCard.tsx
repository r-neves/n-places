"use client";

import { Restaurant } from "@/lib/places/domain/restaurant";
import styles from "./placeCard.module.css";
import { UserRole } from "@/lib/constants/enums";
import { PriceMap, RatingMap, RestaurantTypeMap } from "./restaurant-items";
import { JSX, RefObject, useEffect, useRef, useState } from "react";
import {
    CloseIcon,
    EditIcon,
    GoogleMapsMarker,
    TrashIcon,
} from "@/lib/constants/svg";

const DRAG_DISMISS_THRESHOLD_PX = 80;

export default function PlaceCard({
    place,
    userRole,
    onClose,
}: {
    place: Restaurant | null;
    userRole: RefObject<string>;
    onClose: () => void;
}) {
    const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const dragStartY = useRef<number | null>(null);

    useEffect(() => {
        setIsConfirmingDelete(false);
        setIsDeleting(false);
    }, [place?.id]);

    if (place === null) {
        return null;
    }

    async function handleConfirmDelete() {
        if (place === null) {
            return;
        }

        setIsDeleting(true);

        try {
            const response = await fetch(`/api/restaurants/${place.id}`, {
                method: "DELETE",
            });

            if (!response.ok) {
                throw new Error("Delete failed");
            }

            onClose();
            window.location.reload();
        } catch (e) {
            console.error(e);
            setIsDeleting(false);
            setIsConfirmingDelete(false);
        }
    }

    // setPointerCapture/releasePointerCapture can throw NotFoundError if the browser doesn't
    // consider the pointer "active" (observed with synthetic events, and possible in real
    // browsers if capture was already released some other way) — always swallowed, since losing
    // capture should degrade to a normal (uncaptured) drag rather than break the gesture.
    function tryPointerCapture(e: React.PointerEvent<HTMLDivElement>, capture: boolean) {
        try {
            if (capture) {
                e.currentTarget.setPointerCapture(e.pointerId);
            } else {
                e.currentTarget.releasePointerCapture(e.pointerId);
            }
        } catch {}
    }

    function handleDragPointerDown(e: React.PointerEvent<HTMLDivElement>) {
        dragStartY.current = e.clientY;
        // Keeps this element receiving move/up events for the rest of the gesture even if the
        // finger drifts off the (small) handle — without this, a drifted touch falls through to
        // the page, which mobile browsers read as a pull-to-refresh drag.
        tryPointerCapture(e, true);
    }

    function handleDragPointerMove(e: React.PointerEvent<HTMLDivElement>) {
        if (dragStartY.current === null) {
            return;
        }

        // Belt-and-suspenders alongside `touch-action: none` and `overscroll-behavior:
        // contain` — stops the browser from treating this drag as a page gesture.
        e.preventDefault();
    }

    function handleDragPointerUp(e: React.PointerEvent<HTMLDivElement>) {
        if (dragStartY.current === null) {
            return;
        }

        const dragDistance = e.clientY - dragStartY.current;
        dragStartY.current = null;
        tryPointerCapture(e, false);

        if (dragDistance > DRAG_DISMISS_THRESHOLD_PX) {
            onClose();
        }
    }

    function handleDragPointerCancel(e: React.PointerEvent<HTMLDivElement>) {
        dragStartY.current = null;
        tryPointerCapture(e, false);
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

    if (place.tags.length === 0) {
        typeElems.push(
            <p key="no-type" className={styles.body}>
                -
            </p>
        );
    }

    let ambienceElems: JSX.Element[] = [];
    place.ambience.forEach((t) => {
        ambienceElems.push(
            <span key={t.tag} className={styles.ambience}>
                {t.tag}
            </span>
        );
    });

    if (place.ambience.length === 0) {
        ambienceElems.push(
            <p key="no-ambience" className={styles.body}>
                -
            </p>
        );
    }

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

    let location = place.location;
    if (location === "") {
        location = "-";
    }

    let notes = place.description;
    if (notes === "") {
        notes = "-";
    }

    let review = place.review;
    if (review === "") {
        review = "-";
    }



    return (
        <div className={styles.placeCard}>
            <div className={styles.header}>
                <div
                    className={styles.dragHandle}
                    onPointerDown={handleDragPointerDown}
                    onPointerMove={handleDragPointerMove}
                    onPointerUp={handleDragPointerUp}
                    onPointerCancel={handleDragPointerCancel}
                />
                <div className={styles.spacedRow}>
                    <h2>{place.name}</h2>
                    <div className={styles.headerActions}>
                        {userRole.current === UserRole.ADMIN && (
                            <>
                                <button
                                    className={styles.editBtn}
                                    onClick={() => {
                                        window.location.href = `/restaurants/edit?placeId=${place.id}`;
                                    }}
                                >
                                    <EditIcon />
                                    Edit
                                </button>
                                {isConfirmingDelete ? (
                                    <div className={styles.confirmDeleteRow}>
                                        <span className={styles.confirmText}>
                                            Delete this place?
                                        </span>
                                        <button
                                            className={styles.confirmDeleteBtn}
                                            disabled={isDeleting}
                                            onClick={handleConfirmDelete}
                                        >
                                            {isDeleting ? "..." : "Yes"}
                                        </button>
                                        <button
                                            className={styles.cancelDeleteBtn}
                                            disabled={isDeleting}
                                            onClick={() =>
                                                setIsConfirmingDelete(false)
                                            }
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className={styles.deleteBtn}
                                        onClick={() =>
                                            setIsConfirmingDelete(true)
                                        }
                                    >
                                        <TrashIcon />
                                        Delete
                                    </button>
                                )}
                            </>
                        )}
                        <button
                            className={styles.closeBtn}
                            onClick={onClose}
                            aria-label="Close"
                        >
                            <CloseIcon />
                        </button>
                    </div>
                </div>
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
                {userRole.current === UserRole.ADMIN && place.recommender !== "" && (
                    <div className={styles.column}>
                        <p className={styles.caption}>Recommender</p>
                        <p className={styles.body}>{place.recommender}</p>
                    </div>
                )}
            </div>
            <div>
                <p className={styles.caption}>LOCATION</p>
                <p className={styles.body}>{location}</p>
            </div>
            <div>
                <p className={styles.caption}>NOTES</p>
                <p className={styles.body}>{notes}</p>
            </div>
            <div>
                <p className={styles.caption}>REVIEW</p>
                <p className={styles.body}>{review}</p>
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
            <a href={place.mapsUrl} target="_blank" className={styles.mapsBtn}>
                <GoogleMapsMarker />
                <p>Go to Google Maps</p>
            </a>
        </div>
    );
}
