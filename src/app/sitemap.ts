export const dynamic = "force-static";

import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: "https://deloci.online",
      lastModified: new Date(),
      changeFrequency: "daily",
      priority: 1,
    },
  ];
}