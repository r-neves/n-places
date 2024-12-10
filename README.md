# n-places

> _"I haven't been everywhere, but it's on my list."_
>
> Susan Sontag

N Places is a Progressive Web App that allows you to see places that you stored on Notion databases. These places can be visualized on a map and filtered by different attributes. 

This app is not a Google Maps "killer", it simply does a better job at showing and filtering the places you want to keep, using Notion as a low usage database.

## Running the app locally

```npm run dev```

## Requirements

- As the app uses Notion as the source of information, it requires an [integration Notion API Key](https://developers.notion.com/docs/create-a-notion-integration) to access it.
- A list of database ids (see [finding the database id](https://developers.notion.com/reference/retrieve-a-database) need to be configured on the settings. In the app, each database is identified as a category of places to be displayed (e.g. restaurants, bars, etc). All databases need to have a [configured connection](https://developers.notion.com/docs/working-with-databases#adding-pages-to-a-database) so that the API has permissions to access them.
- The databases need to contain the list of columns necessary for the app to function.
- This app is to be managed by a closed group. To do that safely, the app implements Google SSO to check if the email is authorized to manage app internals such as editing ratings.

## Roadmap
- [ ] Allow the user to edit a place attributes
- [ ] Allow the user to store a place in it's Notion database just by pasting the google maps link or clicking on the share button on google maps

## Design Decisions
- The app was created as a Progressive Web App to accelerate development. If there are important native features that need to be used for the app, the development will transition to either Flutter or React Native.
- The app uses OpenStreetMaps to render a map and avoid unnecessary API costs
- The project uses Notion as a toy database, it's not a reliable tool for efficient querying. Therefore, to minimize the user wait time, a Redis cache (behind Vercel KV) is used to deliver faster results.

## License
Distributed under the GNU General Public License. See LICENSE for more information.