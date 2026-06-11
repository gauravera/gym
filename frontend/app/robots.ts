import { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/api/", "/admin/"],
      },
      // Explicitly allowing AI Crawlers for GEO (Generative Engine Optimization)
      {
        userAgent: "Google-Extended", // Gemini
        allow: "/",
      },
      {
        userAgent: "CCBot", // Common Crawl (often used by AIs)
        allow: "/",
      },
      {
        userAgent: "GPTBot", // OpenAI
        allow: "/",
      },
      {
        userAgent: "ChatGPT-User", // ChatGPT web browsing
        allow: "/",
      },
      {
        userAgent: "Claude-Web", // Anthropic Claude
        allow: "/",
      },
      {
        userAgent: "Anthropic-ai", // Anthropic backend
        allow: "/",
      },
      {
        userAgent: "Omgili", // Webz.io (used by Perplexity and others)
        allow: "/",
      },
      {
        userAgent: "FacebookBot", // Meta
        allow: "/",
      },
    ],
    sitemap: "https://fitflow.app/sitemap.xml",
  };
}
