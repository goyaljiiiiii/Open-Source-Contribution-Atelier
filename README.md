# Open Source Contribution Atelier

![Status](https://img.shields.io/badge/status-active-brightgreen?style=for-the-badge) ![License](https://img.shields.io/github/license/goyaljiiiiii/Open-Source-Contribution-Atelier?style=for-the-badge) ![React](https://img.shields.io/badge/React-20232A?style=for-the-badge&logo=react&logoColor=61DAFB) ![Django](https://img.shields.io/badge/Django-092E20?style=for-the-badge&logo=django&logoColor=white) ![TypeScript](https://img.shields.io/badge/TypeScript-007ACC?style=for-the-badge&logo=typescript&logoColor=white) ![Docker](https://img.shields.io/badge/Docker-2CA5E0?style=for-the-badge&logo=docker&logoColor=white) [![Live Demo](https://img.shields.io/badge/Live%20Demo-Visit-blue?style=for-the-badge)](https://contribution-atelier-frontend.onrender.com/)

Welcome to the **Open Source Contribution Atelier** — a complete Open Source Learning Platform designed to help a beginner confidently transition from *"I know nothing about Open Source"* to *"I can confidently contribute to real open source repositories."*

The platform preserves a playful, neobrutalist developer console aesthetic while delivering a structured, gamified curriculum.

---

## Technical Stack

- **Frontend**: React 19, TypeScript, Vite, Tailwind CSS (Neobrutalist Theme), React Router 7, TanStack React Query
- **Backend**: Django, Django REST Framework, Simple JWT, PostgreSQL, Redis (Caching)
- **Deployment**: Configured for monorepo environments (e.g. Netlify for static frontend, Render/Docker for backend)

---

## Key Features

1. **Structured Learning Curriculum**: 8 core modules going from mindset basics to advanced conflict resolutions.
2. **Markdown-Driven Content**: Lessons and metadata are parsed dynamically. Adding content requires no code changes. See the [Content Guide](CONTENT_GUIDE.md).
3. **Interactive Quizzes**: Theoretical modules feature multi-choice checking dashboards.
4. **Sandbox Terminal**: Practical Git lessons incorporate a mockup sandbox terminal that validates inputs.
5. **Gamification & Badges Cabinet**: Locked and unlocked milestone rewards mapping directly to module progress.
6. **Printable Completion Certificates**: Generates a gorgeous A4 neobrutalist certificate with verification hashes once the curriculum hits 100%.
7. **Hall of Fame & Leaderboard**: Cohort stats, active streaking calendars, and GitHub contributor APIs recognition boards.
8. **Onboarding Guide Tour**: Walkthrough sliders introduce the sandbox console to newcomers.

---

## Learning Curriculum Overview

- **Module 1: Introduction to Open Source**: Mindset, Why it matters, History, and Misconceptions.
- **Module 2: Git Fundamentals**: Repos, Commits, Branching, Merging, and Remotes.
- **Module 3: GitHub Fundamentals**: Forks, Pull Requests, Issues, discussions, and Organizations.
- **Module 4: Open Source Etiquette**: Respectful communication, Reading README & CONTRIBUTING files first, and Review processes.
- **Module 5: First Contribution**: Interactive step-by-step mock PR setup drill.
- **Module 6: Real Contribution Workflow**: Tacing Issue -> Assignment -> Develop -> PR -> Review -> Merge cycles.
- **Module 7: Advanced Open Source**: Rebasing, Squashing, Conflict resolutions, and CI/CD checks.
- **Module 8: Finding Projects**: Discovering issues using filters, Hacktoberfest, and good first issues.

---

## Directory Structure

```text
├── backend/            # Django REST API, views, tests, and caching logic
├── frontend/           # React SPA frontend UI
│   ├── public/         
│   │   ├── content/    # Static Markdown files and curriculum.json metadata catalog
│   │   └── _redirects  # Netlify single page application redirect configuration
│   └── src/            # Components, pages, hooks, state
├── netlify.toml        # Root Netlify configuration mapping monorepo builds
└── CONTENT_GUIDE.md    # Playbook on how to write/add lessons, modules, and quizzes
```

---

## Quick Start

### Docker Setup
To boot both the Django backend and React frontend:
```bash
docker compose up --build
```
- Backend REST API: `http://localhost:8000/api/`
- Frontend SPA: `http://localhost:5173/`

### Manual Development Setup

#### 1. Setup Environment Files
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

#### 2. Initialize Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py seed_lessons
python manage.py runserver
```

#### 3. Run Frontend
```bash
cd frontend
npm install
npm run dev
```

---

## Testing

Run tests locally to ensure no regressions occurred:
- **Backend tests**: `cd backend && pytest`
- **Frontend tests**: `cd frontend && npm run test`

---

## Contributing Content

We encourage educational contributions! To add a lesson, list a quiz, or write a summary module, check our detailed **[Content Guide](CONTENT_GUIDE.md)**.
