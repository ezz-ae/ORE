'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Modal, fieldClass, buttonClass } from '@/components/freehold/ui'
import { toast } from 'sonner'
import { useT } from '@/lib/i18n/provider'
import { useSession } from '@/lib/freehold/use-session'

const MANAGEMENT = ['admin', 'sales_manager', 'director', 'ceo']

/**
 * Create a direct lead. A broker creates a lead for themselves; management can
 * assign it to any broker. Posts to /api/freehold/crm/leads.
 */
export function AddLeadModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const t = useT()
  const router = useRouter()
  const { user } = useSession()
  const isManagement = MANAGEMENT.includes(user?.role ?? '')

  const [form, setForm] = useState({ name: '', phone: '', email: '', interest: '', budgetAed: '', source: 'Direct', message: '' })
  const [assignedBrokerId, setAssignedBrokerId] = useState('')
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([])
  const [busy, setBusy] = useState(false)

  // Management can assign to any broker; load the roster (broker side gets []).
  useEffect(() => {
    if (!open || !isManagement) return
    fetch('/api/freehold/team', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.members) return
        setAgents(d.members.filter((m: { dbRole?: string }) => m.dbRole === 'broker').map((m: { id: string; name: string }) => ({ id: m.id, name: m.name })))
      })
      .catch(() => {})
  }, [open, isManagement])

  if (!open) return null

  function set<K extends keyof typeof form>(k: K, v: string) { setForm((f) => ({ ...f, [k]: v })) }

  async function submit() {
    if (!form.name.trim()) { toast.error(t('crm.addLeadForm.nameRequired')); return }
    setBusy(true)
    try {
      const res = await fetch('/api/freehold/crm/leads', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, ...(isManagement && assignedBrokerId ? { assignedBrokerId } : {}) }),
      })
      if (!res.ok) throw new Error()
      toast.success(t('crm.addLeadForm.created'))
      setForm({ name: '', phone: '', email: '', interest: '', budgetAed: '', source: 'Direct', message: '' })
      setAssignedBrokerId('')
      onClose()
      router.refresh()
    } catch {
      toast.error(t('crm.addLeadForm.failed'))
    } finally {
      setBusy(false)
    }
  }

  const field = fieldClass('lg')

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('crm.addLeadForm.title')}
      subtitle={isManagement ? t('crm.addLeadForm.subtitleMgmt') : t('crm.addLeadForm.subtitleSelf')}
      maxWidth="max-w-lg"
      footer={
        <>
          <button onClick={onClose} className={buttonClass('ghost', 'sm')}>
            {t('crm.addLeadForm.cancel')}
          </button>
          <button onClick={submit} disabled={busy} className={buttonClass('primary', 'sm')}>
            {busy ? t('crm.addLeadForm.creating') : t('crm.addLeadForm.create')}
          </button>
        </>
      }
    >
        <div className="space-y-3">
          <input className={field} placeholder={t('crm.addLeadForm.namePlaceholder')} value={form.name} onChange={(e) => set('name', e.target.value)} autoFocus />
          <div className="grid grid-cols-2 gap-3">
            <input className={field} placeholder={t('crm.addLeadForm.phonePlaceholder')} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            <input className={field} placeholder={t('crm.addLeadForm.emailPlaceholder')} value={form.email} onChange={(e) => set('email', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input className={field} placeholder={t('crm.addLeadForm.interestPlaceholder')} value={form.interest} onChange={(e) => set('interest', e.target.value)} />
            <input className={field} placeholder={t('crm.addLeadForm.budgetPlaceholder')} value={form.budgetAed} onChange={(e) => set('budgetAed', e.target.value)} inputMode="numeric" />
          </div>
          <input className={field} placeholder={t('crm.addLeadForm.sourcePlaceholder')} value={form.source} onChange={(e) => set('source', e.target.value)} />
          <textarea className={`${field} resize-none`} rows={3} placeholder={t('crm.addLeadForm.notePlaceholder')} value={form.message} onChange={(e) => set('message', e.target.value)} />

          {isManagement && agents.length > 0 && (
            <select className={field} value={assignedBrokerId} onChange={(e) => setAssignedBrokerId(e.target.value)}>
              <option value="">{t('crm.addLeadForm.assignUnassigned')}</option>
              {agents.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          )}
        </div>
    </Modal>
  )
}
