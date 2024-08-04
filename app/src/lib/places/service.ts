import { Restaurant } from "./domain/restaurant";
import { RestaurantsRepository } from "./repository/interface";

export interface RestaurantsService {
    getRestaurants(databaseID: string): Promise<Restaurant[]>;
    getDBLastUpdatedDate(databaseID: string): Promise<Date>;
}

export class RestaurantsImpl implements RestaurantsService {
    private readonly repository: RestaurantsRepository;

    constructor(repository: RestaurantsRepository) {
        this.repository = repository;
    }

    async getRestaurants(databaseID: string): Promise<Restaurant[]> {
        return this.repository.getRestaurants(databaseID);
    }

    async getDBLastUpdatedDate(databaseID: string): Promise<Date> {
        return this.repository.getDBLastUpdatedDate(databaseID);
    }
}