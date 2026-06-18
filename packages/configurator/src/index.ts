import { Dashboard } from "./dashboard";
import type { ConfigState, DashboardOptions } from "./types";

export * from "./config/diff";
export * from "./config/reader";
export * from "./config/writer";
export * from "./dashboard";
export * from "./types";
export * from "./utils/omp";

export function createDashboard(
	state: ConfigState,
	options: DashboardOptions = {},
): Dashboard {
	return new Dashboard(state, options);
}
