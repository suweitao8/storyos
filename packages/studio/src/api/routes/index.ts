import type { StudioRouteContext } from "./context.js";
import { registerProjectSettingsRoutes } from "./project.js";
import { registerStoryAssetRoutes } from "./story-assets.js";

export function registerStudioRoutes(context: StudioRouteContext): void {
  registerStoryAssetRoutes(context);
  registerProjectSettingsRoutes(context);
}
