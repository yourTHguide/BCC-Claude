// Single Meet Club — page copy. DRAFT: written from the SMC Digital Brand Kit
// v1.0 messaging hierarchy and the event details Guide approved. Replace with
// the final approved website copy; components read only from here.
//
// `draft: true` on an FAQ item marks an answer that depends on a business
// policy not yet confirmed — it renders with a visible "Draft" tag.

export const SMC_COPY = {
  hero: {
    eyebrow: 'Bangkok singles · Monthly social night',
    titleTop: 'Single',
    titleBottom: 'Meet Club',
    tagline: 'Good people. Great nights.',
    body:
      "A monthly social night for Bangkok singles who'd rather meet in real life. No swiping. No speed dating. Just good people, great conversations, and a night worth showing up for.",
    cta: 'Reserve your spot',
  },
  about: {
    eyebrow: 'About Single Meet Club',
    titleTop: 'Real people.',
    titleBottom: 'Real conversations.',
    body:
      "Meeting new people shouldn't feel complicated. We bring Bangkok singles together for a relaxed social night, with a few playful icebreakers to get conversations started. Come alone or bring a friend. We'll break the ice. You take it from there.",
  },
  expect: {
    eyebrow: 'What to expect',
    titleTop: 'A night that',
    titleBottom: 'makes it easy.',
    items: [
      { key: 'drink', label: 'Welcome drink' },
      { key: 'prompts', label: 'Conversation prompts' },
      { key: 'games', label: 'Fun games & icebreakers' },
      { key: 'mingling', label: 'Natural mingling' },
    ],
  },
  moments: {
    eyebrow: 'A look inside SMC',
    title: 'Real moments',
    body: "From easy first hellos to conversations that run late — here's a glimpse of the night.",
  },
  nextEdition: {
    eyebrow: 'Next edition',
    cta: 'Reserve your spot',
    mapCta: 'View on map',
  },
  faq: {
    title: 'FAQ',
    items: [
      {
        q: 'Is this speed dating?',
        a: "No. There are no rounds, timers or matching. It's a social night where everyone happens to be single — you mingle naturally, at your own pace.",
        draft: false,
      },
      {
        q: 'Can I come alone?',
        a: 'Yes. The night is designed so arriving solo feels easy — the welcome drink, conversation prompts and icebreakers get everyone talking.',
        draft: false,
      },
      {
        q: 'What age group comes?',
        a: 'Single Meet Club is for single adults, mostly aged around 25–45.',
        draft: true,
      },
      {
        q: "What's included in the ticket?",
        a: 'Entry to the night and one welcome drink. Further drinks are available from the bar.',
        draft: true,
      },
      {
        q: 'What happens after I book?',
        a: 'Booking confirmation details will be added here once online booking is live.',
        draft: true,
      },
    ],
  },
  footer: {
    endorsement: 'Presented by',
    venueLabel: 'Venue partner',
  },
} as const
