"use client";

import { Dispatch, SetStateAction } from "react";
import styles from "./problemsModal.module.css";
import { RestaurantProblem } from "@/lib/places/domain/problem";

export default function ProblemsModal({
    isVisible,
    setIsVisible,
    problems,
}: {
    isVisible: boolean;
    setIsVisible: Dispatch<SetStateAction<boolean>>;
    problems: RestaurantProblem[];
}) {
    function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget) {
            return;
        }

        setIsVisible(false);
    }

    if (!isVisible) {
        return null;
    }

    return (
        <div className={styles.overlay} onClick={(e) => handleOverlayClick(e)}>
            <div className={styles.problemsModal}>
                <h2>Data problems ({problems.length})</h2>
                {problems.length === 0 && (
                    <p className={styles.emptyState}>No problems found.</p>
                )}
                <ul className={styles.problemsList}>
                    {problems.map((problem, index) => (
                        <li key={index} className={styles.problemItem}>
                            <span
                                className={`${styles.badge} ${
                                    problem.type === "duplicate"
                                        ? styles.duplicateBadge
                                        : styles.parseErrorBadge
                                }`}
                            >
                                {problem.type === "duplicate"
                                    ? "Duplicate"
                                    : "Parse error"}
                            </span>
                            <p className={styles.problemNames}>
                                {problem.placeNames.length > 0
                                    ? problem.placeNames.join(", ")
                                    : problem.placeIds.join(", ")}
                            </p>
                            <p className={styles.problemReason}>
                                {problem.reason}
                            </p>
                            {problem.notionUrls &&
                                problem.notionUrls.length > 0 && (
                                    <div className={styles.problemLinks}>
                                        {problem.notionUrls.map((url) => (
                                            <a
                                                key={url}
                                                href={url}
                                                target="_blank"
                                                className={styles.problemLink}
                                            >
                                                Open in Notion
                                            </a>
                                        ))}
                                    </div>
                                )}
                        </li>
                    ))}
                </ul>
            </div>
        </div>
    );
}
