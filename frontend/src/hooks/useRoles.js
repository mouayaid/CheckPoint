import { useMemo } from "react";
import { useAuth } from "../context/AuthContext";

const ROLE_IDS = {
  EMPLOYEE: 1,
  MANAGER: 2,
  ADMIN: 3,
};

const ROLE_NAMES = {
  [ROLE_IDS.EMPLOYEE]: "Employee",
  [ROLE_IDS.MANAGER]: "Manager",
  [ROLE_IDS.ADMIN]: "Admin",
};

const ROLE_LABELS_FR = {
  employee: "Employé",
  manager: "Manager",
  admin: "Admin",
};

const normalizeRoleName = (value) => {
  if (typeof value !== "string") return "";
  return value.trim().toLowerCase();
};

const roleNameFromId = (roleId) => ROLE_NAMES[roleId] ?? "";

const roleIdFromName = (roleName) => {
  const normalized = normalizeRoleName(roleName);
  const numericRole = Number(normalized);

  if (Number.isInteger(numericRole) && ROLE_NAMES[numericRole]) {
    return numericRole;
  }

  switch (normalized) {
    case "employee":
    case "employe":
    case "employé":
      return ROLE_IDS.EMPLOYEE;
    case "manager":
      return ROLE_IDS.MANAGER;
    case "admin":
      return ROLE_IDS.ADMIN;
    default:
      return null;
  }
};

const resolveRole = (user) => {
  const rawRoleId = user?.roleId ?? user?.RoleId;
  const rawRoleName = user?.roleName ?? user?.RoleName;
  const rawRole = user?.role ?? user?.Role;

  const roleId =
    typeof rawRoleId === "number"
      ? rawRoleId
      : typeof rawRole === "number"
        ? rawRole
        : roleIdFromName(rawRoleName ?? rawRole);

  const roleName =
    roleNameFromId(roleId) ||
    (typeof rawRoleName === "string" ? rawRoleName.trim() : "") ||
    (typeof rawRole === "string" ? rawRole.trim() : "");

  const normalizedRole = normalizeRoleName(roleName);

  return {
    roleId,
    roleName,
    normalizedRole,
    roleLabel: ROLE_LABELS_FR[normalizedRole] ?? roleName,
  };
};

export const useRoles = (userOverride) => {
  const { user: authUser } = useAuth();
  const user = userOverride ?? authUser;

  return useMemo(() => {
    const role = resolveRole(user);

    const isEmployee =
      role.roleId === ROLE_IDS.EMPLOYEE || role.normalizedRole === "employee";
    const isManager =
      role.roleId === ROLE_IDS.MANAGER || role.normalizedRole === "manager";
    const isAdmin =
      role.roleId === ROLE_IDS.ADMIN || role.normalizedRole === "admin";

    return {
      ...role,
      isEmployee,
      isManager,
      isAdmin,
      canReviewRequests: isAdmin,
      canReviewLeave: isAdmin,
      canManageEvents: isManager || isAdmin,
      canPublishDepartmentChannel: isManager || isAdmin,
      canViewTeamContext: isManager || isAdmin,
      canVotePoll: isEmployee,
    };
  }, [user]);
};

export default useRoles;
