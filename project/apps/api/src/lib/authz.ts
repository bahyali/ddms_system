import * as schema from '@ddms/db';

export type UserPayload = {
  id: string;
  roles: string[];
  tenantId: string;
};

export type FieldDefWithAcl = Pick<
  schema.fieldDefs.$inferSelect,
  'key' | 'acl'
>;

// Centralized RBAC Rules
const rbacRules: Record<string, string[]> = {
  'entity-type:create': ['admin', 'builder'],
  'entity-type:update': ['admin', 'builder'],
  'field-def:create': ['admin', 'builder'],
  'field-def:update': ['admin', 'builder'],
  'record:create': ['admin', 'builder', 'contributor'],
  'record:update': ['admin', 'builder', 'contributor'],
  'record:delete': ['admin', 'builder'],
  'record:read': ['admin', 'builder', 'contributor', 'viewer'],
  'relation:create': ['admin', 'builder', 'contributor'],
  'relation:delete': ['admin', 'builder', 'contributor'],
  'index:read': ['admin', 'builder'],
};

/**
 * Checks if a user has a specific permission based on their roles.
 * @param user The user payload from the request.
 * @param permission The permission string to check (e.g., 'entity-type:create').
 * @returns `true` if the user has permission, `false` otherwise.
 */
export function hasPermission(user: UserPayload, permission: string): boolean {
  const allowedRoles = rbacRules[permission];
  if (!allowedRoles) {
    return false; // Deny by default if permission is not defined
  }
  return user.roles.some((role) => allowedRoles.includes(role));
}

/**
 * Checks if a user is allowed to write to the given fields based on Field ACLs.
 * Secure by default: if a field has no ACL or an empty `write` array, it's not writable.
 * @param user The user payload.
 * @param fieldDefs The field definitions for the entity type.
 * @param data The data payload from the request body.
 * @returns An array of field keys that the user is not allowed to write to. An empty array means the write is permitted.
 */
export function checkWritePermissions(
  user: UserPayload,
  fieldDefs: FieldDefWithAcl[],
  data: Record<string, unknown>,
): string[] {
  const forbiddenFields: string[] = [];
  const fieldDefMap = new Map(fieldDefs.map((fd) => [fd.key, fd]));

  for (const key of Object.keys(data)) {
    const fieldDef = fieldDefMap.get(key);
    if (!fieldDef) {
      // This should be caught by validation, but as a safeguard, deny unknown fields.
      forbiddenFields.push(key);
      continue;
    }

    const acl = fieldDef.acl as { write?: string[] };
    const allowedRoles = acl?.write;

    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      forbiddenFields.push(key); // Deny if no roles are specified
      continue;
    }

    const hasWritePermission = user.roles.some((role) =>
      allowedRoles.includes(role),
    );

    if (!hasWritePermission) {
      forbiddenFields.push(key);
    }
  }

  return forbiddenFields;
}

/**
 * Filters a record's data object, removing fields the user is not allowed to read.
 * Secure by default: if a field has no ACL or an empty `read` array, it's not readable.
 * @param user The user payload.
 * @param fieldDefs The field definitions for the entity type.
 * @param record The record to filter.
 * @returns A new record object with readable fields only.
 */
export function filterReadableFields<
  T extends { data: Record<string, unknown> },
>(user: UserPayload, fieldDefs: FieldDefWithAcl[], record: T): T {
  const fieldDefMap = new Map(fieldDefs.map((fd) => [fd.key, fd]));
  const filteredData: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(record.data)) {
    const fieldDef = fieldDefMap.get(key);
    if (!fieldDef) {
      continue; // Skip fields not in metadata
    }

    const acl = fieldDef.acl as { read?: string[] };
    const allowedRoles = acl?.read;

    if (!Array.isArray(allowedRoles) || allowedRoles.length === 0) {
      continue; // Deny if no roles are specified
    }

    const hasReadPermission = user.roles.some((role) =>
      allowedRoles.includes(role),
    );

    if (hasReadPermission) {
      filteredData[key] = value;
    }
  }

  // Return a new object to avoid mutating the original
  return { ...record, data: filteredData };
}
