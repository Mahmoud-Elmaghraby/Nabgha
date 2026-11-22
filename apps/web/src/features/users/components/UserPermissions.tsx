import { useState } from 'react';
import { PERMISSION_GROUPS } from '@nabgha/types';

interface UserPermissionsProps {
  value: string[];
  onChange: (permissions: string[]) => void;
}

export function UserPermissions({ value, onChange }: UserPermissionsProps) {
  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const hasAll = value.includes('*');

  const toggle = (permission: string) => {
    if (value.includes(permission)) {
      onChange(value.filter((p) => p !== permission));
    } else {
      onChange([...value, permission]);
    }
  };

  const toggleGroup = (permissions: string[]) => {
    const allSelected = permissions.every((p) => value.includes(p));
    if (allSelected) {
      onChange(value.filter((p) => !permissions.includes(p)));
    } else {
      const newPerms = [...value];
      permissions.forEach((p) => { if (!newPerms.includes(p)) newPerms.push(p); });
      onChange(newPerms);
    }
  };

  const countSelected = (keys: string[]) => keys.filter((k) => value.includes(k)).length;

  if (hasAll) {
    return (
      <div className="bg-[#0E3B2E]/5 border border-[#0E3B2E]/20 rounded-xl p-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-[#D4AB53]/20 flex items-center justify-center">
            <svg className="w-5 h-5 text-[#D4AB53]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div>
            <p className="font-semibold text-[#0E3B2E] text-sm">كل الصلاحيات مفعّلة</p>
            <p className="text-gray-500 text-xs">هذا المستخدم لديه صلاحية كاملة على النظام</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => onChange([])}
          className="text-xs font-medium text-red-500 hover:text-red-600"
        >
          تخصيص الصلاحيات
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {PERMISSION_GROUPS.map((group) => {
        const groupKeys = group.permissions.map((p) => p.key);
        const allSelected = groupKeys.every((k) => value.includes(k));
        const selectedCount = countSelected(groupKeys);
        const isOpen = openGroup === group.group;

        return (
          <div key={group.group} className="border border-gray-200 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
              <div className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={(el) => { if (el) el.indeterminate = selectedCount > 0 && !allSelected; }}
                  onChange={() => toggleGroup(groupKeys)}
                  className="w-4 h-4 rounded accent-[#0E3B2E] cursor-pointer"
                />
                <span className="font-semibold text-sm text-gray-700">{group.groupLabel}</span>
                {selectedCount > 0 && (
                  <span className="text-xs bg-[#0E3B2E]/10 text-[#0E3B2E] px-2 py-0.5 rounded-full font-medium">
                    {selectedCount}/{groupKeys.length}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenGroup(isOpen ? null : group.group)}
                className="text-gray-400 hover:text-gray-600 p-1"
              >
                <svg className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="6 9 12 15 18 9"/></svg>
              </button>
            </div>

            {isOpen && (
              <div className="px-4 py-3 grid grid-cols-2 gap-2.5 border-t border-gray-100">
                {group.permissions.map((perm) => (
                  <label key={perm.key} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={value.includes(perm.key)}
                      onChange={() => toggle(perm.key)}
                      className="w-3.5 h-3.5 rounded accent-[#0E3B2E] cursor-pointer"
                    />
                    <span className="text-sm text-gray-600">{perm.label}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
