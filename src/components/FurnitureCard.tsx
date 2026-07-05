import type { Dimensions, FurnitureItem, MatchStatus } from "@/lib/types";

type CardItem = FurnitureItem & { matchStatus: MatchStatus };

interface FurnitureCardProps {
  item: CardItem;
  sourceName: string;
}

function formatDimensions(dimensions?: Dimensions): string | null {
  if (!dimensions) return null;
  const parts: string[] = [];
  if (dimensions.width) parts.push(`W${dimensions.width}`);
  if (dimensions.depth) parts.push(`D${dimensions.depth}`);
  if (dimensions.height) parts.push(`H${dimensions.height}`);
  if (parts.length === 0) return null;
  return `${parts.join(" × ")} mm`;
}

const MATCH_BADGE: Record<MatchStatus, { label: string; className: string }> = {
  fit: {
    label: "✅ 맞음",
    className:
      "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  },
  estimated: {
    label: "⚠️ 추정",
    className:
      "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  },
  unknown: {
    label: "❓ 미확인",
    className:
      "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300",
  },
};

export default function FurnitureCard({ item, sourceName }: FurnitureCardProps) {
  const dimsText = formatDimensions(item.dimensions);
  const badge = MATCH_BADGE[item.matchStatus];

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-black/10 bg-white dark:border-white/10 dark:bg-white/[.03]">
      <div className="relative aspect-square w-full bg-black/[.04] dark:bg-white/[.06]">
        {item.imageUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={item.imageUrl}
            alt={item.title}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-foreground/40">
            이미지 없음
          </div>
        )}
        <span
          className={`absolute left-2 top-2 rounded-full px-2 py-0.5 text-xs font-medium ${badge.className}`}
        >
          {badge.label}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <p className="line-clamp-2 text-sm font-medium leading-snug">
          {item.title}
        </p>
        {dimsText && (
          <p className="text-xs text-foreground/60">{dimsText}</p>
        )}
        {item.price !== undefined && (
          <p className="text-sm font-semibold">
            {item.price.toLocaleString("ko-KR")}원
          </p>
        )}
        <div className="mt-auto flex items-center justify-between pt-2">
          <span className="text-xs text-foreground/50">{sourceName}</span>
          <a
            href={item.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            상품 보기 →
          </a>
        </div>
      </div>
    </div>
  );
}
