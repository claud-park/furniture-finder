import { cachedSourceFetch, fetchJson } from "../http";
import { parseDimensions } from "../dimensions";
import {
  CATEGORY_LABELS,
  type FurnitureItem,
  type FurnitureQuery,
  type SourceAdapter,
  type SourceId,
} from "../types";

const PSE_ENDPOINT = "https://www.googleapis.com/customsearch/v1";

interface PseOffer {
  price?: string | number;
}

interface PseProduct {
  offers?: string | number;
}

interface PseCseImage {
  src?: string;
}

interface PsePagemap {
  cse_image?: PseCseImage[];
  cse_thumbnail?: PseCseImage[];
  offer?: PseOffer[];
  product?: PseProduct[];
}

interface PseItem {
  title?: string;
  link?: string;
  snippet?: string;
  pagemap?: PsePagemap;
}

interface PseSearchResponse {
  items?: PseItem[];
}

function extractImageUrl(pagemap: PsePagemap | undefined): string | undefined {
  return pagemap?.cse_image?.[0]?.src ?? pagemap?.cse_thumbnail?.[0]?.src;
}

function toPrice(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const num = Number(value.replace(/[^0-9.]/g, ""));
    return Number.isFinite(num) && num > 0 ? num : undefined;
  }
  return undefined;
}

function extractPrice(pagemap: PsePagemap | undefined): number | undefined {
  const offerPrice = toPrice(pagemap?.offer?.[0]?.price);
  if (offerPrice !== undefined) return offerPrice;
  return toPrice(pagemap?.product?.[0]?.offers);
}

function buildQuery(query: FurnitureQuery, site: string): string {
  const parts = [`site:${site}`, CATEGORY_LABELS[query.category]];
  if (query.maxWidth) parts.push(String(query.maxWidth));
  return parts.join(" ");
}

export function createPseAdapter(opts: {
  id: SourceId;
  name: string;
  site: string;
}): SourceAdapter {
  return {
    id: opts.id,
    name: opts.name,

    isConfigured(): boolean {
      return Boolean(process.env.GOOGLE_PSE_API_KEY && process.env.GOOGLE_PSE_CX);
    },

    async search(query: FurnitureQuery): Promise<FurnitureItem[]> {
      const apiKey = process.env.GOOGLE_PSE_API_KEY;
      const cx = process.env.GOOGLE_PSE_CX;
      if (!apiKey || !cx) return [];

      const q = buildQuery(query, opts.site);
      const url = `${PSE_ENDPOINT}?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(q)}&num=10`;
      const cacheKey = `${opts.id}:${q}`;
      const json = await cachedSourceFetch(opts.id, cacheKey, () =>
        fetchJson<PseSearchResponse>(url),
      );

      const items = json?.items;
      if (!Array.isArray(items)) return [];

      return items.map((entry, index): FurnitureItem => {
        const title = entry?.title ?? "";
        const snippet = entry?.snippet ?? "";
        const parsed = parseDimensions(`${title} ${snippet}`);

        return {
          id: `${opts.id}-${index}`,
          source: opts.id,
          title,
          url: entry?.link ?? "",
          imageUrl: extractImageUrl(entry?.pagemap),
          price: extractPrice(entry?.pagemap),
          dimensions: parsed.dimensions,
          confidence: parsed.confidence,
          rawDimensionText: parsed.raw ?? undefined,
        };
      });
    },
  };
}
