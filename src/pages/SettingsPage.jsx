import { useEffect, useRef, useState } from 'react'
import Header from '../components/layout/Header.jsx'
import { supabase } from '../lib/supabase.js'
import { useAuth } from '../context/AuthContext.jsx'

const BUCKET = 'workspace-logos'

function Section({ title, description, children }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-6">
      <div className="px-6 py-5 border-b border-gray-100">
        <h2 className="font-sans font-semibold text-gray-900 text-sm">{title}</h2>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <div className="px-6 py-5 flex flex-col gap-5">{children}</div>
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-1.5">{hint}</p>}
      {children}
    </div>
  )
}

function SaveBar({ saving, msg, label, disabled }) {
  const isError = msg?.startsWith('Error')
  return (
    <div className="flex items-center justify-end gap-3 pt-2">
      {msg && (
        <span className={`flex items-center gap-1.5 text-sm font-medium ${isError ? 'text-red-500' : 'text-green-600'}`}>
          {!isError && (
            <svg className="w-4 h-4 shrink-0" viewBox="0 0 20 20" fill="currentColor">
              <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
            </svg>
          )}
          {msg}
        </span>
      )}
      <button
        type="submit"
        disabled={saving || disabled}
        className="flex items-center gap-2 px-5 py-2.5 bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white text-sm font-semibold rounded-lg transition-colors"
      >
        {saving && (
          <svg className="w-3.5 h-3.5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z" />
          </svg>
        )}
        {saving ? 'Saving…' : label}
      </button>
    </div>
  )
}

const input = 'w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent'
const textarea = `${input} resize-y min-h-[100px]`

