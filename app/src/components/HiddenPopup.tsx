"use client";

import { useSession } from "next-auth/react";
import styles from "./hidden.module.css";
import { Dispatch, SetStateAction } from "react";
import GoogleSignInButton from "./GoogleSignInButton";
import SignOutButton from "./SignOutButton";

export default function HiddenPopup({ isVisible, setIsVisible, userRole }: { isVisible: boolean, setIsVisible: Dispatch<SetStateAction<boolean>>, userRole: string }) {
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
            <div className={styles.overlay} onClick={(e) => handleOverlayClick(e)}>
                <div className={styles.hiddenPopup}>
                    <p>Welcome {session.user?.name}!</p>
                    <br />
                    <p>Your role is <span className={`${styles.role} ${userRole}`}>{userRole}</span></p>
                    <SignOutButton/>
                </div>
            </div>
        );
    }

    
    return (
        <div className={styles.overlay} onClick={(e) => handleOverlayClick(e)}>
            <div className={styles.hiddenPopup}>
                <GoogleSignInButton/>
            </div>
        </div>
    );
}