# 🚀 AMTS Live Bus Portal — Production Deployment Guide

This guide provides step-by-step instructions for deploying the **AMTS Live Bus Portal & Municipal Fleet Telemetry System** to live production hosting so anyone worldwide can access it.

---

## 🌟 Recommended Architecture (Fastest & Free Tier Available)

| Layer | Recommended Host | Free Tier? | Purpose |
| :--- | :--- | :--- | :--- |
| **Frontend UI** | [Vercel](https://vercel.com) | ✅ Yes | Global Edge CDN, auto-builds React+Vite, Free SSL, Instant Deploy |
| **Backend API** | [Render](https://render.com) or [Railway](https://railway.app) | ✅ Yes | Runs Django 5.1 with Gunicorn WSGI and WhiteNoise static files |
| **Database** | [Neon](https://neon.tech) or [Supabase](https://supabase.com) | ✅ Yes | Managed Cloud PostgreSQL 16/17 with PostGIS geospatial support |

---

## 📋 Pre-Flight Checklist (Already Automated & Ready)

- [x] **Static Files Ready**: `STATIC_ROOT` configured in Django with WhiteNoise integration. `python manage.py collectstatic --noinput` verified (154 static assets).
- [x] **Production WSGI**: `gunicorn` and `whitenoise` included in [`backend/requirements.txt`](backend/requirements.txt) and [`backend/Procfile`](backend/Procfile).
- [x] **Dynamic Database URL**: Django settings automatically accept cloud `DATABASE_URL` (Neon / Supabase / Render / AWS RDS).
- [x] **SPA Direct Routing**: [`frontend/vercel.json`](frontend/vercel.json) and [`frontend/public/_redirects`](frontend/public/_redirects) configured so routes like `/admin-dashboard` refresh cleanly without 404 errors.
- [x] **Security Exclusions**: [`.gitignore`](.gitignore) created to protect `.env`, secrets, `node_modules`, and virtual environments.
- [x] **Container Ready**: Complete [`Dockerfile`](frontend/Dockerfile) and [`docker-compose.yml`](docker-compose.yml) for 1-command Docker deployment.

---

## 🛠️ Step-by-Step Deployment Instructions

### STEP 1: Push Code to GitHub

1. Open PowerShell / Terminal in `c:\Users\CHIRAG\Desktop\AMTS_Portal`:
   ```powershell
   cd c:\Users\CHIRAG\Desktop\AMTS_Portal
   git init
   git add .
   git commit -m "feat: complete production-ready AMTS live portal and municipal admin system"
   ```

2. Create a new repository on your GitHub account (e.g. `amts-live-portal`).

3. Link and push your repository:
   ```powershell
   git remote add origin https://github.com/<YOUR_GITHUB_USERNAME>/amts-live-portal.git
   git branch -M main
   git push -u origin main
   ```

---

### STEP 2: Provision Cloud PostgreSQL Database (Neon / Supabase)

1. Go to [Neon.tech](https://neon.tech) and create a free project named `amts-portal-db`.
2. In the Neon console, enable PostGIS extension by running in SQL Editor:
   ```sql
   CREATE EXTENSION IF NOT EXISTS postgis;
   ```
3. Copy your database connection string:
   ```
   postgresql://username:password@ep-cool-flower-12345.ap-southeast-1.aws.neon.tech/amts-portal-db?sslmode=require
   ```

---

### STEP 3: Deploy Django Backend on Render.com

1. Go to [Render.com](https://render.com) and click **New +** $\rightarrow$ **Web Service**.
2. Connect your GitHub repository (`amts-live-portal`).
3. Configure the service settings:
   - **Name**: `amts-api`
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && python manage.py collectstatic --noinput && python manage.py migrate
     ```
   - **Start Command**:
     ```bash
     gunicorn core.wsgi:application --bind 0.0.0.0:$PORT
     ```
4. Under **Environment Variables**, add:
   - `DEBUG`: `False`
   - `SECRET_KEY`: *(Generate a secure random string)*
   - `ALLOWED_HOSTS`: `*`
   - `DATABASE_URL`: *(Paste your Neon connection string from Step 2)*
   - `CORS_ALLOW_ALL_ORIGINS`: `True` *(or your Vercel frontend URL once deployed)*
5. Click **Create Web Service**.
6. Once deployed, note your backend live URL (e.g., `https://amts-api.onrender.com`).

---

### STEP 4: Deploy React Frontend on Vercel

1. Go to [Vercel.com](https://vercel.com) and click **Add New...** $\rightarrow$ **Project**.
2. Import your GitHub repository (`amts-live-portal`).
3. Configure the framework and directories:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click edit and select `frontend`
4. Under **Environment Variables**, add:
   - `VITE_API_BASE_URL`: `https://amts-api.onrender.com` *(your live Render backend URL)*
5. Update [`frontend/vercel.json`](frontend/vercel.json) if you prefer reverse proxying API calls without CORS:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/:match*",
         "destination": "https://amts-api.onrender.com/api/:match*"
       },
       {
         "source": "/(.*)",
         "destination": "/index.html"
       }
     ]
   }
   ```
6. Click **Deploy**. Vercel will build and assign you a global live URL (e.g. `https://amts-portal.vercel.app`).

---

### STEP 5: Create Admin User on Live Backend

In Render's dashboard, go to your Web Service $\rightarrow$ **Shell** tab and run:
```bash
python manage.py createsuperuser --username admin --email admin@amts.gov.in
```
When prompted, set password to:
`admin@123`

---

## 🐳 Alternative: 1-Command Docker Deployment (VPS / DigitalOcean / AWS EC2)

If deploying to a single Linux server (Ubuntu/Debian):

1. Install Docker & Docker Compose:
   ```bash
   sudo apt update && sudo apt install -y docker.io docker-compose-v2
   ```

2. Clone repository onto server:
   ```bash
   git clone https://github.com/<YOUR_GITHUB_USERNAME>/amts-live-portal.git
   cd amts-live-portal
   ```

3. Launch full stack (Database + Django + React Nginx):
   ```bash
   docker compose up -d --build
   ```

4. Run migrations and create admin in container:
   ```bash
   docker compose exec backend python manage.py migrate
   docker compose exec backend python manage.py createsuperuser
   ```

Your portal is now live at `http://your-server-ip:3000` (Frontend) and `http://your-server-ip:8000` (Backend)!

---

## 🎯 Final Live Verification Check

Once deployed, test the following URLs on desktop and mobile phones:
1. `https://<YOUR-FRONTEND-URL>/` $\rightarrow$ Public Live Bus Search & Tracker.
2. `https://<YOUR-FRONTEND-URL>/#admin-dashboard` $\rightarrow$ Government Admin Dashboard.
3. Login as Admin: Username `admin` / Password `admin@123`.
4. Register a commuter account $\rightarrow$ Book e-ticket $\rightarrow$ View Passbook.
