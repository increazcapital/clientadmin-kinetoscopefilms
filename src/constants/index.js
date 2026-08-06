/* ============================================================
   Constants: index.js
   Description: App-wide constants for Client Portal
   ============================================================ */

/* ── Journey Steps ─────────────────────── */
export const JOURNEY_STEPS = [
  { id: 1, label: 'Account Created', key: 'accountCreated' },
  { id: 2, label: 'Onboarding Details', key: 'onboardingComplete' },
  { id: 3, label: 'KYC Submitted', key: 'kycSubmitted' },
  { id: 4, label: 'Agreement Signed', key: 'agreementSigned' },
  { id: 5, label: 'First Investment', key: 'firstInvestment' },
  { id: 6, label: 'ROI Configured', key: 'roiConfigured' },
  { id: 7, label: 'First ROI Received', key: 'firstRoiReceived' },
];

/* ── Investment Segments ─────────────────────── */
export const SEGMENTS = [
  'Film Making',
  'Distribution',
  'Music',
  'Trading & Syndication',
  'Content IP Bank',
  'Film Exhibition',
];

/* ── Risk Profiles (placeholder — pending client values) ─────────────────────── */
export const RISK_PROFILES = [
  {
    id: 'conservative',
    label: 'Conservative',
    description: 'Low-risk allocation focused on stable, long-term returns with minimal volatility.',
    icon: '🛡️',
  },
  {
    id: 'moderate',
    label: 'Moderate',
    description: 'Balanced mix of growth and safety, suitable for medium-term investment horizons.',
    icon: '⚖️',
  },
  {
    id: 'aggressive',
    label: 'Aggressive',
    description: 'High-growth allocation targeting maximum returns with higher risk tolerance.',
    icon: '🚀',
  },
];

/* ── Service Request Categories ─────────────────────── */
export const REQUEST_CATEGORIES = [
  'Profile Update',
  'Investment Query',
  'Project Investment Request',
  'Risk Profile Change',
  'Contract Period Extended',
  'Payment Issue',
  'Document Request',
  'Other',
];

/* ── Perk Tiers ─────────────────────── */
export const PERK_TIERS = {
  Silver: {
    label: 'Silver',
    icon: '🥈',
    minAmount: 0,
    maxAmount: 500000,
    color: 'silver',
    benefits: [
      'Monthly investment reports',
      'Email support (24hr response)',
      'Basic portfolio insights',
    ],
  },
  Gold: {
    label: 'Gold',
    icon: '🥇',
    minAmount: 500001,
    maxAmount: 1500000,
    color: 'gold',
    benefits: [
      'All Silver benefits',
      'Priority support (12hr response)',
      'Quarterly investment review call',
      'Early access to new projects',
    ],
  },
  Platinum: {
    label: 'Platinum',
    icon: '💎',
    minAmount: 1500001,
    maxAmount: 5000000,
    color: 'platinum',
    benefits: [
      'All Gold benefits',
      'Dedicated relationship manager',
      'Exclusive event invitations',
      'Bonus eligibility (annual)',
      'Priority project allocation',
    ],
  },
  Diamond: {
    label: 'Diamond',
    icon: '👑',
    minAmount: 5000001,
    maxAmount: null,
    color: 'diamond',
    benefits: [
      'All Platinum benefits',
      'VIP concierge service',
      'Board-level investment insights',
      'Film premiere invitations',
      'Maximum bonus eligibility',
      'Custom investment strategies',
    ],
  },
};

/* ── Nominee Relation Options ─────────────────────── */
export const NOMINEE_RELATIONS = [
  'Spouse',
  'Parent',
  'Child',
  'Sibling',
  'Other',
];

/* ============ END: constants/index.js ============ */
