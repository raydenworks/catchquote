import jsPDF from 'jspdf'
import { autoTable } from 'jspdf-autotable'

// ── Helpers ───────────────────────────────────────────────────────────────────

function hexToRgb(hex) {
  const r = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return r ? [parseInt(r[1], 16), parseInt(r[2], 16), parseInt(r[3], 16)] : [232, 98, 42]
}

function brandLight(b) {
  return b.map(c => Math.round(c * 0.12 + 255 * 0.88))
}

function fmtAmt(n) {
  return Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtMoney(n, currency = 'USD') {
  return `${currency} ${fmtAmt(n)}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  const d = new Date(iso)
  return isNaN(d) ? iso : d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
}

async function loadImageAsDataUrl(url) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 5000)
  try {
    const resp = await fetch(url, { signal: controller.signal })
    const blob = await resp.blob()
    return await new Promise((res, rej) => {
      const reader = new FileReader()
      reader.onload  = () => res(reader.result)
      reader.onerror = rej
      reader.readAsDataURL(blob)
    })
  } catch { return null }
  finally { clearTimeout(timer) }
}

function imgFormat(dataUrl) {
  if (!dataUrl) return 'PNG'
  if (dataUrl.startsWith('data:image/jpeg') || dataUrl.startsWith('data:image/jpg')) return 'JPEG'
  if (dataUrl.startsWith('data:image/webp')) return 'WEBP'
  return 'PNG'
}

// ── Shared palette ────────────────────────────────────────────────────────────

const DARK       = [17,  24,  39]
const MID_GRAY   = [107, 114, 128]
const ALT_ROW    = [246, 247, 249]
const CAT_ROW    = [240, 242, 247]
const WHITE      = [255, 255, 255]
const RULE       = [229, 231, 235]
const BLACK      = [0,   0,   0]
const ORANGE     = [232, 98,  42]

// ── Per-layout themes ─────────────────────────────────────────────────────────

const THEMES = {
  classic: {
    bg:             null,
    primary:        DARK,
    secondary:      MID_GRAY,
    rule:           RULE,
    rowBase:        WHITE,
    rowAlt:         WHITE,
    catBg:          CAT_ROW,
    catText:        MID_GRAY,
    subtotalBg:     [245, 247, 250],
    tblHdrBg:       null,   // falls back to BRAND
    tblHdrText:     WHITE,
    areaBarBg:      null,   // falls back to BRAND
    areaBarText:    WHITE,
    sigLine:        MID_GRAY,
    footerAlign:    'center',
    footerColor:    MID_GRAY,
    lineColor:      RULE,
  },
  modern: {
    bg:             null,
    primary:        DARK,
    secondary:      MID_GRAY,
    rule:           RULE,
    rowBase:        WHITE,
    rowAlt:         ALT_ROW,
    catBg:          CAT_ROW,
    catText:        MID_GRAY,
    subtotalBg:     [243, 244, 248],
    tblHdrBg:       null,
    tblHdrText:     WHITE,
    areaBarBg:      null,   // uses brandLight
    areaBarText:    null,   // uses BRAND
    sigLine:        MID_GRAY,
    footerAlign:    'right',
    footerColor:    MID_GRAY,
    lineColor:      [232, 234, 240],
  },
  bw: {
    bg:             null,
    primary:        BLACK,
    secondary:      [80,  80,  80],
    rule:           BLACK,
    rowBase:        WHITE,
    rowAlt:         [249, 249, 249],
    catBg:          [240, 240, 240],
    catText:        [80,  80,  80],
    subtotalBg:     [235, 235, 235],
    tblHdrBg:       BLACK,
    tblHdrText:     WHITE,
    areaBarBg:      WHITE,
    areaBarText:    BLACK,
    sigLine:        [80,  80,  80],
    footerAlign:    'center',
    footerColor:    [150, 150, 150],
    lineColor:      [200, 200, 200],
  },
  dark: {
    bg:             [13,  13,  13],
    primary:        WHITE,
    secondary:      [170, 170, 170],
    rule:           [42,  42,  42],
    rowBase:        [13,  13,  13],
    rowAlt:         [17,  17,  17],
    catBg:          [26,  26,  26],
    catText:        [136, 136, 136],
    subtotalBg:     [30,  30,  30],
    tblHdrBg:       [30,  30,  30],
    tblHdrText:     WHITE,
    areaBarBg:      [26,  26,  26],
    areaBarText:    ORANGE,
    sigLine:        [51,  51,  51],
    footerAlign:    'right',
    footerColor:    [85,  85,  85],
    lineColor:      [42,  42,  42],
  },
  warm: {
    bg:             [253, 250, 245],
    primary:        [44,  24,  16],
    secondary:      [139, 111, 94],
    rule:           [232, 213, 183],
    rowBase:        [253, 250, 245],
    rowAlt:         [247, 240, 230],
    catBg:          [245, 237, 220],
    catText:        [139, 111, 94],
    subtotalBg:     [240, 230, 211],
    tblHdrBg:       [44,  24,  16],
    tblHdrText:     [253, 250, 245],
    areaBarBg:      [247, 240, 230],
    areaBarText:    [201, 169, 110],
    gold:           [201, 169, 110],
    sigLine:        [201, 169, 110],
    footerAlign:    'center',
    footerColor:    [139, 111, 94],
    lineColor:      [232, 213, 183],
  },
  editorial: {
    bg:             null,
    primary:        BLACK,
    secondary:      [80,  80,  80],
    rule:           [238, 238, 238],
    rowBase:        WHITE,
    rowAlt:         WHITE,
    catBg:          WHITE,
    catText:        ORANGE,
    subtotalBg:     [245, 245, 245],
    tblHdrBg:       ORANGE,
    tblHdrText:     WHITE,
    areaBarBg:      [245, 245, 245],
    areaBarText:    BLACK,
    sigLine:        ORANGE,
    footerAlign:    'right',
    footerColor:    ORANGE,
    lineColor:      [238, 238, 238],
  },
}

// ── Layout constants ───────────────────────────────────────────────────────────

const M        = 14
const SIG_H    = 38
const FOOTER_H = 7
const RESERVE  = SIG_H + FOOTER_H + 2
const MINI_H   = 10
const BAND_H   = 28

// ── Page background fill ──────────────────────────────────────────────────────

function fillPageBg(doc, theme, pageW, pageH) {
  if (!theme.bg) return
  doc.setFillColor(...theme.bg)
  doc.rect(0, 0, pageW, pageH, 'F')
}

// ── Signature block ────────────────────────────────────────────────────────────

function drawSignatureBlock(doc, pageW, pageH, clientName, settings, isLastPage, theme) {
  const top  = pageH - SIG_H - FOOTER_H
  const midX = pageW / 2
  const y    = top + 5

  doc.setDrawColor(...theme.sigLine)
  doc.setLineWidth(0.35)
  doc.line(M, top, pageW - M, top)

  // LEFT — Prepared by
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...theme.secondary)
  doc.text('PREPARED BY', M, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...theme.primary)
  doc.text(settings?.designer_name || '', M, y + 4.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...theme.secondary)
  doc.text(settings?.designer_position || '', M, y + 9)

  const sigLineY = y + (isLastPage ? 21 : 15)
  doc.setDrawColor(...theme.sigLine)
  doc.setLineWidth(0.2)
  doc.line(M, sigLineY, midX - 12, sigLineY)
  doc.setFontSize(6)
  doc.setTextColor(...theme.secondary)
  doc.text('Signature', M, sigLineY + 3)
  if (isLastPage) {
    doc.line(M, sigLineY + 9, midX - 12, sigLineY + 9)
    doc.text('Date', M, sigLineY + 12)
  }

  // RIGHT — Confirmed by
  const rx = midX + 8
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6)
  doc.setTextColor(...theme.secondary)
  doc.text('CONFIRMED & ACCEPTED BY', rx, y)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(...theme.primary)
  doc.text(clientName || 'Client', rx, y + 4.5)

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...theme.secondary)
  doc.text('Client', rx, y + 9)

  doc.setDrawColor(...theme.sigLine)
  doc.setLineWidth(0.2)
  doc.line(rx, sigLineY, pageW - M, sigLineY)
  doc.setFontSize(6)
  doc.setTextColor(...theme.secondary)
  doc.text('Signature', rx, sigLineY + 3)
  if (isLastPage) {
    doc.line(rx, sigLineY + 9, pageW - M, sigLineY + 9)
    doc.text('Date', rx, sigLineY + 12)
  }
}

// ── Page footer ────────────────────────────────────────────────────────────────

function drawPageFooter(doc, pageNum, totalPages, pageW, pageH, theme) {
  const txt = `Generated by CatchQuote · catchquote.io     Page ${pageNum} of ${totalPages}`
  doc.setFontSize(6.5)
  doc.setFont('helvetica', 'normal')
  doc.setTextColor(...theme.footerColor)
  if (theme.footerAlign === 'right') {
    doc.text(txt, pageW - M, pageH - 2, { align: 'right' })
  } else {
    doc.text(txt, pageW / 2, pageH - 2, { align: 'center' })
  }
}

// ── Separator line ─────────────────────────────────────────────────────────────

function sepLine(doc, y, pageW, color = RULE, width = 0.4) {
  doc.setDrawColor(...color)
  doc.setLineWidth(width)
  doc.line(M, y, pageW - M, y)
}

// ── Continuation page mini-header ─────────────────────────────────────────────

function drawMiniHeader(doc, settings, quote, BRAND, pageW, pageH, layout, theme) {
  fillPageBg(doc, theme, pageW, pageH)

  const company = settings?.company_name || ''
  const qNum    = quote.quoteNumber || ''

  if (layout === 'modern') {
    doc.setFillColor(...BRAND)
    doc.rect(0, 0, pageW, MINI_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...WHITE)
    doc.text(company, M, MINI_H - 2.8)
    doc.text(qNum, pageW - M, MINI_H - 2.8, { align: 'right' })
  } else if (layout === 'dark') {
    doc.setFillColor(26, 26, 26)
    doc.rect(0, 0, pageW, MINI_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...WHITE)
    doc.text(company, M, MINI_H - 2.8)
    doc.setTextColor(...ORANGE)
    doc.text(qNum, pageW - M, MINI_H - 2.8, { align: 'right' })
  } else if (layout === 'warm') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(44, 24, 16)
    doc.text(company, M, MINI_H - 3)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(201, 169, 110)
    doc.text(qNum, pageW - M, MINI_H - 3, { align: 'right' })
    doc.setDrawColor(201, 169, 110)
    doc.setLineWidth(0.5)
    doc.line(M, MINI_H, pageW - M, MINI_H)
  } else if (layout === 'editorial') {
    doc.setFillColor(...ORANGE)
    doc.rect(0, 0, pageW, MINI_H, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...WHITE)
    doc.text(company, M, MINI_H - 2.8)
    doc.text(qNum, pageW - M, MINI_H - 2.8, { align: 'right' })
  } else if (layout === 'bw') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...BLACK)
    doc.text(company, M, MINI_H - 3)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(80, 80, 80)
    doc.text(qNum, pageW - M, MINI_H - 3, { align: 'right' })
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.3)
    doc.line(M, MINI_H, pageW - M, MINI_H)
  } else {
    // classic
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7.5)
    doc.setTextColor(...DARK)
    doc.text(company, M, MINI_H - 3)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...MID_GRAY)
    doc.text(qNum, pageW - M, MINI_H - 3, { align: 'right' })
    doc.setDrawColor(...RULE)
    doc.setLineWidth(0.35)
    doc.line(M, MINI_H, pageW - M, MINI_H)
  }
}

// ── Page 1 header — Classic ───────────────────────────────────────────────────

function drawPage1Classic(doc, settings, quote, BRAND, logoDataUrl, pageW) {
  const LOGO_H = 16
  let leftY    = 5

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, imgFormat(logoDataUrl), M, leftY, 0, LOGO_H) } catch { /* skip */ }
    leftY += LOGO_H + 3
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...DARK)
    doc.text(settings?.company_name || '', M, leftY + LOGO_H / 2 + 2.5)
    leftY += LOGO_H + 3
  }

  const rx           = pageW - M
  const lineH        = 4.5
  const contactParts = [settings?.company_address, settings?.company_phone, settings?.company_email].filter(Boolean)
  let rightY         = 7

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...DARK)
  doc.text(settings?.company_name || '', rx, rightY, { align: 'right' })
  rightY += lineH + 1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...MID_GRAY)
  for (const part of contactParts) {
    doc.text(part, rx, rightY, { align: 'right' })
    rightY += lineH
  }
  if (settings?.company_registration) {
    doc.text(`Reg: ${settings.company_registration}`, rx, rightY, { align: 'right' })
    rightY += lineH
  }

  const ruleY = Math.max(leftY, rightY) + 3
  doc.setDrawColor(...BRAND)
  doc.setLineWidth(1)
  doc.line(M, ruleY, pageW - M, ruleY)

  let y = ruleY + 9

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...BRAND)
  doc.text('QUOTATION', M, y)
  y += 4

  doc.setDrawColor(...RULE)
  doc.setLineWidth(0.4)
  doc.line(M, y, pageW - M, y)
  y += 6

  for (const [label, value] of [
    ['QUOTE NO.',   quote.quoteNumber || '—'],
    ['DATE',        fmtDate(quote.date)],
    ['VALID UNTIL', fmtDate(quote.validUntil)],
    ['CURRENCY',    quote.currency || 'USD'],
  ]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MID_GRAY)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    doc.text(value, M + 36, y)
    y += 5
  }

  return y + 4
}

// ── Page 1 header — Modern ────────────────────────────────────────────────────

function drawPage1Modern(doc, settings, quote, BRAND, logoDataUrl, pageW) {
  doc.setFillColor(...BRAND)
  doc.rect(0, 0, pageW, BAND_H, 'F')

  const LOGO_H = 18
  const logoY  = (BAND_H - LOGO_H) / 2

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, imgFormat(logoDataUrl), M, logoY, 0, LOGO_H) } catch { /* skip */ }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...WHITE)
    doc.text(settings?.company_name || '', M, BAND_H / 2 + 2.5)
  }

  const rx           = pageW - M
  const lineH        = 4.5
  const contactParts = [settings?.company_address, settings?.company_phone, settings?.company_email].filter(Boolean)
  const nLines       = 1 + contactParts.length + (settings?.company_registration ? 1 : 0)
  let rightY         = (BAND_H - nLines * lineH) / 2 + lineH

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text(settings?.company_name || '', rx, rightY, { align: 'right' })
  rightY += lineH + 0.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(...WHITE)
  for (const part of contactParts) {
    doc.text(part, rx, rightY, { align: 'right' })
    rightY += lineH
  }
  if (settings?.company_registration) {
    doc.text(`Reg: ${settings.company_registration}`, rx, rightY, { align: 'right' })
  }

  let y = BAND_H + 9

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...BRAND)
  doc.text('QUOTATION', M, y)
  y += 4

  doc.setDrawColor(...BRAND)
  doc.setLineWidth(0.6)
  doc.line(M, y, pageW - M, y)
  y += 6

  for (const [label, value] of [
    ['QUOTE NO.',   quote.quoteNumber || '—'],
    ['DATE',        fmtDate(quote.date)],
    ['VALID UNTIL', fmtDate(quote.validUntil)],
    ['CURRENCY',    quote.currency || 'USD'],
  ]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...MID_GRAY)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...DARK)
    doc.text(value, M + 36, y)
    y += 5
  }

  return y + 4
}

// ── Page 1 header — B&W Minimalist ───────────────────────────────────────────

function drawPage1BW(doc, settings, quote, logoDataUrl, pageW) {
  const LOGO_H = 16
  let leftY    = 8

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, imgFormat(logoDataUrl), M, leftY, 0, LOGO_H) } catch { /* skip */ }
    leftY += LOGO_H + 4
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(16)
    doc.setTextColor(...BLACK)
    doc.text(settings?.company_name || '', M, leftY + 10)
    leftY += LOGO_H + 4
  }

  const rx           = pageW - M
  const lineH        = 4.5
  const contactParts = [settings?.company_address, settings?.company_phone, settings?.company_email].filter(Boolean)
  let rightY         = 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BLACK)
  doc.text(settings?.company_name || '', rx, rightY, { align: 'right' })
  rightY += lineH + 1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(80, 80, 80)
  for (const part of contactParts) {
    doc.text(part, rx, rightY, { align: 'right' })
    rightY += lineH
  }
  if (settings?.company_registration) {
    doc.text(`Reg: ${settings.company_registration}`, rx, rightY, { align: 'right' })
    rightY += lineH
  }

  const ruleY = Math.max(leftY, rightY) + 3
  doc.setDrawColor(...BLACK)
  doc.setLineWidth(0.4)
  doc.line(M, ruleY, pageW - M, ruleY)

  let y = ruleY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BLACK)
  doc.text('Q U O T A T I O N', M, y)
  y += 3

  doc.setDrawColor(80, 80, 80)
  doc.setLineWidth(0.2)
  doc.line(M, y, pageW - M, y)
  y += 8

  for (const [label, value] of [
    ['QUOTE NO.',   quote.quoteNumber || '—'],
    ['DATE',        fmtDate(quote.date)],
    ['VALID UNTIL', fmtDate(quote.validUntil)],
    ['CURRENCY',    quote.currency || 'USD'],
  ]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(80, 80, 80)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BLACK)
    doc.text(value, M + 36, y)
    y += 5.5
  }

  return y + 4
}

// ── Page 1 header — Dark Mode ─────────────────────────────────────────────────

function drawPage1Dark(doc, settings, quote, logoDataUrl, pageW, pageH) {
  fillPageBg(doc, THEMES.dark, pageW, pageH)

  const LOGO_H  = 18
  const HEADER_H = 36

  doc.setFillColor(26, 26, 26)
  doc.rect(0, 0, pageW, HEADER_H, 'F')
  doc.setDrawColor(51, 51, 51)
  doc.setLineWidth(0.4)
  doc.line(0, HEADER_H, pageW, HEADER_H)

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, imgFormat(logoDataUrl), M, (HEADER_H - LOGO_H) / 2, 0, LOGO_H) } catch { /* skip */ }
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(13)
    doc.setTextColor(...WHITE)
    doc.text(settings?.company_name || '', M, HEADER_H / 2 + 2.5)
  }

  const rx           = pageW - M
  const lineH        = 4.5
  const contactParts = [settings?.company_address, settings?.company_phone, settings?.company_email].filter(Boolean)
  const nLines       = 1 + contactParts.length + (settings?.company_registration ? 1 : 0)
  let rightY         = (HEADER_H - nLines * lineH) / 2 + lineH

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...WHITE)
  doc.text(settings?.company_name || '', rx, rightY, { align: 'right' })
  rightY += lineH + 0.5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(170, 170, 170)
  for (const part of contactParts) {
    doc.text(part, rx, rightY, { align: 'right' })
    rightY += lineH
  }
  if (settings?.company_registration) {
    doc.text(`Reg: ${settings.company_registration}`, rx, rightY, { align: 'right' })
  }

  let y = HEADER_H + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(...WHITE)
  doc.text('QUOTATION', M, y)
  y += 4

  doc.setDrawColor(...ORANGE)
  doc.setLineWidth(0.6)
  doc.line(M, y, pageW - M, y)
  y += 7

  for (const [label, value] of [
    ['QUOTE NO.',   quote.quoteNumber || '—'],
    ['DATE',        fmtDate(quote.date)],
    ['VALID UNTIL', fmtDate(quote.validUntil)],
    ['CURRENCY',    quote.currency || 'USD'],
  ]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(170, 170, 170)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...WHITE)
    doc.text(value, M + 36, y)
    y += 5
  }

  return y + 4
}

// ── Page 1 header — Warm Luxury ───────────────────────────────────────────────

function drawPage1Warm(doc, settings, quote, logoDataUrl, pageW, pageH) {
  fillPageBg(doc, THEMES.warm, pageW, pageH)

  const GOLD   = [201, 169, 110]
  const BROWN  = [44,  24,  16]
  const SEC    = [139, 111, 94]
  const LOGO_H = 16
  let leftY    = 8

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, imgFormat(logoDataUrl), M, leftY, 0, LOGO_H) } catch { /* skip */ }
    leftY += LOGO_H + 3
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(15)
    doc.setTextColor(...BROWN)
    doc.text(settings?.company_name || '', M, leftY + 10)
    leftY += LOGO_H + 3
  }

  const rx           = pageW - M
  const lineH        = 4.5
  const contactParts = [settings?.company_address, settings?.company_phone, settings?.company_email].filter(Boolean)
  let rightY         = 8

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.setTextColor(...BROWN)
  doc.text(settings?.company_name || '', rx, rightY, { align: 'right' })
  rightY += lineH + 1

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7.5)
  doc.setTextColor(...SEC)
  for (const part of contactParts) {
    doc.text(part, rx, rightY, { align: 'right' })
    rightY += lineH
  }
  if (settings?.company_registration) {
    doc.text(`Reg: ${settings.company_registration}`, rx, rightY, { align: 'right' })
    rightY += lineH
  }

  const ruleY = Math.max(leftY, rightY) + 3
  doc.setDrawColor(...GOLD)
  doc.setLineWidth(1.2)
  doc.line(M, ruleY, pageW - M, ruleY)

  let y = ruleY + 10

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(20)
  doc.setTextColor(...BROWN)
  doc.text('QUOTATION', M, y)
  y += 3

  doc.setDrawColor(...GOLD)
  doc.setLineWidth(0.5)
  doc.line(M, y, M + 55, y)
  y += 8

  for (const [label, value] of [
    ['QUOTE NO.',   quote.quoteNumber || '—'],
    ['DATE',        fmtDate(quote.date)],
    ['VALID UNTIL', fmtDate(quote.validUntil)],
    ['CURRENCY',    quote.currency || 'USD'],
  ]) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(7)
    doc.setTextColor(...SEC)
    doc.text(label, M, y)
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(...BROWN)
    doc.text(value, M + 36, y)
    y += 5.5
  }

  return y + 4
}

// ── Page 1 header — Editorial ─────────────────────────────────────────────────

function drawPage1Editorial(doc, settings, quote, logoDataUrl, pageW) {
  let y = 8

  if (logoDataUrl) {
    try { doc.addImage(logoDataUrl, imgFormat(logoDataUrl), M, y, 0, 18) } catch { /* skip */ }
    y += 24
  } else {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(22)
    doc.setTextColor(...BLACK)
    doc.text((settings?.company_name || '').toUpperCase(), M, y + 13)
    y += 20
  }

  // Full-width orange rule
  doc.setDrawColor(...ORANGE)
  doc.setLineWidth(2)
  doc.line(M, y, pageW - M, y)
  y += 7

  // Small orange label + large quote number left; meta right
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(7)
  doc.setTextColor(...ORANGE)
  doc.text('Q U O T A T I O N', M, y)

  const metaX = pageW / 2 + 6
  const metaRows = [
    ['DATE',        fmtDate(quote.date)],
    ['VALID UNTIL', fmtDate(quote.validUntil)],
    ['CURRENCY',    quote.currency || 'USD'],
  ]
  let metaY = y
  for (const [label, value] of metaRows) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...ORANGE)
    doc.text(label, metaX, metaY)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(7.5)
    doc.setTextColor(...BLACK)
    doc.text(value, metaX + 28, metaY)
    metaY += 5.5
  }

  // Company contact info right-aligned
  const rx           = pageW - M
  const contactParts = [settings?.company_address, settings?.company_phone, settings?.company_email].filter(Boolean)
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(7)
  doc.setTextColor(80, 80, 80)
  for (const part of contactParts) {
    doc.text(part, rx, metaY, { align: 'right' })
    metaY += 4.5
  }

  // Large quote number
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.setTextColor(...BLACK)
  doc.text(quote.quoteNumber || '—', M, y + 18)

  return Math.max(y + 22, metaY) + 4
}

// ── Client / project block ─────────────────────────────────────────────────────

function drawClientBlock(doc, quote, settings, y, pageW, theme) {
  const col2X  = pageW / 2 + 6
  let leftY    = y
  let rightY   = y

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(6.5)
  doc.setTextColor(...theme.secondary)
  doc.text('BILL TO', M, leftY)
  leftY += 4.5

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...theme.primary)
  doc.text(quote.clientName || '—', M, leftY)
  leftY += 5

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(8)
  doc.setTextColor(...theme.secondary)
  for (const txt of [quote.clientContact, quote.clientEmail, quote.clientAddress].filter(Boolean)) {
    const lines = doc.splitTextToSize(txt, col2X - M - 6)
    doc.text(lines, M, leftY)
    leftY += lines.length * 4
  }

  if (quote.projectAddress) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...theme.secondary)
    doc.text('PROJECT ADDRESS', col2X, rightY)
    rightY += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...theme.primary)
    const pLines = doc.splitTextToSize(quote.projectAddress, pageW - M - col2X)
    doc.text(pLines, col2X, rightY)
    rightY += pLines.length * 4 + 2
  }

  const designer = quote.designerName || settings?.designer_name
  if (designer) {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(6.5)
    doc.setTextColor(...theme.secondary)
    doc.text('SALES DESIGNER', col2X, rightY)
    rightY += 4.5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...theme.primary)
    doc.text(designer, col2X, rightY)
    rightY += 4
  }

  return Math.max(leftY, rightY)
}

// ── Section title (shared helper) ─────────────────────────────────────────────

function drawSectionTitle(doc, title, y, pageW, layout, BRAND, theme) {
  if (layout === 'modern') {
    doc.setFillColor(...BRAND)
    doc.rect(M, y, 3.5, 7.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BRAND)
    doc.text(title, M + 7, y + 5.5)
    return y + 13
  }
  if (layout === 'bw') {
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...BLACK)
    doc.text(title, M, y + 5)
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.3)
    doc.line(M, y + 8, pageW - M, y + 8)
    return y + 13
  }
  if (layout === 'dark') {
    doc.setFillColor(...ORANGE)
    doc.rect(M, y, 3.5, 7.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...ORANGE)
    doc.text(title, M + 7, y + 5.5)
    return y + 13
  }
  if (layout === 'warm') {
    const GOLD = [201, 169, 110]
    doc.setDrawColor(...GOLD)
    doc.setLineWidth(1.5)
    doc.line(M, y + 1, M, y + 8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(44, 24, 16)
    doc.text(title, M + 5, y + 6)
    return y + 13
  }
  if (layout === 'editorial') {
    doc.setDrawColor(...ORANGE)
    doc.setLineWidth(2)
    doc.line(M, y + 8, pageW - M, y + 8)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(10)
    doc.setTextColor(...BLACK)
    doc.text(title, M, y + 5.5)
    return y + 13
  }
  // classic
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(...DARK)
  doc.text(title, M, y + 5)
  sepLine(doc, y + 8, pageW, RULE, 0.4)
  return y + 13
}

// ── Summary section ───────────────────────────────────────────────────────────

function drawSummary(doc, areas, areaSubtotals, itemsByArea, subtotal, gst, gstEnabled, total, quote, settings, BRAND, layout, theme, pageW, startY) {
  const cur = quote.currency || 'USD'
  let y = drawSectionTitle(doc, 'SUMMARY OF WORKS', startY, pageW, layout, BRAND, theme)

  const rows = areas
    .filter(a => (itemsByArea.get(a) ?? []).length > 0)
    .map(a => [a, fmtAmt(areaSubtotals.get(a) ?? 0)])

  const tblHdrBg = theme.tblHdrBg ?? BRAND
  const tableStartY = y

  autoTable(doc, {
    startY: y,
    head:   [['Area of Works', `Subtotal (${cur})`]],
    body:   rows,
    styles: {
      fontSize:    9,
      cellPadding: { top: 3.5, bottom: 3.5, left: 5, right: 5 },
      textColor:   theme.primary,
      lineColor:   theme.lineColor,
      lineWidth:   0.2,
      fillColor:   theme.rowBase,
    },
    headStyles: {
      fillColor:  tblHdrBg,
      textColor:  theme.tblHdrText,
      fontStyle:  'bold',
      fontSize:   8,
      lineWidth:  0,
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 42, halign: 'right', fontStyle: 'bold' },
    },
    alternateRowStyles: { fillColor: theme.rowAlt },
    margin:      { left: M, right: M, bottom: RESERVE, top: MINI_H + 6 },
    didAddPage:  () => drawMiniHeader(doc, settings, quote, BRAND, pageW, doc.internal.pageSize.height, layout, theme),
  })

  // Modern: brand left accent bar on summary table
  if (layout === 'modern') {
    doc.setFillColor(...BRAND)
    doc.rect(M, tableStartY, 3, doc.lastAutoTable.finalY - tableStartY, 'F')
  }

  y = doc.lastAutoTable.finalY + 8

  // Totals block
  const labelX = pageW - M - 72
  const valX   = pageW - M

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  doc.setTextColor(...theme.secondary)
  doc.text('Subtotal', labelX, y)
  doc.setTextColor(...theme.primary)
  doc.text(fmtMoney(subtotal, cur), valX, y, { align: 'right' })
  y += 6

  if (gstEnabled) {
    doc.setTextColor(...theme.secondary)
    doc.text('GST (9%)', labelX, y)
    doc.setTextColor(...theme.primary)
    doc.text(fmtMoney(gst, cur), valX, y, { align: 'right' })
    y += 6
  }

  sepLine(doc, y - 1.5, pageW, theme.rule, 0.4)
  y += 2

  const totalH   = 9
  const gtBg     = layout === 'modern' || layout === 'classic' ? BRAND : (theme.tblHdrBg ?? BRAND)
  const gtText   = theme.tblHdrText

  if (layout === 'bw') {
    doc.setFillColor(...BLACK)
    doc.rect(labelX - 4, y, valX - labelX + 6, totalH, 'F')
  } else {
    doc.setFillColor(...gtBg)
    doc.roundedRect(labelX - 4, y, valX - labelX + 6, totalH, 1, 1, 'F')
  }
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10)
  doc.setTextColor(...gtText)
  doc.text(`GRAND TOTAL (${cur})`, labelX, y + 6)
  doc.text(fmtMoney(total, cur), valX, y + 6, { align: 'right' })

  // Warm: gold left accent stripe on grand total
  if (layout === 'warm') {
    doc.setFillColor(201, 169, 110)
    doc.rect(labelX - 4, y, 3, totalH, 'F')
  }

  return y + totalH + 4
}

// ── One area's detail section ─────────────────────────────────────────────────

function drawArea(doc, areaName, areaItems, areaSubtotal, BRAND, layout, theme, currency, pageW, pageH, settings, quote, startY) {
  let y = startY

  if (y + 40 > pageH - RESERVE) {
    doc.addPage()
    drawMiniHeader(doc, settings, quote, BRAND, pageW, pageH, layout, theme)
    y = MINI_H + 4
  }

  const tableW = pageW - 2 * M

  // Area header bar
  if (layout === 'modern') {
    const BL = brandLight(BRAND)
    doc.setFillColor(...BL)
    doc.roundedRect(M, y, tableW, 8.5, 1.5, 1.5, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...BRAND)
    doc.text(areaName.toUpperCase(), M + 5, y + 6)
    doc.text(fmtMoney(areaSubtotal, currency), pageW - M - 3, y + 6, { align: 'right' })
    y += 11
  } else if (layout === 'classic') {
    doc.setFillColor(...BRAND)
    doc.rect(M, y, tableW, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...WHITE)
    doc.text(areaName.toUpperCase(), M + 4, y + 5.5)
    doc.text(fmtMoney(areaSubtotal, currency), pageW - M - 3, y + 5.5, { align: 'right' })
    y += 10
  } else if (layout === 'bw') {
    doc.setDrawColor(...BLACK)
    doc.setLineWidth(0.3)
    doc.line(M, y, pageW - M, y)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...BLACK)
    doc.text(areaName.toUpperCase(), M + 2, y + 6)
    doc.text(fmtMoney(areaSubtotal, currency), pageW - M, y + 6, { align: 'right' })
    doc.line(M, y + 8.5, pageW - M, y + 8.5)
    y += 11
  } else if (layout === 'editorial') {
    // Orange left border + light grey band
    doc.setFillColor(245, 245, 245)
    doc.rect(M, y, tableW, 9, 'F')
    doc.setFillColor(...ORANGE)
    doc.rect(M, y, 4, 9, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(...BLACK)
    doc.text(areaName.toUpperCase(), M + 8, y + 6.5)
    doc.setFontSize(8)
    doc.text(fmtMoney(areaSubtotal, currency), pageW - M, y + 6.5, { align: 'right' })
    y += 12
  } else {
    // dark / warm — use theme colors
    doc.setFillColor(...theme.areaBarBg)
    doc.rect(M, y, tableW, 8, 'F')
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(9.5)
    doc.setTextColor(...theme.areaBarText)
    doc.text(areaName.toUpperCase(), M + 4, y + 5.5)
    doc.text(fmtMoney(areaSubtotal, currency), pageW - M - 3, y + 5.5, { align: 'right' })
    y += 10
  }

  // Group items by category
  const groups = []
  for (const item of areaItems) {
    const last = groups[groups.length - 1]
    if (!last || last.cat !== item.category) groups.push({ cat: item.category, items: [] })
    groups[groups.length - 1].items.push(item)
  }

  const tblHdrBg = theme.tblHdrBg ?? BRAND

  const catSubStyle = {
    fontStyle:   'bold',
    halign:      'right',
    fillColor:   theme.subtotalBg,
    textColor:   theme.primary,
    cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
    fontSize:    7.5,
  }

  const areaSubStyle = {
    fontStyle:   'bold',
    halign:      'right',
    fillColor:   tblHdrBg,
    textColor:   theme.tblHdrText,
    cellPadding: { top: 3, bottom: 3, left: 4, right: 4 },
    fontSize:    8,
  }

  const body   = []
  let itemNum  = 0

  for (const { cat, items } of groups) {
    // Category header
    const catCellStyle = {
      fillColor:   theme.catBg,
      textColor:   theme.catText,
      fontStyle:   layout === 'editorial' ? 'bold' : (layout === 'modern' ? 'normal' : 'bold'),
      fontSize:    layout === 'editorial' ? 6.5 : 7.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: layout === 'modern' ? 10 : 5, right: 5 },
    }
    body.push([{ content: layout === 'editorial' ? cat.toUpperCase() : cat, colSpan: 6, styles: catCellStyle }])

    for (const item of items) {
      itemNum++
      const lineTotal = (parseFloat(item.qty) || 0) * (parseFloat(item.unitPrice) || 0)
      const fill      = (layout === 'modern' && itemNum % 2 === 0) ? ALT_ROW : theme.rowBase
      body.push([
        { content: String(itemNum),          styles: { halign: 'center', textColor: theme.secondary, fillColor: fill } },
        { content: item.description || '',   styles: { fillColor: fill, textColor: theme.primary } },
        { content: String(item.qty ?? ''),   styles: { halign: 'right', fillColor: fill, textColor: theme.primary } },
        { content: item.unit || '',          styles: { halign: 'center', fillColor: fill, textColor: theme.secondary } },
        { content: fmtAmt(item.unitPrice),   styles: { halign: 'right', fillColor: fill, textColor: theme.primary } },
        { content: fmtAmt(lineTotal),        styles: { halign: 'right', fontStyle: 'bold', fillColor: fill, textColor: theme.primary } },
      ])
    }

    const catSub = items.reduce((s, i) => s + (parseFloat(i.qty) || 0) * (parseFloat(i.unitPrice) || 0), 0)
    body.push([
      { content: `${cat} — Subtotal`, colSpan: 5, styles: catSubStyle },
      { content: fmtAmt(catSub),                  styles: catSubStyle },
    ])
  }

  body.push([
    { content: `${areaName} — Total`, colSpan: 5, styles: areaSubStyle },
    { content: fmtAmt(areaSubtotal),              styles: areaSubStyle },
  ])

  const headFill  = layout === 'modern' ? BRAND.map(c => Math.round(c * 0.82)) : tblHdrBg

  autoTable(doc, {
    startY: y,
    head:   [['No.', 'Description', 'Qty', 'Unit', `Unit Price (${currency})`, `Amount (${currency})`]],
    body,
    styles: {
      fontSize:    8.5,
      cellPadding: { top: 2.5, bottom: 2.5, left: 4, right: 4 },
      textColor:   theme.primary,
      lineColor:   theme.lineColor,
      lineWidth:   0.2,
      fillColor:   theme.rowBase,
    },
    headStyles: {
      fillColor:  headFill,
      textColor:  theme.tblHdrText,
      fontStyle:  'bold',
      fontSize:   7.5,
      lineWidth:  0,
    },
    columnStyles: {
      0: { cellWidth: 16,   halign: 'center' },
      1: { cellWidth: 'auto' },
      2: { cellWidth: 13,   halign: 'right'  },
      3: { cellWidth: 15,   halign: 'center' },
      4: { cellWidth: 30,   halign: 'right'  },
      5: { cellWidth: 30,   halign: 'right'  },
    },
    alternateRowStyles: { fillColor: theme.rowBase },
    margin:      { left: M, right: M, bottom: RESERVE, top: MINI_H + 6 },
    didAddPage:  () => drawMiniHeader(doc, settings, quote, BRAND, pageW, doc.internal.pageSize.height, layout, theme),
  })

  return doc.lastAutoTable.finalY + 8
}

// ── Main export ────────────────────────────────────────────────────────────────

export async function exportQuotePDF({
  quote, areas, itemsByArea, areaSubtotals,
  subtotal, gst, gstEnabled, total,
  settings,
}) {
  const layout   = (settings?.pdf_layout || 'modern').toLowerCase()
  const BRAND    = hexToRgb(settings?.brand_colour || '#E8622A')
  const theme    = THEMES[layout] || THEMES.modern
  const currency = quote.currency || 'USD'
  const pageW    = 210
  const pageH    = 297

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  let logoDataUrl = null
  if (settings?.company_logo_url) {
    logoDataUrl = await loadImageAsDataUrl(settings.company_logo_url).catch(() => null)
  }

  // ── PAGE 1 HEADER ─────────────────────────────────────────────────────────────

  let headerEnd
  if (layout === 'modern') {
    headerEnd = drawPage1Modern(doc, settings, quote, BRAND, logoDataUrl, pageW)
  } else if (layout === 'bw') {
    headerEnd = drawPage1BW(doc, settings, quote, logoDataUrl, pageW)
  } else if (layout === 'dark') {
    headerEnd = drawPage1Dark(doc, settings, quote, logoDataUrl, pageW, pageH)
  } else if (layout === 'warm') {
    headerEnd = drawPage1Warm(doc, settings, quote, logoDataUrl, pageW, pageH)
  } else if (layout === 'editorial') {
    headerEnd = drawPage1Editorial(doc, settings, quote, logoDataUrl, pageW)
  } else {
    headerEnd = drawPage1Classic(doc, settings, quote, BRAND, logoDataUrl, pageW)
  }

  sepLine(doc, headerEnd + 2, pageW, theme.rule, 0.4)

  const clientEnd = drawClientBlock(doc, quote, settings, headerEnd + 7, pageW, theme)
  sepLine(doc, clientEnd + 4, pageW, theme.rule, 0.4)

  let summaryEnd = drawSummary(
    doc, areas, areaSubtotals, itemsByArea,
    subtotal, gst, gstEnabled, total,
    quote, settings, BRAND, layout, theme, pageW, clientEnd + 10
  )

  // Notes
  if (quote.notes) {
    let ny = summaryEnd + 4
    if (ny + 18 > pageH - RESERVE) {
      doc.addPage()
      drawMiniHeader(doc, settings, quote, BRAND, pageW, pageH, layout, theme)
      ny = MINI_H + 6
    }
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8.5)
    doc.setTextColor(...theme.primary)
    doc.text('Notes', M, ny)
    ny += 5
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...theme.secondary)
    for (const line of doc.splitTextToSize(quote.notes, pageW - M * 2)) {
      if (ny + 5 > pageH - RESERVE) {
        doc.addPage()
        drawMiniHeader(doc, settings, quote, BRAND, pageW, pageH, layout, theme)
        ny = MINI_H + 6
      }
      doc.text(line, M, ny)
      ny += 4.5
    }
  }

  // ── DETAIL PAGES ─────────────────────────────────────────────────────────────

  const activeAreas = areas.filter(a => (itemsByArea.get(a) ?? []).length > 0)

  if (activeAreas.length > 0) {
    doc.addPage()
    drawMiniHeader(doc, settings, quote, BRAND, pageW, pageH, layout, theme)
    let dy = MINI_H + 6

    dy = drawSectionTitle(doc, 'DETAILED BREAKDOWN', dy, pageW, layout, BRAND, theme)

    for (const areaName of activeAreas) {
      const areaItems    = itemsByArea.get(areaName) ?? []
      const areaSubtotal = areaSubtotals.get(areaName) ?? 0
      dy = drawArea(doc, areaName, areaItems, areaSubtotal, BRAND, layout, theme, currency, pageW, pageH, settings, quote, dy)
    }
  }

  // ── T&C PAGE ─────────────────────────────────────────────────────────────────

  if (settings?.terms_and_conditions?.trim()) {
    doc.addPage()
    drawMiniHeader(doc, settings, quote, BRAND, pageW, pageH, layout, theme)
    let tcY = MINI_H + 6

    tcY = drawSectionTitle(doc, 'TERMS & CONDITIONS', tcY, pageW, layout, BRAND, theme)

    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8)
    doc.setTextColor(...theme.secondary)

    for (const line of doc.splitTextToSize(settings.terms_and_conditions, pageW - M * 2)) {
      if (tcY + 5 > pageH - RESERVE) {
        doc.addPage()
        drawMiniHeader(doc, settings, quote, BRAND, pageW, pageH, layout, theme)
        tcY = MINI_H + 6
      }
      doc.text(line, M, tcY)
      tcY += 4.5
    }
  }

  // ── PER-PAGE: signature + footer ──────────────────────────────────────────────

  const totalPages = doc.internal.getNumberOfPages()
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p)
    // Re-fill background for dark/warm on every page (sig block draws over it correctly)
    if (theme.bg) {
      doc.setFillColor(...theme.bg)
      doc.rect(0, pageH - SIG_H - FOOTER_H - 1, pageW, SIG_H + FOOTER_H + 1, 'F')
    }
    drawSignatureBlock(doc, pageW, pageH, quote.clientName, settings, p === totalPages, theme)
    drawPageFooter(doc, p, totalPages, pageW, pageH, theme)
  }

  const safeName = (quote.quoteNumber || 'quote').replace(/[^a-z0-9]/gi, '-').toLowerCase()

  await new Promise(resolve => setTimeout(resolve, 0))

  const blob = doc.output('blob')
  doc.internal = null

  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = `${safeName}.pdf`
  a.rel      = 'noopener'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 3000)
}
