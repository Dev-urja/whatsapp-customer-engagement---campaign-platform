import React, { useState } from 'react';
import { User, AppRole } from '../../types';
import { Plus, X } from 'lucide-react';
import { resolveRoles } from '../../permissions';
import AdminPageHeader from './AdminPageHeader';

interface UserManagementProps {
  users: User[];
  roles: AppRole[];
  currentUser: User;
  onAddUser: (u: User & { password?: string }) => void;
  onUpdateUser: (id: string, data: Partial<User>) => void;
  onDeleteUser: (id: string) => void;
}

export default function UserManagement({
  users,
  roles,
  currentUser,
  onAddUser,
  onUpdateUser,
  onDeleteUser,
}: UserManagementProps) {
  const roleOptions = resolveRoles(roles);
  const [showModal, setShowModal] = useState(false);

  const handleCreateUser = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = (fd.get('password') as string) || '';
    const confirmPassword = (fd.get('confirmPassword') as string) || '';

    if (password.length < 8) {
      alert('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirmPassword) {
      alert('Passwords do not match.');
      return;
    }

    onAddUser({
      id: `u-${Date.now()}`,
      name: fd.get('name') as string,
      email: fd.get('email') as string,
      role: fd.get('role') as string,
      status: ((fd.get('status') as string) || 'active') as 'active' | 'inactive',
      created_at: new Date().toISOString(),
      lastLogin: 'Never logged',
      password,
    });
    setShowModal(false);
    e.currentTarget.reset();
  };

  return (
    <div>
      <AdminPageHeader
        title="Users"
        description="Manage team accounts and assign roles."
        action={
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="bg-urja-primary hover:bg-urja-primary/90 text-white text-sm font-medium px-4 py-2 rounded-lg flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" /> Add User
          </button>
        }
      />

      <div className="bg-white dark:bg-[#1e1d2e] rounded-xl border border-slate-200 dark:border-[#3d3c52] overflow-hidden shadow-sm">
        <table className="w-full text-sm text-left">
          <thead className="bg-slate-50 dark:bg-[#161525] border-b border-slate-200 dark:border-[#3d3c52] text-xs text-slate-500 dark:text-slate-400 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Email</th>
              <th className="px-4 py-3 font-medium">Role</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="px-4 py-3 font-medium">Last Login</th>
              <th className="px-4 py-3 font-medium text-center w-16">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {users.map(u => (
              <tr key={u.id} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.03]">
                <td className="px-4 py-3 font-medium text-slate-900 dark:text-slate-100">{u.name}</td>
                <td className="px-4 py-3 text-slate-600 dark:text-slate-400">{u.email}</td>
                <td className="px-4 py-3">
                  {u.id !== currentUser.id ? (
                    <select
                      value={u.role}
                      onChange={e => onUpdateUser(u.id, { role: e.target.value })}
                      className="text-sm px-2 py-1 rounded-md border border-slate-200 dark:border-[#3d3c52] focus:outline-none focus:ring-2 focus:ring-urja-primary/30"
                    >
                      {roleOptions.map(r => (
                        <option key={r.id} value={r.name}>{r.name}</option>
                      ))}
                    </select>
                  ) : (
                    <span className="text-xs font-medium px-2 py-0.5 rounded bg-red-50 text-red-700 border border-red-100">
                      {u.role}
                    </span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {u.id !== currentUser.id ? (
                    <select
                      value={u.status}
                      onChange={e => onUpdateUser(u.id, { status: e.target.value as 'active' | 'inactive' })}
                      className="text-sm px-2 py-1 rounded-md border border-slate-200 dark:border-[#3d3c52] focus:outline-none focus:ring-2 focus:ring-urja-primary/30"
                    >
                      <option value="active">Active</option>
                      <option value="inactive">Inactive</option>
                    </select>
                  ) : (
                    <span className="flex items-center gap-1.5 text-sm text-slate-600">
                      <span className="w-2 h-2 rounded-full bg-emerald-500" />
                      Active
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-500 text-xs">{u.lastLogin}</td>
                <td className="px-4 py-3 text-center">
                  {u.id !== currentUser.id && (
                    <button
                      type="button"
                      onClick={() => confirm(`Remove "${u.name}"?`) && onDeleteUser(u.id)}
                      className="text-slate-400 hover:text-red-600 text-lg leading-none"
                      title="Delete user"
                    >
                      ×
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <h2 className="text-base font-semibold text-slate-900">Add User</h2>
              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleCreateUser} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
                <input name="name" required className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                <input name="email" type="email" required className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
                  <input name="password" type="password" required minLength={8} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Confirm</label>
                  <input name="confirmPassword" type="password" required minLength={8} className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
                  <select name="role" required className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    {roleOptions.map(r => (
                      <option key={r.id} value={r.name}>{r.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Status</label>
                  <select name="status" className="w-full text-sm px-3 py-2 border border-slate-200 rounded-lg bg-white">
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-slate-600 hover:bg-slate-50 rounded-lg">
                  Cancel
                </button>
                <button type="submit" className="px-4 py-2 text-sm bg-urja-primary hover:bg-urja-primary/90 text-white rounded-lg font-medium">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
