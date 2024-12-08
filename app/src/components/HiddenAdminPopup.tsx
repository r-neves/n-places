"use client";

import { useSession } from "next-auth/react";
import styles from "./hidden.module.css";
import { Dispatch, SetStateAction } from "react";
import GoogleSignInButton from "./GoogleSignInButton";
import SignOutButton from "./SignOutButton";
import { TrashIcon } from "@/lib/util/svg";

export default function HiddenAdminPopup({
    isVisible,
    setIsVisible,
    userRole,
}: {
    isVisible: boolean;
    setIsVisible: Dispatch<SetStateAction<boolean>>;
    userRole: string;
}) {
    function handleOverlayClick(event: React.MouseEvent<HTMLDivElement>) {
        if (event.target !== event.currentTarget) {
            return;
        }

        setIsVisible(false);
    }

    const { data: session } = useSession();

    if (!isVisible) {
        return null;
    }

    if (session) {
        return (
            <div
                className={styles.overlay}
                onClick={(e) => handleOverlayClick(e)}
            >
                <div className={styles.hiddenAdminPopup}>
                    <p>Welcome {session.user?.name}!</p>
                    <br />
                    <p>
                        Your role is{" "}
                        <span className={`${styles.role} ${userRole}`}>
                            {userRole}
                        </span>
                    </p>
                    {userRole === "admin" && (
                        <button
                            className={styles.wipeCacheButton}
                            onClick={async () =>
                                await fetch("/api/cache/evict", {
                                    cache: "no-store",
                                    method: "POST",
                                }).then(() => {
                                    caches.keys().then((cacheNames) => {
                                        return Promise.all(
                                            cacheNames.map((cacheName) => {
                                                return caches.delete(cacheName);
                                            })
                                        );
                                    });

                                    window.location.reload();
                                })
                            }
                        >
                            <TrashIcon />
                            <p className={styles.textDiv}>Wipe Cache</p>
                        </button>
                    )}
                    <SignOutButton />
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay} onClick={(e) => handleOverlayClick(e)}>
            <div className={styles.hiddenPopup}>
                <GoogleSignInButton />
            </div>
        </div>
    );
}
