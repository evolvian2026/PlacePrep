/**
 * Matches a student's profile against a company's eligibility criteria.
 *
 * Every student's first question about a company is "can I even apply?", and
 * the answer is already in the data — `users.branch/graduation_year/cgpa`
 * against `companies.eligible_branches/eligible_years/min_cgpa`. This joins
 * the two and explains the verdict rather than just returning a boolean.
 *
 * A criterion the student has not filled in is `unknown`, never a rejection:
 * telling someone they are ineligible because their own profile is blank
 * would be both wrong and discouraging.
 */
import type { Db } from '../db/index.js';
import { db as sharedDb } from '../db/index.js';
import { json } from '../lib/util.js';

export interface StudentProfile {
  branch: string | null;
  graduationYear: number | null;
  cgpa: number | null;
}

export interface CompanyCriteria {
  eligibleBranches: string[];
  eligibleYears: number[];
  minCgpa: number | null;
}

export type EligibilityStatus = 'eligible' | 'not_eligible' | 'unknown';

export interface Eligibility {
  status: EligibilityStatus;
  /** Why the student does not qualify. Empty unless status is 'not_eligible'. */
  blockers: string[];
  /** Profile fields the student has not filled in, so the check is incomplete. */
  missingProfile: string[];
  /** Criteria that were checked and passed — shown as reassurance. */
  met: string[];
}

/**
 * Branch names arrive in many spellings ("CSE", "cse", "Computer Science").
 * Normalising to a lowercase alphanumeric key catches the common variants
 * without pretending to be a full taxonomy.
 */
function branchKey(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

const BRANCH_ALIASES: Record<string, string> = {
  computerscience: 'cse',
  computerscienceengineering: 'cse',
  cs: 'cse',
  informationtechnology: 'it',
  electronics: 'ece',
  electronicsandcommunication: 'ece',
  electronicscommunication: 'ece',
  electrical: 'eee',
  electricalandelectronics: 'eee',
  mech: 'mechanical',
  civilengineering: 'civil',
};

function canonicalBranch(value: string): string {
  const key = branchKey(value);
  return BRANCH_ALIASES[key] ?? key;
}

export function evaluateEligibility(profile: StudentProfile, criteria: CompanyCriteria): Eligibility {
  const blockers: string[] = [];
  const missingProfile: string[] = [];
  const met: string[] = [];

  if (criteria.eligibleBranches.length > 0) {
    if (!profile.branch) {
      missingProfile.push('branch');
    } else {
      const allowed = criteria.eligibleBranches.map(canonicalBranch);
      if (allowed.includes(canonicalBranch(profile.branch))) {
        met.push(`Open to ${profile.branch}`);
      } else {
        blockers.push(`Open to ${criteria.eligibleBranches.join(', ')} — not ${profile.branch}`);
      }
    }
  }

  if (criteria.eligibleYears.length > 0) {
    if (!profile.graduationYear) {
      missingProfile.push('graduation year');
    } else if (criteria.eligibleYears.includes(profile.graduationYear)) {
      met.push(`Hiring the ${profile.graduationYear} batch`);
    } else {
      blockers.push(`Hiring the ${criteria.eligibleYears.join(', ')} batch — not ${profile.graduationYear}`);
    }
  }

  if (criteria.minCgpa !== null && criteria.minCgpa > 0) {
    if (profile.cgpa === null) {
      missingProfile.push('CGPA');
    } else if (profile.cgpa >= criteria.minCgpa) {
      met.push(`CGPA ${profile.cgpa} clears the ${criteria.minCgpa} cut-off`);
    } else {
      blockers.push(`Needs CGPA ${criteria.minCgpa} — yours is ${profile.cgpa}`);
    }
  }

  // A failed criterion is decisive even if another is unknown: no amount of
  // filling in the profile will make an ineligible branch eligible.
  if (blockers.length > 0) return { status: 'not_eligible', blockers, missingProfile, met };
  if (missingProfile.length > 0) return { status: 'unknown', blockers, missingProfile, met };
  return { status: 'eligible', blockers, missingProfile, met };
}

/** Reads the profile the eligibility check needs. Null for a signed-out visitor. */
export function loadProfile(userId: number | null, target: Db = sharedDb()): StudentProfile | null {
  if (!userId) return null;
  const row = target
    .prepare<[number], { branch: string | null; graduation_year: number | null; cgpa: number | null }>(
      'SELECT branch, graduation_year, cgpa FROM users WHERE id = ?',
    )
    .get(userId);
  if (!row) return null;
  return { branch: row.branch, graduationYear: row.graduation_year, cgpa: row.cgpa };
}

/** Shapes a company row's stored JSON columns into the criteria the check needs. */
export function criteriaFromRow(row: {
  eligible_branches: string;
  eligible_years: string;
  min_cgpa: number | null;
}): CompanyCriteria {
  return {
    eligibleBranches: json<string[]>(row.eligible_branches, []),
    eligibleYears: json<number[]>(row.eligible_years, []),
    minCgpa: row.min_cgpa,
  };
}
