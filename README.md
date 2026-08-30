<div align="center">

# 🚀 Open Source Contribution Atelier

### *Empowering developers to go from zero to confident open-source contributors.*

[![Live Demo](https://img.shields.io/badge/🌐_Live_Demo-Vercel-000000?style=for-the-badge&logo=vercel&logoColor=white)](https://open-source-contribution-atelier.vercel.app)
[![GitHub Stars](https://img.shields.io/github/stars/nandinigoyaldev/Open-Source-Contribution-Atelier?style=for-the-badge&logo=github&color=FFD700)](https://github.com/nandinigoyaldev/Open-Source-Contribution-Atelier/stargazers)
[![License](https://img.shields.io/github/license/nandinigoyaldev/Open-Source-Contribution-Atelier?style=for-the-badge&color=8A2BE2)](LICENSE)
[![ECSoC 2026](https://img.shields.io/badge/ECSoC_2026-Active_Program-4ECDC4?style=for-the-badge&logo=github)](LEADERBOARD.md)

---

</div>

## 💡 About The Project

Getting started in open-source can feel intimidating—navigating massive codebases, git merge conflicts, complex PR reviews, and unwritten community rules. 

**Open Source Contribution Atelier** is an interactive, gamified learning platform built to bridge that gap. Designed with empathy and built for real-world impact, Atelier gives developers a safe, hands-on environment to practice version control, complete guided lessons, solve real sandbox exercises, track contribution streaks, and submit peer code reviews.

Whether you're making your very first pull request or mentoring the next generation of contributors, Atelier is your launchpad into open source.

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technologies & Tools |
| :--- | :--- |
| **Frontend** | ![React](https://img.shields.io/badge/React_19-61DAFB?style=flat-square&logo=react&logoColor=black) ![TypeScript](https://img.shields.io/badge/TypeScript_5.0-3178C6?style=flat-square&logo=typescript&logoColor=white) ![Vite](https://img.shields.io/badge/Vite_6.0-646CFF?style=flat-square&logo=vite&logoColor=white) ![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS_3.4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white) ![Redux Toolkit](https://img.shields.io/badge/Redux_Toolkit-764ABC?style=flat-square&logo=redux&logoColor=white) |
| **Backend API** | ![Django](https://img.shields.io/badge/Django_5.0-092E20?style=flat-square&logo=django&logoColor=white) ![Django REST Framework](https://img.shields.io/badge/DRF-red?style=flat-square&logo=django&logoColor=white) ![Python](https://img.shields.io/badge/Python_3.11+-3776AB?style=flat-square&logo=python&logoColor=white) ![Simple JWT](https://img.shields.io/badge/JWT_Auth-black?style=flat-square&logo=jsonwebtokens&logoColor=white) |
| **Real-Time & Tasks** | ![Django Channels](https://img.shields.io/badge/Django_Channels-092E20?style=flat-square&logo=django&logoColor=white) ![WebSockets](https://img.shields.io/badge/WebSockets-010101?style=flat-square&logo=socketdotio&logoColor=white) ![Celery](https://img.shields.io/badge/Celery-37814A?style=flat-square&logo=celery&logoColor=white) ![Redis](https://img.shields.io/badge/Redis-DC382D?style=flat-square&logo=redis&logoColor=white) |
| **Database & Caching** | ![PostgreSQL](https://img.shields.io/badge/PostgreSQL-4169E1?style=flat-square&logo=postgresql&logoColor=white) ![SQLite](https://img.shields.io/badge/SQLite_Dev-003B57?style=flat-square&logo=sqlite&logoColor=white) |
| **DevOps & Testing** | ![Docker](https://img.shields.io/badge/Docker-2496ED?style=flat-square&logo=docker&logoColor=white) ![GitHub Actions](https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white) ![Pytest](https://img.shields.io/badge/Pytest-0A9EDC?style=flat-square&logo=pytest&logoColor=white) ![Vitest](https://img.shields.io/badge/Vitest-6E9F18?style=flat-square&logo=vitest&logoColor=white) |

</div>

---

## ✨ Key Features

- 🎯 **Gamified Learning Paths**: Progress through bite-sized modules covering Git basics, branching strategies, PR etiquette, and issue tracking.
- 💻 **Interactive In-Browser Terminal Sandbox**: Practice real Git commands in a sandboxed, zero-risk environment with instant output verification.
- 🎴 **Spaced Repetition Flashcards**: Master open-source terminology, CLI flags, and workflow best practices using an SM-2 algorithmic memory engine.
- 🤝 **Mentorship & Peer Code Review**: Request guidance from experienced mentors or review peer PR submissions to earn XP and badges.
- 📊 **Streak & Burnout Analytics**: Stay motivated with daily streak tracking, XP leaderboards, milestone achievements, and health checks.
- 🎓 **Verified Printable Certificates**: Earn a cryptographically verifiable A4 completion certificate upon mastering the core curriculum.
- 💬 **Live Community Collaboration**: Connect with fellow learners via real-time WebSocket chat and collaborative session rooms.

---

## ⚡ Quick Start & Local Setup

### 🐳 Option A: Running with Docker (Recommended)

Spin up the entire stack (Postgres, Redis, Django API, Celery Worker, and Vite Frontend) in seconds:

```bash
# 1. Clone the repository
git clone https://github.com/nandinigoyaldev/Open-Source-Contribution-Atelier.git
cd Open-Source-Contribution-Atelier

# 2. Copy configuration environment files
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env

# 3. Boot the stack with Docker Compose
docker compose up --build
```

- 🌐 **Frontend SPA**: `http://localhost:5173`
- ⚙️ **Backend REST API**: `http://localhost:8000/api/`

---

### 💻 Option B: Manual Local Development Setup

#### 1. Backend (Django REST API)

> Requirements: **Python 3.9+**

```bash
cd backend

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Run migrations and seed curriculum database
python manage.py migrate
python manage.py seed_lessons
python manage.py seed_dashboard

# Start Django development server
python manage.py runserver
```

- API Endpoint: `http://localhost:8000/api/`

#### 2. Frontend (React 19 + Vite)

> Requirements: **Node.js 20+**

```bash
cd frontend

# Install dependencies
npm install

# Start Vite hot-reloading development server
npm run dev
```

- Web App: `http://localhost:5173`

---

## 🧪 Running Tests & Quality Checks

Before pushing changes, run the test suites to ensure everything is green:

```bash
# Backend Pytest Suite
cd backend
python -m pytest

# Frontend Vitest Suite
cd frontend
npm run test

# Frontend ESLint & Formatting
npm run lint
npm run format:check
```

---

## 🏆 ECSoC 2026 Program & Leaderboard

Participating in **ECSoC 2026**? We are excited to have you!

- 📊 **[Official ECSoC '26 Leaderboard](LEADERBOARD.md)**
- 📌 **[Participation & Issue Claiming Guide](.github/CONTRIBUTING.md)**
- 📌 **[Curriculum & Content Guide](docs/CONTENT_GUIDE.md)**

---

## 🤝 Contributing

Contributions of all kinds are welcome! Whether you are fixing a typo, adding a new lesson, improving UI accessibility, or squashing bugs:

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feat/amazing-feature`)
3. Commit your Changes (`git commit -m 'feat: add amazing feature'`)
4. Push to the Branch (`git push origin feat/amazing-feature`)
5. Open a Pull Request

Please review our [Contributing Guidelines](.github/CONTRIBUTING.md) and [Code of Conduct](.github/CODE_OF_CONDUCT.md).

---

## 💜 Community & Contributors

A huge thank you to everyone who has contributed to making this project better for learners worldwide!

<a href="https://github.com/nandinigoyaldev/Open-Source-Contribution-Atelier/graphs/contributors">
  <img src="https://contrib.rocks/image?repo=nandinigoyaldev/Open-Source-Contribution-Atelier&max=100&columns=12" />
</a>

---

<div align="center">

### 🌟 If you find this project inspiring, please give it a star!

Designed and built with ❤️ by the open-source community.

</div>
