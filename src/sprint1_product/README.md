#
<div align="right">
  
  # SE 4450 – SOFTWARE ENGINEERING DESIGN II
<br/> 
<img src="/env/CourseLogo.png" height="50">
&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
<br/>
<strong> Capstone Project Workbook <br/>  2025/2026</strong> <br/>
<br/>

<br/>
</div>

**Project Title: AI Resume and Job Prep**
>
> The purpose of this project is to help students optimize their resumes and covet letters, as well as help them prepare for their interviews by providing them mock interview.
>
>**Faculty Advisor:**  Dr. Alexandra L'Heureux, alheure2@uwo.ca <br/>
>**Industry Sponsor:**  

<div align="center">
  
<h2 align="center"> <strong> LevelUp</strong> </h2>
<img src="/env/LevelUpLogo.jpeg" height="200">

| Name| Email|
| :------- | :--- |
|Saad Al-Bayaty	|salbaya3@uwo.ca|
|Omar El Terras |oelterra@uwo.ca|
|Manav Preet Singh	|msing344@uwo.ca|
|Bilal Saad	|bsaad2@uwo.ca|
</div>



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
