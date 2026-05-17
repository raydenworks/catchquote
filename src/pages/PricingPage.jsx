import { useState } from 'react'
import Header from '../components/layout/Header.jsx'
import { useAuth } from '../context/AuthContext.jsx'
import { supabase } from '../lib/supabase.js'

const ENTERPRISE_EMAIL = 'info@catchquote.io'
const PRO_PRICE_ID     = import.meta.env.VITE_STRIPE_PRO_PRICE_ID

const PRICING_TABLE = {
  SGD: { sym: 'S$',  proMo: 24.90, proYr: 249,  memMo: 10,   memYr: 100  },
  USD: { sym: '$',   proMo: 18.90, proYr: 189,  memMo: 7.50, memYr: 75   },
  MYR: { sym: 'RM',  proMo: 87,   proYr: 870,  memMo: 35,   memYr: 350  },
  AUD: { sym: 'A$',  proMo: 29,   proYr: 290,  memMo: 12,   memYr: 120  },
  GBP: { sym: '£',   proMo: 14.90, proYr: 149,  memMo: 6,    memYr: 60   },
  EUR: { sym: '€',   proMo: 17.50, proYr: 175,  memMo: 7,    memYr: 70   },
  HKD: { sym: 'HK$', proMo: 148,  proYr: 1480, memMo: 59,   memYr: 590  },
}
const CURRENCIES = ['SGD', 'USD', 'MYR', 'AUD', 'GBP', 'EUR', 'HKD']

function fmtPrice(sym, amount) {
  const n = Number.isInteger(amount)
    ? amount.toLocaleString()
    : amount.toFixed(2)
  return `${sym}${n}`
}

function CheckIcon({ dark = false }) {
  return (
    <svg className={`w-4 h-4 shrink-0 ${dark ? 'text-brand-400' : 'text-green-500'}`} fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  )
}

const TRIAL_FEATURES = [
  'Up to 3 quotes',
  'PDF export',
  'Preset library',
  'Single user only',
]

const PRO_FEATURES = [
  'Unlimited quotes',
  'PDF export',
  'Preset library',
  'Up to 3 team members',
  'Priority email support',
  'Custom workspace branding (coming soon)',
  'Client portal & e-signature (coming soon)',
]

const ENTERPRISE_FEATURES = [
  'Everything in Pro',
  'Unlimited team members',
  'White-label PDF branding',
  'Dedicated account manager',
  'Custom integrations',
  'SLA & priority support',
]

