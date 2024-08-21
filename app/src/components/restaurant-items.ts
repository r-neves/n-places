import restaurant from "../../images/icons/restaurants/restaurant.svg";
import asian from "../../images/icons/restaurants/asian.svg";
import brunch from "../../images/icons/restaurants/brunch.svg";
import buffet from "../../images/icons/restaurants/buffet.svg";
import fish from "../../images/icons/restaurants/fish.svg";
import francesinha from "../../images/icons/restaurants/francesinha.svg";
import hamburgers from "../../images/icons/restaurants/hamburgers.svg";
import indian from "../../images/icons/restaurants/indian.svg";
import italian from "../../images/icons/restaurants/italian.svg";
import meat from "../../images/icons/restaurants/meat.svg";
import mexican from "../../images/icons/restaurants/mexican.svg";
import portuguese from "../../images/icons/restaurants/portuguese.svg";
import ramen from "../../images/icons/restaurants/ramen.svg";
import seafood from "../../images/icons/restaurants/seafood.svg";
import sushi from "../../images/icons/restaurants/sushi.svg";
import tapas from "../../images/icons/restaurants/tapas.svg";
import vegetarian from "../../images/icons/restaurants/vegetarian.svg";
import { Restaurant } from "@/lib/places/domain/restaurant";

interface RestaurantItem {
    id: string;
    image: any;
    textColor: string;
  }
  
  interface RestaurantItems {
    [key: string]: RestaurantItem;
  }

export const IMAGE_SIZE = 32;

export const RestaurantItems: RestaurantItems = {
    "restaurant": {
        id: "restaurant",
        image: restaurant,
        textColor: "#c94079"
    },
    "asian": {
        id: "asian",
        image: asian,
        textColor: "#8d5bc1"
    },
    "brunch": {
        id: "brunch",
        image: brunch,
        textColor: "#f0c165"
    },
    "buffet": {
        id: "buffet",
        image: buffet,
        textColor: "#428bca"
    },
    "fish": {
        id: "fish",
        image: fish,
        textColor: "#2d7cd1"
    },
    "francesinha": {
        id: "francesinha",
        image: francesinha,
        textColor: "#ca8e1b"
    },
    "hamburgers": {
        id: "hamburgers",
        image: hamburgers,
        textColor: "#8d5bc1"
    },
    "indian": {
        id: "indian",
        image: indian,
        textColor: "#eb5757"
    },
    "italian": {
        id: "italian",
        image: italian,
        textColor: "#cd4944"
    },
    "meat": {
        id: "meat",
        image: meat,
        textColor: "#cd4944"
    },
    "mexican": {
        id: "mexican",
        image: mexican,
        textColor: "#d87620"
    },
    "ramen": {
        id: "ramen",
        image: ramen,
        textColor: "#2c9964"
    },
    "portuguese": {
        id: "portuguese",
        image: portuguese,
        textColor: "#2c9964",
    },
    "seafood": {
        id: "seafood",
        image: seafood,
        textColor: "#d87620"
    },
    "sushi": {
        id: "sushi",
        image: sushi,
        textColor: "#c94079"
    },
    "tapas": {
        id: "tapas",
        image: tapas,
        textColor: "#c94079"
    },
    "vegetarian": {
        id: "vegetarian",
        image: vegetarian,
        textColor: "#2c9964"
    },
};

export function splitRestaurantsByTag(restaurants: Restaurant[]): { [tag: string]: Restaurant[] } {
    const result: { [tag: string]: Restaurant[] } = {};
    for (const key in RestaurantItems) {
        result[key] = [];
    }

    restaurants.forEach((restaurant) => {
        if (restaurant.tags.length == 0) {
            result["restaurant"].push(restaurant);
        } else {
            const mainTag = restaurant.tags[0].tag.toLocaleLowerCase();
            if (result[mainTag] === undefined) {
                console.info("Tag not found: %s", restaurant.tags[0].tag);
                result["restaurant"].push(restaurant);
            } else {
                result[mainTag].push(restaurant);
            }
        }
    });

    return result;
}