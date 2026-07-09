import { AppRole } from './types';

export const DEFAULT_ROLES: Omit<AppRole, 'created_at'>[] = [
  {
    id: 'role-admin',
    name: 'Admin',
    description: 'Full platform access including credentials, users, and role management.',
    permissions: [
      'menu.dashboards', 'menu.customers', 'menu.campaigns', 'menu.conversations', 'menu.chatbot', 'menu.settings',
      'customers.view_all', 'customers.create', 'customers.import', 'customers.delete', 'customers.reassign',
      'inbox.view_all', 'campaigns.manage', 'chatbot.manage',
      'settings.credentials', 'settings.users', 'settings.roles', 'settings.templates', 'settings.reports',
    ],
    isSystem: true,
  },
  {
    id: 'role-manager',
    name: 'Manager',
    description: 'Review analytics, manage contacts and campaigns. Cannot edit API credentials or roles.',
    permissions: [
      'menu.dashboards', 'menu.customers', 'menu.campaigns', 'menu.conversations', 'menu.chatbot', 'menu.settings',
      'customers.view_all', 'customers.create', 'customers.import', 'customers.delete', 'customers.reassign',
      'inbox.view_all', 'campaigns.manage', 'chatbot.manage',
      'settings.templates', 'settings.reports',
    ],
    isSystem: true,
  },
  {
    id: 'role-sales',
    name: 'Sales',
    description: 'Resolve support chats and manage assigned customers only.',
    permissions: [
      'menu.dashboards', 'menu.conversations', 'menu.customers',
      'customers.view_assigned_only',
    ],
    isSystem: true,
  },
];
