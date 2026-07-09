import React from 'react';
import { AppRole, User } from '../../types';
import AdminPageHeader from './AdminPageHeader';
import RolesPermissionsPanel from '../RolesPermissionsPanel';

interface RolesManagementProps {
  roles: AppRole[];
  users: User[];
  onCreateRole: (role: Omit<AppRole, 'created_at'>) => void;
  onUpdateRole: (id: string, data: Partial<AppRole>) => void;
  onDeleteRole: (id: string) => void;
}

export default function RolesManagement(props: RolesManagementProps) {
  return (
    <div>
      <AdminPageHeader
        title="Roles & Permissions"
        description="Define roles and control what each role can access."
      />
      <RolesPermissionsPanel {...props} embedded />
    </div>
  );
}
