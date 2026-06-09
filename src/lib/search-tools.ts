import { toolDefinition } from "@tanstack/ai";
import { z } from "zod";
import { vectorSearch } from "./vector-search";

export const searchDocsToolDef = toolDefinition({
  name: "searchDocs",
  description:
    "Search the TanStack AI documentation using semantic vector search. Use this tool whenever the user asks about TanStack AI features, APIs, guides, adapters, streaming, tools, middleware, or any other TanStack AI topic.",
  inputSchema: z.object({
    query: z.string().describe("Natural language search query"),
    section: z
      .string()
      .optional()
      .describe(
        "Optional section filter: guides, adapters, api, getting-started, protocol, reference, community-adapters, architecture",
      ),
  }),
  outputSchema: z.array(
    z.object({
      title: z.string(),
      section: z.string(),
      slug: z.string(),
      content: z.string(),
      score: z.number(),
    }),
  ),
});

export const searchDocsTool = searchDocsToolDef.server(async (args) => {
  const { query, section } = args as { query: string; section?: string };
  const hits = await vectorSearch({
    query,
    section,
    limit: 5,
    contentChars: 1500,
  });
  return hits.map(({ _id: _ignored, ...rest }) => rest);
});
