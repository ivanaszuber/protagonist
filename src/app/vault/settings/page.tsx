'use client'

import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { TopNav } from '@/components/TopNav'
import {
  computeFireTrajectoryYear,
  computeVaultDerived,
  formatGbp,
  type BudgetCategory,
  type VaultSettings,
} from '@/lib/vault'
import { getUserId } from '@/lib/user'

const inputStyle: CSSProperties = {
  background: '#0D0820',
  border: '0.5px solid #3D2070',
  borderRadius: 8,
  padding: '4px 10px',
  fontSize: 13,
  color: '#E8E0F0',
  textAlign: 'right',
  width: 100,
  fontFamily: 'inherit',
}

function SectionCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div
      style={{
        background: '#140C28',
        border: '0.5px solid #2D1B55',
        borderRadius: 14,
        marginBottom: 12,
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '10px 14px',
          fontSize: 10,
          color: '#5A4A7A',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          borderBottom: '0.5px solid #1A0D35',
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function Row({
  label,
  icon,
  value,
  onChange,
  readOnly,
  suffix,
}: {
  label: string
  icon?: string
  value: string | number
  onChange?: (v: string) => void
  readOnly?: boolean
  suffix?: string
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '0.5px solid #1A0D35',
        gap: 10,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: 1, minWidth: 0 }}>
        {icon && (
          <span
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: icon,
              flexShrink: 0,
            }}
          />
        )}
        <span style={{ fontSize: 13, color: '#C0B0E0' }}>{label}</span>
      </div>
      {readOnly ? (
        <span style={{ fontSize: 13, color: '#E8E0F0', fontWeight: 500 }}>
          {value}
          {suffix}
        </span>
      ) : (
        <input
          type={typeof value === 'number' ? 'number' : 'text'}
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          style={inputStyle}
        />
      )}
    </div>
  )
}

