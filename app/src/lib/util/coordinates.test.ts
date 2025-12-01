import {describe, expect, test} from '@jest/globals';
import {getCoordinatesFromMapsUrl} from './coordinates';

describe('NotionAPIRestaurantsRepository', () => {
  test('coordinates scrapping works', () => {
    const mapsUrl = 'https://maps.app.goo.gl/GcMfNb5CeNQ4nRsu8'; // Clube 1886
    const latitude = 38.9549507;
    const longitude = -8.9910923;
    const index = 0;

    return getCoordinatesFromMapsUrl(index, mapsUrl).then((coordinates) => {
      expect(coordinates.index).toBe(index);
      expect(coordinates.latitude).toBeCloseTo(latitude, 4); // Example latitude
      expect(coordinates.longitude).toBeCloseTo(longitude, 4); // Example longitude
    });
  });
});