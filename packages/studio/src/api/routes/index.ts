import type { StudioRouteContext } from "./context.js";
import { registerProjectSettingsRoutes } from "./project.js";
import { registerStoryAssetRoutes } from "./story-assets.js";
import { registerStoryReadRoutes } from "./stories.js";
import { registerProviderRoutes } from "./providers.js";
import { registerStoryProductionRoutes } from "./story-production.js";

export function registerStudioRoutes(context: StudioRouteContext): void {
  // Production routes must exist before asset-task recovery can resume an
  // extraction's post-processing chain.
  registerStoryProductionRoutes(context);
  registerStoryAssetRoutes(context);
  registerProjectSettingsRoutes(context);
  registerStoryReadRoutes(context);
  registerProviderRoutes(context);
}
