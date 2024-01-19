import { dummyData } from "./dummy-data";

const NOTION_API_URL = "https://api.notion.com/v1";

interface PlaceItem {
	name: string;
	longitude: number;
	latitude: number;
}

export async function getDBLastUpdatedDate(databaseID: string): Promise<Date> {
	const res = await fetch(`${NOTION_API_URL}/databases/${databaseID}`, {
		method: "GET",
		headers: {
			Authorization: `Bearer ${process.env.NOTION_API_KEY}`,
			"Notion-Version": `${process.env.NOTION_API_VERSION}`,
		},
	});

	return res
		.json()
		.then((response) => {
			return new Date(response.last_edited_time);
		})
		.catch((error) => {
			console.log(error);
			return error;
		});
}

export async function getDBEntries(databaseID: string): Promise<PlaceItem[]> {
	return dummyData;
}