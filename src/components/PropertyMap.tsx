import { ExternalLink } from "lucide-react";

export function PropertyMap({
  latitude,
  longitude,
  label,
}: {
  latitude: number | null;
  longitude: number | null;
  label?: string;
}) {
  if (latitude == null || longitude == null) {
    return <p className="text-sm text-muted-foreground">Location pin not available yet.</p>;
  }

  const delta = 0.006;
  const bbox = [longitude - delta, latitude - delta, longitude + delta, latitude + delta].join(
    "%2C",
  );
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  const externalUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=17/${latitude}/${longitude}`;

  return (
    <div>
      <div className="overflow-hidden rounded-xl border border-border">
        <iframe
          title={label ?? "Property location"}
          className="h-64 w-full"
          loading="lazy"
          src={src}
        />
      </div>
      <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {latitude.toFixed(5)}, {longitude.toFixed(5)}
        </span>
        <a
          href={externalUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-primary hover:underline"
        >
          Open in full map <ExternalLink className="h-3 w-3" />
        </a>
      </div>
    </div>
  );
}
