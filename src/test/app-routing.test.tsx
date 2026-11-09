import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

// Match routes without rendering: jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it.each(["/", "/course", "/resultats"])(
    "matches a page for %s instead of falling back to not found",
    (path) => {
      const router = createRouter({ routeTree });
      expect(router.matchRoutes(path).at(-1)?.routeId).not.toBe(rootRouteId);
    },
  );
});
