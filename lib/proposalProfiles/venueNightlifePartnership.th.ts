// SNX Phase 4 — Thai composition for the Venue / Nightlife Partnership
// Proposal Profile. Kept as its own file, deliberately separate from
// venueNightlifePartnership.ts, so this module can be reviewed/signed off
// by a Thai speaker in isolation from the English composer's diff, per the
// approved architecture. Same profile key (venue-nightlife-partnership),
// same locked section structure, same deal-term keys, same product-content
// seam — language is the only thing this file adds, resolved independently
// of the profile in lib/proposals.ts's composeProposalWithProfile().
//
// This is authored Thai business language, not a runtime translation of the
// English composer's output — there is no machine-translation call anywhere
// in this file or the render path. Canonical facts (Partner name, venue
// names, product/business display name, numbers, percentages, and any
// operator-entered commercial value) are read verbatim from the same
// ProposalWriterInputs the English composer reads and are never altered
// here. Only structure (headings), term LABELS, and surrounding prose are
// Thai-specific.
//
// Approved Thai section names (do NOT change without updating this file's
// own review): the operator handoff listed 9 Thai phrases in order. The
// first, ข้อเสนอความร่วมมือ, is the document/cover TITLE (the Thai
// counterpart of "PARTNERSHIP PROPOSAL" — see lib/proposalDocument.ts's
// language-aware meta.title); the remaining 8, in the same order, are the
// section headings below, matching the locked English structure 1:1:
//   แนวทางความร่วมมือ            -- Partnership Opportunity (explicitly NOT
//                                    the literal โอกาสในการร่วมมือ, per the
//                                    approved correction)
//   เกี่ยวกับกิจกรรม               -- About the Experience
//   รูปแบบความร่วมมือที่เสนอ        -- Proposed Collaboration
//   สิ่งที่เราดูแลและนำมาสู่ความร่วมมือ -- What We Bring
//   รูปแบบการดำเนินงานและการดูแลกลุ่ม -- Group Flow / Operating Model
//   เงื่อนไขทางการค้าและความร่วมมือ   -- Commercial & Partnership Terms
//   การทบทวนความร่วมมือรายเดือน     -- Monthly Review
//   ขั้นตอนถัดไป                   -- Next Steps

import type { ProposalWriterInputs } from '@/lib/proposalWriter'
import type { ProposalDealVariable } from '@/lib/dealVariables'
import { humanizeBusinessContexts } from '@/lib/operator/businessContexts'

// ── Term labels (approved, Phase 4 handoff §7) ─────────────────────────
// Keyed by the exact same `key`s nightlifeDealVariables() defines in the
// English module — every key there has a Thai label here, so no deal term
// ever falls back to its raw English label in a Thai proposal. Common
// nightlife words (Welcome Shot, Host, Bottle Service) are deliberately
// kept in English inside the label/value text below where that reads
// naturally in Thai hospitality context, per the approved guidance.
const TERM_LABELS_TH: Record<string, string> = {
  'commission': 'ค่าคอมมิชชัน / ส่วนแบ่งรายได้',
  'guest-entry': 'ค่าเข้าร่วมสำหรับแขก',
  'welcome-benefit': 'สิทธิพิเศษต้อนรับสำหรับแขก',
  'host-benefit': 'สิทธิพิเศษสำหรับโฮสต์',
  'minimum-guest-purchase': 'ยอดใช้จ่ายขั้นต่ำต่อแขก',
  'guest-bill-discount': 'ส่วนลดสำหรับแขก',
  'bottle-service-commission': 'ค่าคอมมิชชันจาก Bottle Service',
  'minimum-group-size': 'จำนวนแขกขั้นต่ำต่อกลุ่ม',
  'venue-stay-duration': 'ระยะเวลาที่ใช้ในแต่ละร้าน',
  'operating-rules': 'เงื่อนไขการดำเนินงาน',
  'review-cadence': 'รอบการทบทวนความร่วมมือ',
  'contract-period': 'ระยะเวลาความร่วมมือ',
  'exclusivity': 'เงื่อนไขสิทธิ์เฉพาะ',
}

