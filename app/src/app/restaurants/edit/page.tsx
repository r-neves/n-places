import { Suspense } from "react";
import EditPlaceScreen from "./EditPlaceScreen";
import styles from "@/components/placeForm/place-form.module.css";

// useSearchParams needs a Suspense boundary to avoid opting the whole route into client-side
// rendering — same wrapper the add page uses.
export default function EditPlacePage() {
    return (
        <Suspense fallback={<div className={styles.page} />}>
            <EditPlaceScreen />
        </Suspense>
    );
}
