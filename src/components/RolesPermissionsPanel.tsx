import React, { useState } from 'react';

import { AppRole, User } from '../types';

import { PERMISSION_GROUPS, PermissionKey } from '../permissions';

import { Shield, Plus, Pencil, Trash2, Lock, Users, CheckSquare, X } from 'lucide-react';



interface RolesPermissionsPanelProps {

  roles: AppRole[];

  users: User[];

  onCreateRole: (role: Omit<AppRole, 'created_at'>) => void;

  onUpdateRole: (id: string, data: Partial<AppRole>) => void;

  onDeleteRole: (id: string) => void;

  embedded?: boolean;

}



type FormState = {

  id?: string;

  name: string;

  description: string;

  permissions: string[];

  isSystem?: boolean;

};



const emptyForm = (): FormState => ({ name: '', description: '', permissions: [] });



function formatPermissionLabel(key: string) {

  return key

    .replace('menu.', '')

    .replace('customers.', '')

    .replace('settings.', '')

    .replace('inbox.', '')

    .replace('campaigns.', '')

    .replace('chatbot.', '')

    .replace(/_/g, ' ');

}



export default function RolesPermissionsPanel({

  roles,

  users,

  onCreateRole,

  onUpdateRole,

  onDeleteRole,

  embedded = false,

}: RolesPermissionsPanelProps) {

  const [showModal, setShowModal] = useState(false);

  const [form, setForm] = useState<FormState>(emptyForm());

  const [editingId, setEditingId] = useState<string | null>(null);



  const userCountByRole = (roleName: string) =>

    users.filter(u => u.role === roleName).length;



  const openCreate = () => {

    setEditingId(null);

    setForm(emptyForm());

    setShowModal(true);

  };



  const openEdit = (role: AppRole) => {

    setEditingId(role.id);

    setForm({

      id: role.id,

      name: role.name,

      description: role.description,

      permissions: [...role.permissions],

      isSystem: role.isSystem,

    });

    setShowModal(true);

  };



  const togglePermission = (key: PermissionKey) => {

    setForm(prev => ({

      ...prev,

      permissions: prev.permissions.includes(key)

        ? prev.permissions.filter(p => p !== key)

        : [...prev.permissions, key],

    }));

  };



  const toggleGroup = (keys: PermissionKey[], selectAll: boolean) => {

    setForm(prev => {

      const set = new Set(prev.permissions);

      keys.forEach(k => (selectAll ? set.add(k) : set.delete(k)));

      return { ...prev, permissions: Array.from(set) };

    });

  };



  const handleSubmit = (e: React.FormEvent) => {

    e.preventDefault();

    if (!form.name.trim()) {

      alert('Role name is required');

      return;

    }



    if (editingId) {

      onUpdateRole(editingId, {

        name: form.name.trim(),

        description: form.description.trim(),

        permissions: form.permissions,

      });

    } else {

      onCreateRole({

        id: `role-${Date.now()}`,

        name: form.name.trim(),

        description: form.description.trim(),

        permissions: form.permissions,

        isSystem: false,

      });

    }

    setShowModal(false);

  };



  const handleDelete = (role: AppRole) => {

    const count = userCountByRole(role.name);

    if (count > 0) {

      alert(`Cannot delete "${role.name}" — ${count} user(s) are assigned to this role.`);

      return;

    }

    if (confirm(`Delete role "${role.name}"? This cannot be undone.`)) {

      onDeleteRole(role.id);

    }

  };



  const createButtonClass =

    'bg-urja-primary hover:bg-urja-primary/90 text-white font-semibold rounded-xl transition-all shadow-xs flex items-center gap-1.5 shrink-0';



  return (

    <div className={embedded ? '' : 'bg-white rounded-2xl border border-slate-150 p-6 space-y-5 shadow-xs text-xs'} id="roles-permissions-panel">

      {!embedded && (

      <div className="flex justify-between items-start gap-4">

        <div>

          <h3 className="text-sm font-semibold text-slate-800 flex items-center gap-2">

            <Shield className="w-4 h-4 text-urja-primary" />

            Roles & Permissions

          </h3>

          <p className="text-slate-500 text-[11px] mt-0.5">

            Define access levels and assign granular permissions to each role. Users inherit permissions from their assigned role.

          </p>

        </div>

        <button type="button" onClick={openCreate} className={`${createButtonClass} px-4 py-2 text-xs`}>

          <Plus className="w-3.5 h-3.5" /> Create Role

        </button>

      </div>

      )}



      {embedded && (

        <div className="flex justify-end mb-4">

          <button type="button" onClick={openCreate} className={`${createButtonClass} px-4 py-2 text-sm`}>

            <Plus className="w-4 h-4" /> Create Role

          </button>

        </div>

      )}



      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">

        {roles.map(role => {

          const count = userCountByRole(role.name);

          return (

            <div

              key={role.id}

              className="role-card border border-slate-200 dark:border-[#3d3c52] rounded-xl p-4 bg-white dark:bg-[#1e1d2e] space-y-3 hover:border-urja-primary/40 dark:hover:border-urja-primary/50 transition-colors"

            >

              <div className="flex justify-between items-start gap-2">

                <div>

                  <div className="flex items-center gap-2 flex-wrap">

                    <span className="font-bold text-slate-800 dark:text-slate-100 text-sm">{role.name}</span>

                    {role.isSystem && (

                      <span className="text-[9px] font-semibold uppercase tracking-wide bg-slate-100 dark:bg-urja-primary/15 text-slate-600 dark:text-urja-secondary border border-slate-200 dark:border-urja-primary/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">

                        <Lock className="w-2.5 h-2.5" /> System

                      </span>

                    )}

                  </div>

                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">{role.description || 'No description'}</p>

                </div>

                <div className="flex gap-1 shrink-0">

                  <button

                    type="button"

                    onClick={() => openEdit(role)}

                    className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-urja-primary hover:bg-urja-primary/10 rounded-lg transition-colors"

                    title="Edit role"

                  >

                    <Pencil className="w-3.5 h-3.5" />

                  </button>

                  {!role.isSystem && (

                    <button

                      type="button"

                      onClick={() => handleDelete(role)}

                      className="p-1.5 text-slate-500 dark:text-slate-400 hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors"

                      title="Delete role"

                    >

                      <Trash2 className="w-3.5 h-3.5" />

                    </button>

                  )}

                </div>

              </div>



              <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400">

                <span className="flex items-center gap-1.5">

                  <CheckSquare className="w-3.5 h-3.5 text-urja-primary/80" />

                  {role.permissions.length} permissions

                </span>

                <span className="flex items-center gap-1.5">

                  <Users className="w-3.5 h-3.5 text-urja-primary/80" />

                  {count} user{count !== 1 ? 's' : ''}

                </span>

              </div>



              <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-200/80 dark:border-[#3d3c52]">

                {role.permissions.slice(0, 6).map(p => (

                  <span

                    key={p}

                    className="text-[10px] bg-slate-100 dark:bg-white/[0.06] border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded-md capitalize"

                  >

                    {formatPermissionLabel(p)}

                  </span>

                ))}

                {role.permissions.length > 6 && (

                  <span className="text-[10px] text-slate-400 dark:text-slate-500 px-1 self-center">

                    +{role.permissions.length - 6} more

                  </span>

                )}

              </div>

            </div>

          );

        })}

      </div>



      {showModal && (

        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center z-[100] p-4 animate-fade-in">

          <div className="bg-white dark:bg-[#1e1d2e] rounded-2xl border border-slate-150 dark:border-[#3d3c52] shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-scale-up">

            <div className="flex justify-between items-center border-b border-slate-100 dark:border-[#3d3c52] p-5 shrink-0">

              <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase tracking-wider">

                {editingId ? 'Edit Role' : 'Create Role'}

              </h3>

              <button type="button" onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">

                <X className="w-5 h-5" />

              </button>

            </div>



            <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0">

              <div className="p-5 space-y-4 overflow-y-auto flex-1">

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                  <div className="space-y-1">

                    <label className="block font-semibold text-slate-600 dark:text-slate-300 text-xs">Role Name *</label>

                    <input

                      type="text"

                      required

                      disabled={form.isSystem}

                      value={form.name}

                      onChange={e => setForm(f => ({ ...f, name: e.target.value }))}

                      placeholder="e.g. Support Lead"

                      className="w-full text-xs p-2.5 border border-slate-200 dark:border-[#3d3c52] rounded-xl focus:outline-none disabled:opacity-60"

                    />

                    {form.isSystem && (

                      <p className="text-[10px] text-slate-400">System role names cannot be changed.</p>

                    )}

                  </div>

                  <div className="space-y-1">

                    <label className="block font-semibold text-slate-600 dark:text-slate-300 text-xs">Description</label>

                    <input

                      type="text"

                      value={form.description}

                      onChange={e => setForm(f => ({ ...f, description: e.target.value }))}

                      placeholder="Brief description of this role"

                      className="w-full text-xs p-2.5 border border-slate-200 dark:border-[#3d3c52] rounded-xl focus:outline-none"

                    />

                  </div>

                </div>



                <div className="space-y-4 pt-2">

                  <p className="font-semibold text-slate-700 dark:text-slate-200 text-xs uppercase tracking-wider">Permissions</p>

                  {PERMISSION_GROUPS.map(group => {

                    const groupKeys = group.permissions.map(p => p.key);

                    const allSelected = groupKeys.every(k => form.permissions.includes(k));

                    const someSelected = groupKeys.some(k => form.permissions.includes(k));

                    return (

                      <div key={group.label} className="border border-slate-150 dark:border-[#3d3c52] rounded-xl overflow-hidden">

                        <div className="flex items-center justify-between bg-slate-50 dark:bg-[#161525] px-4 py-2.5 border-b border-slate-100 dark:border-[#3d3c52]">

                          <span className="font-semibold text-slate-700 dark:text-slate-200 text-sm">{group.label}</span>

                          <button

                            type="button"

                            onClick={() => toggleGroup(groupKeys, !allSelected)}

                            className="text-[10px] font-medium text-urja-primary hover:text-urja-secondary"

                          >

                            {allSelected ? 'Deselect all' : someSelected ? 'Select all' : 'Select all'}

                          </button>

                        </div>

                        <div className="p-3 space-y-1">

                          {group.permissions.map(perm => (

                            <label

                              key={perm.key}

                              className="flex items-start gap-3 p-2 rounded-lg hover:bg-slate-50 dark:hover:bg-white/[0.04] cursor-pointer"

                            >

                              <input

                                type="checkbox"

                                checked={form.permissions.includes(perm.key)}

                                onChange={() => togglePermission(perm.key)}

                                className="mt-0.5 rounded border-slate-300 text-urja-primary focus:ring-urja-primary"

                              />

                              <div>

                                <span className="font-medium text-slate-800 dark:text-slate-100 block text-sm">{perm.label}</span>

                                <span className="text-xs text-slate-500 dark:text-slate-400">{perm.description}</span>

                              </div>

                            </label>

                          ))}

                        </div>

                      </div>

                    );

                  })}

                </div>

              </div>



              <div className="p-5 border-t border-slate-100 dark:border-[#3d3c52] flex justify-end gap-2 shrink-0">

                <button

                  type="button"

                  onClick={() => setShowModal(false)}

                  className="px-4 py-2 border border-slate-200 dark:border-[#3d3c52] text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-50 dark:hover:bg-white/[0.04] text-sm"

                >

                  Cancel

                </button>

                <button

                  type="submit"

                  className="px-4 py-2 bg-urja-primary hover:bg-urja-primary/90 text-white font-medium rounded-xl shadow-xs text-sm"

                >

                  {editingId ? 'Save Changes' : 'Create Role'}

                </button>

              </div>

            </form>

          </div>

        </div>

      )}

    </div>

  );

}


