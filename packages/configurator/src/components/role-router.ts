import type { RoleAssignment } from "../types";
import { formatDisplayLines } from "../utils/format";

export function renderRoleRouter(
	roles: readonly RoleAssignment[],
	width: number,
): readonly string[] {
	if (roles.length === 0)
		return formatDisplayLines(["No role assignments configured."], width);
	return formatDisplayLines(
		roles.map((role) => `${role.role} → ${role.provider}/${role.modelId}`),
		width,
	);
}
