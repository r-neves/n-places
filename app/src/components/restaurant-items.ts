import restaurant from "../../images/icons/restaurants/icon-restaurant-default.png";
import restaurantSelected from "../../images/icons/restaurants/icon-restaurant-active.png";
import asian from "../../images/icons/restaurants/icon-asian-default.png";
import asianSelected from "../../images/icons/restaurants/icon-asian-active.png";
import brunch from "../../images/icons/restaurants/icon-brunch-default.png";
import brunchSelected from "../../images/icons/restaurants/icon-brunch-active.png";
import buffet from "../../images/icons/restaurants/icon-buffet-default.png";
import buffetSelected from "../../images/icons/restaurants/icon-buffet-active.png";
import fish from "../../images/icons/restaurants/icon-fish-default.png";
import fishSelected from "../../images/icons/restaurants/icon-fish-active.png";
import francesinha from "../../images/icons/restaurants/icon-francesinha-default.png";
import francesinhaSelected from "../../images/icons/restaurants/icon-francesinha-active.png";
import hamburgers from "../../images/icons/restaurants/icon-hamburger-default.png";
import hamburgersSelected from "../../images/icons/restaurants/icon-hamburger-active.png";
import indian from "../../images/icons/restaurants/icon-indian-default.png";
import indianSelected from "../../images/icons/restaurants/icon-indian-active.png";
import italian from "../../images/icons/restaurants/icon-italian-default.png";
import italianSelected from "../../images/icons/restaurants/icon-italian-active.png";
import meat from "../../images/icons/restaurants/icon-meat-default.png";
import meatSelected from "../../images/icons/restaurants/icon-meat-active.png";
import mexican from "../../images/icons/restaurants/icon-mexican-default.png";
import mexicanSelected from "../../images/icons/restaurants/icon-mexican-active.png";
import portuguese from "../../images/icons/restaurants/icon-portuguese-default.png";
import portugueseSelected from "../../images/icons/restaurants/icon-portuguese-active.png";
import ramen from "../../images/icons/restaurants/icon-ramen-default.png";
import ramenSelected from "../../images/icons/restaurants/icon-ramen-active.png";
import seafood from "../../images/icons/restaurants/icon-seafood-default.png";
import seafoodSelected from "../../images/icons/restaurants/icon-seafood-active.png";
import sushi from "../../images/icons/restaurants/icon-sushi-default.png";
import sushiSelected from "../../images/icons/restaurants/icon-sushi-active.png";
import tapas from "../../images/icons/restaurants/icon-tapas-default.png";
import tapasSelected from "../../images/icons/restaurants/icon-tapas-active.png";
import vegetarian from "../../images/icons/restaurants/icon-vegetarian-default.png";
import vegetarianSelected from "../../images/icons/restaurants/icon-vegetarian-active.png";
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

export const IMAGE_SIZE = 64;

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