'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { Dictionary } from '@/lib/i18n';
import { ConfirmDialog } from './ConfirmDialog';

export function DeleteProjectButton({
  projectId,
  dict,
}: {
  readonly projectId: string;
  readonly dict: Dictionary;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function remove() {
    setBusy(true);
    try {
      const response = await fetch(`/api/projects/${projectId}`, { method: 'DELETE' });
      if (response.ok) router.push('/projects');
    } finally {
      setBusy(false);
      setOpen(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="text-xs text-[var(--muted)] transition hover:text-red-300"
      >
        {dict.projects.remove}
      </button>

      <ConfirmDialog
        open={open}
        title={dict.projects.removeTitle}
        body={dict.projects.removeBody}
        confirmLabel={busy ? dict.projects.removing : dict.projects.removeConfirm}
        cancelLabel={dict.common.close}
        destructive
        onConfirm={remove}
        onCancel={() => setOpen(false)}
      />
    </>
  );
}
