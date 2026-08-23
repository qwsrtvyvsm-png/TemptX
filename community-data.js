/* TEMPTX Community — reference/seed data, loaded before community.js.
   Plain top-level `const`s (no build step / no modules on this site) so
   community.js can read them directly once this script tag has run.

   Two different kinds of data live here:
   1. Presentation copy for boards, the intent grid, resources, the pathway,
      and contribution cards — this is real, permanent site copy, just kept
      out of the HTML so community.js can render it consistently.
   2. SEED_EVENTS — clearly-marked placeholder/demo content. TEMPTX has no
      events/calendar backend yet, so these are illustrative only and must
      never be presented as live, confirmed events. Replace this array wholesale
      once a real events system exists; don't hand-edit around it.
*/

const COMMUNITY_BOARDS = [
  { key: "discussions", label: "Discussions", description: "General conversation across the community." },
  { key: "qna", label: "Questions & Answers", description: "Ask a question, get real answers, mark the one that helped." },
  { key: "stories-experiences", label: "Stories & Experiences", description: "Share what you've learned — in your words." },
  { key: "tips-advice", label: "Tips & Advice", description: "Practical knowledge from people who've done it." },
  { key: "industry-talk", label: "Industry Talk", description: "Trends, changes, and issues affecting the industry." },
  { key: "announcements", label: "Announcements", description: "Official TemptX updates.", staffOnly: true },
  { key: "feedback-ideas", label: "Feedback & Ideas", description: "Suggestions for TemptX itself." },
  { key: "safety-support", label: "Safety & Support", description: "Safety questions and support conversations." },
  { key: "local-district", label: "Local / District Chat", description: "Local recommendations and area chat." }
];

const COMMUNITY_INTENT_GRID = [
  { n: "01", label: "Ask a question", description: "Post to Questions & Answers and get real answers.", href: "community.html?board=qna&compose=question#compose" },
  { n: "02", label: "Find information", description: "Browse guides, FAQs, and the resource directory.", href: "#resources" },
  { n: "03", label: "Get support", description: "Talk to the community or reach TemptX Support.", href: "community-support.html" },
  { n: "04", label: "Solve a problem", description: "Report an issue and track it privately.", href: "report.html" },
  { n: "05", label: "Stay safe", description: "Screening, red flags, and platform safety rules.", href: "safety-hub.html" },
  { n: "06", label: "Understand my rights", description: "What TemptX expects — and what you can expect back.", href: "community-standards.html" },
  { n: "07", label: "Find opportunities", description: "Apply, advertise, or list your services.", href: "why-temptx.html" },
  { n: "08", label: "Meet people", description: "Join a group built around what you do.", href: "#groups" },
  { n: "09", label: "Report something", description: "Flag a profile, post, or safety concern.", href: "report.html" },
  { n: "10", label: "Learn something new", description: "Consent, privacy, and industry basics.", href: "educational-hub.html" }
];

const COMMUNITY_POPULAR_SEARCHES = ["verification", "safety", "getting started", "profile", "payments", "privacy"];

// Real destinations only — every card below links to a page that already
// exists and works. No placeholder resource pages were invented for this.
const COMMUNITY_FEATURED_RESOURCES = [
  {
    id: "new-member-checklist",
    title: "New Member Checklist",
    description: "Start here — the essentials for setting up and using TemptX well.",
    category: "Getting started",
    updated: "2026-08",
    href: "community-support.html"
  },
  {
    id: "safety-planning-guide",
    title: "Safety Planning Guide",
    description: "Screening, meeting safely, and what to do if something feels wrong.",
    category: "Safety",
    updated: "2026-08",
    href: "safety-hub.html"
  },
  {
    id: "community-guidelines",
    title: "Community Guidelines",
    description: "What's expected of every member — and how reports are handled.",
    category: "Community",
    updated: "2026-08",
    href: "community-standards.html"
  },
  {
    id: "understanding-verification",
    title: "Understanding Verification",
    description: "What each verification status confirms, and what it doesn't.",
    category: "Trust & safety",
    updated: "2026-08",
    href: "verification.html"
  },
  {
    id: "sex-work-resources",
    title: "Sex Work Resources",
    description: "Peer organisations, health services, and legal information.",
    category: "Support",
    updated: "2026-08",
    href: "sex-work-resources.html"
  },
  {
    id: "educational-hub",
    title: "Educational Hub",
    description: "Consent, communication, and privacy basics for the industry.",
    category: "Learn",
    updated: "2026-08",
    href: "educational-hub.html"
  }
];

