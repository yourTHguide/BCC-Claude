// Single Meet Club — page copy (approved). Components read only from here;
// event facts (date, venue, price, edition) live in lib/smc/config.ts.

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
      },
      {
        q: 'Can I come alone?',
        a: 'Yes. The night is designed so arriving solo feels easy — the welcome drink, conversation prompts and icebreakers get everyone talking.',
      },
      {
        q: 'What age group comes?',
        a: 'Single Meet Club is for single adults aged 20 and over. Please bring ID, as it may be checked at the door.',
      },
      {
        q: "What's included in the ticket?",
        a: 'Entry to the night and one welcome drink. Further drinks are available from the bar. Halloween costumes are optional.',
      },
      {
        q: 'What happens after I book?',
        a: "You'll receive a confirmation email with your QR ticket straight away. One QR code covers your whole booking, so your group checks in together. Tickets are non-refundable, but you can ask to transfer a ticket to another eligible guest up to 24 hours before the event.",
      },
    ],
  },
  footer: {
    endorsement: 'Presented by',
    venueLabel: 'Venue partner',
  },
} as const
