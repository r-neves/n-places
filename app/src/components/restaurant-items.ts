import restaurant from "../../images/icons/restaurants/restaurant.svg";
import restaurantSelected from "../../images/icons/restaurants/restaurant_selected.svg";
import asian from "../../images/icons/restaurants/asian.svg";
import asianSelected from "../../images/icons/restaurants/asian_selected.svg";
import brunch from "../../images/icons/restaurants/brunch.svg";
import brunchSelected from "../../images/icons/restaurants/brunch_selected.svg";
import buffet from "../../images/icons/restaurants/buffet.svg";
import buffetSelected from "../../images/icons/restaurants/buffet_selected.svg";
import fish from "../../images/icons/restaurants/fish.svg";
import fishSelected from "../../images/icons/restaurants/fish_selected.svg";
import francesinha from "../../images/icons/restaurants/francesinha.svg";
import francesinhaSelected from "../../images/icons/restaurants/francesinha_selected.svg";
import hamburgers from "../../images/icons/restaurants/hamburgers.svg";
import hamburgersSelected from "../../images/icons/restaurants/hamburgers_selected.svg";
import indian from "../../images/icons/restaurants/indian.svg";
import indianSelected from "../../images/icons/restaurants/indian_selected.svg";
import italian from "../../images/icons/restaurants/italian.svg";
import italianSelected from "../../images/icons/restaurants/italian_selected.svg";
import meat from "../../images/icons/restaurants/meat.svg";
import meatSelected from "../../images/icons/restaurants/meat_selected.svg";
import mexican from "../../images/icons/restaurants/mexican.svg";
import mexicanSelected from "../../images/icons/restaurants/mexican_selected.svg";
import portuguese from "../../images/icons/restaurants/portuguese.svg";
import portugueseSelected from "../../images/icons/restaurants/portuguese_selected.svg";
import ramen from "../../images/icons/restaurants/ramen.svg";
import ramenSelected from "../../images/icons/restaurants/ramen_selected.svg";
import seafood from "../../images/icons/restaurants/seafood.svg";
import seafoodSelected from "../../images/icons/restaurants/seafood_selected.svg";
import sushi from "../../images/icons/restaurants/sushi.svg";
import sushiSelected from "../../images/icons/restaurants/sushi_selected.svg";
import tapas from "../../images/icons/restaurants/tapas.svg";
import tapasSelected from "../../images/icons/restaurants/tapas_selected.svg";
import vegetarian from "../../images/icons/restaurants/vegetarian.svg";
import vegetarianSelected from "../../images/icons/restaurants/vegetarian_selected.svg";
import { Restaurant } from "@/lib/places/domain/restaurant";

interface RestaurantItem {
    id: string;
    image: any;
    textColor: string;
    selectedImage: any;
    selectedTextColor: string;
  }
  
  interface RestaurantItems {
    [key: string]: RestaurantItem;
  }

export const IMAGE_SIZE = 32;

export const RestaurantItems: RestaurantItems = {
    "restaurant": {
        id: "restaurant",
        image: restaurant,
        textColor: "#c94079",
        selectedImage: restaurantSelected,
        selectedTextColor: "#892b53"
    },
    "asian": {
        id: "asian",
        image: asian,
        textColor: "#8d5bc1",
        selectedImage: asianSelected,
        selectedTextColor: "#5f3e84"
    },
    "brunch": {
        id: "brunch",
        image: brunch,
        textColor: "#d87620",
        selectedImage: brunchSelected,
        selectedTextColor: "#934f16"
    },
    "buffet": {
        id: "buffet",
        image: buffet,
        textColor: "#428bca",
        selectedImage: buffetSelected,
        selectedTextColor: "#0872cd"
    },
    "fish": {
        id: "fish",
        image: fish,
        textColor: "#2d7cd1",
        selectedImage: fishSelected,
        selectedTextColor: "#1f558f"
    },
    "francesinha": {
        id: "francesinha",
        image: francesinha,
        textColor: "#ca8e1b",
        selectedImage: francesinhaSelected,
        selectedTextColor: "#8a6013"
    },
    "hamburgers": {
        id: "hamburgers",
        image: hamburgers,
        textColor: "#8d5bc1",
        selectedImage: hamburgersSelected,
        selectedTextColor: "#5f3e84"
    },
    "indian": {
        id: "indian",
        image: indian,
        textColor: "#eb5757",
        selectedImage: indianSelected,
        selectedTextColor: "#ed2a29"
    },
    "italian": {
        id: "italian",
        image: italian,
        textColor: "#cd4944",
        selectedImage: italianSelected,
        selectedTextColor: "#8c312f"
    },
    "meat": {
        id: "meat",
        image: meat,
        textColor: "#cd4944",
        selectedImage: meatSelected,
        selectedTextColor: "#8c312f"
    },
    "mexican": {
        id: "mexican",
        image: mexican,
        textColor: "#d87620",
        selectedImage: mexicanSelected,
        selectedTextColor: "#934f16"
    },
    "ramen": {
        id: "ramen",
        image: ramen,
        textColor: "#2c9964",
        selectedImage: ramenSelected,
        selectedTextColor: "#195637"
    },
    "portuguese": {
        id: "portuguese",
        image: portuguese,
        textColor: "#2c9964",
        selectedImage: portugueseSelected,
        selectedTextColor: "#1e6943"
    },
    "seafood": {
        id: "seafood",
        image: seafood,
        textColor: "#d87620",
        selectedImage: seafoodSelected,
        selectedTextColor: "#934f16"
    },
    "sushi": {
        id: "sushi",
        image: sushi,
        textColor: "#c94079",
        selectedImage: sushiSelected,
        selectedTextColor: "#892b53"
    },
    "tapas": {
        id: "tapas",
        image: tapas,
        textColor: "#c94079",
        selectedImage: tapasSelected,
        selectedTextColor: "#892b53"
    },
    "vegetarian": {
        id: "vegetarian",
        image: vegetarian,
        textColor: "#2c9964",
        selectedImage: vegetarianSelected,
        selectedTextColor: "#1e6943"
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