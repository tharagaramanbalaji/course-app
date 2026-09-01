# 🚀 100% Free Production Deployment Guide

Deploy the entire **CourseApp / LearnFlow** application completely **FREE** with no credit card or paid blueprint required:
- **Backend**: [Render](https://render.com) (Free Python Web Service)
- **Database**: [Render](https://render.com) (Free PostgreSQL Instance) or [Neon](https://neon.tech) / [Supabase](https://supabase.com)
- **Frontend**: [Vercel](https://vercel.com) (Free Hobby Tier)

---

## 🏗️ Architecture

```
               ┌───────────────────────────────┐
               │      Vercel Free Tier (SPA)   │
               │  https://your-app.vercel.app  │
               └───────────────┬───────────────┘
                               │
               (HTTPS REST / JSON / JWT / CORS)
                               │
                               ▼
               ┌───────────────────────────────┐
               │   Render Free Web Service     │
               │ https://your-api.onrender.com │
               └───────────────┬───────────────┘
                               │
                     (Asyncpg / SQLAlchemy)
                               │
                               ▼
               ┌───────────────────────────────┐
               │    Render Free PostgreSQL     │
               │    (Internal Connection)      │
               └───────────────────────────────┘
```

---

## Step 1: Create Free PostgreSQL Database on Render

1. Log into your free **[Render Dashboard](https://dashboard.render.com)**.
2. In the top right, click **New +** → **PostgreSQL**.
3. Set the configuration:
   - **Name**: `course-app-db`
   - **Database**: `courseapp`
   - **User**: `courseapp`
   - **Region**: Choose the closest region (e.g. Frankfurt, Oregon, Singapore, Ohio)
   - **Instance Type**: Select **Free**
4. Click **Create Database**.
5. Once created, copy the **Internal Database URL** (e.g., `postgresql://courseapp:...@dpg-...:5432/courseapp`).
   *(If deploying from outside Render, copy the **External Database URL**)*.

---

## Step 2: Create Free Web Service on Render (Backend)

1. In the Render Dashboard, click **New +** → **Web Service**.
2. Select **"Build and deploy from a Git repository"** and choose your repository (`course-app`).
3. Fill in the deployment settings:
   - **Name**: `course-app-backend`
   - **Region**: Same region as your database
   - **Branch**: `main`
   - **Root Directory**: `backend`
   - **Language**: `Python 3`
   - **Build Command**:
     ```bash
     pip install -r requirements.txt && python scripts/setup_db.py
     ```
   - **Start Command**:
     ```bash
     uvicorn app.main:app --host 0.0.0.0 --port $PORT
     ```
   - **Instance Type**: Select **Free**
4. Click **"Advanced"** at the bottom:
   - **Health Check Path**: `/api/v1/health`
5. Under **Environment Variables**, click **"Add Environment Variable"** and enter:

| Key | Value | Notes |
|---|---|---|
| `PYTHON_VERSION` | `3.12.9` | Ensures pre-compiled binary wheels install smoothly |
| `DATABASE_URL` | `postgresql://...` *(Paste Internal DB URL from Step 1)* | Database connection |
| `SECRET_KEY` | `your-long-random-secret-key-32-chars-or-more!` | Token encryption |
| `ENVIRONMENT` | `production` | Production mode |
| `DEBUG` | `false` | Disable debug logs |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `60` | Token expiry |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh expiry |
| `FRONTEND_URL` | `https://placeholder.vercel.app` | *Update with real Vercel URL in Step 4* |
| `BACKEND_CORS_ORIGINS` | `https://placeholder.vercel.app` | *Update with real Vercel URL in Step 4* |

6. Click **Create Web Service**.
7. Render will build the service, run migrations (`alembic upgrade head`), seed default demo users, and import the 9 master courses automatically!
8. Copy your live backend URL from the top of the page:
   `https://course-app-backend-xxxx.onrender.com`

---

## Step 3: Deploy Frontend on Vercel (100% Free)

1. Log into your free **[Vercel Dashboard](https://vercel.com/dashboard)**.
2. Click **"Add New..."** → **"Project"**.
3. Import your GitHub repository (`course-app`).
4. Configure project settings:
   - **Framework Preset**: `Vite`
   - **Root Directory**: Click "Edit" and select `frontend`
   - **Build & Output Settings**: Leave defaults (`npm run build` and `dist`)
5. Open **Environment Variables** and add:
   - **Key**: `VITE_API_BASE_URL`
   - **Value**: `https://<your-render-backend-url>.onrender.com/api/v1`
   *(e.g., `https://course-app-backend-xxxx.onrender.com/api/v1`)*
6. Click **"Deploy"**.
7. Once finished, copy your live Vercel URL:
   `https://course-app-xxxx.vercel.app`

---

## Step 4: Update CORS on Render

Now that you have your live Vercel domain:

1. Open your **Render Dashboard** → click your **Backend Web Service** (`course-app-backend`) → **Environment**.
2. Update the two variables with your live Vercel URL:
   - **`FRONTEND_URL`**: `https://course-app-xxxx.vercel.app`
   - **`BACKEND_CORS_ORIGINS`**: `https://course-app-xxxx.vercel.app`
3. Click **"Save Changes"** (Render will redeploy with CORS active in under 30 seconds).

---

## Step 5: Test & Login

Open your Vercel URL in the browser and log in with any of the pre-seeded accounts:

| Role | Email | Password | What You Can Do |
|---|---|---|---|
| 👑 **Admin** | `admin@example.com` | `Admin123!` | System settings, user management, site analytics |
| 🧑‍🏫 **Instructor** | `instructor@example.com` | `Teach123!` | Course studio, markdown editor, curriculum builder |
| 🎓 **Learner** | `learner@example.com` | `Learn123!` | Course catalogue, video & text lessons, quiz attempts |

---

## 🛠️ Verification Checklist

- [ ] **Backend Health Check**: Open `https://your-backend.onrender.com/api/v1/health` in browser $\to$ returns `{"status":"ok"}`.
- [ ] **Database Connection Check**: Open `https://your-backend.onrender.com/api/v1/health/db` $\to$ returns `{"status":"ok","database":"reachable"}`.
- [ ] **SPA Routing**: Refresh any deep page (like `/courses` or `/settings`) on Vercel; `vercel.json` rewrites prevent 404 errors.
- [ ] **Login Test**: Sign in with `learner@example.com` / `Learn123!` and launch any course lesson!
