import { Page } from "@playwright/test";

export interface TestUserData {
  id?: number;
  username?: string;
  email?: string;
  token?: string;
  [key: string]: any;
}

/**
 * Generates an isolated unique user data object to prevent race conditions during parallel test runs.
 *
 * @param prefix - Prefix for the username and email
 */
export function generateUniqueTestUser(prefix = "user"): Required<Omit<TestUserData, keyof Record<string, any>>> & TestUserData {
  const uniqueSuffix = `${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  return {
    id: Math.floor(Math.random() * 900000) + 100000,
    username: `${prefix}_${uniqueSuffix}`,
    email: `${prefix}_${uniqueSuffix}@test-atelier.local`,
    token: `mock-access-token-${uniqueSuffix}`,
  };
}

/**
 * Mocks a successful login response from the backend with worker-isolated credentials.
 *
 * @param page - Playwright Page object
 * @param userData - Custom user data to override defaults
 */
export async function mockLogin(page: Page, userData: TestUserData = {}) {
  const fallback = generateUniqueTestUser("login_user");
  const user = {
    id: userData.id ?? fallback.id,
    username: userData.username ?? fallback.username,
    email: userData.email ?? fallback.email,
    ...userData,
  };
  const token = userData.token ?? fallback.token;

  await page.route("**/api/auth/login/", async (route) => {
    const json = {
      access: token,
      refresh: `refresh-${token}`,
      user,
    };
    await route.fulfill({ status: 200, json });
  });

  await page.route("**/api/auth/me/", async (route) => {
    await route.fulfill({ status: 200, json: user });
  });

  return { user, token };
}

/**
 * Mocks a successful signup response from the backend.
 *
 * @param page - Playwright Page object
 * @param userData - Custom user data to override defaults
 */
export async function mockSignup(page: Page, userData: TestUserData = {}) {
  const fallback = generateUniqueTestUser("signup_user");
  const user = {
    id: userData.id ?? fallback.id,
    username: userData.username ?? fallback.username,
    email: userData.email ?? fallback.email,
    ...userData,
  };

  await page.route("**/api/auth/signup/", async (route) => {
    await route.fulfill({ status: 201, json: user });
  });

  return user;
}

/**
 * Mocks a successful magic link verify response from the backend.
 *
 * @param page - Playwright Page object
 * @param userData - Custom user data to override defaults
 */
export async function mockMagicLink(page: Page, userData: TestUserData = {}) {
  const fallback = generateUniqueTestUser("magic_user");
  const user = {
    id: userData.id ?? fallback.id,
    username: userData.username ?? fallback.username,
    email: userData.email ?? fallback.email,
    ...userData,
  };
  const token = userData.token ?? fallback.token;

  await page.route("**/api/auth/magic-link/verify/", async (route) => {
    const json = {
      access: token,
      refresh: `refresh-${token}`,
      user,
      message: "You have been successfully logged in.",
    };
    await route.fulfill({ status: 200, json });
  });

  await page.route("**/api/auth/me/", async (route) => {
    await route.fulfill({ status: 200, json: user });
  });

  return { user, token };
}

/**
 * Sets the auth token in local storage to bypass the login page in tests.
 * This should be called before `page.goto` or similar navigation.
 *
 * @param page - Playwright Page object
 * @param token - Optional custom token to store
 */
export async function setAuthenticatedState(page: Page, token = "mock-access-token") {
  // First, visit root or domain so we can set local storage
  await page.goto("/");
  await page.evaluate((tok) => {
    localStorage.setItem("accessToken", tok);
  }, token);
}
