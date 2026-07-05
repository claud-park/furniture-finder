import { cachedSourceFetch, fetchJson } from "../http";
import { parseDimensions } from "../dimensions";
import { CATEGORY_LABELS, type FurnitureItem, type FurnitureQuery, type SourceAdapter } from "../types";

const SEARCH_URL = "https://sik.search.blue.cdtapps.com/kr/ko/search-result-page";

interface IkeaSalesPrice {
  numeral?: number;
}

interface IkeaProduct {
  id?: string;
  itemNoGlobal?: string;
  name?: string;
  typeName?: string;
  itemMeasureReferenceText?: string;
  pipUrl?: string;
  mainImageUrl?: string;
  images?: Array<{ url?: string }>;
  salesPrice?: IkeaSalesPrice;
}

interface IkeaSearchItem {
  product?: IkeaProduct;
}

interface IkeaSearchResponse {
  searchResultPage?: {
    products?: {
      main?: {
        items?: IkeaSearchItem[];
      };
    };
  };
}

function buildSearchUrl(query: FurnitureQuery): string {
  const keyword = CATEGORY_LABELS[query.category];
  const params = new URLSearchParams({
    types: "PRODUCT",
    q: keyword,
    size: "24",
  });
  return `${SEARCH_URL}?${params.toString()}`;
}

function extractImageUrl(product: IkeaProduct): string | undefined {
  if (product.mainImageUrl) return product.mainImageUrl;
  if (Array.isArray(product.images)) {
    return product.images.find((img) => img?.url)?.url;
  }
  return undefined;
}

export const ikeaAdapter: SourceAdapter = {
  id: "ikea",
  name: "IKEA Korea",

  isConfigured(): boolean {
    return true;
  },

  async search(query: FurnitureQuery): Promise<FurnitureItem[]> {
    const url = buildSearchUrl(query);
    const cacheKey = `ikea:${query.category}`;
    const json = await cachedSourceFetch("ikea", cacheKey, () =>
      fetchJson<IkeaSearchResponse>(url),
    );

    const items = json?.searchResultPage?.products?.main?.items;
    if (!Array.isArray(items)) return [];

    return items.map((entry, index): FurnitureItem => {
      const product = entry?.product ?? {};
      const name = product.name ?? "";
      const typeName = product.typeName ?? "";
      const title = `${name} ${typeName}`.trim();
      const measureText = product.itemMeasureReferenceText ?? "";
      const combinedText = `${measureText} ${name}`.trim();
      const parsed = parseDimensions(combinedText);
      const idPart = product.id ?? product.itemNoGlobal ?? String(index);

      return {
        id: `ikea-${idPart}`,
        source: "ikea",
        title,
        url: product.pipUrl ?? "",
        imageUrl: extractImageUrl(product),
        price:
          typeof product.salesPrice?.numeral === "number"
            ? product.salesPrice.numeral
            : undefined,
        dimensions: parsed.dimensions,
        confidence: parsed.confidence,
        rawDimensionText: parsed.raw ?? measureText ?? undefined,
      };
    });
  },
};
