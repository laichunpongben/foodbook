/**
 * food map — Leaflet renderer for /world.
 *
 *   ┌──── world view ────────────────────────────┐
 *   │  · olive dots = farms / producers / etc.   │
 *   │  · paprika filled = restaurants (visited)  │
 *   │  · paprika hollow = restaurants (discov.)  │
 *   │  · CARTO Dark Matter basemap               │
 *   │  · top-right layer toggle                  │
 *   └────────────────────────────────────────────┘
 *
 * Lazy-loaded — Leaflet's payload only ships with /world via the
 * page's <script> block. Popups are built as DOM nodes (not HTML
 * strings) so no escaping is needed and `<a href>` link routing
 * stays native.
 */
import L, { type CircleMarker, type LatLngBoundsExpression, type Map as LeafletMap } from "leaflet";

const FARM_KINDS = [
  "farm",
  "producer",
  "market",
  "fishery",
  "forager",
  "mill",
  "dairy",
  "orchard",
] as const;
export type FarmKind = (typeof FARM_KINDS)[number];
export type PinKind = FarmKind | "restaurant";

export interface MapPin {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  kind: PinKind;
  /** Restaurants only — visited (filled) vs discovered (hollow). */
  status?: "visited" | "discovered";
  /** For restaurants — used in popup subtitle. */
  city?: string;
  /** For farms — plain-text location ("Sarno Valley, Campania"). */
  location?: string;
  heroUrl?: string;
  href: string;
}

const COLOUR_FARM = "#5d6e44"; // olive (matches --olive)
const COLOUR_RESTAURANT = "#d2543b"; // paprika (matches --paprika)

function isFarm(kind: PinKind): kind is FarmKind {
  return kind !== "restaurant";
}

function kindLabel(pin: MapPin): string {
  if (pin.kind === "restaurant") {
    return pin.status === "discovered" ? "Restaurant · discovered" : "Restaurant · visited";
  }
  return pin.kind.charAt(0).toUpperCase() + pin.kind.slice(1);
}

function makeMarker(pin: MapPin): CircleMarker {
  const isRestaurant = pin.kind === "restaurant";
  const isDiscovered = isRestaurant && pin.status === "discovered";
  const colour = isRestaurant ? COLOUR_RESTAURANT : COLOUR_FARM;
  return L.circleMarker([pin.lat, pin.lng], {
    radius: 7,
    color: colour,
    fillColor: colour,
    // hollow ring for discovered restaurants; filled disc otherwise
    fillOpacity: isDiscovered ? 0 : 0.85,
    weight: 2,
    opacity: 1,
  });
}

/** Build the popup as a DOM tree. Avoids HTML string concatenation so
 *  user-authored names/cities can't smuggle markup, and lets the link
 *  behave like a native <a>. */
function buildPopup(pin: MapPin): HTMLElement {
  const root = document.createElement("div");

  if (pin.heroUrl) {
    const img = document.createElement("img");
    img.src = pin.heroUrl;
    img.alt = "";
    img.loading = "lazy";
    img.className = "food-map-popup__photo";
    root.appendChild(img);
  }

  const body = document.createElement("div");
  body.className = "food-map-popup__body";

  const kind = document.createElement("p");
  kind.className = "food-map-popup__kind";
  kind.textContent = kindLabel(pin);
  body.appendChild(kind);

  const name = document.createElement("p");
  name.className = "food-map-popup__name";
  const link = document.createElement("a");
  link.href = pin.href;
  link.textContent = pin.name;
  name.appendChild(link);
  body.appendChild(name);

  const sub = pin.city ?? pin.location;
  if (sub) {
    const subEl = document.createElement("p");
    subEl.className = "food-map-popup__sub";
    subEl.textContent = sub;
    body.appendChild(subEl);
  }

  root.appendChild(body);
  return root;
}

export function mountFoodMap(el: HTMLElement, pins: readonly MapPin[]): LeafletMap {
  const map = L.map(el, {
    worldCopyJump: true,
    zoomControl: true,
    minZoom: 2,
  }).setView([20, 0], 2);

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  const farmLayer = L.layerGroup();
  const restaurantLayer = L.layerGroup();

  for (const pin of pins) {
    const marker = makeMarker(pin).bindPopup(buildPopup(pin), {
      className: "food-map-popup",
      minWidth: 220,
      maxWidth: 240,
      closeButton: false,
      autoPanPadding: [32, 32],
    });
    (isFarm(pin.kind) ? farmLayer : restaurantLayer).addLayer(marker);
  }

  farmLayer.addTo(map);
  restaurantLayer.addTo(map);

  L.control
    .layers(
      undefined,
      {
        "Farms &middot; producers": farmLayer,
        Restaurants: restaurantLayer,
      },
      { collapsed: false, position: "topright" },
    )
    .addTo(map);

  if (pins.length > 0) {
    const bounds: LatLngBoundsExpression = pins.map((p) => [p.lat, p.lng] as [number, number]);
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 7 });
  }

  return map;
}