const COMMUNITY_RESOURCE_DIRECTORY = [
  { id: "faq", title: "FAQ", description: "Straight answers about accounts, privacy, and joining.", href: "faq.html" },
  { id: "safety-hub", title: "Safety Hub", description: "Guidance for safer decisions, screening, and consent.", href: "safety-hub.html" },
  { id: "educational-hub-directory", title: "Educational Hub", description: "Stigma-aware information for navigating the industry.", href: "educational-hub.html" },
  { id: "sex-work-resources-directory", title: "Sex Work Resources", description: "Support, health, legal, and peer-led services.", href: "sex-work-resources.html" },
  { id: "sex-work-abbreviations", title: "Sex Work Abbreviations", description: "A plain-language guide to common directory terms.", href: "sex-work-abbreviations.html" },
  { id: "friendly-businesses", title: "Friendly Businesses", description: "Services that work respectfully with the industry.", href: "friendly-businesses.html" },
  { id: "community-standards-directory", title: "Community Standards", description: "The rules every member and post is held to.", href: "community-standards.html" },
  { id: "verification-standard", title: "Verification Standard", description: "What TemptX verification checks actually cover.", href: "verification.html" },
  { id: "moderation-process", title: "Moderation Process", description: "How reports are received, prioritised, and actioned.", href: "moderation.html" },
  { id: "useful-links", title: "Useful Links", description: "A curated doorway to support and industry information.", href: "links.html" }
];

const COMMUNITY_SUPPORT_CATEGORIES = [
  { label: "Safety concern", href: "report.html?type=other&category=coercion" },
  { label: "Harassment", href: "report.html?type=conversation&category=harassment" },
  { label: "Scam", href: "report.html?type=profile&category=scam" },
  { label: "Account issue", href: "report.html?type=account&category=other" },
  { label: "Privacy concern", href: "report.html?type=technical&category=privacy" },
  { label: "Something else", href: "report.html?type=other&category=other" }
];

const COMMUNITY_PATHWAY = [
  { key: "start", label: "Start", title: "New here? Learn the basics.", href: "community-support.html" },
  { key: "understand", label: "Understand", title: "Get the knowledge you need.", href: "educational-hub.html" },
  { key: "prepare", label: "Prepare", title: "Stay safe and ready.", href: "safety-hub.html" },
  { key: "connect", label: "Connect", title: "Meet the right people.", href: "#groups" },
  { key: "participate", label: "Participate", title: "Ask, share, and contribute.", href: "#discussions" },
  { key: "grow", label: "Grow", title: "Build confidence and recognition.", href: "#contributions-panel" }
];

// Topic key maps to either a board (discussions filtered/searched by tag),
// a group, a role count from /api/community/stats, or an external page —
// counts are filled in at runtime from real data, never hardcoded here.
const COMMUNITY_TOPICS = [
  { key: "providers", label: "Providers", source: { type: "members", role: "provider" }, href: "community.html?group=providers" },
  { key: "clients", label: "Clients", source: { type: "members", role: "client" }, href: "community.html?group=clients" },
  { key: "creators", label: "Creators", source: { type: "members", role: "creator" }, href: "community.html?group=creators" },
  { key: "new-members", label: "New Members", source: { type: "group", key: "new-members" }, href: "community.html?group=new-members" },
  { key: "safety", label: "Safety", source: { type: "board", key: "safety-support" }, href: "community.html?board=safety-support" },
  { key: "industry-talk", label: "Industry Talk", source: { type: "board", key: "industry-talk" }, href: "community.html?board=industry-talk" },
  { key: "business", label: "Business & Branding", source: { type: "group", key: "business" }, href: "community.html?group=business" },
  { key: "technology", label: "Technology", source: { type: "group", key: "technology" }, href: "community.html?group=technology" }
];

const COMMUNITY_CONTRIBUTION_CARDS = [
  { title: "Join the Conversation", description: "Jump into discussions, ask questions, and share your experience.", cta: "Start now", href: "community.html?board=discussions#compose" },
  { title: "Find Your Group", description: "Connect with people who get it. Groups for every interest.", cta: "Explore groups", href: "#groups" },
  { title: "Share Your Knowledge", description: "Help others by answering questions in Q&A.", cta: "Answer a question", href: "community.html?board=qna" },
  { title: "Get Recognised", description: "Contribution badges reward useful participation, not popularity.", cta: "Learn more", href: "#contributions" },
  { title: "Help Shape TemptX", description: "Your feedback drives what we build next.", cta: "Submit an idea", href: "#feedback" }
];

// Illustrative schedule only — TemptX has no events/calendar backend yet.
// Dates are relative to the current build so the page never shows a stale
// "past" event; replace this whole array once real events exist.
const SEED_EVENTS = [
  {
    id: "community-qna",
    title: "Community Q&A",
    description: "Live with the TemptX team — ask us anything.",
    daysFromNow: 16,
    time: "20:00",
    durationMinutes: 60,
    format: "Online",
    cta: "community.html?board=discussions"
  },
  {
    id: "creator-workshop",
    title: "Creator Workshop",
    description: "Content that connects — a working session for creators.",
    daysFromNow: 23,
    time: "19:00",
    durationMinutes: 90,
    format: "Online",
    cta: "community.html?group=creators"
  },
  {
    id: "safety-first",
    title: "Safety First",
    description: "Practical screening and safety tips, open discussion.",
    daysFromNow: 30,
    time: "18:00",
    durationMinutes: 60,
    format: "Online",
    cta: "safety-hub.html"
  }
];
