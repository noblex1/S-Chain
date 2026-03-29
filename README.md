# S-Chain — Real-time supply chain tracking

Full-stack demo: **React + Tailwind**, **Express + MongoDB (Mongoose)**, **JWT auth**, **Socket.io** real-time location and notifications, **Leaflet + OpenStreetMap** for maps (no API key required).

## Prerequisites

- **Node.js** 18+
- **MongoDB** running locally, or a MongoDB Atlas URI

## Quick start

### 1. Backend

```bash
cd server
cp .env.example .env
# Edit .env: set MONGODB_URI and JWT_SECRET
npm install
npm run dev
```

API listens on **http://localhost:5000** (REST + WebSocket).

### 2. Frontend

```bash
cd client
cp .env.example .env
npm install
npm run dev
```

App runs on **http://localhost:5173** with `/api` proxied to the backend. Set `VITE_SOCKET_URL=http://localhost:5000` in `client/.env` if the browser cannot reach the API host.

### 3. First admin user

1. Open **http://localhost:5173/bootstrap-admin** and create the first admin (only works while no admin exists).
2. Or register a **customer** / **logistics manager** from **Register**, then promote to admin in MongoDB if needed.

## API summary

| Method | Path | Notes |
|--------|------|--------|
| POST | `/api/auth/register` | Body: `name`, `email`, `password`, `role` (`customer` \| `logistics_manager`) |
| POST | `/api/auth/login` | JWT in response |
| POST | `/api/auth/bootstrap-admin` | One-time first admin |
| GET | `/api/users?role=customer` | Admin / logistics only |
| POST | `/api/shipments` | Bearer token; staff must send `customer` id |
| GET | `/api/shipments` | Filtered for customers |
| GET/PUT/DELETE | `/api/shipments/:id` | Delete: admin only |
| POST | `/api/tracking/update-location` | `{ shipmentId, lat, lng }` — broadcasts over Socket.io |

## WebSocket events

- Client → server: `join:shipment`, `leave:shipment` with shipment id.
- Server → client: `shipment:location`, `shipment:updated`, `notification`.

## Project layout

- `server/` — Express, Mongoose models (`SChainUser`, `SChainShipment`, `SChainTrackingLog`), JWT, Socket.io.
- `client/` — Vite React app, role-based dashboards, live map, simulated GPS, QR code on detail page, CSV export for staff.

## Production notes

- Set `CLIENT_URL` to your real frontend origin for CORS and Socket.io.
- Use a strong `JWT_SECRET` and HTTPS.
- Replace OSM tiles or switch to Mapbox/Google if your policy requires it.
