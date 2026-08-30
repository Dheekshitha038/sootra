import { API_BASE as AKINATOR_BASE } from "./akinator";

// The Cultural Map & Timeline backend lives under /api/v1 directly,
// one level up from /api/v1/akinator.
const BASE = AKINATOR_BASE.replace("/akinator", "");

export async function fetchEntity(entityId) {
  const res = await fetch(`${BASE}/entities/${entityId}`);
  if (!res.ok) throw new Error(`fetchEntity failed: ${res.status}`);
  return res.json();
}

export async function fetchPins() {
  const res = await fetch(`${BASE}/map/pins`);
  if (!res.ok) throw new Error(`fetchPins failed: ${res.status}`);
  return res.json();
}

export async function fetchNearby(lat, lng, radiusKm = 300) {
  const params = new URLSearchParams({ lat, lng, radius_km: radiusKm });
  const res = await fetch(`${BASE}/map/nearby?${params}`);
  if (!res.ok) throw new Error(`fetchNearby failed: ${res.status}`);
  return res.json();
}