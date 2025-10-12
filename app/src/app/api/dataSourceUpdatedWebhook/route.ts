import { NextRequest } from "next/server";

export async function POST(req: NextRequest) {
    const body= await req.json();
    console.info(body);
    
    return Response.json({ status: "ok" });
}