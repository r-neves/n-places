import axios, { Axios } from "axios";
import { IPlaces } from "./interface";
import { Client } from "@notionhq/client";
import {
	DatabaseObjectResponse,
	GetDatabaseResponse,
} from "@notionhq/client/build/src/api-endpoints";

const NOTION_API_URL = "https://api.notion.com/v1";
const NOTION_API_VERSION = "2022-06-28";

interface NotionDBResponse {
	object: string;
	last_edited_time: string;
}

export class NotionIntegration implements IPlaces {
	private notionClient: Client;

	constructor() {
		this.notionClient = new Client({
			auth: process.env.REACT_APP_NOTION_API_KEY,
		});
	}

	async getDBLastUpdatedDate(databaseID: string): Promise<Date> {
        return this.notionClient.databases.retrieve({
			database_id: databaseID,
		}).then((response) => {
            return new Date(Date.parse((response as DatabaseObjectResponse).last_edited_time));
        }).catch((error) => {
            console.log(error);
            return error;
        });
	}
}
