# 🚀 Full-Stack Production Deployment Guide

This guide walks you through deploying **CourseApp / LearnFlow** to production using:
- **Backend & Database**: [Render](https://render.com) (FastAPI + Managed PostgreSQL)
- **Frontend**: [Vercel](https://vercel.com) (React + Vite Single-Page Application)

---

## 🏗️ Architecture Overview

```
               ┌───────────────────────────────┐
               │         Vercel (SPA)          │
               │  https://your-app.vercel.app  │
               └───────────────┬───────────────┘
                               │
               (HTTPS REST / JSON / JWT / CORS)
                               │
                               ▼
               ┌───────────────────────────────┐
               │     Render Web Service        │
               │ https://your-api.onrender.com │
               └───────────────┬───────────────┘
                               │
                     (Asyncpg / SQLAlchemy)
                               │
                               ▼
               ┌───────────────────────────────┐
               │   Render Managed PostgreSQL   │
               │    (Internal Connection)      │
               └───────────────────────────────┘
```

---

## Part 1: Deploy Backend & Database on Render

### Option A: 1-Click Render Blueprint (Recommended)

1. Push your latest code to your GitHub repository (`main` branch).
2. Log into the **[Render Dashboard](https://dashboard.render.com)**.
3. Click **"New +"** in the top navigation and select **"Blueprint"**.
4. Connect your GitHub repository (`course-app`).
5. Render will automatically detect `render.yaml` and configure:
   - **PostgreSQL Database** (`course-app-db`)
   - **FastAPI Web Service** (`course-app-backend`)
   - Auto-generated `SECRET_KEY`
   - Auto-connected `DATABASE_URL`
   - Build & Migration command: `pip install -r requirements.txt && python scripts/setup_db.py`
6. Click **"Apply"** to launch deployment.
7. Once deployed, copy your Render Web Service URL:
   `https://course-app-backend-xxxx.onrender.com`

---

### Option B: Manual Render Setup (If not using Blueprint)

1. **Create PostgreSQL Database**:
   - In Render Dashboard, click **New +** → **PostgreSQL**.
   - Name: `course-app-db`
   - Database: `courseapp`
   - User: `courseapp`
   - Click **Create Database** and copy the **Internal Database URL** (or External if connecting externally).

2. **Create Web Service**:
   - Click **New +** → **Web Service**.
   - Connect your GitHub repository.
   - **Root Directory**: `backend`
   - **Environment**: `Python 3`
   - **Build Command**: `pip install -r requirements.txt && python scripts/setup_db.py`
   - **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
   - **Health Check Path**: `/api/v1/health`

3. **Add Environment Variables**:
   Under the **Environment** tab of your web service, add:
   | Key | Value | Notes |
   |---|---|---|
   | `DATABASE_URL` | `postgresql://...` | Linked from your Render DB |
   | `SECRET_KEY` | *(Click "Generate" or paste random 64-char string)* | JWT signing key |
   | `ENVIRONMENT` | `production` | Production mode |
   | `DEBUG` | `false` | Disables debug logs |
   | `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | 1 hour access tokens |
   | `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | 7-day refresh tokens |
   | `FRONTEND_URL` | `https://<your-vercel-app>.vercel.app` | Updated after Vercel deploy |
   | `BACKEND_CORS_ORIGINS` | `["https://<your-vercel-app>.vercel.app"]` | Updated after Vercel deploy |

---

## Part 2: Deploy Frontend on Vercel

1. Log into the **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Click **"Add New..."** → **"Project"**.
3. Import your GitHub repository (`course-app`).
4. Configure the project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click "Edit" and choose `frontend`
   - **Build Command**: `npm run build` *(default)*
   - **Output Directory**: `dist` *(default)*
   - **Install Command**: `npm install` *(default)*
5. **Add Environment Variable**:
   Under **Environment Variables**, add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://<your-render-backend-url>.onrender.com/api/v1`
   *(Replace with your actual Render backend URL followed by `/api/v1`)*
6. Click **"Deploy"**.
7. Once deployed, copy your Vercel URL (e.g. `https://course-app-xxxx.vercel.app`).

---

## Part 3: Link CORS on Render

Now that you have your live Vercel domain:

1. Open your **Render Dashboard** → click your **Backend Web Service** → go to **Environment**.
2. Update the following environment variables:
   - **`FRONTEND_URL`**: `https://your-app.vercel.app`
   - **`BACKEND_CORS_ORIGINS`**: `["https://your-app.vercel.app"]`
   *(You can also use comma-separated format: `https://your-app.vercel.app,http://localhost:5173`)*
3. Click **"Save Changes"** (Render will automatically redeploy the backend with the new CORS configuration).

---

## Part 4: Default Seed Accounts

The automated bootstrap script (`scripts/setup_db.py`) seeds three default accounts with distinct role permissions on first launch:

| Role | Email | Default Password | Access Level |
|---|---|---|---|
| 👑 **Admin** | `admin@example.com` | `Admin123!` | User management, site-wide analytics, system config |
| 🧑‍🏫 **Instructor** | `instructor@example.com` | `Teach123!` | Course builder, module/lesson editor, assignment manager |
| 🎓 **Learner** | `learner@example.com` | `Learn123!` | Course catalog, video & text lesson player, quizzes |

> [!TIP]
> After logging in for the first time, you can change passwords or invite new users directly from the **Users** settings page.

---

## Part 5: Optional Integrations

### 1. Google Workspace Single Sign-On (SSO)
1. Go to the **[Google Cloud Console](https://console.cloud.google.com/)** → **APIs & Services** → **Credentials**.
2. Create an **OAuth 2.0 Client ID** (Web application).
3. **Authorized JavaScript origins**:
   - `https://your-app.vercel.app`
4. **Authorized redirect URIs**:
   - `https://your-backend.onrender.com/api/v1/sso/google/callback`
5. Copy the Client ID & Secret and add them to Render Environment Variables:
   - `GOOGLE_CLIENT_ID`: `your-google-client-id.apps.googleusercontent.com`
   - `GOOGLE_CLIENT_SECRET`: `your-google-client-secret`
   - `SSO_ALLOWED_DOMAINS`: `["yourcompany.com"]` *(or leave empty for all Google accounts)*

### 2. PDF Certificate Generation (PDFMonkey)
1. Register on **[PDFMonkey.io](https://www.pdfmonkey.io/)** and create a certificate template.
2. In Render Environment Variables, set:
   - `PDFMONKEY_API_KEY`: `your-pdfmonkey-api-key`
   - `PDFMONKEY_TEMPLATE_ID`: `your-template-id`

---

## 🛠️ Verification & Troubleshooting Checklist

- [ ] **Backend Health Check**: Open `https://your-backend.onrender.com/api/v1/health` (should return `{"status":"ok"}`).
- [ ] **Database Connection Check**: Open `https://your-backend.onrender.com/api/v1/health/db` (should return `{"status":"ok","database":"reachable"}`).
- [ ] **Frontend Client-Side Routing**: Refresh any deep page (like `/courses` or `/settings`) on Vercel; `vercel.json` rewrites prevent 404 errors.
- [ ] **CORS Verification**: Open browser DevTools Network tab on your Vercel site; API requests should succeed with status `200` without CORS errors.