export default function VaultSettingsPage() {
  const router = useRouter()
  const userId = getUserId()
  const [form, setForm] = useState<VaultSettings | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState(false)

  useEffect(() => {
    void fetch(`/api/vault/settings?userId=${encodeURIComponent(userId)}`)
      .then((r) => r.json())
      .then((d: { settings: VaultSettings }) => {
        setForm(d.settings)
      })
      .catch(() => {})
  }, [userId])

  function patch<K extends keyof VaultSettings>(key: K, value: VaultSettings[K]) {
    setForm((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  function patchCategory(index: number, budget: number) {
    setForm((prev) => {
      if (!prev) return prev
      const categories = [...prev.budget_categories]
      categories[index] = { ...categories[index], budget }
      return { ...prev, budget_categories: categories }
    })
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    try {
      await fetch('/api/vault/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, patch: form }),
      })
      setToast(true)
      setTimeout(() => {
        setToast(false)
        router.back()
      }, 800)
      window.dispatchEvent(new CustomEvent('protagonist:vault-updated'))
    } finally {
      setSaving(false)
    }
  }

  if (!form) {
    return (
      <div style={{ minHeight: '100vh', background: '#0D0820', color: '#5A4A7A', padding: 24 }}>
        <TopNav />
        Loading...
      </div>
    )
  }

  const derived = computeVaultDerived(form)
  const fireYear = computeFireTrajectoryYear(form)
  const budgetTotal = form.budget_categories.reduce((s, c) => s + c.budget, 0)

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D0820',
        color: '#E8E0F0',
        paddingBottom: 100,
      }}
    >
      <TopNav />
      <div style={{ padding: '16px 16px 0', maxWidth: 480, margin: '0 auto' }}>
        <button
          type="button"
          onClick={() => router.back()}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#5A4A7A',
            fontSize: 12,
            cursor: 'pointer',
            marginBottom: 12,
            fontFamily: 'inherit',
          }}
        >
          ← Back
        </button>
        <h1 style={{ fontSize: 18, fontWeight: 500, margin: '0 0 16px' }}>Vault settings</h1>

        <SectionCard title="Net worth">
          <Row
            label="Invested (£)"
            value={form.invested}
            onChange={(v) => patch('invested', Number(v) || 0)}
          />
          <Row
            label="Cash & savings (£)"
            value={form.cash}
            onChange={(v) => patch('cash', Number(v) || 0)}
          />
          <Row
            label="Total net worth"
            value={formatGbp(derived.totalNetWorth)}
            readOnly
          />
        </SectionCard>

        <SectionCard title="Income">
          <Row
            label="Monthly net income (£)"
            value={form.monthly_income}
            onChange={(v) => patch('monthly_income', Number(v) || 0)}
          />
          <Row
            label="Monthly savings target (£)"
            value={form.monthly_savings_target}
            onChange={(v) => patch('monthly_savings_target', Number(v) || 0)}
          />
        </SectionCard>

        <SectionCard title="Monthly budget">
          {form.budget_categories.map((cat: BudgetCategory, i: number) => (
            <div
              key={cat.key}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '10px 14px',
                borderBottom: '0.5px solid #1A0D35',
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: cat.color,
                  flexShrink: 0,
                }}
              />
              <span style={{ fontSize: 12, color: '#C0B0E0', flex: 1, minWidth: 0 }}>
                {cat.label}
              </span>
              <div
                style={{
                  width: 48,
                  height: 4,
                  background: '#1E0D40',
                  borderRadius: 2,
                  overflow: 'hidden',
                  flexShrink: 0,
                }}
              >
                <div
                  style={{
                    height: '100%',
                    width: `${form.monthly_income > 0 ? Math.min(100, (cat.budget / form.monthly_income) * 100) : 0}%`,
                    background: cat.color,
                  }}
                />
              </div>
              <input
                type="number"
                value={cat.budget}
                onChange={(e) => patchCategory(i, Number(e.target.value) || 0)}
                style={{ ...inputStyle, width: 72 }}
              />
            </div>
          ))}
          <Row label="Total budget" value={formatGbp(budgetTotal)} readOnly />
          <Row
            label="Monthly surplus"
            value={formatGbp(derived.monthlySurplus)}
            readOnly
          />
        </SectionCard>

        <SectionCard title="Investments & growth">
          <Row
            label="Expected return p.a. (%)"
            value={form.expected_return_rate}
            onChange={(v) => patch('expected_return_rate', Number(v) || 0)}
          />
          <Row
            label="ISA allowance used (£)"
            value={form.isa_allowance_used}
            onChange={(v) => patch('isa_allowance_used', Number(v) || 0)}
          />
          <Row
            label="Shadow compound rate (%)"
            value={form.shadow_interest_rate}
            onChange={(v) => patch('shadow_interest_rate', Number(v) || 0)}
          />
        </SectionCard>

        <SectionCard title="FIRE target">
          <Row
            label="FIRE number (£)"
            value={form.fire_number}
            onChange={(v) => patch('fire_number', Number(v) || 0)}
          />
          <Row
            label="Target year"
            value={form.fire_target_year}
            onChange={(v) => patch('fire_target_year', Number(v) || 2030)}
          />
          <Row
            label="Annual spend in FIRE (£)"
            value={form.fire_annual_spend}
            onChange={(v) => patch('fire_annual_spend', Number(v) || 0)}
          />
          <Row
            label="On current trajectory"
            value={fireYear ? String(fireYear) : '—'}
            readOnly
          />
        </SectionCard>

        <SectionCard title="Short-term goal (coin tracker)">
          <Row
            label="Net worth goal (£)"
            value={form.nw_goal}
            onChange={(v) => patch('nw_goal', Number(v) || 0)}
          />
          <Row
            label="Goal deadline"
            value={form.nw_goal_deadline ?? ''}
            onChange={(v) => patch('nw_goal_deadline', v || null)}
          />
          <Row
            label="Each coin = (£)"
            value={form.coin_denomination}
            onChange={(v) => patch('coin_denomination', Number(v) || 10000)}
          />
        </SectionCard>

        {toast && (
          <div
            style={{
              textAlign: 'center',
              fontSize: 12,
              color: '#1D9E75',
              marginBottom: 8,
            }}
          >
            Saved ✓
          </div>
        )}

        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          style={{
            width: '100%',
            padding: '14px',
            background: '#1D9E75',
            color: '#012A1E',
            border: 'none',
            borderRadius: 12,
            fontSize: 14,
            fontWeight: 600,
            cursor: saving ? 'default' : 'pointer',
            opacity: saving ? 0.7 : 1,
            fontFamily: 'inherit',
          }}
        >
          {saving ? 'Saving...' : 'Save vault settings'}
        </button>
      </div>
    </div>
  )
}
