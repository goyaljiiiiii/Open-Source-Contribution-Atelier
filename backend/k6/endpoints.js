import http from "k6/http";
import { check } from "k6";

export const BASE_URL = __ENV.K6_BASE_URL || "http://localhost:8000";

export function hitEndpoints() {
  const readEndpoints = [
    "/api/content/published-lessons/",
    "/api/content/published-lessons/git-basics/",
    "/api/leaderboard/",
    "/api/dashboard/stats/",
    "/api/accounts/profile/",
    "/api/progress/badges/",
    "/api/dashboard/community/",
    "/api/search/?q=git",
    "/api/content/categories/",
    "/api/content/roadmap/",
    "/api/content/organizations/",
    "/api/progress/summary/",
    "/api/challenges/",
    "/api/health/",
    "/api/version/",
    "/api/notifications/",
    "/api/notes/",
    "/api/recommendations/",
  ];

  for (const ep of readEndpoints) {
    const res = http.get(`${BASE_URL}${ep}`);
    check(res, {
      "status is expected": (r) => [200, 201, 401, 404].includes(r.status),
    });
  }

  // Write & Action Endpoints
  const payload = JSON.stringify({ username: "perf_test_user", password: "Password123!" });
  const params = { headers: { "Content-Type": "application/json" } };

  const loginRes = http.post(`${BASE_URL}/api/accounts/login/`, payload, params);
  check(loginRes, {
    "login status is expected": (r) => [200, 400, 401].includes(r.status),
  });

  const verifyPayload = JSON.stringify({ command: "git init", expected: "git init" });
  const verifyRes = http.post(`${BASE_URL}/api/sandbox/verify/`, verifyPayload, params);
  check(verifyRes, {
    "sandbox verify status is expected": (r) => [200, 400, 401].includes(r.status),
  });
}

