// A real error type for Notion API failures.
//
// The existing read helpers in client.ts swallow failures — they `.catch()` and return
// `Response.error()`, so a 403 or a validation error looks like a successful call to everything
// downstream. That is survivable for a read (the map renders empty) but not for a create: the
// caller has to be able to tell "Notion rejected this field" from "the integration cannot write
// to this database" and say so.

export interface NotionErrorBody {
    object?: string;
    status?: number;
    code?: string;
    message?: string;
    request_id?: string;
}

export class NotionAPIError extends Error {
    status: number;
    code: string;
    requestId?: string;

    constructor(
        status: number,
        code: string,
        message: string,
        requestId?: string
    ) {
        super(message);
        this.name = "NotionAPIError";
        this.status = status;
        this.code = code;
        this.requestId = requestId;
        // Required for `instanceof` to survive the es5 downlevel in tsconfig.
        Object.setPrototypeOf(this, NotionAPIError.prototype);
    }
}

export async function notionErrorFromResponse(
    response: Response
): Promise<NotionAPIError> {
    let body: NotionErrorBody = {};

    try {
        body = await response.json();
    } catch (e) {
        // Notion occasionally returns a non-JSON body (gateway errors, HTML error pages).
    }

    return new NotionAPIError(
        response.status,
        body.code || "unknown_error",
        body.message || "Notion request failed with status " + response.status,
        body.request_id
    );
}
