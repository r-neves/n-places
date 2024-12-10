"use client";
import { useRouter } from "next/navigation";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import styles from "./page.module.css";
import { useSession } from "next-auth/react";
import { UserRole } from "@/lib/util/enums";

export default function EditRatingPage() {
    const { data: session, status } = useSession();
    const router = useRouter();
    const searchParams = useSearchParams();
    const placeId = searchParams.get("placeId");
    const [placeName, setPlaceName] = useState("");
    const [currentRating, setCurrentRating] = useState<string | null>(null);
    const [ratingID, setRatingID] = useState<string | null>(null);
    const [propertyID, setPropertyID] = useState<string | null>(null);
    const [options, setOptions] = useState<any | null>(null);
    const [userRole, setUserRole] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);

    useEffect(() => {
        const updateUserRole = async () => {
            if (!session || !session.user || !session.user.email) {
                return;
            }

            const response: string = await fetch("/api/auth/getRole", {
                method: "POST",
                body: JSON.stringify({ email: session.user.email }),
            }).then((response) => response.json());

            setUserRole(response === "" ? UserRole.VIEWER : response);
        };

        updateUserRole();
    }, [status]);

    useEffect(() => {
        if (placeId) {
            fetch(`/api/restaurants/${placeId}`, {cache: "no-store"})
                .then((response) => {
                    response.json().then((data) => {
                        setPlaceName(data.name);
                        setCurrentRating(data.rating);
                    });
                })
                .catch((error) => {
                    console.error("Error fetching place data:", error);
                });
        }
    }, [placeId]);

    useEffect(() => {
        fetch("/api/restaurants/schema")
            .then((response) => {
                response.json().then((data) => {
                    setOptions(data.properties.Rating.status.options);
                    setPropertyID(data.properties.Rating.id);

                    for (const option in options) {
                        if (options[option].name === currentRating) {
                            setRatingID(options[option].id);
                            break;
                        }
                    }

                    if (
                        (options !== null && currentRating === null) ||
                        currentRating === ""
                    ) {
                        setRatingID(options[0].id);
                    }
                });
            })
            .catch((error) => {
                console.error("Error fetching database schema:", error);
            });
    }, [currentRating]);

    const handleRatingChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setRatingID(event.target.value);
    };

    const handleSubmit = () => {
        if (ratingID === null || propertyID === null) {
            console.error("Rating or property ID is null");
            return;
        }

        setIsSubmitting(true);

        fetch(`/api/restaurants/${placeId}/rating`, {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                ratingID: ratingID,
                propertyID: "Rating",
            }),
        })
            .then((response) => {
                if (response.ok) {
                    setIsSuccess(true);
                    setTimeout(() => {
                        router.push("/"); // Replace with your target page
                    }, 1000);
                } else {
                    console.error("Error submitting rating:", response);
                }
            })
            .catch((error) => {
                console.error("Error submitting rating:", error);
            })
    };

    if (status === "loading" || userRole === null) {
        return (
            <div className={styles.page}>
                <h1>Loading...</h1>
            </div>
        );
    }

    if (userRole !== UserRole.ADMIN) {
        return (
            <div className={styles.page}>
                <h1>Unauthorized</h1>
                <p>You are not authorized to access this page.</p>
            </div>
        );
    }

    return (
        <div className={styles.page}>
            <h1>
                {currentRating === "" || currentRating === null
                    ? "Add"
                    : "Edit"}{" "}
                Rating
            </h1>
            <h2>Restaurant: {placeName}</h2>
            {currentRating !== null && currentRating !== "" && (
                <h3>Current Rating: {currentRating}</h3>
            )}
            <label className={styles.ratingOption}>
                <input
                    type="radio"
                    name={options && options[0].name}
                    value={options && options[0].id}
                    checked={ratingID === options[0].id}
                    className={styles.radioInput}
                    onChange={handleRatingChange}
                />
                {options && options[0].name}
            </label>
            <div className={styles.ratingsDiv}>
                <div className={styles.ratingColumn}>
                    {options &&
                        Array.from(options.slice(1, 6), (value: any) => (
                            <label
                                key={value.id}
                                className={styles.ratingOption}
                            >
                                <input
                                    type="radio"
                                    name={value.name}
                                    value={value.id}
                                    checked={ratingID === value.id}
                                    className={styles.radioInput}
                                    onChange={handleRatingChange}
                                />
                                {value.name}
                            </label>
                        ))}
                </div>
                <div className={styles.ratingColumn}>
                    {options &&
                        Array.from(options.slice(6), (value: any) => (
                            <label
                                key={value.id}
                                className={styles.ratingOption}
                            >
                                <input
                                    type="radio"
                                    name={value.name}
                                    value={value.id}
                                    checked={ratingID === value.id}
                                    className={styles.radioInput}
                                    onChange={handleRatingChange}
                                />
                                {value.name}
                            </label>
                        ))}
                </div>
            </div>
            <div className={styles.buttonsDiv}>
                <button
                    className={styles.submitButton}
                    onClick={handleSubmit}
                    disabled={isSubmitting || isSuccess}
                    style={{
                        backgroundColor: isSuccess ? "green" : "",
                        color: isSuccess ? "white" : "",
                    }}
                >
                    {isSuccess ? "✔" : "Confirm"}
                </button>

                <button
                    className={styles.cancelButton}
                    onClick={() => router.push("/")}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
