import { useState, useEffect } from 'react'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import Dashboard from './pages/Dashboard.jsx'
import QuotePage from './pages/QuotePage.jsx'
import TeamPage from './pages/TeamPage.jsx'
import PresetsPage from './pages/PresetsPage.jsx'
import SettingsPage from './pages/SettingsPage.jsx'
import PricingPage from './pages/PricingPage.jsx'
import BillingPage from './pages/BillingPage.jsx'
import SuperAdminPage from './pages/SuperAdminPage.jsx'
import LoginPage from './pages/LoginPage.jsx'
import SignupPage from './pages/SignupPage.jsx'
import LandingPage from './pages/LandingPage.jsx'
import ForgotPasswordPage from './pages/ForgotPasswordPage.jsx'
import ResetPasswordPage from './pages/ResetPasswordPage.jsx'
import ContactWidget from './components/layout/ContactWidget.jsx'

// ── URL ↔ page-state mapping tables ─────────────────────────────────────────
const AUTH_PAGE_PATHS = {
  dashboard:  '/dashboard',
  pricing:    '/pricing',
  team:       '/team',
  presets:    '/presets',
  settings:   '/settings',
  billing:    '/billing',
  superadmin: '/admin',
}
const PATH_TO_AUTH_PAGE = Object.fromEntries(
  Object.entries(AUTH_PAGE_PATHS).map(([k, v]) => [v, k])
)

const UNAUTH_PAGE_PATHS = {
  landing:           '/',
  login:             '/login',
  signup:            '/signup',
  'forgot-password': '/forgot-password',
}
const PATH_TO_UNAUTH_PAGE = Object.fromEntries(
  Object.entries(UNAUTH_PAGE_PATHS).map(([k, v]) => [v, k])
)

function parsePathname(pathname) {
  if (pathname.startsWith('/quotes/')) {
    const seg = pathname.slice('/quotes/'.length)
    return { page: 'quote', unauthPage: 'landing', quoteId: seg === 'new' ? null : (seg || null) }
  }
  if (PATH_TO_AUTH_PAGE[pathname]) {
    return { page: PATH_TO_AUTH_PAGE[pathname], unauthPage: 'landing', quoteId: null }
  }
  if (PATH_TO_UNAUTH_PAGE[pathname]) {
    return { page: 'dashboard', unauthPage: PATH_TO_UNAUTH_PAGE[pathname], quoteId: null }
  }
  return { page: 'dashboard', unauthPage: 'landing', quoteId: null }
}

function consumeUpgradeParam() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('upgraded') === 'true') {
    window.history.replaceState({}, '', window.location.pathname)
    return true
  }
  return false
}

const INITIAL_PATH    = window.location.pathname
const INITIAL_STATE   = parsePathname(INITIAL_PATH)

const Spinner = () => (
  <div className="min-h-screen bg-gray-50 flex items-center justify-center">
    <div className="text-center">
      <svg className="animate-spin w-6 h-6 text-brand-500 mx-auto mb-3" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
      </svg>
      <p className="text-gray-400 text-sm">Loading…</p>
    </div>
  </div>
)

