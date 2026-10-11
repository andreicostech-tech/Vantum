// ============ TRANSLATIONS ============
// Languages and IP-country mapping. The texts themselves live in content/i18n.json
// (edited from /admin or by hand); build.mjs appends them below as `const I18N`.
const LANGS = {
  en: 'English',
  ro: 'Română',
  de: 'Deutsch',
  fr: 'Français',
  es: 'Español',
  it: 'Italiano',
};

// which language a visitor gets, based on the country of their IP
const COUNTRY_LANG = {
  RO: 'ro', MD: 'ro',
  DE: 'de', AT: 'de', CH: 'de', LI: 'de',
  FR: 'fr', BE: 'fr', LU: 'fr', MC: 'fr',
  ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es', VE: 'es', EC: 'es', GT: 'es', CU: 'es',
  BO: 'es', DO: 'es', HN: 'es', PY: 'es', SV: 'es', NI: 'es', CR: 'es', PA: 'es', UY: 'es',
  IT: 'it', SM: 'it', VA: 'it',
};