// ── Default-value presentation (approved, Phase 4 handoff §8) ─────────
// The canonical Deal value is still the single source of truth — this map
// only decides how to WORD a value that is exactly the English profile
// default nightlifeDealVariables() ships (i.e. the operator never touched
// it). A value that doesn't match its key's `en` string here — whether a
// genuinely custom operator edit, or one of the four optional terms
// (commission/guest-bill-discount/bottle-service-commission/operating-
// rules), which have no default at all — is rendered verbatim, exactly as
// stored. Nothing here alters a custom operator-entered value.
const DEFAULT_VALUE_TH: Record<string, { en: string; th: string }> = {
  'guest-entry': { en: 'Free entry for our guests', th: 'เข้าฟรีสำหรับแขกของเรา' },
  'welcome-benefit': { en: '1 welcome shot per guest', th: 'Welcome Shot 1 แก้วต่อคน' },
  'host-benefit': { en: '1 complimentary drink per host', th: 'เครื่องดื่มฟรีสำหรับโฮสต์ 1 แก้วต่อคน' },
  'minimum-guest-purchase': { en: 'Minimum 1 drink per guest', th: 'แขกแต่ละคนสั่งเครื่องดื่มอย่างน้อย 1 แก้ว' },
  'minimum-group-size': { en: '5 guests', th: 'ขั้นต่ำ 5 คนต่อกลุ่ม' },
  'venue-stay-duration': {
    en: 'Approximately 1–1.5 hours per venue for moving/route-based events',
    th: 'ประมาณ 1–1.5 ชั่วโมงต่อร้าน สำหรับกิจกรรมที่มีการย้ายสถานที่',
  },
  'review-cadence': { en: 'Monthly', th: 'ทบทวนรายเดือน' },
  'contract-period': { en: 'Ongoing', th: 'ต่อเนื่อง' },
  'exclusivity': { en: 'Non-exclusive unless separately agreed', th: 'ไม่ผูกขาด เว้นแต่จะมีการตกลงเป็นอย่างอื่น' },
}

/** Resolves one deal variable's Thai label + rendered value, or null if it has no value (omitted — same "no TBD filler" rule as the English composer). */
function renderTermTh(variable: ProposalDealVariable): { label: string; value: string } | null {
  const value = variable.value?.trim()
  if (!value) return null
  const label = TERM_LABELS_TH[variable.key] ?? variable.label
  const mapped = DEFAULT_VALUE_TH[variable.key]
  const renderedValue = mapped && value === mapped.en ? mapped.th : value
  return { label, value: renderedValue }
}

// ── Product content (Thai) ─────────────────────────────────────────────
// Own Thai-authored registry, parallel to (not derived from) the English
// module's NIGHTLIFE_PRODUCT_CONTENT — same seam, same keys
// (business-context slug), independently maintained so this file stays
// self-contained. A context with no entry here falls back to
// genericNightlifeProductContentTh() rather than borrowing another
// product's description or the English text.

interface NightlifeProductContentTh {
  whatItIs: string
  targetAudience: string
  operatingModel: string
  whatWeBringToVenues: string[]
}