export default function SettingsPage({ onBack, onNavigate }) {
  const { workspace } = useAuth()

  const [branding, setBranding] = useState({
    company_name:         '',
    company_logo_url:     '',
    brand_colour:         '#ea580c',
    tagline:              '',
    company_address:      '',
    company_phone:        '',
    company_email:        '',
    company_registration: '',
    designer_name:        '',
    designer_position:    '',
    footer_message:       'Thank you for your business.',
    pdf_layout:           'modern',
    default_currency:     'USD',
  })
  const [tc, setTc] = useState('')

  const [loading,       setLoading]       = useState(true)
  const [loadError,     setLoadError]     = useState('')
  const [loadAttempt,   setLoadAttempt]   = useState(0)
  const [savingBrand,   setSavingBrand]   = useState(false)
  const [brandMsg,      setBrandMsg]      = useState('')
  const [savingTc,      setSavingTc]      = useState(false)
  const [tcMsg,         setTcMsg]         = useState('')
  const [logoUploading, setLogoUploading] = useState(false)
  const [logoError,     setLogoError]     = useState('')
  const logoInputRef  = useRef(null)
  const flashTimers   = useRef([])

  // track if either save is running so the other can show as disabled
  const anySaving = savingBrand || savingTc

  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data, error } = await supabase
          .from('workspace_settings')
          .select('*')
          .eq('workspace_id', workspace.id)
          .maybeSingle()
        if (cancelled) return
        if (error) throw error
        if (data) {
          setBranding({
            company_name:         data.company_name         ?? '',
            company_logo_url:     data.company_logo_url     ?? '',
            brand_colour:         data.brand_colour         ?? '#ea580c',
            tagline:              data.tagline              ?? '',
            company_address:      data.company_address      ?? '',
            company_phone:        data.company_phone        ?? '',
            company_email:        data.company_email        ?? '',
            company_registration: data.company_registration ?? '',
            designer_name:        data.designer_name        ?? '',
            designer_position:    data.designer_position    ?? '',
            footer_message:       data.footer_message       ?? 'Thank you for your business.',
            pdf_layout:           data.pdf_layout           ?? 'modern',
            default_currency:     data.default_currency     ?? 'USD',
          })
          setTc(data.terms_and_conditions ?? '')
        }
      } catch (err) {
        if (!cancelled) setLoadError(err.message || 'Failed to load settings.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      flashTimers.current.forEach(clearTimeout)
    }
  }, [workspace.id, loadAttempt])

  function setBrand(field) {
    return e => setBranding(prev => ({ ...prev, [field]: e.target.value }))
  }

  function flashMsg(setMsg, msg) {
    setMsg(msg)
    const t = setTimeout(() => setMsg(''), 6000)
    flashTimers.current.push(t)
  }

  async function handleSaveBranding(e) {
    e.preventDefault()
    if (savingBrand || savingTc) return
    console.log('[Settings] branding save: start')
    setSavingBrand(true)
    setBrandMsg('')

    try {
      const payload = { workspace_id: workspace.id, ...branding }
      console.log('[Settings] branding save: calling upsert')
      const { error } = await supabase
        .from('workspace_settings')
        .upsert(payload, { onConflict: 'workspace_id' })
      console.log('[Settings] branding save: upsert returned', { error })
      if (error) throw new Error(error.message)
      console.log('[Settings] branding save: success — unblocking button now')
      setSavingBrand(false)
      flashMsg(setBrandMsg, 'Saved.')
      console.log('[Settings] branding save: done')
    } catch (err) {
      console.error('[Settings] branding save: error', err)
      setSavingBrand(false)
      flashMsg(setBrandMsg, `Error: ${err.message}`)
    }
  }

  async function handleSaveTc(e) {
    e.preventDefault()
    if (savingBrand || savingTc) return
    console.log('[Settings] T&C save: start, length:', tc?.length)
    setSavingTc(true)
    setTcMsg('')

    try {
      console.log('[Settings] T&C save: calling update')
      const { error } = await supabase
        .from('workspace_settings')
        .update({ terms_and_conditions: tc })
        .eq('workspace_id', workspace.id)
      console.log('[Settings] T&C save: update returned', { error })
      if (error) throw new Error(error.message)
      console.log('[Settings] T&C save: success — unblocking button now')
      setSavingTc(false)
      flashMsg(setTcMsg, 'Saved.')
      console.log('[Settings] T&C save: done')
    } catch (err) {
      console.error('[Settings] T&C save: error', err)
      setSavingTc(false)
      flashMsg(setTcMsg, `Error: ${err.message}`)
    }
  }

  async function handleLogoUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) {
      setLogoError('File must be under 2 MB.')
      return
    }
    setLogoUploading(true)
    setLogoError('')
    try {
      const ext  = file.name.split('.').pop()
      const path = `${workspace.id}/logo.${ext}`
      await supabase.storage.from(BUCKET).remove([path])
      const { error: uploadErr } = await supabase.storage
        .from(BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type })
      if (uploadErr) throw new Error(uploadErr.message)
      const { data: { publicUrl } } = supabase.storage.from(BUCKET).getPublicUrl(path)
      setBranding(prev => ({ ...prev, company_logo_url: `${publicUrl}?t=${Date.now()}` }))
    } catch (err) {
      setLogoError(err.message || 'Upload failed. Please try again.')
    } finally {
      setLogoUploading(false)
    }
  }

  async function handleRemoveLogo() {
    setBranding(prev => ({ ...prev, company_logo_url: '' }))
    const exts = ['png', 'jpg', 'jpeg', 'webp', 'svg']
    await Promise.all(
      exts.map(ext => supabase.storage.from(BUCKET).remove([`${workspace.id}/logo.${ext}`]))
    )
  }

  if (loading || loadError) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Header onBack={onBack} onNavigate={onNavigate} />
        <div className="flex flex-col items-center justify-center h-64 gap-3">
          {loadError ? (
            <>
              <p className="text-sm text-red-500">{loadError}</p>
              <button
                onClick={() => { setLoadError(''); setLoading(true); setLoadAttempt(n => n + 1) }}
                className="text-sm font-medium text-brand-600 hover:underline"
              >
                Try again
              </button>
            </>
          ) : (
            <p className="text-sm text-gray-400">Loading settings…</p>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onBack={onBack} onNavigate={onNavigate} />

      <main className="max-w-2xl mx-auto px-4 sm:px-6 py-10 pb-16">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
          <p className="text-sm text-gray-500 mt-1">{workspace.name}</p>
        </div>

        {/* ── Branding form ── */}
        <form onSubmit={handleSaveBranding} noValidate>
          <Section title="Company Branding" description="Used on quotes and PDFs.">

            <Field label="Company Logo" hint="PNG, JPG, WebP or SVG · max 2 MB">
              <div className="flex items-start gap-4">
                {branding.company_logo_url ? (
                  <div className="relative shrink-0">
                    <img
                      src={branding.company_logo_url}
                      alt="Company logo"
                      className="h-16 w-auto max-w-[160px] rounded-lg border border-gray-200 object-contain bg-white p-1"
                    />
                    <button
                      type="button"
                      onClick={handleRemoveLogo}
                      className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center hover:bg-red-600"
                      title="Remove logo"
                    >×</button>
                  </div>
                ) : (
                  <div className="shrink-0 h-16 w-24 rounded-lg border-2 border-dashed border-gray-200 flex items-center justify-center bg-gray-50">
                    <svg className="w-6 h-6 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15.75l5.159-5.159a2.25 2.25 0 013.182 0l5.159 5.159m-1.5-1.5l1.409-1.409a2.25 2.25 0 013.182 0l2.909 2.909M3.75 18h16.5M21 12V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v12" />
                    </svg>
                  </div>
                )}
                <div className="flex flex-col gap-2">
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    disabled={logoUploading}
                    className="px-4 py-2 text-sm font-medium border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                  >
                    {logoUploading ? 'Uploading…' : branding.company_logo_url ? 'Replace logo' : 'Upload logo'}
                  </button>
                  {logoError && <p className="text-xs text-red-500">{logoError}</p>}
                </div>
                <input
                  ref={logoInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
                  className="hidden"
                  onChange={handleLogoUpload}
                />
              </div>
            </Field>

            <Field label="Company Name">
              <input className={input} value={branding.company_name} onChange={setBrand('company_name')} placeholder="Smith Renovations Pty Ltd" />
            </Field>

            <Field label="Brand Primary Colour">
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding.brand_colour}
                  onChange={setBrand('brand_colour')}
                  className="h-10 w-14 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={branding.brand_colour}
                  onChange={setBrand('brand_colour')}
                  placeholder="#ea580c"
                  className="w-32 px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-brand-500 font-mono"
                />
              </div>
            </Field>

            <Field label="Tagline / Slogan">
              <input className={input} value={branding.tagline} onChange={setBrand('tagline')} placeholder="Quality renovations, delivered on time." />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Company Phone">
                <input className={input} value={branding.company_phone} onChange={setBrand('company_phone')} placeholder="+1 (555) 000-0000" />
              </Field>
              <Field label="Company Email">
                <input type="email" className={input} value={branding.company_email} onChange={setBrand('company_email')} placeholder="info@yourcompany.com" />
              </Field>
            </div>

            <Field label="Company Address">
              <input className={input} value={branding.company_address} onChange={setBrand('company_address')} placeholder="123 Main Street, Suite 100" />
            </Field>

            <Field label="Company Registration Number" hint="UEN or other registration number">
              <input className={input} value={branding.company_registration} onChange={setBrand('company_registration')} placeholder="202312345A" />
            </Field>

            <div className="grid sm:grid-cols-2 gap-4">
              <Field label="Designer Name" hint="Appears on quote PDF signature block">
                <input className={input} value={branding.designer_name} onChange={setBrand('designer_name')} placeholder="Jane Smith" />
              </Field>
              <Field label="Designer Position">
                <input className={input} value={branding.designer_position} onChange={setBrand('designer_position')} placeholder="Interior Designer" />
              </Field>
            </div>
          </Section>

          <Section title="Quote Footer" description="Footer message on every quote PDF.">
            <Field label="Footer Message">
              <input className={input} value={branding.footer_message} onChange={setBrand('footer_message')} placeholder="Thank you for your business." />
            </Field>
          </Section>

          <Section title="PDF Layout" description="Choose the visual style for exported quote PDFs.">
            <div className="grid sm:grid-cols-2 gap-4">
              {[
                {
                  value:   'modern',
                  label:   'Modern',
                  desc:    'Full brand colour header, light section bands, alternating row shading.',
                  swatches: ['#E8622A', '#f3f4f8', '#ffffff'],
                },
                {
                  value:   'classic',
                  label:   'Classic',
                  desc:    'Clean white background, brand colour accents only on headers and totals.',
                  swatches: ['#E8622A', '#ffffff', '#f5f7fa'],
                },
                {
                  value:   'bw',
                  label:   'B&W Minimalist',
                  desc:    'Pure black and white, no colour — bold typography and generous whitespace.',
                  swatches: ['#000000', '#f9f9f9', '#ffffff'],
                },
                {
                  value:   'dark',
                  label:   'Dark Mode',
                  desc:    'Near-black background, white text, orange grand total accent — premium dark feel.',
                  swatches: ['#0D0D0D', '#1A1A1A', '#E8622A'],
                },
                {
                  value:   'warm',
                  label:   'Warm Luxury',
                  desc:    'Ivory background, warm brown text, gold accents — high-end residential feel.',
                  swatches: ['#FDFAF5', '#C9A96E', '#2C1810'],
                },
                {
                  value:   'editorial',
                  label:   'Editorial',
                  desc:    'Bold magazine-style layout, oversized typography, strong orange accents.',
                  swatches: ['#ffffff', '#E8622A', '#000000'],
                },
              ].map(({ value, label, desc, swatches }) => {
                const selected = branding.pdf_layout === value
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setBranding(prev => ({ ...prev, pdf_layout: value }))}
                    className={`text-left px-4 py-4 rounded-xl border-2 transition-colors ${selected ? 'border-brand-600 bg-brand-50' : 'border-gray-200 hover:border-gray-300'}`}
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-brand-600' : 'border-gray-300'}`}>
                        {selected && <div className="w-2 h-2 rounded-full bg-brand-600"/>}
                      </div>
                      <span className={`text-sm font-semibold ${selected ? 'text-brand-700' : 'text-gray-700'}`}>{label}</span>
                      <div className="flex gap-1 ml-auto">
                        {swatches.map((c, i) => (
                          <div key={i} className="w-3.5 h-3.5 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: c }} />
                        ))}
                      </div>
                    </div>
                    <p className="text-xs text-gray-500 leading-relaxed pl-6">{desc}</p>
                  </button>
                )
              })}
            </div>
          </Section>

          <Section title="Quote Defaults" description="Default settings applied to every new quote.">
            <Field label="Default Currency" hint="Used for all new quotes. Individual quotes can override this.">
              <select
                className={input}
                value={branding.default_currency}
                onChange={setBrand('default_currency')}
              >
                {[
                  { code: 'SGD', label: 'SGD — Singapore Dollar (S$)' },
                  { code: 'USD', label: 'USD — US Dollar ($)'         },
                  { code: 'MYR', label: 'MYR — Malaysian Ringgit (RM)'},
                  { code: 'AUD', label: 'AUD — Australian Dollar (A$)'},
                  { code: 'GBP', label: 'GBP — British Pound (£)'     },
                  { code: 'EUR', label: 'EUR — Euro (€)'              },
                  { code: 'HKD', label: 'HKD — Hong Kong Dollar (HK$)'},
                ].map(({ code, label }) => (
                  <option key={code} value={code}>{label}</option>
                ))}
              </select>
            </Field>
          </Section>

          <SaveBar saving={savingBrand} msg={brandMsg} label="Save Branding" disabled={anySaving && !savingBrand} />
        </form>

        {/* ── T&C form ── */}
        <form onSubmit={handleSaveTc} noValidate className="mt-8">
          <Section title="Terms &amp; Conditions" description="Printed on the final page of every quote PDF.">
            <div>
              <textarea
                className={textarea}
                value={tc}
                onChange={e => setTc(e.target.value)}
                rows={12}
                placeholder={"1. All prices are in the currency stated on this quote.\n2. A 30% deposit is required upon acceptance.\n3. This quote is valid for 30 days from the date issued.\n4. …"}
              />
              <p className="text-xs text-gray-400 mt-1.5 text-right">
                {tc.length.toLocaleString()} characters
              </p>
            </div>
          </Section>

          <SaveBar saving={savingTc} msg={tcMsg} label="Save Terms & Conditions" disabled={anySaving && !savingTc} />
        </form>

        {/* ── Help & Support ── */}
        <div className="mt-12 mb-16">
          <div className="border-t border-gray-200 mb-8" />
          <h2 className="font-sans text-lg font-bold text-gray-900 mb-1">Need help? We're here.</h2>
          <p className="text-sm text-gray-400 mb-6">Reach our team through any of the channels below.</p>

          <div className="grid sm:grid-cols-3 gap-4">

            {/* WhatsApp */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
              <div className="w-10 h-10 bg-green-100 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-green-600">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm mb-0.5">Chat with us</p>
                <p className="text-xs text-gray-400">Typically replies in minutes</p>
              </div>
              <a
                href="https://wa.me/6596702141"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full text-center py-2 rounded-lg text-sm font-semibold bg-green-500 hover:bg-green-600 text-white transition-colors"
              >
                Open WhatsApp
              </a>
            </div>

            {/* Email */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
              <div className="w-10 h-10 bg-brand-100 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-brand-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm mb-0.5">Send an email</p>
                <p className="text-xs text-gray-400">info@catchquote.io</p>
              </div>
              <a
                href="mailto:info@catchquote.io"
                className="block w-full text-center py-2 rounded-lg text-sm font-semibold bg-brand-600 hover:bg-brand-700 text-white transition-colors"
              >
                Send Email
              </a>
            </div>

            {/* Phone */}
            <div className="bg-white rounded-xl border border-gray-200 p-5 flex flex-col gap-4">
              <div className="w-10 h-10 bg-blue-100 rounded-xl flex items-center justify-center">
                <svg viewBox="0 0 24 24" fill="none" strokeWidth={2} stroke="currentColor" className="w-5 h-5 text-blue-600">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 002.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 01-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 00-1.091-.852H4.5A2.25 2.25 0 002.25 4.5v2.25z"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-gray-900 text-sm mb-0.5">Give us a call</p>
                <p className="text-xs text-gray-400">+65 9670 2141</p>
              </div>
              <a
                href="tel:+6596702141"
                className="block w-full text-center py-2 rounded-lg text-sm font-semibold bg-blue-500 hover:bg-blue-600 text-white transition-colors"
              >
                Call Now
              </a>
            </div>

          </div>

          <p className="text-xs text-gray-400 text-center mt-5">
            Support hours: Monday – Friday, 9am – 6pm SGT
          </p>
        </div>

      </main>
    </div>
  )
}
