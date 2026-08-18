import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANIES } from '../src/db/seed/companies.js';
import { EXTENDED_COMPANIES } from '../src/db/seed/companies-extended.js';
import { sectorFor } from '../src/db/seed/sectors.js';
import { ARCHETYPES } from '../src/db/seed/company-archetypes.js';

const ALL = [...COMPANIES, ...EXTENDED_COMPANIES];

test('company catalogue', async (t) => {
  await t.test('slugs and names are unique across both catalogues', () => {
    const slugs = new Set<string>();
    const names = new Set<string>();
    for (const company of ALL) {
      assert.ok(!slugs.has(company.slug), `duplicate slug: ${company.slug}`);
      assert.ok(!names.has(company.name), `duplicate name: ${company.name}`);
      slugs.add(company.slug);
      names.add(company.name);
    }
  });

  await t.test('slugs are url-safe and derived from the name', () => {
    for (const company of ALL) {
      assert.match(company.slug, /^[a-z0-9-]+$/, `bad slug: ${company.slug}`);
      // Catches the copy-paste failure where a brief keeps the slug of the row
      // it was duplicated from: the slug must share a word with the name.
      const nameWords = company.name.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter(Boolean);
      const slugWords = company.slug.split('-');
      const initials = nameWords.map((word) => word[0]).join('');
      const relatable =
        slugWords.some((word) => nameWords.some((n) => n.startsWith(word) || word.startsWith(n))) ||
        // Acronym slugs are fine: "hpe" for "Hewlett Packard Enterprise".
        slugWords.some((word) => initials.startsWith(word));
      assert.ok(relatable, `slug "${company.slug}" does not match name "${company.name}"`);
    }
  });

  await t.test('every company has rounds, and every round has sections', () => {
    for (const company of ALL) {
      assert.ok(company.rounds.length > 0, `${company.slug} has no rounds`);
      for (const round of company.rounds) {
        assert.ok(round.sections.length > 0, `${company.slug}/${round.slug} has no sections`);
        for (const section of round.sections) {
          assert.ok(section.questionCount > 0, `${company.slug}/${round.slug}/${section.slug} asks for 0 questions`);
          assert.ok(section.topics.length > 0, `${company.slug}/${round.slug}/${section.slug} has no topics`);
        }
      }
    }
  });

  await t.test('round slugs are unique within a company', () => {
    for (const company of ALL) {
      const seen = new Set<string>();
      for (const round of company.rounds) {
        assert.ok(!seen.has(round.slug), `${company.slug} repeats round slug ${round.slug}`);
        seen.add(round.slug);
      }
    }
  });

  await t.test('CTC range is sane', () => {
    for (const company of ALL) {
      assert.ok(company.ctcMinLpa > 0, `${company.slug} has a non-positive min CTC`);
      assert.ok(
        company.ctcMaxLpa >= company.ctcMinLpa,
        `${company.slug} max CTC ${company.ctcMaxLpa} is below min ${company.ctcMinLpa}`,
      );
    }
  });

  await t.test('templated companies say so, so a student is never misled', () => {
    for (const company of EXTENDED_COMPANIES) {
      const note = company.insights.find((insight) => insight.title.includes('hiring-process template'));
      assert.ok(note, `${company.slug} is templated but carries no provenance note`);
      assert.equal(note!.provenance, 'community_reported');
    }
  });

  await t.test('no templated insight is passed off as verified company policy', () => {
    for (const company of EXTENDED_COMPANIES) {
      for (const insight of company.insights) {
        if (insight.provenance !== 'verified') continue;
        // The only verified claims on a templated company are statements about
        // this platform's own content, not about the employer's process.
        assert.match(insight.title, /question bank/i, `${company.slug}: "${insight.title}" claims to be verified`);
      }
    }
  });

  await t.test('every archetype is actually used', () => {
    const used = new Set(EXTENDED_COMPANIES.map((c) => c.insights[0]?.body ?? ''));
    for (const [id, archetype] of Object.entries(ARCHETYPES)) {
      assert.ok(
        [...used].some((body) => body.includes(archetype.label)),
        `archetype ${id} (${archetype.label}) is defined but no company uses it`,
      );
    }
  });
});

test('sector bucketing', async (t) => {
  await t.test('picks the domain half of a compound label', () => {
    assert.equal(sectorFor('Investment Platform'), 'Banking & Financial Services');
    assert.equal(sectorFor('Banking Software'), 'Software Products');
    assert.equal(sectorFor('Software Engineering Services'), 'IT Services & Consulting');
    assert.equal(sectorFor('Financial Services Technology'), 'Banking & Financial Services');
    assert.equal(sectorFor('Telecom & Digital Services'), 'Telecom & Networking');
    assert.equal(sectorFor('Home Services Marketplace'), 'Internet & E-commerce');
    assert.equal(sectorFor('Consumer Products'), 'Manufacturing & Engineering');
  });

  await t.test('falls back to Other only for a missing label', () => {
    assert.equal(sectorFor(null), 'Other');
    assert.equal(sectorFor(''), 'Other');
  });

  await t.test('every company in the catalogue buckets to a real sector', () => {
    for (const company of ALL) {
      assert.notEqual(sectorFor(company.industry), 'Other', `${company.name} ("${company.industry}") is unbucketed`);
    }
  });
});
