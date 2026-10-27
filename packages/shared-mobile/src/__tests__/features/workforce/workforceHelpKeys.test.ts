import { employerTranslation as en } from '../../../core/i18n/locales/employer/en';
import { employerTranslation as hi } from '../../../core/i18n/locales/employer/hi';

// Every status the employer can see needs its "what happens next" copy, in English and Hindi,
// otherwise the screen would show a raw key like wf_next_Approved_title.
const STATUSES = ['Submitted', 'UnderReview', 'Approved', 'Rejected', 'PartiallyFulfilled', 'Fulfilled', 'Closed', 'Cancelled'];

describe('Workforce help text (employer app)', () => {
  for (const [name, dict] of [['en', en], ['hi', hi]] as const) {
    const d = dict as unknown as Record<string, string>;
    it(`${name}: every status has a next-step title and text`, () => {
      for (const s of STATUSES) {
        expect(d[`wf_next_${s}_title`]).toBeTruthy();
        expect(d[`wf_next_${s}_text`]).toBeTruthy();
      }
    });
    it(`${name}: the how-it-works, lifecycle and field notes exist`, () => {
      for (const k of ['wf_help_list_title', 'wf_step_submit_t', 'wf_step_review_t', 'wf_step_confirm_t', 'wf_step_start_t', 'wf_life_1', 'wf_life_5', 'wf_note_cancel', 'wf_note_site', 'wf_note_submit', 'wf_progress_label', 'wf_help_inv_title']) {
        expect(d[k]).toBeTruthy();
      }
    });
  }
  it('Hindi progress text keeps both placeholders', () => {
    const d = hi as unknown as Record<string, string>;
    expect(d.wf_progress_label).toContain('{{done}}');
    expect(d.wf_progress_label).toContain('{{total}}');
  });
});
