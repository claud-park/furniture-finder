import { createHmac } from "node:crypto";
import { cachedSourceFetch, fetchJson } from "../http";
import { parseDimensions } from "../dimensions";
import { CATEGORY_LABELS, type FurnitureItem, type FurnitureQuery, type SourceAdapter } from "../types";

const DOMAIN = "https://api-gateway.coupang.com";
const PATH = "/v2/providers/affiliate_open_api/apis/openapi/v1/products/search";

interface CoupangProduct {
  productId?: number | string;
  productName?: string;
  productPrice?: number;
  productImage?: string;
  productUrl?: string;
}

interface CoupangSearchResponse {
  data?: {
    productData?: CoupangProduct[];
  };
}

function buildKeyword(query: FurnitureQuery): string {
  const label = CATEGORY_LABELS[query.category];
  if (query.maxWidth) {
    return `${label} ${Math.round(query.maxWidth / 10)}`;
  }
  return label;
}

/** UTC 기준 yyMMdd'T'HHmmss'Z' */
function signedDate(): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const yy = pad(now.getUTCFullYear() % 100);
  const MM = pad(now.getUTCMonth() + 1);
  const dd = pad(now.getUTCDate());
  const HH = pad(now.getUTCHours());
  const mm = pad(now.getUTCMinutes());
  const ss = pad(now.getUTCSeconds());
  return `${yy}${MM}${dd}T${HH}${mm}${ss}Z`;
}

function buildAuthHeader(accessKey: string, secretKey: string, queryString: string): string {
  const date = signedDate();
  const message = `${date}GET${PATH}${queryString}`;
  const signature = createHmac("sha256", secretKey).update(message).digest("hex");
  return `CEA algorithm=HmacSHA256, access-key=${accessKey}, signed-date=${date}, signature=${signature}`;
}

export const coupangAdapter: SourceAdapter = {
  id: "coupang",
  name: "쿠팡",

  isConfigured(): boolean {
    return Boolean(process.env.COUPANG_ACCESS_KEY && process.env.COUPANG_SECRET_KEY);
  },

  async search(query: FurnitureQuery): Promise<FurnitureItem[]> {
    const accessKey = process.env.COUPANG_ACCESS_KEY;
    const secretKey = process.env.COUPANG_SECRET_KEY;
    if (!accessKey || !secretKey) return [];

    const keyword = buildKeyword(query);
    const queryString = `keyword=${encodeURIComponent(keyword)}&limit=20`;
    const cacheKey = `coupang:${keyword}`;

    const json = await cachedSourceFetch("coupang", cacheKey, () => {
      const authorization = buildAuthHeader(accessKey, secretKey, queryString);
      const url = `${DOMAIN}${PATH}?${queryString}`;
      return fetchJson<CoupangSearchResponse>(url, {
        headers: { Authorization: authorization },
      });
    });

    const products = json?.data?.productData;
    if (!Array.isArray(products)) return [];

    return products.map((product, index): FurnitureItem => {
      const title = product.productName ?? "";
      const parsed = parseDimensions(title);
      const idPart = product.productId ?? index;

      return {
        id: `coupang-${idPart}`,
        source: "coupang",
        title,
        url: product.productUrl ?? "",
        imageUrl: product.productImage,
        price: product.productPrice,
        dimensions: parsed.dimensions,
        confidence: parsed.confidence,
        rawDimensionText: parsed.raw,
      };
    });
  },
};