const NIGHTLIFE_PRODUCT_CONTENT_TH: Record<string, NightlifeProductContentTh> = {
  'bkk-club-crawl': {
    whatItIs:
      'Bangkok Club Crawl คือกิจกรรมไนต์ไลฟ์แบบมีไกด์นำทาง ดำเนินการโดย Best Nightlife Thailand แขกจะเข้าร่วมเส้นทางที่วางแผนไว้ล่วงหน้า และเคลื่อนที่ไปยังร้านต่าง ๆ ที่คัดสรร พร้อมโฮสต์ท้องถิ่นที่ดูแลจังหวะเวลา การเคลื่อนกลุ่ม และประสบการณ์ของแขกตลอดทั้งคืน',
    targetAudience:
      'นักท่องเที่ยว ชาวต่างชาติที่พำนักในไทย แขกเดี่ยว คู่รัก และกลุ่มเล็ก ที่ต้องการค่ำคืนแบบโซเชียลโดยไม่ต้องเริ่มต้นที่ร้านด้วยตัวเอง',
    operatingModel: 'โฮสต์ของ Bangkok Club Crawl เป็นผู้รับผิดชอบดูแลกลุ่ม จังหวะเวลา และการเคลื่อนกลุ่มระหว่างร้านอย่างราบรื่น',
    whatWeBringToVenues: [
      'กลุ่มแขกที่มีโฮสต์ท้องถิ่นของ Bangkok Club Crawl ดูแลตลอดกิจกรรม',
      'เส้นทางไนต์ไลฟ์ที่วางแผนไว้ล่วงหน้า ซึ่งสามารถรวมร้านพาร์ทเนอร์ได้หลายร้าน',
      'การบรีฟแขกก่อนเริ่มกิจกรรม พร้อมการนำทางตลอดค่ำคืน',
      'โอกาสในการเข้าเยี่ยมชมร้านเพิ่มเติมจากกลุ่มแขกของกิจกรรม',
      'จุดประสานงานที่ชัดเจนจากฝั่ง Bangkok Club Crawl',
      'การทบทวนผลลัพธ์รายเดือน เพื่อให้ทั้งสองฝ่ายปรับปรุงร่วมกันได้',
    ],
  },
  'best-nightlife': {
    whatItIs:
      'Best Nightlife Thailand คัดสรรและดูแลกิจกรรมไนต์ไลฟ์สำหรับนักท่องเที่ยว ชาวต่างชาติ และคนท้องถิ่นทั่วกรุงเทพฯ โดยเชื่อมโยงแขกเข้ากับร้านที่เหมาะกับค่ำคืนที่พวกเขามองหา',
    targetAudience: 'นักท่องเที่ยว ชาวต่างชาติที่พำนักในไทย และคนท้องถิ่น ที่มองหาค่ำคืนที่จัดสรรมาอย่างดี ไม่ใช่การเดินเข้าร้านด้วยตัวเอง',
    operatingModel: 'โฮสต์หรือผู้ประสานงานของ Best Nightlife Thailand เป็นจุดติดต่อหลักของกลุ่ม ดูแลจังหวะเวลาและประสบการณ์ของแขก',
    whatWeBringToVenues: [
      'กลุ่มแขกที่มีโฮสต์ดูแล หรือแขกที่ได้รับการแนะนำ พร้อมการบรีฟก่อนเข้าร้าน',
      'จุดประสานงานที่ชัดเจนจากฝั่ง Best Nightlife Thailand',
      'การนำแขกเข้าสู่ร้านในฐานะส่วนหนึ่งของค่ำคืนที่วางแผนไว้',
      'การทบทวนผลลัพธ์อย่างสม่ำเสมอ เพื่อให้ทั้งสองฝ่ายปรับปรุงร่วมกันได้',
    ],
  },
}

function genericNightlifeProductContentTh(label: string): NightlifeProductContentTh {
  return {
    whatItIs: `${label} คือกิจกรรมไนต์ไลฟ์แบบมีไกด์นำทาง แขกจะเข้าร่วมค่ำคืนที่วางแผนไว้ล่วงหน้า และเคลื่อนที่ไปยังร้านต่าง ๆ ที่คัดสรร พร้อมโฮสต์ท้องถิ่นที่ดูแลจังหวะเวลา การเคลื่อนกลุ่ม และประสบการณ์ของแขกตลอดทั้งคืน`,
    targetAudience:
      'นักท่องเที่ยว ชาวต่างชาติที่พำนักในไทย แขกเดี่ยว คู่รัก และกลุ่มเล็ก ที่ต้องการค่ำคืนแบบโซเชียลโดยไม่ต้องเริ่มต้นที่ร้านด้วยตัวเอง',
    operatingModel: `โฮสต์ของ ${label} เป็นผู้รับผิดชอบดูแลกลุ่ม จังหวะเวลา และการเคลื่อนกลุ่มระหว่างร้านอย่างราบรื่น`,
    whatWeBringToVenues: [
      'กลุ่มแขกที่มีโฮสต์ท้องถิ่นดูแลตลอดกิจกรรม',
      'เส้นทางที่วางแผนไว้ล่วงหน้า ซึ่งสามารถรวมร้านพาร์ทเนอร์ได้หลายร้าน',
      'การบรีฟแขกก่อนเริ่มกิจกรรม พร้อมการนำทางตลอดค่ำคืน',
      'โอกาสในการเข้าเยี่ยมชมร้านเพิ่มเติมจากกลุ่มแขกของกิจกรรม',
      'จุดประสานงานที่ชัดเจนจากฝั่งเรา',
      'การทบทวนผลลัพธ์รายเดือน เพื่อให้ทั้งสองฝ่ายปรับปรุงร่วมกันได้',
    ],
  }
}

