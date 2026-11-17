import fs from 'fs';
import path from 'path';
import { resources } from '../../core/i18n/translations';

const SRC = path.resolve(__dirname, '../..');
const walk = (d: string, out: string[] = []): string[] => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== '__tests__' && e.name !== 'node_modules') walk(p, out); }
    else if (/\.tsx$/.test(e.name)) out.push(p);
  }
  return out;
};

// Screens that translate with the `employer` namespace must only use keys that exist in it (or in the default
// namespace) — otherwise the user sees English fallback text or the raw key in every language.
describe('every t("key") used by employer-namespace screens is defined', () => {
  const empKeys = new Set(Object.keys(resources.en.employer));
  const baseKeys = new Set(Object.keys(resources.en.translation));
  const missing: string[] = [];
  for (const f of walk(SRC)) {
    const s = fs.readFileSync(f, 'utf8');
    if (!s.includes("useTranslation('employer')")) continue;
    for (const m of s.matchAll(/\bt\('([A-Za-z0-9_]+)'/g)) {
      if (!empKeys.has(m[1]) && !baseKeys.has(m[1])) missing.push(`${path.relative(SRC, f)} → ${m[1]}`);
    }
  }
  it('has no undefined keys', () => expect([...new Set(missing)].sort()).toEqual([]));
});
