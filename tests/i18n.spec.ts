import { test, expect, request } from "@playwright/test";
import { menuText, parseLocale, translate } from "../src/lib/i18n";
import kk from "../src/lib/i18n/kk.json";
import ru from "../src/lib/i18n/ru.json";
import type { Catalog } from "../src/lib/types";
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());
const baseURL = process.env.TEST_BASE_URL ?? "http://127.0.0.1:3000";

test("first visits are Kazakh; language preferences render every entry page on the server", async () => {
  const fresh = await request.newContext({ baseURL });
  try {
    const catalog: Catalog = await (
      await fresh.get("/api/catalog/table-and-thyme")
    ).json();
    for (const url of [
      "/",
      "/admin",
      "/restaurant?slug=table-and-thyme",
      `/restaurant?slug=table-and-thyme&table=${catalog.tables[0].id}`,
    ]) {
      const html = await (await fresh.get(url)).text();
      expect(html).toContain('<html lang="kk"');
      expect(html).toContain('aria-label="Тіл"');
      expect(/<option[^>]*value="kk"[^>]*selected=""/.test(html)).toBe(true);
    }
    for (const locale of ["ru", "en"] as const) {
      const ctx = await request.newContext({
        baseURL,
        storageState: {
          cookies: [
            {
              name: "locale",
              value: locale,
              domain: new URL(baseURL).hostname,
              path: "/",
              expires: -1,
              httpOnly: false,
              secure: false,
              sameSite: "Lax",
            },
          ],
          origins: [],
        },
      });
      try {
        for (const url of ["/", "/admin", "/restaurant?slug=table-and-thyme"]) {
          const html = await (await ctx.get(url)).text();
          expect(html).toContain(`<html lang="${locale}"`);
          expect(
            new RegExp(`<option[^>]*value="${locale}"[^>]*selected=""`).test(
              html,
            ),
          ).toBe(true);
          expect(html).toContain(
            translate(
              locale,
              url === "/"
                ? "Connect your restaurant"
                : url === "/admin"
                  ? "Welcome back."
                  : "Explore the menu",
            ),
          );
        }
      } finally {
        await ctx.dispose();
      }
    }
  } finally {
    await fresh.dispose();
  }
});

test("menu fallback is per field and never substitutes another optional language", () => {
  const item = {
    name: "Суп",
    description: "Горячий суп",
    nameEn: "Soup",
    descriptionEn: "   ",
    nameKk: "",
    descriptionKk: "Ыстық сорпа",
  };
  expect(menuText(item, "kk")).toBe("Суп");
  expect(menuText(item, "kk", "description")).toBe("Ыстық сорпа");
  expect(menuText(item, "en")).toBe("Soup");
  expect(menuText(item, "en", "description")).toBe("Горячий суп");
  expect(menuText(item, "ru")).toBe("Суп");
  expect(menuText(undefined, "kk")).toBe("");
  expect(parseLocale("fr")).toBe("kk");
  expect(Object.keys(kk).sort()).toEqual(Object.keys(ru).sort());
});

test("managers can save, omit, and clear optional translations; signed-in language persists", async () => {
  const admin = await request.newContext({
    baseURL,
    extraHTTPHeaders: { origin: baseURL },
    storageState: {
      cookies: [
        {
          name: "locale",
          value: "ru",
          domain: new URL(baseURL).hostname,
          path: "/",
          expires: -1,
          httpOnly: false,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    },
  });
  const tag = `Перевод-${Date.now()}`;
  let categoryId: string | undefined;
  let itemId: string | undefined;
  const catalog = async (): Promise<Catalog> =>
    (await admin.get("/api/catalog/table-and-thyme")).json();
  try {
    expect(
      (
        await admin.post("/api/auth/login", {
          data: {
            email: "admin@tableandthyme.local",
            password: process.env.SEED_PASSWORD ?? "TableThyme2026!",
          },
        })
      ).status(),
    ).toBe(200);
    const c = await catalog();
    const manage = (entity: string, op: string, data: unknown, id?: string) =>
      admin.post(`/api/manage/${entity}`, {
        data: { restaurantId: c.restaurant.id, op, data, id },
      });
    expect(
      (
        await manage("categories", "create", {
          name: tag,
          nameKk: "Сынақ",
          nameEn: "Test",
          sortOrder: 999,
          isActive: true,
        })
      ).status(),
    ).toBe(200);
    categoryId = (await catalog()).categories.find((x) => x.name === tag)!.id;
    const values = {
      name: tag,
      nameKk: "Сорпа",
      nameEn: "Soup",
      description: "Описание",
      descriptionKk: "",
      descriptionEn: "English description",
      categoryId,
      imageUrl: "",
      price: 100,
      costPrice: 0,
      isAvailable: true,
    };
    expect((await manage("menu", "create", values)).status()).toBe(200);
    let item = (await catalog()).menu.find((x) => x.name === tag)!;
    itemId = item.id;
    expect(menuText(item, "kk")).toBe("Сорпа");
    expect(menuText(item, "kk", "description")).toBe("Описание");
    // Existing clients that omit optional fields must preserve saved translations.
    const { nameKk, nameEn, descriptionKk, descriptionEn, ...base } = values;
    expect([nameKk, nameEn, descriptionKk, descriptionEn]).toHaveLength(4);
    expect(
      (
        await manage("menu", "update", { ...base, price: 200 }, itemId)
      ).status(),
    ).toBe(200);
    item = (await catalog()).menu.find((x) => x.id === itemId)!;
    expect(item.nameEn).toBe("Soup");
    expect(
      (
        await manage(
          "menu",
          "update",
          {
            ...base,
            nameEn: "  ",
            nameKk: "",
            descriptionEn: "",
            descriptionKk: "",
          },
          itemId,
        )
      ).status(),
    ).toBe(200);
    item = (await catalog()).menu.find((x) => x.id === itemId)!;
    expect(menuText(item, "en")).toBe(tag);
    expect(menuText(item, "en", "description")).toBe("Описание");
    const html = await (await admin.get("/admin")).text();
    expect(html).toContain('<html lang="ru"');
    expect(html).toContain("Обзор ресторана.");
    expect(html).toContain('aria-label="Язык"');
    expect(
      (
        await manage(
          "categories",
          "update",
          { name: tag, nameEn: "", nameKk: "", sortOrder: 999, isActive: true },
          categoryId,
        )
      ).status(),
    ).toBe(200);
    expect(
      menuText(
        (await catalog()).categories.find((x) => x.id === categoryId),
        "kk",
      ),
    ).toBe(tag);
  } finally {
    // Only this test's un-ordered fixture rows are removed.
    const restaurantId = (await catalog()).restaurant.id;
    if (itemId)
      await admin.post("/api/manage/menu", {
        data: { restaurantId, op: "delete", id: itemId },
      });
    if (categoryId)
      await admin.post("/api/manage/categories", {
        data: { restaurantId, op: "delete", id: categoryId },
      });
    await admin.dispose();
  }
});
