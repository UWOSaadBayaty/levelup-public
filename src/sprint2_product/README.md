# Sprint 2 Product Increment

## Increment Name
**Sprint 2 Deployment-Ready Increment for LevelUp Career Platform**

---

## 1. Sprint 2 Feature Breakdown

### Epic 1 — User Account Management
- Login
- Password reset & email verification
- Session timeout & logout

---

### Epic 2 — Resume Builder
- Upload & parse resume (PDF/DOCX)
- Inline resume editor
- Autosave & versioning
- AI resume suggestions
- Export to PDF/DOCX

---

### Epic 3 — Cover Letter Assistant
- Generate cover letter from job description
- Job posting URL parser
- Tone & style customization

---

### Epic 4 — Mock Interview
- Interview session runner (text Q&A)
- AI interview feedback
- Question bank & difficulty levels
- Recording consent & storage handling

---

### Dropped / De-Scoped Features
**Dashboard module was dropped in Sprint 2** to prioritize completing and polishing the core career-preparation flows (Resume Builder, Cover Letter Assistant, and Mock Interview) within the sprint timeline.

---

## 2. Core User Journey (End-to-End Flow)

1. User logs into the platform (or resets password if needed).
2. User uploads a resume (PDF/DOCX).
3. System parses the resume into editable sections.
4. User edits content using the inline editor.
5. AI suggestions are generated to improve wording and structure.
6. User exports the finalized resume.
7. User generates a cover letter from a job description or URL.
8. User customizes tone and edits the letter.
9. User launches a mock interview session.
10. User answers interview questions.
11. System generates interview feedback.
12. User logs out or session times out securely.

---

# 🚀 LevelUp Project Setup Guide

Welcome to the project! Follow these instructions to get the **Backend (FastAPI)** and **Frontend (React/Node)** running locally on your machine.

> **Note:** The database is hosted remotely. You do not need to install PostgreSQL locally, but you will need the connection credentials.

## 1. Prerequisites

* **Python 3.10+**
* **Node.js & npm** (LTS version recommended)
* **Git**

---

## 2. Backend Setup

### A. Navigate and Create Virtual Environment

Open a terminal in the project root.

```bash
cd src/prototypes/backend

# Create virtual environment
python -m venv venv

# Activate virtual environment

# Windows:
venv\Scripts\activate

# Mac/Linux:
source venv/bin/activate
````

### B. Install Dependencies

```bash
pip install -r requirements.txt
```

### C. Configure Environment Variables (Crucial)

Since the database is deployed, you need to tell the local app where to find it.

1.  Create a file named `.env` inside the `src/prototypes/backend/` folder.
2.  Add the following content:

<!-- end list -->

```ini
# Database Connection (Remote)
DATABASE_URL="postgresql://<user>:<password>@<host>:5432/<dbname>?sslmode=require"
DB_SSLMODE="require"
GROQ_API_KEY=<your_groq_api_key>
GROQ_BASE_URL=https://api.groq.com/openai/v1
GROQ_MODEL=llama-3.1-8b-instant
```

### D. Run the Backend Server

```bash
# Ensure venv is activated and you are in the backend folder
uvicorn app.main:app --reload --port 8000
```

  * **Success:** You should see `Application startup complete`.
  * **Swagger UI:** Go to http://localhost:8000/docs to test the API.

-----

## 3\. Frontend Setup

Open a **new** terminal window (leave the backend running).

### A. Install Dependencies

```bash
cd src/prototypes/frontend
npm install
```

### B. Run the Frontend

```bash
# Start the development server
npm start
```

The app should now be accessible at http://localhost:3000 (or `5173` if using Vite).