export default function PricingPage({ onNavigate }) {
  const { isTrial, workspace } = useAuth()
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [checkoutError,   setCheckoutError]   = useState('')
  const [billing,         setBilling]         = useState('monthly')
  const [currency,        setCurrency]        = useState('SGD')

  const p        = PRICING_TABLE[currency]
  const isAnnual = billing === 'annual'
  const proPrice = isAnnual ? p.proYr : p.proMo
  const memPrice = isAnnual ? p.memYr : p.memMo

  async function handleUpgrade() {
    if (!PRO_PRICE_ID) {
      setCheckoutError('Stripe is not configured yet. Contact support to upgrade.')
      return
    }
    setCheckoutLoading(true)
    setCheckoutError('')
    try {
      const { data, error } = await supabase.functions.invoke('create-checkout-session', {
        body: {
          workspace_id: workspace.id,
          price_id:     PRO_PRICE_ID,
          success_url:  `${window.location.origin}/?upgraded=true`,
          cancel_url:   `${window.location.origin}/`,
        },
      })
      if (error) throw new Error(error.message)
      if (data?.url) {
        window.location.href = data.url
      } else {
        throw new Error('No checkout URL returned.')
      }
    } catch (err) {
      setCheckoutError(err.message || 'Failed to start checkout. Please try again.')
      setCheckoutLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Header onNavigate={onNavigate} />

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-16 pb-20">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold text-gray-900 mb-3">Simple, honest pricing</h1>
          <p className="text-gray-500 text-base max-w-lg mx-auto">
            Start free, upgrade when you're ready. No hidden fees, no lock-in contracts.
          </p>
        </div>

        {/* ── Toggles ── */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-10">

          {/* Billing cycle toggle */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm">
            <button
              onClick={() => setBilling('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                billing === 'monthly' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setBilling('annual')}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                billing === 'annual' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:text-gray-800'
              }`}
            >
              Annual
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                billing === 'annual' ? 'bg-green-400 text-white' : 'bg-green-100 text-green-700'
              }`}>
                2 months free
              </span>
            </button>
          </div>

          {/* Currency toggle */}
          <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-xl p-1 shadow-sm flex-wrap justify-center">
            {CURRENCIES.map(cur => (
              <button
                key={cur}
                onClick={() => setCurrency(cur)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-colors ${
                  currency === cur ? 'bg-brand-600 text-white' : 'text-gray-500 hover:text-gray-800'
                }`}
              >
                {cur}
              </button>
            ))}
          </div>
        </div>

        {/* ── Cards ── */}
        <div className="grid sm:grid-cols-3 gap-6">

          {/* Trial */}
          <div className={`bg-white rounded-2xl border p-7 flex flex-col ${!isTrial ? 'border-gray-200 opacity-80' : 'border-yellow-300 ring-2 ring-yellow-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-gray-900 text-lg">Trial</p>
              {isTrial && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-yellow-50 text-yellow-700 ring-1 ring-yellow-200">
                  Current plan
                </span>
              )}
            </div>
            <p className="text-3xl font-bold text-gray-900 mb-1">Free</p>
            <p className="text-sm text-gray-500 mb-6">No credit card required</p>

            <ul className="space-y-3 mb-8 flex-1">
              {TRIAL_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <CheckIcon />{f}
                </li>
              ))}
            </ul>

            <button
              disabled
              className="w-full py-2.5 rounded-xl text-sm font-semibold bg-gray-100 text-gray-400 cursor-not-allowed"
            >
              {isTrial ? 'Current plan' : 'Downgrade not available'}
            </button>
          </div>

          {/* Pro */}
          <div className={`rounded-2xl border p-7 flex flex-col ${isTrial ? 'bg-white border-brand-300 ring-2 ring-brand-200' : 'bg-white border-green-300 ring-2 ring-green-200'}`}>
            <div className="flex items-center justify-between mb-1">
              <p className="font-bold text-gray-900 text-lg">Pro</p>
              {!isTrial && (
                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-50 text-green-700 ring-1 ring-green-200">
                  Current plan
                </span>
              )}
            </div>
            <div className="flex items-end gap-1 mb-0.5">
              <p className="text-3xl font-bold text-gray-900">{fmtPrice(p.sym, proPrice)}</p>
              <p className="text-gray-500 text-sm mb-1">/{isAnnual ? 'year' : 'month'}</p>
            </div>
            <p className="text-sm text-gray-500 mb-1">Per workspace · billed {billing}</p>
            <p className="text-xs text-gray-400 mb-6">
              +{fmtPrice(p.sym, memPrice)}/user for additional members
            </p>

            <ul className="space-y-3 mb-8 flex-1">
              {PRO_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-600">
                  <CheckIcon />{f}
                </li>
              ))}
            </ul>

            {isTrial ? (
              <div>
                {checkoutError && (
                  <p className="text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-3">{checkoutError}</p>
                )}
                <button
                  onClick={handleUpgrade}
                  disabled={checkoutLoading}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white transition-colors"
                >
                  {checkoutLoading ? 'Redirecting to checkout…' : 'Upgrade to Pro'}
                </button>
              </div>
            ) : (
              <button
                disabled
                className="w-full py-2.5 rounded-xl text-sm font-semibold bg-green-50 text-green-700 cursor-default"
              >
                Active
              </button>
            )}
          </div>

          {/* Enterprise */}
          <div className="bg-gray-900 rounded-2xl border border-gray-700 p-7 flex flex-col">
            <div className="mb-1">
              <p className="font-bold text-white text-lg">Enterprise</p>
            </div>
            <p className="text-3xl font-bold text-white mb-1">Custom</p>
            <p className="text-sm text-gray-400 mb-6">Contact us for pricing</p>

            <ul className="space-y-3 mb-8 flex-1">
              {ENTERPRISE_FEATURES.map(f => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-gray-300">
                  <CheckIcon dark />{f}
                </li>
              ))}
            </ul>

            <a
              href={`mailto:${ENTERPRISE_EMAIL}?subject=CatchQuote%20Enterprise&body=Hi%2C%20I%27m%20interested%20in%20CatchQuote%20Enterprise%20for%20my%20firm.`}
              className="block w-full py-2.5 rounded-xl text-sm font-semibold text-center bg-white hover:bg-gray-100 text-gray-900 transition-colors"
            >
              Contact us
            </a>
          </div>
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          All payments processed in SGD via Stripe.
        </p>
        <p className="text-center text-sm text-gray-400 mt-3">
          Questions? Email us at{' '}
          <a href={`mailto:${ENTERPRISE_EMAIL}`} className="text-brand-600 hover:text-brand-700 font-medium">
            {ENTERPRISE_EMAIL}
          </a>
        </p>
      </main>
    </div>
  )
}
