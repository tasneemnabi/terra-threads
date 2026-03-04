import type { MetadataRoute } from "next";

const BASE_URL = "https://fiber.clothing";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  return [
    {
      url: BASE_URL,
      lastModified: new Date(),
      priority: 1.0,
    },
    {
      url: `${BASE_URL}/brands`,
      lastModified: new Date(),
      priority: 0.9,
    },
    {
      url: `${BASE_URL}/about`,
      lastModified: new Date(),
      priority: 0.5,
    },
  ];
}
