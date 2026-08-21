import { describe, it, expect, vi } from "vitest";
import { generateUniqueTestUser, mockLogin, mockSignup, mockMagicLink } from "../../e2e/helpers/auth";

describe("Playwright E2E auth parallel isolation helpers", () => {
  it("generates unique distinct test users on consecutive calls", () => {
    const user1 = generateUniqueTestUser("worker1");
    const user2 = generateUniqueTestUser("worker2");

    expect(user1.username).not.toBe(user2.username);
    expect(user1.email).not.toBe(user2.email);
    expect(user1.token).not.toBe(user2.token);
    expect(user1.id).not.toBe(user2.id);

    expect(user1.username).toMatch(/^worker1_\d+_[a-z0-9]+/);
    expect(user1.email).toContain("@test-atelier.local");
  });

  it("mockLogin returns unique user and token and routes routes properly", async () => {
    const routes: Record<string, Function> = {};
    const mockPage: any = {
      route: vi.fn(async (pattern: string, handler: Function) => {
        routes[pattern] = handler;
      }),
    };

    const res = await mockLogin(mockPage);

    expect(res.user.username).toBeDefined();
    expect(res.token).toBeDefined();
    expect(mockPage.route).toHaveBeenCalledWith("**/api/auth/login/", expect.any(Function));
    expect(mockPage.route).toHaveBeenCalledWith("**/api/auth/me/", expect.any(Function));
  });

  it("mockSignup and mockMagicLink return isolated dynamic credentials", async () => {
    const mockPage: any = {
      route: vi.fn(),
    };

    const signupUser = await mockSignup(mockPage);
    expect(signupUser.username).toMatch(/^signup_user_/);
    expect(mockPage.route).toHaveBeenCalledWith("**/api/auth/signup/", expect.any(Function));

    const magic = await mockMagicLink(mockPage);
    expect(magic.user.username).toMatch(/^magic_user_/);
    expect(mockPage.route).toHaveBeenCalledWith("**/api/auth/magic-link/verify/", expect.any(Function));
  });
});
