export function normalizeString(str: string): string {
    return str
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();
}

export function capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
}

export function normalizeMapsUrl(url: string): string {
    try {
        const parsed = new URL(url);
        return `${parsed.hostname.toLowerCase()}${parsed.pathname.replace(/\/$/, "")}`;
    } catch {
        return url.trim().toLowerCase();
    }
}