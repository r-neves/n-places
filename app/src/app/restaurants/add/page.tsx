import { Suspense } from "react";
import AddPlaceScreen from "./AddPlaceScreen";
import styles from "./add-place.module.css";

// useSearchParams needs a Suspense boundary to avoid opting the whole route into client-side
// rendering — same wrapper the editRating page uses.
export default function AddPlacePage() {
    return (
        <Suspense fallback={<div className={styles.page} />}>
            <AddPlaceScreen />
        </Suspense>
    );
}
