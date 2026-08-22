import { test as base, Page } from "@playwright/test";
import { generateUniqueTestUser, mockLogin, setAuthenticatedState } from "../helpers/auth";

// Define custom fixtures
type MyFixtures = {
  authPage: Page;
};

// Extend base test
export const test = base.extend<MyFixtures>({
  authPage: async ({ page }, use) => {
    // 1. Generate unique user to prevent cross-worker test interference
    const uniqueUser = generateUniqueTestUser("auth_fixture");

    // 2. Mock the login API responses with unique credentials
    await mockLogin(page, uniqueUser);

    // 3. Set the unique token in local storage
    await setAuthenticatedState(page, uniqueUser.token);

    // 4. Use the page in the test
    // eslint-disable-next-line react-hooks/rules-of-hooks
    await use(page);
  },
});

export { expect } from "@playwright/test";
