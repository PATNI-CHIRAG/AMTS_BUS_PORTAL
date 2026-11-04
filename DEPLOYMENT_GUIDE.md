# 🚀 AMTS Live Bus Portal — Production Deployment Guide

This guide provides step-by-step instructions for deploying the **AMTS Live Bus Portal & Municipal Fleet Telemetry System** to live production hosting so anyone worldwide can access it.

---

## 🌟 Architecture & Current Status

| Layer | Host | Status | Details |
| :--- | :--- | :--- | :--- |
| **Database** | [Neon.tech](https://neon.tech) | 🟢 **100% Ready & Seeded** | PostGIS 3.6.4, 22 tables, 14 routes, 536 stops, 31 vehicles, `admin` user created |
| **Backend API** | [Render](https://render.com) | 🟡 **Ready to Deploy** | Django 5.1 + Gunicorn WSGI + WhiteNoise static files |
| **Frontend UI** | [Vercel](https://vercel.com) | 🟡 **Ready to Deploy** | React 18 + Vite + Tailwind CSS + Leaflet maps |

---

## 📋 What Has Already Been Done For You

- [x] **Neon Database Configured & Seeded**:
  - PostgreSQL 18.6 with PostGIS 3.6.4 extension active.
  - All migrations applied, including `0004_bookedticket_username`.
  - Transit network imported: 14 lines, 536 stops, 31 fleet vehicles, 31 real-time operating trips.
  - Admin superuser created (`admin` / `admin@123`).
- [x] **Neon PgBouncer Fix**: Removed `-c search_path=transit,public` startup parameters in `core/settings.py` so Neon's pooled connection strings connect cleanly without errors.
- [x] **Git Repository Synced**: All latest backend code, migrations, and static assets pushed to GitHub: `https://github.com/PATNI-CHIRAG/AMTS_BUS_PORTAL.git`.
- [x] **Static Files Ready**: WhiteNoise configured; `collectstatic` verified.
- [x] **Frontend Production Build**: Clean build with Vite in <1s with 0 errors.

---

## 🛠️ Step-by-Step Live Deployment Instructions

### STEP 1: Deploy Django Backend on Render.com

1. Sign in to **[Render.com](https://render.com)**.
2. In the top navigation, click **New +** $\rightarrow$ **Web Service**.
3. Select **Build and deploy from a Git repository** and connect your repo: `PATNI-CHIRAG/AMTS_BUS_PORTAL`.
4. Configure the service:
   - **Name**: `amts-api` (or any name you choose)
   - **Region**: `Singapore (ap-southeast-1)` *(recommended since your Neon DB is in ap-southeast-1 for ultra-low latency)*
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Runtime**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - **Start Command**:
     ```bash
     gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
     ```
   - **Instance Type**: `Free`

5. Under **Environment Variables**, add the following 5 variables:

   | Key | Value | Notes |
   | :--- | :--- | :--- |
   | `DATABASE_URL` | `postgresql://neondb_owner:npg_mPtXS6xEprj9@ep-snowy-fog-aobh3zz1-pooler.c-2.ap-southeast-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require` | Your Neon database |
   | `DEBUG` | `False` | Production mode |
   | `SECRET_KEY` | `amts-production-super-secret-key-chirag-2026-safe` | Any secure random string |
   | `ALLOWED_HOSTS` | `*` | Allows Render subdomains |
   | `CORS_ALLOW_ALL_ORIGINS` | `True` | Allows Vercel frontend requests |

6. Click **Deploy Web Service** (or **Manual Deploy** $\rightarrow$ **Deploy latest commit** if updating an existing service).
7. Wait 2–3 minutes for the build to finish. Once live, Render will give you your public API URL:
   `https://amts-api.onrender.com` (or similar).
8. Test it in your browser: `https://amts-api.onrender.com/api/routes/` should return JSON data of the 14 AMTS routes!

---

### STEP 2: Deploy React Frontend on Vercel

1. Sign in to **[Vercel.com](https://vercel.com)**.
2. Click **Add New...** $\rightarrow$ **Project**.
3. Import your GitHub repository: `PATNI-CHIRAG/AMTS_BUS_PORTAL`.
4. Configure the project:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click **Edit** and select `frontend`
   - **Build Command**: `npm run build` (default)
   - **Output Directory**: `dist` (default)
5. Under **Environment Variables**, add:
   - **Name**: `VITE_API_BASE_URL`
   - **Value**: `https://<YOUR-RENDER-BACKEND-URL>` (e.g. `https://amts-api.onrender.com`, **without** trailing slash)
6. Click **Deploy**.
7. Vercel will build the frontend in ~30 seconds and give you a global production URL:
   `https://amts-bus-portal.vercel.app` (or similar).

---

### STEP 3: Verify Your Live System

Now anyone can open your portal on desktop, tablet, or mobile!

1. **Commuter Portal**: Open `https://<YOUR-VERCEL-URL>`:
   - Test route search, stop viewer, fare calculation, and interactive Leaflet map.
   - Register a commuter account, book an e-ticket, and view the QR ticket in your passbook.
2. **Admin Command Center**: Open `https://<YOUR-VERCEL-URL>/#admin-dashboard` (or click Admin Login in header):
   - Login Credentials:
     - **Username**: `admin`
     - **Password**: `admin@123`
   - Verify:
     - Live Fleet Telemetry & GPS Dispatch Matrix.
     - Real-time bus speed, heading, and battery/fuel telemetry.
     - Add/Manage Routes, Buses, and Bus Stands.
     - Post live service advisories.

