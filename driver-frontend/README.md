# CargoX Driver Portal (`driver-frontend`)

Standalone web application for CargoX transport fleet drivers to manage assigned shipments, milestones, Proof of Delivery (POD) uploads, location tracking, and customer collections (UPI & Cash).

---

## 🚀 Features

- **Driver Authentication:** Sign in with driver username/password or Clerk Google/Email SSO.
- **Role Verification:** Automatic JWT validation and backend authorization check for `DRIVER` access privileges.
- **Active & Historical Trips:** View assigned pickup and dropoff routes, cargo details, weights, and transit statuses.
- **Milestone Actions:** Progression buttons for `Start Pickup`, `Start Transit`, `Arrive at Destination`, and `Submit Proof of Delivery`.
- **Google Maps Navigation:** Instant deep-links to Google Maps directions for both pickup and destination locations.
- **Live Location Updates:** GPS coordinate transmission directly to the CargoX tracking engine.
- **Proof of Delivery (POD):** Digital recipient name, phone, receiver notes, and signature capture.
- **Payment Collection (UPI & Cash):** Direct merchant settlements, QR code generation, instant status checks, and on-site cash recording.
- **Push & In-App Notifications:** Real-time milestone updates and delivery alerts via `NotificationDropdown`.

---

## 🛠️ Local Development

### 1. Prerequisites
- Node.js 18+ (Node 20+ recommended)
- CargoX Backend API running (locally on `http://127.0.0.1:8000` or deployed on HTTPS)

### 2. Install Dependencies
```bash
cd driver-frontend
npm install
```

### 3. Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```

Configure your variables:
```env
# Backend Base URL (omit trailing slash)
VITE_API_BASE_URL=http://127.0.0.1:8000

# Clerk Authentication Publishable Key
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

> **Security Note:** Never place secret API keys or private credentials into frontend `.env` files.

### 4. Run Development Server
```bash
npm run dev
```
The driver application will run at `http://localhost:5175`.

---

## 📦 Production Build

To build the static application bundle:
```bash
npm run build
```

This generates optimized production assets in `dist/`.

To preview the production bundle locally:
```bash
npm run preview
```

---

## 🌐 Independent Deployment

`driver-frontend` can be deployed independently of `admin-frontend` and `customer-frontend` to any static hosting provider (e.g., Render, Vercel, Netlify, Cloudflare Pages, AWS S3 + CloudFront).

### Production Environment Variables
Set the following environment variables in your hosting dashboard:
- `VITE_API_BASE_URL`: `https://cargox-1.onrender.com` (Your deployed CargoX backend HTTPS URL)
- `VITE_CLERK_PUBLISHABLE_KEY`: `pk_live_...` or your testing Clerk key.

### Single Page Application (SPA) Route Rewrite Rules
Because the application uses HTML5 client-side routing (`react-router-dom`), configure all unmatched routes to serve `index.html`:

- **Render Static Site:**
  - Build Command: `npm install && npm run build`
  - Publish Directory: `dist`
  - Routes / Rewrites:
    - Source: `/*`
    - Destination: `/index.html`
    - Action: Rewrite

- **Vercel (`vercel.json`):**
  ```json
  {
    "rewrites": [{ "source": "/(.*)", "destination": "/" }]
  }
  ```

- **Netlify (`_redirects`):**
  ```
  /*    /index.html   200
  ```

- **Nginx:**
  ```nginx
  location / {
      try_files $uri $uri/ /index.html;
  }
  ```
