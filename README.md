# notion-places

Notion Places is a Progressive Web App that allows you to see places that you stored on Notion databases. These places can be visualized on a map or a list, and filtered by different attributes. 

This app is not supposed to replace Google Maps, it simply does a better job at showing and filtering your places.

## Usage

TODO

## Requirements

- As the app uses Notion as the source of information, it requires an [integration Notion API Key](https://developers.notion.com/docs/create-a-notion-integration) to access it.
- A list of database ids (see [finding the database id](https://developers.notion.com/reference/retrieve-a-database) need to be configured on the settings. In the app, each database is identified as a category of places to be displayed (e.g. restaurants, bars, etc). All databases need to have a [configured connection](https://developers.notion.com/docs/working-with-databases#adding-pages-to-a-database) so that the API has permissions to access them.
- The databases need to contain a column named "Map" with the google maps link to be displayed on the map.
- This app is to be used by a closed group. To avoid unauthorized accesses, the app should have a Google SSO to check if the email is authorized to access the app

## Roadmap
- [ ] Allow the user to edit a place attributes
- [ ] Allow the user to store a place in it's Notion database just by pasting the google maps link or clicking on the share button on google maps

## Design Decisions
- The app was created as a Progressive Web App to accelerate development. If there are important native features that need to be used for the app, the development will transition to either Flutter or React Native.
- The app uses OpenStreetMaps to render a map and avoid unnecessary API costs

## License

Distributed under the GNU General Public License. See LICENSE for more information.