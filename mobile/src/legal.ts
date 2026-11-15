export const LEGAL_VERSION = '2026-11-08';
export const CONTACT = 'privacy@perigee.example'; // TODO: replace with the team's real contact before App Store submission

type Doc = { title: string; updated: string; sections: { h: string; p: string[] }[] };

export const LEGAL: Record<'terms' | 'privacy' | 'cookies', Doc> = {
  terms: {
    title: 'Terms of Use',
    updated: LEGAL_VERSION,
    sections: [
      { h: '1. What HMSC is', p: ['HMSC is a health-monitoring companion for astronauts, analog-mission crews and training participants. It collects health indicators you choose to share, compares them with your personal baseline and suggests actions that complement the plan prescribed by your mission and flight surgeon.'] },
      { h: '2. Not a medical device', p: ['HMSC does not diagnose, treat, cure or prevent any disease and is not a substitute for a physician or flight surgeon. Colour codes and suggestions are informational. In an emergency, follow your mission\'s medical procedures and contact your flight surgeon or emergency services immediately.', 'Suggestions that would go beyond your prescribed plan are marked "needs approval" and must be confirmed by your flight surgeon before you act on them.'] },
      { h: '3. Eligibility', p: ['You must be at least 18 years old to create an account. By registering you confirm the date of birth you provided is accurate.'] },
      { h: '4. Your account', p: ['Keep your password confidential. You are responsible for activity under your account. You can delete your account at any time from Profile → Delete account; this permanently removes your health data from our servers.'] },
      { h: '5. Third-party devices', p: ['If you connect WHOOP or another service, their terms also apply. You can disconnect at any time; we then stop importing data and revoke our access where the provider allows it.'] },
      { h: '6. Acceptable use', p: ['Do not attempt to access other users\' data, reverse-engineer the service, or upload data you are not entitled to share.'] },
      { h: '7. Prototype status', p: ['HMSC is developed for the NASA Space Apps Challenge 2026. It is not affiliated with or endorsed by NASA. Features, thresholds and availability may change. The service is provided "as is" without warranties to the extent permitted by law.'] },
      { h: '8. Contact', p: [`Questions: ${CONTACT}`] },
    ],
  },
  privacy: {
    title: 'Privacy Policy',
    updated: LEGAL_VERSION,
    sections: [
      { h: 'Summary', p: ['We collect the minimum data needed to show your health status. We never sell your data, never use it for advertising and never track you across apps or websites.'] },
      { h: 'What we collect', p: ['Account: name, email, date of birth (age verification), role and mission name.', 'Health data you provide or connect: vital signs, sleep, mood, symptoms, lab results, body measurements, radiation and environment readings, and data imported from WHOOP (recovery, HRV, resting heart rate, SpO₂, sleep, strain, body measurements).', 'Technical: a session identifier stored in a secure cookie (web) or the device keychain (iOS).'] },
      { h: 'Legal basis & consent', p: ['Health data is a special category of personal data. We process it only with your explicit consent, given at registration, which you can withdraw at any time by deleting your account or disconnecting a source.'] },
      { h: 'How we use it', p: ['To compute your indicators, body-system status, readiness score and adaptive plan; to generate reports you choose to send to your flight surgeon; and to keep your account secure.'] },
      { h: 'Sharing', p: ['Your data is visible only to you. A report is shared with your flight surgeon only when you press "Send report". Infrastructure providers (hosting) process data on our behalf under contract.'] },
      { h: 'Security', p: ['Passwords are hashed with scrypt. Third-party tokens are encrypted at rest (AES-256-GCM). All traffic uses HTTPS in production. Sessions expire after 30 days.'] },
      { h: 'Retention & your rights', p: ['We keep your data while your account exists. You can export everything (Profile → Export my data) and delete your account and all data at any time. You may also request correction or access by contacting us.'] },
      { h: 'Children', p: ['HMSC is not intended for anyone under 18 and we do not knowingly collect their data.'] },
      { h: 'Contact', p: [`Data controller contact: ${CONTACT}`] },
    ],
  },
  cookies: {
    title: 'Cookie Policy',
    updated: LEGAL_VERSION,
    sections: [
      { h: 'Essential cookies only', p: ['The web version sets one cookie: pg_session — an HttpOnly, SameSite=Lax session cookie that keeps you signed in (30 days). It is strictly necessary and cannot be switched off without signing out.'] },
      { h: 'Local storage', p: ['We remember your cookie-banner choice in your browser\'s local storage (pg_cookie_consent).'] },
      { h: 'No tracking', p: ['We do not use analytics, advertising or third-party tracking cookies. If this ever changes we will ask for your consent first.'] },
    ],
  },
};