function productLabel(businessContexts: string[], product?: string): string {
  if (product?.trim()) return product.trim()
  return humanizeBusinessContexts(businessContexts) || 'ความร่วมมือนี้'
}

function resolveProductContentTh(businessContexts: string[], label: string): NightlifeProductContentTh {
  return businessContexts.map((c) => NIGHTLIFE_PRODUCT_CONTENT_TH[c]).find(Boolean) ?? genericNightlifeProductContentTh(label)
}

// ── Composer ────────────────────────────────────────────────────────────
//
// `inputs.productProfile` (built by the English module's
// buildNightlifeProductProfile) is intentionally NOT read here for content —
// only its presence gates whether the About/What We Bring/Group Flow
// sections render, mirroring the English composer's own structure. All
// Thai copy in those sections is sourced fresh from resolveProductContentTh
// above, keyed the same way (businessContexts), so this file never renders
// English prose translated at runtime.

export function composeVenueNightlifePartnershipDraftTh(inputs: ProposalWriterInputs): string {
  const { productProfile, partnerDisplayName, businessContexts, product, venues, dealVariables } = inputs
  const label = productLabel(businessContexts, product)
  const productLine = product ? `${humanizeBusinessContexts(businessContexts) || label} — ${product}` : label
  const content = resolveProductContentTh(businessContexts, label)
  const lines: string[] = []

  // Cover — "ข้อเสนอความร่วมมือ" is the approved Thai document title (see
  // this file's header comment). lib/proposalDocument.ts's REDUNDANT_TITLE/
  // META_LINE strip this whole block before Preview/PDF rendering, exactly
  // like the English "# Partnership Proposal — …" header — it stays in
  // draft_content only for the operator's own raw-markdown editing view.
  lines.push(`# ข้อเสนอความร่วมมือ — ${partnerDisplayName}`)
  lines.push('')
  lines.push(`**สำหรับ:** ${productLine}  `)
  lines.push(`**จัดทำโดย:** Sanctuary Nexus Co., Ltd.  `)
  lines.push(`**วันที่:** ${inputs.proposalDate.slice(0, 10)}  `)
  if (inputs.version != null) lines.push(`**เวอร์ชัน:** v${inputs.version}`)
  lines.push('')
  lines.push('---')
  lines.push('')

  // แนวทางความร่วมมือ — Partnership Opportunity. Approved tone reference
  // (Phase 4 handoff §9), adapted to the actual product/partner.
  lines.push('## แนวทางความร่วมมือ')
  lines.push('')
  lines.push(
    `${label} มีความประสงค์ที่จะร่วมมือกับ ${partnerDisplayName} ในฐานะหนึ่งในพาร์ทเนอร์สถานที่ของกิจกรรม โดยเราจะดูแลการนำกลุ่มแขกมายังร้านในคืนที่เหมาะสมกับเส้นทางและรูปแบบของกิจกรรม ขณะที่ทางร้านได้รับโอกาสในการต้อนรับลูกค้าเพิ่มเติมจากกลุ่มของเรา`
  )
  lines.push('')
  lines.push(
    'รูปแบบความร่วมมือจะเน้นความยืดหยุ่นในการดำเนินงาน สามารถทดลอง ปรับรูปแบบ และทบทวนผลร่วมกันตามจำนวนแขกจริง ความเหมาะสมของเส้นทาง และความคิดเห็นจากทั้งสองฝ่าย'
  )
  lines.push('')

  // เกี่ยวกับกิจกรรม — About the Experience
  if (productProfile) {
    lines.push('## เกี่ยวกับกิจกรรม')
    lines.push('')
    lines.push(content.whatItIs)
    lines.push('')
    lines.push(`**กลุ่มแขกที่เรานำมา:** ${content.targetAudience}`)
    lines.push('')
  }

  // รูปแบบความร่วมมือที่เสนอ — Proposed Collaboration. Same single-vs-
  // multi-venue branching as the English composer (never assumed from the
  // Partner's name or venue count — see lib/proposals.ts's
  // resolveProposalVenues). A single venue never gets "more than one venue
  // in a night" language.
  lines.push('## รูปแบบความร่วมมือที่เสนอ')
  lines.push('')
  if (venues.length === 1) {
    lines.push(
      `เราขอเสนอให้ ${venues[0]} เป็นหนึ่งในร้านพาร์ทเนอร์สำหรับเส้นทางที่คัดสรรของ ${label}`
    )
    lines.push('')
    lines.push(
      'ร้านอาจได้รับการพิจารณาให้เข้าร่วมตามความเหมาะสมของเส้นทาง จังหวะเวลา รูปแบบของกลุ่มแขก และความเหมาะสมในการดำเนินงานของแต่ละคืน ความร่วมมือนี้จะเริ่มต้นในลักษณะการทำงานร่วมกันอย่างชัดเจน ยืนยันเงื่อนไข ทดลองคืนที่คัดเลือก ทบทวนผลจริง และปรับปรุงร่วมกัน'
    )
  } else if (venues.length > 1) {
    lines.push(`เราขอเสนอให้ร้านที่คัดสรรของ ${partnerDisplayName} เข้าร่วมเป็นส่วนหนึ่งของเส้นทาง ${label} โดยเริ่มต้นจาก:`)
    lines.push('')
    for (const venue of venues) lines.push(`- ${venue}`)
    lines.push('')
    lines.push(
      `${label} อาจพาแขกเข้าเยี่ยมชมร้านของ ${partnerDisplayName} มากกว่าหนึ่งร้านในคืนเดียว ขึ้นอยู่กับเส้นทาง จังหวะเวลา รูปแบบของกลุ่มแขก และความเหมาะสมในการดำเนินงานของแต่ละร้าน ความร่วมมือนี้จะเริ่มต้นในลักษณะการทำงานร่วมกันอย่างชัดเจน ยืนยันเงื่อนไข ทดลองคืนที่คัดเลือก ทบทวนผลจริง และปรับปรุงร่วมกัน`
    )
  } else {
    lines.push(`เราขอเสนอให้ ${partnerDisplayName} เข้าร่วมเป็นส่วนหนึ่งของเส้นทาง ${label}`)
    lines.push('')
    lines.push('ความร่วมมือนี้จะเริ่มต้นในลักษณะการทำงานร่วมกันอย่างชัดเจน ยืนยันเงื่อนไข ทดลองคืนที่คัดเลือก ทบทวนผลจริง และปรับปรุงร่วมกัน')
  }
  lines.push('')

  // สิ่งที่เราดูแลและนำมาสู่ความร่วมมือ — What We Bring
  if (productProfile) {
    lines.push('## สิ่งที่เราดูแลและนำมาสู่ความร่วมมือ')
    lines.push('')
    for (const item of content.whatWeBringToVenues) lines.push(`- ${item}`)
    lines.push('')
    lines.push(
      `${label} ไม่ได้รับประกันจำนวนแขกที่จะเข้าร่วม จำนวนแขกจริงขึ้นอยู่กับยอดจองที่ยืนยัน ฤดูกาล วันที่จัดกิจกรรม สภาพอากาศ ประสิทธิภาพการตลาด และความต้องการปกติของธุรกิจไนต์ไลฟ์`
    )
    lines.push('')
  }

  // รูปแบบการดำเนินงานและการดูแลกลุ่ม — Group Flow / Operating Model
  if (productProfile) {
    lines.push('## รูปแบบการดำเนินงานและการดูแลกลุ่ม')
    lines.push('')
    lines.push(content.operatingModel + ' ทางร้านเพียงให้บริการตามปกติ พร้อมสิทธิพิเศษที่ตกลงร่วมกัน')
    lines.push('')
    lines.push(
      'สำหรับกิจกรรมที่มีการย้ายสถานที่ ระยะเวลาที่ใช้ในแต่ละร้านโดยทั่วไปจะอยู่ที่ประมาณ 1–1.5 ชั่วโมง ทั้งนี้ระยะเวลาที่แท้จริงอาจแตกต่างกันไปตามการดำเนินงานจริง'
    )
    lines.push('')
  }

  // เงื่อนไขทางการค้าและความร่วมมือ — Commercial & Partnership Terms.
  // Same "populated terms only, no TBD filler" rule as the English composer.
  lines.push('## เงื่อนไขทางการค้าและความร่วมมือ')
  lines.push('')
  const populated = dealVariables.map(renderTermTh).filter((row): row is { label: string; value: string } => row !== null)
  if (populated.length === 0) {
    lines.push('_เงื่อนไขจะกำหนดร่วมกันภายหลัง_')
  } else {
    for (const row of populated) lines.push(`- **${row.label}:** ${row.value}`)
    lines.push('')
    lines.push('เงื่อนไขใดที่ไม่ได้ระบุไว้ข้างต้น ถือว่ายังไม่มีการตกลงร่วมกัน')
  }
  lines.push('')

  // การทบทวนความร่วมมือรายเดือน — Monthly Review. Same topics as English.
  lines.push('## การทบทวนความร่วมมือรายเดือน')
  lines.push('')
  lines.push('เราแนะนำให้มีการทบทวนความร่วมมือเป็นประจำ โดยเฉพาะในช่วงเริ่มต้นของความร่วมมือ ครอบคลุมหัวข้อดังนี้:')
  lines.push('')
  lines.push(`- จำนวนคืน/กิจกรรมที่เกี่ยวข้องกับร้านของ ${partnerDisplayName}`)
  lines.push('- จำนวนแขกและการเคลื่อนกลุ่ม')
  lines.push('- ความเหมาะสมของจังหวะเวลาและเส้นทาง')
  lines.push('- ความคิดเห็นจากทางร้าน')
  lines.push('- ความคิดเห็นจากโฮสต์')
  lines.push('- พฤติกรรมของแขกและความเหมาะสมในการดำเนินงาน')
  lines.push('- ผลด้านการค้าที่สามารถวัดผลได้')
  lines.push('- การเปลี่ยนแปลงที่จำเป็นต่อเงื่อนไข จังหวะเวลา หรือรูปแบบการดำเนินงาน')
  lines.push('')
  lines.push('การทบทวนนี้ช่วยให้ความร่วมมือดำเนินไปตามผลจริง ไม่ใช่ข้อสันนิษฐาน')
  lines.push('')

  // ขั้นตอนถัดไป — Next Steps. Concise, operational, no signature/contract language.
  lines.push('## ขั้นตอนถัดไป')
  lines.push('')
  lines.push(
    `เมื่อยืนยันเงื่อนไขข้างต้นแล้ว ทั้งสองฝ่ายสามารถเริ่มต้นคืนที่คัดเลือกได้ และทบทวนผลตามรอบที่ตกลงร่วมกัน เรายินดีปรับรายละเอียดร่วมกัน เพื่อให้ความร่วมมือนี้เหมาะสมกับ ${partnerDisplayName}, ${label} และแขกที่เข้าร่วมกิจกรรม`
  )
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('_เอกสารนี้เป็นข้อเสนอความร่วมมือเบื้องต้น ยังไม่มีผลผูกพันจนกว่าทั้งสองฝ่ายจะตกลงร่วมกันเป็นลายลักษณ์อักษร_')
  lines.push('')

  return lines.join('\n')
}
