import { NextRequest } from "next/server";
import NotionAPIClient from "../../../../lib/client/notion/client";

export interface GetRoleRequest {
    email: string;
}

export async function POST(req: NextRequest) {
    const body: GetRoleRequest = await req.json();
    console.info(`Getting role for ${body.email}`);
    const role = await NotionAPIClient.getUserRole(process.env.AUTH_DATA_SOURCE_ID!, body.email);

    console.info(`Role for ${body.email}: ${role}`);

    return Response.json(role);
}