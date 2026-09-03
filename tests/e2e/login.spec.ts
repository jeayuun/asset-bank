import { expect, test } from "@playwright/test";

test("root redirects to the branded sign-in page", async ({ page }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/login$/);
  await expect(
    page.getByRole("heading", { name: "Sign in to Asset Bank" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue with Google" }),
  ).toBeEnabled();
});

test("unauthenticated access to a protected route redirects to sign-in", async ({
  page,
}) => {
  await page.goto("/super/users");
  await expect(page).toHaveURL(/\/login$/);
});
