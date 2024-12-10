import { DatabaseSchema, Restaurant } from "./domain/restaurant";
import { RestaurantsRepository } from "./repository/interface";

export interface RestaurantsService {
    getRestaurant(id: string): Promise<Restaurant | null>;
    getRestaurants(lastModifiedDate: Date): Promise<Restaurant[]>;
    getDBLastUpdatedDate(): Promise<Date>;
    editRating(placeID: string, propertyID: string, ratingID: string): Promise<void>;
    getDatabaseSchema(): Promise<DatabaseSchema>;
}

export class RestaurantsImpl implements RestaurantsService {
    private readonly repository: RestaurantsRepository;

    constructor(repository: RestaurantsRepository) {
        this.repository = repository;
    }

    async getRestaurant(id: string): Promise<Restaurant | null> {
        return this.repository.getRestaurant(id);
    }

    async getRestaurants(lastModifiedDate: Date): Promise<Restaurant[]> {
        return this.repository.getRestaurants(lastModifiedDate);
    }

    async getDBLastUpdatedDate(): Promise<Date> {
        return this.repository.getDBLastUpdatedDate();
    }

    async editRating(placeID: string, propertyID: string, ratingID: string): Promise<void> {
        return this.repository.editRating(placeID, propertyID, ratingID);
    }

    async getDatabaseSchema(): Promise<DatabaseSchema> {
        return this.repository.getDatabaseSchema();
    }
}