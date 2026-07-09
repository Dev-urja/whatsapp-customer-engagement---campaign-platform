import { AppRole } from './types';
import { DEFAULT_ROLES } from './roleDefaults';

export type MenuId = 'dashboards' | 'customers' | 'campaigns' | 'conversations' | 'chatbot' | 'users' | 'roles' | 'settings';

export type PermissionKey =
  | 'menu.dashboards' | 'menu.customers' | 'menu.campaigns' | 'menu.conversations' | 'menu.chatbot' | 'menu.settings'
  | 'customers.view_all' | 'customers.view_assigned_only' | 'customers.create' | 'customers.import' | 'customers.delete' | 'customers.reassign'
  | 'inbox.view_all'
  | 'campaigns.manage' | 'chatbot.manage'
  | 'settings.credentials' | 'settings.users' | 'settings.roles' | 'settings.templates' | 'settings.reports';

export const PERMISSION_GROUPS: { label: string; permissions: { key: PermissionKey; label: string; description: string }[] }[] = [
  {
    label: 'Navigation',
    permissions: [
      { key: 'menu.dashboards', label: 'Monitor Dashboards', description: 'Access analytics and performance dashboards' },
      { key: 'menu.customers', label: 'Segment Databases', description: 'Access customer database section' },
      { key: 'menu.campaigns', label: 'Campaign Scheduler', description: 'Access campaign management' },
      { key: 'menu.conversations', label: 'Support Inboxes', description: 'Access WhatsApp inbox' },
      { key: 'menu.chatbot', label: 'Chatbot Builder', description: 'Access chatbot flow builder' },
      { key: 'menu.settings', label: 'Settings', description: 'Access platform settings' },
    ],
  },
  {
    label: 'Customers',
    permissions: [
      { key: 'customers.view_all', label: 'View all customers', description: 'See every customer in the database' },
      { key: 'customers.view_assigned_only', label: 'View assigned customers only', description: 'Limit to customers assigned to this user' },
      { key: 'customers.create', label: 'Create customers', description: 'Add new customer records' },
      { key: 'customers.import', label: 'Import customers', description: 'Bulk CSV import' },
      { key: 'customers.delete', label: 'Delete customers', description: 'Remove customer records' },
      { key: 'customers.reassign', label: 'Reassign sales rep', description: 'Change assigned representative' },
    ],
  },
  {
    label: 'Inbox',
    permissions: [
      { key: 'inbox.view_all', label: 'View all inbound chats', description: 'See all conversations, not just assigned ones' },
    ],
  },
  {
    label: 'Campaigns & Chatbot',
    permissions: [
      { key: 'campaigns.manage', label: 'Manage campaigns', description: 'Create, edit, and delete campaigns' },
      { key: 'chatbot.manage', label: 'Manage chatbot flows', description: 'Edit and activate chatbot flows' },
    ],
  },
  {
    label: 'Settings',
    permissions: [
      { key: 'settings.credentials', label: 'Edit API credentials', description: 'Save WhatsApp Cloud API tokens' },
      { key: 'settings.users', label: 'Manage users', description: 'Create and delete user accounts' },
      { key: 'settings.roles', label: 'Manage roles & permissions', description: 'Create roles and assign permissions' },
      { key: 'settings.templates', label: 'Manage templates', description: 'Submit WhatsApp templates' },
      { key: 'settings.reports', label: 'Export reports', description: 'Download CSV reports' },
    ],
  },
];

export function resolveRoles(roles: AppRole[]): AppRole[] {
  return roles.length > 0
    ? roles
    : DEFAULT_ROLES.map(r => ({ ...r, created_at: new Date().toISOString() }));
}

export function findRole(roleName: string, roles: AppRole[]): AppRole | undefined {
  const list = resolveRoles(roles);
  return list.find(r => r.name === roleName || r.id === roleName);
}

export function hasPermission(roleName: string, permission: PermissionKey | string, roles: AppRole[]): boolean {
  if (roleName === 'Admin') return true;
  const role = findRole(roleName, roles);
  if (!role) return false;
  return role.permissions.includes(permission);
}

export function canAccessMenu(roleName: string, menu: string, roles: AppRole[]): boolean {
  if (menu === 'users') return hasPermission(roleName, 'settings.users', roles);
  if (menu === 'roles') return hasPermission(roleName, 'settings.roles', roles);
  if (menu === 'settings') {
    return hasPermission(roleName, 'menu.settings', roles)
      || hasPermission(roleName, 'settings.credentials', roles)
      || hasPermission(roleName, 'settings.templates', roles)
      || hasPermission(roleName, 'settings.reports', roles);
  }
  return hasPermission(roleName, `menu.${menu}` as PermissionKey, roles);
}

export function getDefaultMenu(roleName: string, roles: AppRole[]): MenuId {
  if (hasPermission(roleName, 'menu.conversations', roles) && isSalesScoped(roleName, roles)) {
    return 'conversations';
  }
  const first = resolveRoles(roles)
    .find(r => r.name === roleName)?.permissions
    .find(p => p.startsWith('menu.'));
  if (first) return first.replace('menu.', '') as MenuId;
  return 'dashboards';
}

export function getMenuLabel(menu: MenuId, roleName: string, roles: AppRole[]): string {
  if (isSalesScoped(roleName, roles)) {
    if (menu === 'dashboards') return 'My Performance';
    if (menu === 'customers') return 'My Customers';
  }
  const labels: Record<MenuId, string> = {
    dashboards: 'Dashboard',
    customers: 'Customers',
    campaigns: 'Campaigns',
    conversations: 'Inbox',
    chatbot: 'Chatbot',
    users: 'Users',
    roles: 'Roles',
    settings: 'Settings',
  };
  return labels[menu];
}

export function isSalesScoped(roleName: string, roles: AppRole[]): boolean {
  const role = findRole(roleName, roles);
  if (!role) return roleName === 'Sales';
  return role.permissions.includes('customers.view_assigned_only') && !role.permissions.includes('customers.view_all');
}

/** @deprecated use isSalesScoped with roles */
export function isSales(roleName: string): boolean {
  return roleName === 'Sales';
}

export function showRoleSimulator(roleName: string, roles: AppRole[]): boolean {
  return hasPermission(roleName, 'settings.roles', roles) || roleName === 'Admin';
}

export function canManageCustomers(roleName: string, roles: AppRole[]): boolean {
  return hasPermission(roleName, 'customers.create', roles)
    || hasPermission(roleName, 'customers.view_all', roles);
}

export function canViewAllInbox(roleName: string, roles: AppRole[]): boolean {
  return hasPermission(roleName, 'inbox.view_all', roles);
}

export function isAdminRole(roleName: string, roles: AppRole[]): boolean {
  return hasPermission(roleName, 'settings.roles', roles) && hasPermission(roleName, 'settings.credentials', roles);
}
