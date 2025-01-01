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
import { NOTION_GREEN, NOTION_YELLOW, NOTION_RED, NOTION_GREY } from "@/lib/constants/colors";

interface RestaurantType {
    id: string;
    image: any;
    color: string;
    selectedImage: any;
    selectedColor: string;
}

interface RestaurantTypeMap {
    [key: string]: RestaurantType;
}

interface Rating {
    id: string;
    color: string;
}

interface RatingMap {
    [key: string]: Rating;
}

interface Price {
    id: string;
    color: string;
}

interface PriceMap {
    [key: string]: Price;
}

export const IMAGE_SIZE = 64;

export const RestaurantTypeMap: RestaurantTypeMap = {
    restaurant: {
        id: "restaurant",
        image: restaurant,
        color: "#c94079",
        selectedImage: restaurantSelected,
        selectedColor: "#892b53",
    },
    asian: {
        id: "asian",
        image: asian,
        color: "#8d5bc1",
        selectedImage: asianSelected,
        selectedColor: "#5f3e84",
    },
    brunch: {
        id: "brunch",
        image: brunch,
        color: "#d87620",
        selectedImage: brunchSelected,
        selectedColor: "#934f16",
    },
    buffet: {
        id: "buffet",
        image: buffet,
        color: "#428bca",
        selectedImage: buffetSelected,
        selectedColor: "#0872cd",
    },
    fish: {
        id: "fish",
        image: fish,
        color: "#2d7cd1",
        selectedImage: fishSelected,
        selectedColor: "#1f558f",
    },
    francesinha: {
        id: "francesinha",
        image: francesinha,
        color: "#ca8e1b",
        selectedImage: francesinhaSelected,
        selectedColor: "#8a6013",
    },
    hamburgers: {
        id: "hamburgers",
        image: hamburgers,
        color: "#8d5bc1",
        selectedImage: hamburgersSelected,
        selectedColor: "#5f3e84",
    },
    indian: {
        id: "indian",
        image: indian,
        color: "#eb5757",
        selectedImage: indianSelected,
        selectedColor: "#ed2a29",
    },
    italian: {
        id: "italian",
        image: italian,
        color: "#cd4944",
        selectedImage: italianSelected,
        selectedColor: "#8c312f",
    },
    meat: {
        id: "meat",
        image: meat,
        color: "#cd4944",
        selectedImage: meatSelected,
        selectedColor: "#8c312f",
    },
    mexican: {
        id: "mexican",
        image: mexican,
        color: "#d87620",
        selectedImage: mexicanSelected,
        selectedColor: "#934f16",
    },
    ramen: {
        id: "ramen",
        image: ramen,
        color: "#2c9964",
        selectedImage: ramenSelected,
        selectedColor: "#195637",
    },
    portuguese: {
        id: "portuguese",
        image: portuguese,
        color: "#2c9964",
        selectedImage: portugueseSelected,
        selectedColor: "#1e6943",
    },
    seafood: {
        id: "seafood",
        image: seafood,
        color: "#d87620",
        selectedImage: seafoodSelected,
        selectedColor: "#934f16",
    },
    sushi: {
        id: "sushi",
        image: sushi,
        color: "#c94079",
        selectedImage: sushiSelected,
        selectedColor: "#892b53",
    },
    tapas: {
        id: "tapas",
        image: tapas,
        color: "#c94079",
        selectedImage: tapasSelected,
        selectedColor: "#892b53",
    },
    vegetarian: {
        id: "vegetarian",
        image: vegetarian,
        color: "#2c9964",
        selectedImage: vegetarianSelected,
        selectedColor: "#1e6943",
    },
};

export const RatingMap: RatingMap = {
    "Not Visited": {
        id: "Not Visited",
        color: NOTION_GREY,
    },
    "1/10": {
        id: "1/10",
        color: NOTION_RED,
    },
    "2/10": {
        id: "2/10",
        color: NOTION_RED,
    },
    "3/10": {
        id: "3/10",
        color: NOTION_RED,
    },
    "4/10": {
        id: "4/10",
        color: NOTION_YELLOW,
    },
    "5/10": {
        id: "5/10",
        color: NOTION_YELLOW,
    },
    "6/10": {
        id: "6/10",
        color: NOTION_YELLOW,
    },
    "7/10": {
        id: "7/10",
        color: NOTION_GREEN,
    },
    "8/10": {
        id: "8/10",
        color: NOTION_GREEN,
    },
    "9/10": {
        id: "9/10",
        color: NOTION_GREEN,
    },
    "10/10": {
        id: "10/10",
        color: NOTION_GREEN,
    },
};

export const PriceMap: PriceMap = {
    "undefined": {
        id: "Not defined",
        color: NOTION_GREY,
    },
    "5-12 €": {
        id: "5-12 €",
        color: NOTION_GREEN,
    },
    "13-20 €": {
        id: "13-20 €",
        color: NOTION_YELLOW,
    },
    "21-35 €": {
        id: "21-35 €",
        color: NOTION_RED,
    },
    "+35 €": {
        id: "+35 €",
        color: NOTION_RED,
    },
};

export function splitRestaurantsByTag(restaurants: Restaurant[]): {
    [tag: string]: Restaurant[];
} {
    const result: { [tag: string]: Restaurant[] } = {};
    for (const key in RestaurantTypeMap) {
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
