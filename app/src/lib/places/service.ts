import { Restaurant } from "./domain/restaurant";
import { RestaurantsRepository } from "./repository/interface";

export interface RestaurantsService {
    getRestaurants(lastModifiedDate: Date): Promise<Restaurant[]>;
    getDBLastUpdatedDate(): Promise<Date>;
}

export class RestaurantsImpl implements RestaurantsService {
    private readonly repository: RestaurantsRepository;

    constructor(repository: RestaurantsRepository) {
        this.repository = repository;
    }

    async getRestaurants(lastModifiedDate: Date): Promise<Restaurant[]> {
        return this.repository.getRestaurants(lastModifiedDate);
    }

    async getDBLastUpdatedDate(): Promise<Date> {
        return this.repository.getDBLastUpdatedDate();
    }
}