function AppContent() {
  const { user, workspace, role, loading, workspaceError, workspaceReady, isSuperAdmin, signOut, retryWorkspace } = useAuth()

  const [page,             setPage]             = useState(INITIAL_STATE.page)
  const [activeQuoteId,    setActiveQuoteId]    = useState(INITIAL_STATE.quoteId)
  const [unauthPage,       setUnauthPage]       = useState(INITIAL_STATE.unauthPage)
  const [showResetPw,      setShowResetPw]      = useState(INITIAL_PATH === '/reset-password')
  const [upgraded,         setUpgraded]         = useState(consumeUpgradeParam)

  // ── Helpers ──────────────────────────────────────────────────────────────────
  function pagePath(pg, quoteId = null) {
    if (pg === 'quote') return quoteId ? `/quotes/${quoteId}` : '/quotes/new'
    return AUTH_PAGE_PATHS[pg] ?? '/dashboard'
  }

  // Authenticated page navigation
  function navigate(pg) {
    if ((pg === 'team' || pg === 'presets' || pg === 'settings' || pg === 'billing') && role !== 'admin') return
    if (pg === 'superadmin' && !isSuperAdmin) return
    setPage(pg)
    if (pg !== 'quote') setActiveQuoteId(null)
    window.history.pushState({ pg }, '', pagePath(pg))
  }

  // Unauthenticated page navigation
  function navigateUnauth(pg) {
    setUnauthPage(pg)
    window.history.pushState({ unauthPage: pg }, '', UNAUTH_PAGE_PATHS[pg] ?? '/')
  }

  function openQuote(id) {
    setActiveQuoteId(id)
    setPage('quote')
    window.history.pushState({ pg: 'quote', quoteId: id }, '', `/quotes/${id}`)
  }

  // ── Sync URL on auth-state change (login / logout) ───────────────────────────
  useEffect(() => {
    if (loading && !workspaceReady) return
    const pathname = window.location.pathname
    if (user) {
      const isUnauthPath = PATH_TO_UNAUTH_PAGE[pathname] !== undefined
      if (isUnauthPath) {
        window.history.replaceState({ pg: page }, '', pagePath(page, activeQuoteId))
      }
    } else {
      const isAuthPath = PATH_TO_AUTH_PAGE[pathname] !== undefined ||
        pathname.startsWith('/quotes/')
      if (isAuthPath) {
        window.history.replaceState({}, '', '/')
      }
    }
  }, [user, loading, workspaceReady]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Browser back / forward ───────────────────────────────────────────────────
  useEffect(() => {
    function onPopState() {
      const parsed = parsePathname(window.location.pathname)
      setPage(parsed.page)
      setUnauthPage(parsed.unauthPage)
      setActiveQuoteId(parsed.quoteId)
    }
    window.addEventListener('popstate', onPopState)
    return () => window.removeEventListener('popstate', onPopState)
  }, [])

  // ── Password reset — checked before any auth gate ─────────────────────────────
  if (showResetPw) {
    return (
      <ResetPasswordPage
        onInvalidToken={() => {
          setShowResetPw(false)
          navigateUnauth('forgot-password')
        }}
      />
    )
  }

  // ── Auth loading (first page load only) ──────────────────────────────────────
  if (loading && !workspaceReady) return <Spinner />

  // ── Not authenticated ─────────────────────────────────────────────────────────
  if (!user) {
    if (unauthPage === 'login') {
      return (
        <>
          <LoginPage
            onBack={() => navigateUnauth('landing')}
            onForgotPassword={() => navigateUnauth('forgot-password')}
          />
          <ContactWidget />
        </>
      )
    }
    if (unauthPage === 'signup') {
      return (
        <>
          <SignupPage
            onSwitchToLogin={() => navigateUnauth('login')}
            onBack={() => navigateUnauth('landing')}
          />
          <ContactWidget />
        </>
      )
    }
    if (unauthPage === 'forgot-password') {
      return (
        <>
          <ForgotPasswordPage onBack={() => navigateUnauth('login')} />
          <ContactWidget />
        </>
      )
    }
    return (
      <>
        <LandingPage
          onSignIn={() => navigateUnauth('login')}
          onSignUp={() => navigateUnauth('signup')}
        />
        <ContactWidget />
      </>
    )
  }

  // ── Super admin: bypass workspace requirement entirely ─────────────────────────
  if (isSuperAdmin) {
    if (page === 'pricing') return <><PricingPage onNavigate={navigate} /><ContactWidget /></>
    return <SuperAdminPage onNavigate={navigate} />
  }

  // ── Workspace still loading after sign-in ─────────────────────────────────────
  if (!workspace && !workspaceError && !workspaceReady) return <Spinner />

  // ── Workspace error ───────────────────────────────────────────────────────────
  if (workspaceError || !workspace) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
          </div>
          <p className="font-semibold text-gray-900 text-lg mb-2">Workspace setup failed</p>
          <p className="text-sm text-gray-500 mb-5">{workspaceError || 'Workspace not found.'}</p>
          <div className="bg-gray-100 rounded-lg px-4 py-3 text-left mb-6 text-xs text-gray-600 leading-relaxed">
            <p className="font-semibold mb-1">Quick fix:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Open Supabase dashboard → SQL Editor</li>
              <li>Run migrations 001 through 005 in order</li>
              <li>Click "Try again" below</li>
            </ol>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button onClick={retryWorkspace} className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold rounded-lg">Try again</button>
            <button onClick={signOut} className="px-5 py-2.5 bg-white hover:bg-gray-50 text-gray-700 text-sm font-semibold rounded-lg border border-gray-200">Sign out</button>
          </div>
        </div>
      </div>
    )
  }

  // ── Deactivated account ───────────────────────────────────────────────────────
  if (workspace.is_active === false) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-5">
            <svg className="w-7 h-7 text-gray-400" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
            </svg>
          </div>
          <p className="font-bold text-gray-900 text-xl mb-2">Account deactivated</p>
          <p className="text-sm text-gray-500 mb-6">
            Your CatchQuote account has been deactivated. Please contact{' '}
            <a href="mailto:info@catchquote.io" className="text-brand-600 hover:underline">info@catchquote.io</a>
            {' '}to reactivate.
          </p>
          <button onClick={signOut} className="px-5 py-2.5 bg-white border border-gray-200 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50">
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  // ── Authenticated pages ───────────────────────────────────────────────────────
  let pageContent
  if (page === 'pricing') {
    pageContent = <PricingPage onNavigate={navigate} />
  } else if (page === 'team' && role === 'admin') {
    pageContent = <TeamPage onBack={() => navigate('dashboard')} onNavigate={navigate} />
  } else if (page === 'presets' && role === 'admin') {
    pageContent = <PresetsPage onBack={() => navigate('dashboard')} onNavigate={navigate} />
  } else if (page === 'settings' && role === 'admin') {
    pageContent = <SettingsPage onBack={() => navigate('dashboard')} onNavigate={navigate} />
  } else if (page === 'billing' && role === 'admin') {
    pageContent = <BillingPage onNavigate={navigate} />
  } else if (page === 'quote') {
    pageContent = <QuotePage quoteId={activeQuoteId} onBack={() => navigate('dashboard')} onNavigate={navigate} />
  } else {
    pageContent = (
      <Dashboard
        onOpenQuote={openQuote}
        onNavigate={navigate}
        upgraded={upgraded}
        onDismissUpgraded={() => setUpgraded(false)}
      />
    )
  }

  return <>{pageContent}<ContactWidget /></>
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  )
}
