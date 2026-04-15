const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000/api";

type RequestOptions = RequestInit & {
  requireAuth?: boolean;
};

export async function fetchApi(endpoint: string, options: RequestOptions = {}) {
  const { requireAuth = true, headers: customHeaders, ...config } = options;

  const headers = new Headers(customHeaders);
  headers.set("Content-Type", "application/json");

  if (requireAuth) {
    const token = localStorage.getItem("accessToken");
    if (token) {
      headers.set("Authorization", `Bearer ${token}`);
    }
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...config,
    headers,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => ({}));
    throw new Error(errorBody.detail || "An error occurred");
  }

  return response.json().catch(() => ({}));
}
