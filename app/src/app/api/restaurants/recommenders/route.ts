import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth/require-role";
import { NotionAPIRestaurantsRepository } from "@/lib/places/repository/notion/repository";
import { RestaurantsImpl, RestaurantsService } from "@/lib/places/service";

export const dynamic = "force-dynamic";

// The names already used as recommenders, for the add screen's autocomplete.
//
// Admin-gated on the server, not just hidden in the UI: recommenders are admin-only information
// everywhere else in this app (PlaceCard hides the field, the search bar omits the entries, the
// map's recommender pill does not render), so an endpoint that lists every one of them cannot be
// open. Returns names only rather than making the client download the whole database to derive
// them.
export async function GET() {
    const auth = await requireAdmin();
    if (!auth.ok) {
        return auth.response;
    }

    const repoImpl = new NotionAPIRestaurantsRepository();
    const restaurantService: RestaurantsService = new RestaurantsImpl(repoImpl);

    try {
        return NextResponse.json(await restaurantService.listRecommenders());
    } catch (e) {
        // Never fatal: the field is free text, so no suggestions just means typing it out.
        console.warn("Failed to read recommenders: %s", e);
        return NextResponse.json([]);
    }
}
