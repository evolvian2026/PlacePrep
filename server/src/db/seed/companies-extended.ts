import type { CompanyDifficulty, CompanyType } from '../../types.js';
import type { CompanySeed, InsightSeed } from './companies.js';
import { ARCHETYPES, archetypeNote, type ArchetypeId } from './company-archetypes.js';

/**
 * The wider catalogue of employers that recruit on Indian campuses.
 *
 * Each entry is a *brief*: the company's identity, eligibility band and pay band,
 * plus the hiring archetype its process resembles. `expandBriefs` turns a brief
 * into a full CompanySeed by attaching that archetype's rounds.
 *
 * Read the honesty note in `company-archetypes.ts` before adding to this file.
 * In short: the metadata below is indicative and the round structures are
 * templates, both surfaced as such in the UI. Everything is editable from the
 * admin console, which is where a placement cell should put what it has actually
 * confirmed.
 *
 * CTC bands are broad on purpose — they are a rough sense of the segment a role
 * sits in, not an offer figure, and they move every season.
 */

const YEARS = [2026, 2027, 2028];
const CS = ['CSE', 'IT'];
const CS_ECE = ['CSE', 'IT', 'ECE'];
const CIRCUIT = ['CSE', 'IT', 'ECE', 'EEE'];
const ALL_BRANCHES = ['CSE', 'IT', 'ECE', 'EEE', 'Mechanical', 'Civil', 'Chemical'];
const CORE_BRANCHES = ['Mechanical', 'Civil', 'EEE', 'ECE', 'Chemical'];

interface CompanyBrief {
  slug: string;
  name: string;
  logoText: string;
  brandColor: string;
  companyType: CompanyType;
  industry: string;
  description: string;
  difficulty: CompanyDifficulty;
  archetype: ArchetypeId;
  /** Indicative annual package band in lakhs. */
  ctc: [number, number];
  roles: string[];
  locations: string[];
  branches?: string[];
  minCgpa?: number;
  hiringFrequency?: string;
  prepWeeks?: number;
  /** Anything specific worth saying beyond the template note. */
  insights?: InsightSeed[];
}

const PREP_WEEKS: Record<CompanyDifficulty, number> = { easy: 4, moderate: 6, hard: 9, very_hard: 12 };

const advice = (title: string, body: string): InsightSeed => ({
  category: 'preparation_advice',
  title,
  body,
  provenance: 'community_reported',
  sourceLabel: 'PlacePrep editorial guidance',
});

// ══════════════════════════════════════════════════════════════════════
// IT services & consulting
// ══════════════════════════════════════════════════════════════════════
const IT_SERVICES: CompanyBrief[] = [
  {
    slug: 'hcltech', name: 'HCLTech', logoText: 'HCL', brandColor: '#0f6cbd',
    companyType: 'service', industry: 'IT Services & Consulting',
    description: 'Global technology services firm hiring at scale across engineering, infrastructure and digital services.',
    difficulty: 'moderate', archetype: 'service_mass', ctc: [3.5, 9],
    roles: ['Graduate Engineer Trainee', 'Software Engineer'], locations: ['Noida', 'Chennai', 'Bengaluru', 'Pune'],
    branches: ALL_BRANCHES, minCgpa: 6, hiringFrequency: 'Annually, plus off-campus drives',
  },
  {
    slug: 'tech-mahindra', name: 'Tech Mahindra', logoText: 'TECHM', brandColor: '#e4002b',
    companyType: 'service', industry: 'IT Services & Telecom',
    description: 'IT and networking services company with a strong telecom practice, recruiting in volume from campuses.',
    difficulty: 'easy', archetype: 'service_mass', ctc: [3.25, 7.5],
    roles: ['Associate Software Engineer'], locations: ['Pune', 'Hyderabad', 'Noida', 'Bengaluru'],
    branches: ALL_BRANCHES, minCgpa: 6,
  },
  {
    slug: 'ltimindtree', name: 'LTIMindtree', logoText: 'LTIM', brandColor: '#0033a0',
    companyType: 'service', industry: 'IT Services & Consulting',
    description: 'Technology consulting and digital services firm formed from the L&T Infotech and Mindtree merger.',
    difficulty: 'moderate', archetype: 'service_premium', ctc: [4, 10],
    roles: ['Graduate Engineer Trainee', 'Senior Software Engineer (elite track)'],
    locations: ['Mumbai', 'Pune', 'Bengaluru', 'Chennai'], branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'mphasis', name: 'Mphasis', logoText: 'MPHA', brandColor: '#e5372a',
    companyType: 'service', industry: 'IT Services',
    description: 'Applied technology services firm with a large banking and insurance client base.',
    difficulty: 'moderate', archetype: 'service_mass', ctc: [3.5, 8],
    roles: ['Associate Software Engineer'], locations: ['Bengaluru', 'Pune', 'Chennai'], branches: CIRCUIT,
  },
  {
    slug: 'hexaware', name: 'Hexaware Technologies', logoText: 'HEXA', brandColor: '#f47920',
    companyType: 'service', industry: 'IT Services',
    description: 'IT services company focused on automation-led delivery for financial services and healthcare.',
    difficulty: 'easy', archetype: 'service_mass', ctc: [3.5, 7],
    roles: ['Graduate Engineer Trainee'], locations: ['Mumbai', 'Chennai', 'Pune'], branches: CIRCUIT,
  },
  {
    slug: 'persistent-systems', name: 'Persistent Systems', logoText: 'PSYS', brandColor: '#ff6a13',
    companyType: 'service', industry: 'Software Engineering Services',
    description: 'Product engineering services company working on software development for global technology clients.',
    difficulty: 'moderate', archetype: 'service_premium', ctc: [4.5, 11],
    roles: ['Software Engineer', 'Product Engineer'], locations: ['Pune', 'Nagpur', 'Hyderabad', 'Bengaluru'],
    branches: CS_ECE, minCgpa: 6.5,
  },
  {
    slug: 'coforge', name: 'Coforge', logoText: 'COFO', brandColor: '#00b2a9',
    companyType: 'service', industry: 'IT Services',
    description: 'Digital services company with concentrations in insurance, travel and banking technology.',
    difficulty: 'moderate', archetype: 'service_mass', ctc: [4, 8.5],
    roles: ['Software Engineer Trainee'], locations: ['Noida', 'Greater Noida', 'Bengaluru'], branches: CIRCUIT,
  },
  {
    slug: 'zensar', name: 'Zensar Technologies', logoText: 'ZENS', brandColor: '#5c2d91',
    companyType: 'service', industry: 'IT Services',
    description: 'Digital solutions and technology services company, part of the RPG Group.',
    difficulty: 'easy', archetype: 'service_mass', ctc: [3.5, 7],
    roles: ['Trainee Engineer'], locations: ['Pune', 'Hyderabad', 'Bengaluru'], branches: CIRCUIT,
  },
  {
    slug: 'birlasoft', name: 'Birlasoft', logoText: 'BIRL', brandColor: '#c8102e',
    companyType: 'service', industry: 'IT Services',
    description: 'Enterprise technology services firm serving manufacturing, life sciences and energy clients.',
    difficulty: 'easy', archetype: 'service_mass', ctc: [3.5, 7],
    roles: ['Associate Engineer'], locations: ['Noida', 'Pune', 'Bengaluru', 'Hyderabad'], branches: CIRCUIT,
  },
  {
    slug: 'cyient', name: 'Cyient', logoText: 'CYNT', brandColor: '#e21b23',
    companyType: 'service', industry: 'Engineering & Technology Services',
    description: 'Engineering, manufacturing and digital technology services company with an aerospace and rail focus.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [3.5, 7.5],
    roles: ['Engineer Trainee'], locations: ['Hyderabad', 'Pune', 'Bengaluru'], branches: ALL_BRANCHES,
  },
  {
    slug: 'kpit', name: 'KPIT Technologies', logoText: 'KPIT', brandColor: '#00a0df',
    companyType: 'service', industry: 'Automotive Software',
    description: 'Automotive software company working on electric, autonomous and connected vehicle platforms.',
    difficulty: 'moderate', archetype: 'semiconductor', ctc: [4, 9],
    roles: ['Software Engineer — Embedded'], locations: ['Pune', 'Bengaluru'], branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'sonata-software', name: 'Sonata Software', logoText: 'SONA', brandColor: '#0072ce',
    companyType: 'service', industry: 'IT Services',
    description: 'Technology services company focused on platform modernisation and cloud migration.',
    difficulty: 'easy', archetype: 'service_mass', ctc: [3.5, 7],
    roles: ['Software Engineer Trainee'], locations: ['Bengaluru', 'Hyderabad'], branches: CIRCUIT,
  },
  {
    slug: 'happiest-minds', name: 'Happiest Minds', logoText: 'HAPM', brandColor: '#f37021',
    companyType: 'service', industry: 'Digital Transformation Services',
    description: 'Digital transformation and product engineering services company.',
    difficulty: 'moderate', archetype: 'service_mass', ctc: [4, 8],
    roles: ['Software Engineer'], locations: ['Bengaluru', 'Pune', 'Noida'], branches: CS_ECE,
  },
  {
    slug: 'mastek', name: 'Mastek', logoText: 'MSTK', brandColor: '#00539b',
    companyType: 'service', industry: 'IT Services',
    description: 'Enterprise digital and cloud transformation services company.',
    difficulty: 'easy', archetype: 'service_mass', ctc: [3.5, 7],
    roles: ['Graduate Trainee'], locations: ['Mumbai', 'Pune', 'Chennai'], branches: CIRCUIT,
  },
  {
    slug: 'tata-elxsi', name: 'Tata Elxsi', logoText: 'TELX', brandColor: '#486aae',
    companyType: 'service', industry: 'Design & Technology Services',
    description: 'Design and technology services company working in automotive, broadcast and healthcare engineering.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [5, 12],
    roles: ['Design Engineer', 'Software Engineer'], locations: ['Bengaluru', 'Pune', 'Thiruvananthapuram'],
    branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'lt-technology-services', name: 'L&T Technology Services', logoText: 'LTTS', brandColor: '#0072bc',
    companyType: 'service', industry: 'Engineering R&D Services',
    description: 'Pure-play engineering research and development services company across industrial and mobility sectors.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [4, 9],
    roles: ['Graduate Engineer Trainee'], locations: ['Vadodara', 'Mysuru', 'Chennai', 'Bengaluru'],
    branches: ALL_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'virtusa', name: 'Virtusa', logoText: 'VIRT', brandColor: '#00a3e0',
    companyType: 'service', industry: 'IT Services',
    description: 'Digital engineering and IT outsourcing company with a large banking practice.',
    difficulty: 'moderate', archetype: 'service_mass', ctc: [4, 8.5],
    roles: ['Engineer Trainee'], locations: ['Hyderabad', 'Chennai', 'Pune'], branches: CIRCUIT,
  },
  {
    slug: 'ust', name: 'UST', logoText: 'UST', brandColor: '#e03c31',
    companyType: 'service', industry: 'Digital Technology Services',
    description: 'Digital transformation services company with delivery centres across South India.',
    difficulty: 'moderate', archetype: 'service_mass', ctc: [4, 9],
    roles: ['Software Engineer Trainee'], locations: ['Thiruvananthapuram', 'Kochi', 'Chennai', 'Bengaluru'], branches: CIRCUIT,
  },
  {
    slug: 'quest-global', name: 'Quest Global', logoText: 'QUES', brandColor: '#00539f',
    companyType: 'service', industry: 'Engineering Services',
    description: 'Engineering services company working in aerospace, energy and medical devices.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [4, 8.5],
    roles: ['Graduate Engineer Trainee'], locations: ['Bengaluru', 'Thiruvananthapuram', 'Hyderabad'], branches: ALL_BRANCHES,
  },
  {
    slug: 'tata-technologies', name: 'Tata Technologies', logoText: 'TATT', brandColor: '#004c97',
    companyType: 'service', industry: 'Product Engineering Services',
    description: 'Product engineering and digital services company serving automotive and aerospace manufacturers.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [4, 8],
    roles: ['Graduate Engineer Trainee'], locations: ['Pune', 'Bengaluru', 'Chennai'], branches: ALL_BRANCHES,
  },
  {
    slug: 'nucleus-software', name: 'Nucleus Software', logoText: 'NUCL', brandColor: '#f58220',
    companyType: 'service', industry: 'Banking Software',
    description: 'Lending and transaction banking software products for financial institutions.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [4.5, 9],
    roles: ['Software Engineer'], locations: ['Noida', 'Chennai'], branches: CS_ECE,
  },
  {
    slug: 'newgen-software', name: 'Newgen Software', logoText: 'NEWG', brandColor: '#1a4b8c',
    companyType: 'service', industry: 'Enterprise Software',
    description: 'Low-code process automation and content management software company.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [4.5, 9],
    roles: ['Software Engineer'], locations: ['Noida', 'Chennai'], branches: CS_ECE,
  },
  {
    slug: 'xoriant', name: 'Xoriant', logoText: 'XORI', brandColor: '#f26522',
    companyType: 'service', industry: 'Product Engineering Services',
    description: 'Software product engineering and digital services company.',
    difficulty: 'moderate', archetype: 'service_premium', ctc: [4.5, 10],
    roles: ['Software Engineer'], locations: ['Pune', 'Mumbai', 'Bengaluru'], branches: CS_ECE,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Global consulting & professional services
// ══════════════════════════════════════════════════════════════════════
const CONSULTING: CompanyBrief[] = [
  {
    slug: 'ey', name: 'EY', logoText: 'EY', brandColor: '#ffe600',
    companyType: 'service', industry: 'Professional Services & Consulting',
    description: 'Professional services firm hiring into technology consulting, risk and assurance technology.',
    difficulty: 'hard', archetype: 'consulting_tech', ctc: [5.5, 13],
    roles: ['Analyst — Technology Consulting'], locations: ['Bengaluru', 'Gurugram', 'Mumbai', 'Kochi'],
    branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'kpmg', name: 'KPMG', logoText: 'KPMG', brandColor: '#00338d',
    companyType: 'service', industry: 'Professional Services & Consulting',
    description: 'Professional services firm recruiting into technology advisory, cyber and data practices.',
    difficulty: 'hard', archetype: 'consulting_tech', ctc: [5.5, 13],
    roles: ['Analyst — Advisory'], locations: ['Bengaluru', 'Gurugram', 'Mumbai', 'Pune'], branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'pwc', name: 'PwC', logoText: 'PWC', brandColor: '#d04a02',
    companyType: 'service', industry: 'Professional Services & Consulting',
    description: 'Professional services firm hiring into technology consulting and managed services.',
    difficulty: 'hard', archetype: 'consulting_tech', ctc: [5.5, 13],
    roles: ['Associate — Technology Consulting'], locations: ['Bengaluru', 'Kolkata', 'Hyderabad', 'Mumbai'],
    branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'zs-associates', name: 'ZS Associates', logoText: 'ZS', brandColor: '#00263e',
    companyType: 'service', industry: 'Consulting & Analytics',
    description: 'Consulting and technology firm focused on commercial strategy and analytics for life sciences.',
    difficulty: 'very_hard', archetype: 'analytics_ds', ctc: [10, 22],
    roles: ['Business Technology Analyst', 'Decision Analytics Associate'],
    locations: ['Pune', 'Gurugram', 'Bengaluru'], branches: ALL_BRANCHES, minCgpa: 7.5,
    insights: [
      advice(
        'Case discussion carries real weight',
        'Reported processes lean heavily on structured problem solving with numbers said out loud. Practise narrating your reasoning — a correct answer arrived at silently scores poorly here.',
      ),
    ],
  },
  {
    slug: 'grant-thornton', name: 'Grant Thornton', logoText: 'GT', brandColor: '#5c2d91',
    companyType: 'service', industry: 'Professional Services',
    description: 'Assurance, tax and advisory firm with a growing technology consulting practice.',
    difficulty: 'moderate', archetype: 'consulting_tech', ctc: [5, 10],
    roles: ['Analyst'], locations: ['Bengaluru', 'Gurugram', 'Mumbai'], branches: CIRCUIT,
  },
  {
    slug: 'protiviti', name: 'Protiviti', logoText: 'PROT', brandColor: '#00558c',
    companyType: 'service', industry: 'Risk & Technology Consulting',
    description: 'Global consulting firm specialising in internal audit, risk and technology consulting.',
    difficulty: 'moderate', archetype: 'consulting_tech', ctc: [5, 10],
    roles: ['Technology Consultant'], locations: ['Bengaluru', 'Mumbai', 'Gurugram'], branches: CIRCUIT,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Global product & platform companies
// ══════════════════════════════════════════════════════════════════════
const GLOBAL_PRODUCT: CompanyBrief[] = [
  {
    slug: 'oracle', name: 'Oracle', logoText: 'ORCL', brandColor: '#c74634',
    companyType: 'product', industry: 'Enterprise Software & Cloud',
    description: 'Database and cloud applications company with large engineering centres in India.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [12, 28],
    roles: ['Member of Technical Staff', 'Application Engineer'], locations: ['Bengaluru', 'Hyderabad', 'Noida'],
    branches: CS_ECE, minCgpa: 7,
    insights: [advice('Database depth pays off', 'SQL and DBMS internals — indexing, transactions, query plans — are worth more preparation here than at a typical product company.')],
  },
  {
    slug: 'sap', name: 'SAP Labs', logoText: 'SAP', brandColor: '#0faaff',
    companyType: 'product', industry: 'Enterprise Software',
    description: 'Enterprise resource planning software company with a major R&D presence in India.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [12, 26],
    roles: ['Developer Associate'], locations: ['Bengaluru', 'Gurugram', 'Pune'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'cisco', name: 'Cisco', logoText: 'CSCO', brandColor: '#1ba0d7',
    companyType: 'product', industry: 'Networking & Security',
    description: 'Networking hardware and software company with large engineering teams in Bengaluru.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [14, 30],
    roles: ['Software Engineer', 'Network Consulting Engineer'], locations: ['Bengaluru', 'Chennai'],
    branches: CS_ECE, minCgpa: 7,
    insights: [advice('Networking fundamentals matter here', 'Beyond the usual DSA, expect real depth on TCP/IP, routing and switching — more than most software roles ask for.')],
  },
  {
    slug: 'vmware', name: 'VMware', logoText: 'VMW', brandColor: '#607078',
    companyType: 'product', industry: 'Virtualisation & Cloud Infrastructure',
    description: 'Virtualisation and cloud infrastructure company with substantial India engineering.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [16, 34],
    roles: ['Member of Technical Staff'], locations: ['Bengaluru', 'Pune'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'intuit', name: 'Intuit', logoText: 'INTU', brandColor: '#0077c5',
    companyType: 'product', industry: 'Financial Software',
    description: 'Financial software company behind consumer and small-business accounting products.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [18, 38],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'uber', name: 'Uber', logoText: 'UBER', brandColor: '#000000',
    companyType: 'product', industry: 'Mobility & Marketplace',
    description: 'Ride-hailing and delivery marketplace with engineering teams working on large-scale distributed systems.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [20, 45],
    roles: ['Software Engineer'], locations: ['Bengaluru', 'Hyderabad'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'atlassian', name: 'Atlassian', logoText: 'ATLS', brandColor: '#0052cc',
    companyType: 'product', industry: 'Developer & Collaboration Tools',
    description: 'Collaboration software company building developer and project management tools.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [20, 42],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'servicenow', name: 'ServiceNow', logoText: 'NOW', brandColor: '#62d84e',
    companyType: 'product', industry: 'Enterprise Workflow Software',
    description: 'Enterprise workflow and IT service management platform company.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [16, 34],
    roles: ['Software Engineer'], locations: ['Hyderabad', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'nutanix', name: 'Nutanix', logoText: 'NTNX', brandColor: '#024da1',
    companyType: 'product', industry: 'Cloud Infrastructure',
    description: 'Hybrid multicloud infrastructure software company with engineering in Bengaluru and Pune.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [16, 34],
    roles: ['Member of Technical Staff'], locations: ['Bengaluru', 'Pune'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'netapp', name: 'NetApp', logoText: 'NTAP', brandColor: '#0067c5',
    companyType: 'product', industry: 'Data Storage & Management',
    description: 'Data storage and cloud data services company.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [15, 32],
    roles: ['Member of Technical Staff'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'dell', name: 'Dell Technologies', logoText: 'DELL', brandColor: '#007db8',
    companyType: 'product', industry: 'Hardware & Enterprise Technology',
    description: 'Computing hardware and enterprise infrastructure company with India R&D centres.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [8, 20],
    roles: ['Software Engineer', 'Systems Engineer'], locations: ['Bengaluru', 'Hyderabad', 'Pune'], branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'hpe', name: 'Hewlett Packard Enterprise', logoText: 'HPE', brandColor: '#01a982',
    companyType: 'product', industry: 'Enterprise Technology',
    description: 'Enterprise infrastructure, edge and hybrid cloud technology company.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [8, 20],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'ibm', name: 'IBM', logoText: 'IBM', brandColor: '#0f62fe',
    companyType: 'product', industry: 'Technology & Consulting',
    description: 'Technology and consulting company hiring across software, cloud, data and consulting roles.',
    difficulty: 'moderate', archetype: 'service_premium', ctc: [4.5, 14],
    roles: ['Associate System Engineer', 'Software Developer'], locations: ['Bengaluru', 'Pune', 'Hyderabad', 'Kochi'],
    branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'amdocs', name: 'Amdocs', logoText: 'DOX', brandColor: '#00a9e0',
    companyType: 'product', industry: 'Telecom Software',
    description: 'Software and services company for communications and media providers.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [5.5, 12],
    roles: ['Software Developer'], locations: ['Pune', 'Gurugram', 'Chennai'], branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'ericsson', name: 'Ericsson', logoText: 'ERIC', brandColor: '#0082f0',
    companyType: 'product', industry: 'Telecom Equipment',
    description: 'Telecommunications equipment and services company with R&D centres in India.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [7, 16],
    roles: ['Software Engineer', 'Network Engineer'], locations: ['Bengaluru', 'Chennai', 'Gurugram'],
    branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'nokia', name: 'Nokia', logoText: 'NOK', brandColor: '#124191',
    companyType: 'product', industry: 'Telecom Equipment',
    description: 'Network infrastructure company with large R&D operations in Bengaluru and Chennai.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [7, 16],
    roles: ['Software Engineer', 'R&D Engineer'], locations: ['Bengaluru', 'Chennai', 'Noida'],
    branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'juniper', name: 'Juniper Networks', logoText: 'JNPR', brandColor: '#84b135',
    companyType: 'product', industry: 'Networking',
    description: 'Networking products company building routing, switching and security platforms.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [16, 34],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'siemens', name: 'Siemens', logoText: 'SIE', brandColor: '#009999',
    companyType: 'product', industry: 'Industrial Technology',
    description: 'Industrial automation, mobility and digital industries technology company.',
    difficulty: 'hard', archetype: 'core_engineering', ctc: [6, 14],
    roles: ['Graduate Trainee Engineer'], locations: ['Pune', 'Bengaluru', 'Gurugram'], branches: ALL_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'philips', name: 'Philips', logoText: 'PHIL', brandColor: '#0b5ed7',
    companyType: 'product', industry: 'Health Technology',
    description: 'Health technology company with software and imaging R&D in Bengaluru and Pune.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [8, 18],
    roles: ['Software Engineer'], locations: ['Bengaluru', 'Pune', 'Chennai'], branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'honeywell', name: 'Honeywell', logoText: 'HON', brandColor: '#e2231a',
    companyType: 'product', industry: 'Industrial & Aerospace Technology',
    description: 'Diversified technology company spanning aerospace, building automation and industrial software.',
    difficulty: 'hard', archetype: 'core_engineering', ctc: [6, 14],
    roles: ['Engineer', 'Software Engineer'], locations: ['Bengaluru', 'Hyderabad', 'Pune'], branches: ALL_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'ge-aerospace', name: 'GE Aerospace', logoText: 'GE', brandColor: '#0364a5',
    companyType: 'product', industry: 'Aerospace Engineering',
    description: 'Aircraft engine and systems manufacturer with an engineering centre in Bengaluru.',
    difficulty: 'hard', archetype: 'core_engineering', ctc: [7, 16],
    roles: ['Edison Engineering Development Program', 'Design Engineer'], locations: ['Bengaluru', 'Pune'],
    branches: ALL_BRANCHES, minCgpa: 7.5,
  },
  {
    slug: 'abb', name: 'ABB', logoText: 'ABB', brandColor: '#ff000f',
    companyType: 'product', industry: 'Electrification & Automation',
    description: 'Electrification and automation technology company.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Bengaluru', 'Chennai', 'Vadodara'], branches: CORE_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'schneider-electric', name: 'Schneider Electric', logoText: 'SCHN', brandColor: '#3dcd58',
    companyType: 'product', industry: 'Energy Management & Automation',
    description: 'Energy management and industrial automation company.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Bengaluru', 'Gurugram', 'Chennai'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'bosch', name: 'Bosch', logoText: 'BOSC', brandColor: '#e20015',
    companyType: 'product', industry: 'Automotive & Industrial Technology',
    description: 'Engineering and technology company with a large India centre working on mobility and industrial systems.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [6, 14],
    roles: ['Associate Engineer', 'Embedded Software Engineer'], locations: ['Bengaluru', 'Coimbatore', 'Pune'],
    branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'continental', name: 'Continental', logoText: 'CONT', brandColor: '#ffa500',
    companyType: 'product', industry: 'Automotive Technology',
    description: 'Automotive technology company working on vehicle electronics and safety systems.',
    difficulty: 'moderate', archetype: 'semiconductor', ctc: [5.5, 12],
    roles: ['Software Engineer — Automotive'], locations: ['Bengaluru', 'Pune'], branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'harman', name: 'HARMAN', logoText: 'HARM', brandColor: '#000000',
    companyType: 'product', industry: 'Connected Car & Audio',
    description: 'Connected car, audio and enterprise automation company, part of Samsung.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [6, 15],
    roles: ['Software Engineer — Embedded'], locations: ['Bengaluru', 'Pune', 'Chennai'], branches: CIRCUIT, minCgpa: 7,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Semiconductor & EDA
// ══════════════════════════════════════════════════════════════════════
const SEMICONDUCTOR: CompanyBrief[] = [
  {
    slug: 'qualcomm', name: 'Qualcomm', logoText: 'QCOM', brandColor: '#3253dc',
    companyType: 'product', industry: 'Semiconductors & Wireless',
    description: 'Wireless technology and chipset company with major engineering centres in India.',
    difficulty: 'very_hard', archetype: 'semiconductor', ctc: [16, 36],
    roles: ['Engineer — Software', 'Engineer — Hardware'], locations: ['Bengaluru', 'Hyderabad', 'Chennai', 'Noida'],
    branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'nvidia', name: 'NVIDIA', logoText: 'NVDA', brandColor: '#76b900',
    companyType: 'product', industry: 'Semiconductors & AI Computing',
    description: 'Graphics and accelerated computing company with engineering teams in Bengaluru, Pune and Hyderabad.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [20, 45],
    roles: ['Software Engineer', 'ASIC Engineer'], locations: ['Bengaluru', 'Pune', 'Hyderabad'],
    branches: CIRCUIT, minCgpa: 8,
  },
  {
    slug: 'amd', name: 'AMD', logoText: 'AMD', brandColor: '#ed1c24',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Processor and graphics company with large silicon and software teams in India.',
    difficulty: 'very_hard', archetype: 'semiconductor', ctc: [16, 36],
    roles: ['Silicon Design Engineer', 'Software Engineer'], locations: ['Bengaluru', 'Hyderabad'],
    branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'texas-instruments', name: 'Texas Instruments', logoText: 'TI', brandColor: '#cc0000',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Analog and embedded processing semiconductor company.',
    difficulty: 'very_hard', archetype: 'semiconductor', ctc: [18, 38],
    roles: ['Analog Design Engineer', 'Embedded Software Engineer'], locations: ['Bengaluru'],
    branches: ['ECE', 'EEE', 'CSE'], minCgpa: 8,
  },
  {
    slug: 'micron', name: 'Micron Technology', logoText: 'MU', brandColor: '#0066b3',
    companyType: 'product', industry: 'Memory & Storage',
    description: 'Memory and storage semiconductor company with engineering and fabrication investment in India.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [12, 28],
    roles: ['Engineer'], locations: ['Hyderabad', 'Bengaluru', 'Sanand'], branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'western-digital', name: 'Western Digital', logoText: 'WDC', brandColor: '#0098da',
    companyType: 'product', industry: 'Data Storage',
    description: 'Data storage company building flash and hard-disk technologies.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [12, 26],
    roles: ['Firmware Engineer'], locations: ['Bengaluru'], branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'samsung-rd', name: 'Samsung R&D India', logoText: 'SRI', brandColor: '#1428a0',
    companyType: 'product', industry: 'Consumer Electronics R&D',
    description: 'Research and development arm of Samsung working on devices, networks and on-device intelligence.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [12, 30],
    roles: ['Software Engineer'], locations: ['Bengaluru', 'Noida', 'Delhi'], branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'synopsys', name: 'Synopsys', logoText: 'SNPS', brandColor: '#0b2a5b',
    companyType: 'product', industry: 'EDA & Semiconductor IP',
    description: 'Electronic design automation and semiconductor IP company.',
    difficulty: 'very_hard', archetype: 'semiconductor', ctc: [14, 30],
    roles: ['R&D Engineer'], locations: ['Bengaluru', 'Noida', 'Hyderabad'], branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'cadence', name: 'Cadence Design Systems', logoText: 'CDNS', brandColor: '#00a4e4',
    companyType: 'product', industry: 'EDA',
    description: 'Electronic design automation software and hardware company.',
    difficulty: 'very_hard', archetype: 'semiconductor', ctc: [14, 32],
    roles: ['Software Engineer', 'Design Engineer'], locations: ['Bengaluru', 'Noida', 'Pune'],
    branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'analog-devices', name: 'Analog Devices', logoText: 'ADI', brandColor: '#0067b1',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Analog, mixed-signal and digital signal processing semiconductor company.',
    difficulty: 'very_hard', archetype: 'semiconductor', ctc: [14, 30],
    roles: ['Design Engineer', 'Applications Engineer'], locations: ['Bengaluru', 'Hyderabad'],
    branches: ['ECE', 'EEE'], minCgpa: 8,
  },
  {
    slug: 'nxp', name: 'NXP Semiconductors', logoText: 'NXP', brandColor: '#ff6600',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Automotive and industrial semiconductor company.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [12, 26],
    roles: ['Engineer'], locations: ['Bengaluru', 'Noida', 'Hyderabad'], branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'infineon', name: 'Infineon Technologies', logoText: 'IFX', brandColor: '#0a8a0a',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Power systems and IoT semiconductor company.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [12, 26],
    roles: ['Engineer'], locations: ['Bengaluru', 'Pune'], branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'marvell', name: 'Marvell Technology', logoText: 'MRVL', brandColor: '#0072ce',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Data infrastructure semiconductor company.',
    difficulty: 'very_hard', archetype: 'semiconductor', ctc: [16, 34],
    roles: ['Design Engineer', 'Software Engineer'], locations: ['Pune', 'Bengaluru', 'Hyderabad'],
    branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'mediatek', name: 'MediaTek', logoText: 'MTK', brandColor: '#eb6100',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Fabless semiconductor company designing mobile and connectivity chipsets.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [14, 30],
    roles: ['Engineer'], locations: ['Bengaluru', 'Noida'], branches: CIRCUIT, minCgpa: 7.5,
  },
  {
    slug: 'renesas', name: 'Renesas Electronics', logoText: 'RNSA', brandColor: '#1f4e9c',
    companyType: 'product', industry: 'Semiconductors',
    description: 'Microcontroller and automotive semiconductor company.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [10, 24],
    roles: ['Engineer'], locations: ['Bengaluru', 'Noida'], branches: CIRCUIT, minCgpa: 7,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Banking, financial services & fintech
// ══════════════════════════════════════════════════════════════════════
const FINANCE: CompanyBrief[] = [
  {
    slug: 'goldman-sachs', name: 'Goldman Sachs', logoText: 'GS', brandColor: '#7399c6',
    companyType: 'product', industry: 'Investment Banking & Technology',
    description: 'Investment bank with one of the largest engineering organisations in Indian financial services.',
    difficulty: 'very_hard', archetype: 'fintech_tech', ctc: [20, 42],
    roles: ['Analyst — Engineering'], locations: ['Bengaluru', 'Hyderabad'], branches: CS_ECE, minCgpa: 8,
    insights: [advice('Expect quantitative depth alongside DSA', 'Probability and combinatorics appear more often here than at pure software companies, and are frequently asked in interviews rather than only on the test.')],
  },
  {
    slug: 'morgan-stanley', name: 'Morgan Stanley', logoText: 'MS', brandColor: '#00285a',
    companyType: 'product', industry: 'Investment Banking & Technology',
    description: 'Investment bank with substantial technology teams in Mumbai and Bengaluru.',
    difficulty: 'very_hard', archetype: 'fintech_tech', ctc: [18, 40],
    roles: ['Technology Analyst'], locations: ['Mumbai', 'Bengaluru'], branches: CS_ECE, minCgpa: 8,
  },
  {
    slug: 'jpmorgan-chase', name: 'JPMorgan Chase', logoText: 'JPMC', brandColor: '#5c2d2d',
    companyType: 'product', industry: 'Banking Technology',
    description: 'Global bank with large software engineering centres across India.',
    difficulty: 'hard', archetype: 'fintech_tech', ctc: [14, 32],
    roles: ['Software Engineer'], locations: ['Mumbai', 'Bengaluru', 'Hyderabad'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'barclays', name: 'Barclays', logoText: 'BARC', brandColor: '#00aeef',
    companyType: 'product', industry: 'Banking Technology',
    description: 'International bank with technology centres in Pune and Chennai.',
    difficulty: 'hard', archetype: 'fintech_tech', ctc: [12, 28],
    roles: ['Technology Analyst'], locations: ['Pune', 'Chennai', 'Noida'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'deutsche-bank', name: 'Deutsche Bank', logoText: 'DB', brandColor: '#0018a8',
    companyType: 'product', industry: 'Banking Technology',
    description: 'Global bank with technology and operations centres in Pune and Bengaluru.',
    difficulty: 'hard', archetype: 'fintech_tech', ctc: [12, 28],
    roles: ['Technology Analyst'], locations: ['Pune', 'Bengaluru', 'Mumbai'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'hsbc', name: 'HSBC', logoText: 'HSBC', brandColor: '#db0011',
    companyType: 'product', industry: 'Banking Technology',
    description: 'International bank with technology delivery centres across India.',
    difficulty: 'moderate', archetype: 'fintech_tech', ctc: [8, 20],
    roles: ['Software Engineer'], locations: ['Pune', 'Hyderabad', 'Bengaluru'], branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'wells-fargo', name: 'Wells Fargo', logoText: 'WF', brandColor: '#d71e28',
    companyType: 'product', industry: 'Banking Technology',
    description: 'Banking group with technology centres in Hyderabad and Bengaluru.',
    difficulty: 'hard', archetype: 'fintech_tech', ctc: [10, 24],
    roles: ['Software Engineer'], locations: ['Hyderabad', 'Bengaluru', 'Chennai'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'american-express', name: 'American Express', logoText: 'AMEX', brandColor: '#006fcf',
    companyType: 'product', industry: 'Payments & Financial Services',
    description: 'Payments company with technology and analytics teams in Gurugram and Bengaluru.',
    difficulty: 'hard', archetype: 'fintech_tech', ctc: [14, 30],
    roles: ['Engineer', 'Analyst'], locations: ['Gurugram', 'Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'visa', name: 'Visa', logoText: 'VISA', brandColor: '#1a1f71',
    companyType: 'product', industry: 'Payments Technology',
    description: 'Payments network company with engineering centres in Bengaluru.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [18, 38],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'mastercard', name: 'Mastercard', logoText: 'MA', brandColor: '#eb001b',
    companyType: 'product', industry: 'Payments Technology',
    description: 'Payments technology company with engineering teams in Pune, Gurugram and Vadodara.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [16, 34],
    roles: ['Software Engineer'], locations: ['Pune', 'Gurugram', 'Vadodara'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'paypal', name: 'PayPal', logoText: 'PYPL', brandColor: '#003087',
    companyType: 'product', industry: 'Payments Technology',
    description: 'Digital payments company with engineering centres in Chennai and Bengaluru.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [18, 38],
    roles: ['Software Engineer'], locations: ['Chennai', 'Bengaluru', 'Hyderabad'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'fiserv', name: 'Fiserv', logoText: 'FISV', brandColor: '#ff6200',
    companyType: 'product', industry: 'Financial Technology',
    description: 'Payments and financial technology company with delivery centres across India.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [6, 14],
    roles: ['Software Engineer'], locations: ['Pune', 'Chennai', 'Noida'], branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'fis', name: 'FIS', logoText: 'FIS', brandColor: '#8dc63f',
    companyType: 'product', industry: 'Financial Technology',
    description: 'Financial technology company serving banks and capital markets.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [5.5, 13],
    roles: ['Software Engineer'], locations: ['Pune', 'Bengaluru', 'Chennai'], branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'broadridge', name: 'Broadridge', logoText: 'BR', brandColor: '#00833e',
    companyType: 'product', industry: 'Financial Technology',
    description: 'Investor communications and capital markets technology company.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [6, 14],
    roles: ['Software Engineer'], locations: ['Bengaluru', 'Hyderabad'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'blackrock', name: 'BlackRock', logoText: 'BLK', brandColor: '#000000',
    companyType: 'product', industry: 'Asset Management Technology',
    description: 'Asset management firm whose Aladdin platform is built by large engineering teams in India.',
    difficulty: 'very_hard', archetype: 'fintech_tech', ctc: [18, 38],
    roles: ['Analyst — Engineering'], locations: ['Gurugram', 'Mumbai'], branches: CS_ECE, minCgpa: 8,
  },
  {
    slug: 'state-street', name: 'State Street', logoText: 'STT', brandColor: '#00539b',
    companyType: 'product', industry: 'Financial Services Technology',
    description: 'Custody bank and asset servicing company with technology centres in India.',
    difficulty: 'moderate', archetype: 'fintech_tech', ctc: [8, 18],
    roles: ['Software Engineer'], locations: ['Bengaluru', 'Hyderabad', 'Chennai'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'societe-generale', name: 'Société Générale', logoText: 'SG', brandColor: '#e60028',
    companyType: 'product', industry: 'Banking Technology',
    description: 'European bank with global solution centres in Bengaluru and Chennai.',
    difficulty: 'hard', archetype: 'fintech_tech', ctc: [10, 22],
    roles: ['Software Engineer'], locations: ['Bengaluru', 'Chennai'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'de-shaw', name: 'D. E. Shaw & Co.', logoText: 'DESH', brandColor: '#003057',
    companyType: 'product', industry: 'Quantitative Finance',
    description: 'Investment and technology development firm with a highly selective engineering intake in Hyderabad and Gurugram.',
    difficulty: 'very_hard', archetype: 'fintech_tech', ctc: [25, 50],
    roles: ['Systems Engineer', 'Software Developer'], locations: ['Hyderabad', 'Gurugram', 'Bengaluru'],
    branches: CS_ECE, minCgpa: 8.5,
    insights: [advice('Among the most selective processes on campus', 'Reported loops go deep on algorithms, probability and precise reasoning about edge cases. Broad familiarity is not enough — depth in a smaller set of areas serves better.')],
  },
  {
    slug: 'tower-research', name: 'Tower Research Capital', logoText: 'TRC', brandColor: '#1c355e',
    companyType: 'product', industry: 'Quantitative Trading',
    description: 'Quantitative trading firm with a technology centre in Gurugram.',
    difficulty: 'very_hard', archetype: 'fintech_tech', ctc: [30, 60],
    roles: ['Software Developer'], locations: ['Gurugram'], branches: CS_ECE, minCgpa: 8.5,
  },
  {
    slug: 'nomura', name: 'Nomura', logoText: 'NOMU', brandColor: '#a6192e',
    companyType: 'product', industry: 'Banking Technology',
    description: 'Financial services group with a technology and operations centre in Powai, Mumbai.',
    difficulty: 'hard', archetype: 'fintech_tech', ctc: [12, 26],
    roles: ['Technology Analyst'], locations: ['Mumbai'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'standard-chartered', name: 'Standard Chartered', logoText: 'SC', brandColor: '#0473ea',
    companyType: 'product', industry: 'Banking Technology',
    description: 'International bank with technology and operations hubs in Bengaluru and Chennai.',
    difficulty: 'moderate', archetype: 'fintech_tech', ctc: [8, 18],
    roles: ['Technology Analyst'], locations: ['Bengaluru', 'Chennai'], branches: CS_ECE, minCgpa: 7,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Indian internet, product & high-growth companies
// ══════════════════════════════════════════════════════════════════════
const INDIAN_PRODUCT: CompanyBrief[] = [
  {
    slug: 'flipkart', name: 'Flipkart', logoText: 'FKRT', brandColor: '#2874f0',
    companyType: 'product', industry: 'E-commerce',
    description: 'Indian e-commerce marketplace with engineering teams working on supply chain, search and payments at scale.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [20, 42],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'swiggy', name: 'Swiggy', logoText: 'SWGY', brandColor: '#fc8019',
    companyType: 'product', industry: 'Food Delivery & Quick Commerce',
    description: 'On-demand delivery platform building logistics, discovery and payments systems.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [18, 38],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'zomato', name: 'Zomato', logoText: 'ZOMA', brandColor: '#e23744',
    companyType: 'product', industry: 'Food Delivery & Quick Commerce',
    description: 'Food delivery and restaurant discovery platform.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [16, 34],
    roles: ['Software Development Engineer'], locations: ['Gurugram', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'paytm', name: 'Paytm', logoText: 'PAYT', brandColor: '#00baf2',
    companyType: 'product', industry: 'Digital Payments',
    description: 'Digital payments and financial services platform.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [12, 28],
    roles: ['Software Engineer'], locations: ['Noida', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'phonepe', name: 'PhonePe', logoText: 'PHPE', brandColor: '#5f259f',
    companyType: 'product', industry: 'Digital Payments',
    description: 'Digital payments platform handling very high transaction volumes.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [18, 40],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'razorpay', name: 'Razorpay', logoText: 'RZP', brandColor: '#0c2451',
    companyType: 'product', industry: 'Payments Infrastructure',
    description: 'Payments infrastructure company serving online businesses.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [16, 34],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'cred', name: 'CRED', logoText: 'CRED', brandColor: '#0b0b0b',
    companyType: 'product', industry: 'Fintech',
    description: 'Members-only credit card payments and rewards platform.',
    difficulty: 'very_hard', archetype: 'startup_product', ctc: [20, 42],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'zerodha', name: 'Zerodha', logoText: 'ZRDA', brandColor: '#387ed1',
    companyType: 'product', industry: 'Stock Broking Technology',
    description: 'Discount broking firm that builds its trading platforms in-house.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [12, 28],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'groww', name: 'Groww', logoText: 'GROW', brandColor: '#00d09c',
    companyType: 'product', industry: 'Investment Platform',
    description: 'Investment platform for mutual funds, stocks and derivatives.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [16, 32],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'meesho', name: 'Meesho', logoText: 'MEES', brandColor: '#f43397',
    companyType: 'product', industry: 'E-commerce',
    description: 'E-commerce platform focused on value commerce and small sellers.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [18, 36],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
  },
  {
    slug: 'ola', name: 'Ola', logoText: 'OLA', brandColor: '#c6f31c',
    companyType: 'product', industry: 'Mobility',
    description: 'Mobility platform building ride-hailing and mapping technology.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [14, 30],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'ola-electric', name: 'Ola Electric', logoText: 'OLAE', brandColor: '#000000',
    companyType: 'product', industry: 'Electric Vehicles',
    description: 'Electric two-wheeler manufacturer building vehicle software and battery technology.',
    difficulty: 'hard', archetype: 'semiconductor', ctc: [10, 26],
    roles: ['Embedded Engineer', 'Software Engineer'], locations: ['Bengaluru', 'Krishnagiri'], branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'dream11', name: 'Dream11', logoText: 'D11', brandColor: '#d0021b',
    companyType: 'product', industry: 'Sports Technology',
    description: 'Fantasy sports platform handling extreme traffic spikes around live matches.',
    difficulty: 'very_hard', archetype: 'product_sde', ctc: [20, 40],
    roles: ['Software Development Engineer'], locations: ['Mumbai', 'Bengaluru'], branches: CS_ECE, minCgpa: 7.5,
    insights: [advice('Scale is the theme', 'This platform absorbs enormous, highly concentrated traffic spikes. Caching, queuing and idempotency are worth more attention than usual.')],
  },
  {
    slug: 'zoho', name: 'Zoho', logoText: 'ZOHO', brandColor: '#e42527',
    companyType: 'product', industry: 'Business Software',
    description: 'Business software suite company known for hiring on aptitude and programming ability over pedigree.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [6, 18],
    roles: ['Member of Technical Staff'], locations: ['Chennai', 'Tenkasi', 'Madurai'], branches: CIRCUIT, minCgpa: 6,
    insights: [advice('Programming rounds are long and hands-on', 'Reported processes run multiple programming rounds on paper and on a machine. Practise writing complete, compiling programs rather than sketching approaches.')],
  },
  {
    slug: 'freshworks', name: 'Freshworks', logoText: 'FRSH', brandColor: '#ff5d0e',
    companyType: 'product', industry: 'SaaS',
    description: 'Customer engagement software company building CRM and support products.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [12, 26],
    roles: ['Software Engineer'], locations: ['Chennai', 'Bengaluru', 'Hyderabad'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'postman', name: 'Postman', logoText: 'POST', brandColor: '#ff6c37',
    companyType: 'product', industry: 'Developer Tools',
    description: 'API development platform used by developers worldwide.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [16, 34],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'browserstack', name: 'BrowserStack', logoText: 'BSTK', brandColor: '#f4b400',
    companyType: 'product', industry: 'Developer Tools',
    description: 'Cloud testing infrastructure platform for web and mobile applications.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [16, 34],
    roles: ['Software Engineer'], locations: ['Mumbai', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'chargebee', name: 'Chargebee', logoText: 'CHBE', brandColor: '#ff6c37',
    companyType: 'product', industry: 'SaaS',
    description: 'Subscription billing and revenue management platform.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [14, 28],
    roles: ['Software Engineer'], locations: ['Chennai', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'innovaccer', name: 'Innovaccer', logoText: 'INNO', brandColor: '#00b0f0',
    companyType: 'product', industry: 'Healthcare Technology',
    description: 'Healthcare data platform company working on care coordination and analytics.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [14, 30],
    roles: ['Software Engineer'], locations: ['Noida', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'makemytrip', name: 'MakeMyTrip', logoText: 'MMT', brandColor: '#eb2026',
    companyType: 'product', industry: 'Online Travel',
    description: 'Online travel platform for flights, hotels and holidays.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [12, 28],
    roles: ['Software Development Engineer'], locations: ['Gurugram', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'myntra', name: 'Myntra', logoText: 'MYNT', brandColor: '#ff3f6c',
    companyType: 'product', industry: 'Fashion E-commerce',
    description: 'Fashion and lifestyle e-commerce platform.',
    difficulty: 'hard', archetype: 'product_sde', ctc: [16, 32],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'nykaa', name: 'Nykaa', logoText: 'NYKA', brandColor: '#fc2779',
    companyType: 'product', industry: 'Beauty & Lifestyle E-commerce',
    description: 'Beauty and lifestyle retail platform with in-house technology teams.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [10, 22],
    roles: ['Software Engineer'], locations: ['Mumbai', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'urban-company', name: 'Urban Company', logoText: 'UC', brandColor: '#f05a28',
    companyType: 'product', industry: 'Home Services Marketplace',
    description: 'Home services marketplace matching customers with trained professionals.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [14, 30],
    roles: ['Software Development Engineer'], locations: ['Gurugram'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'lenskart', name: 'Lenskart', logoText: 'LENS', brandColor: '#00b9c6',
    companyType: 'product', industry: 'Eyewear Retail Technology',
    description: 'Omnichannel eyewear retailer with in-house manufacturing and technology.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [10, 22],
    roles: ['Software Engineer'], locations: ['Gurugram', 'Bengaluru'], branches: CS_ECE, minCgpa: 6.5,
  },
  {
    slug: 'policybazaar', name: 'PolicyBazaar', logoText: 'PBZR', brandColor: '#00a0e3',
    companyType: 'product', industry: 'Insurance Technology',
    description: 'Insurance aggregator and financial services marketplace.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [8, 20],
    roles: ['Software Engineer'], locations: ['Gurugram'], branches: CS_ECE, minCgpa: 6.5,
  },
  {
    slug: 'delhivery', name: 'Delhivery', logoText: 'DLVR', brandColor: '#e01e26',
    companyType: 'product', industry: 'Logistics Technology',
    description: 'Logistics and supply chain company building routing and warehouse systems.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [12, 26],
    roles: ['Software Engineer'], locations: ['Gurugram', 'Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'sharechat', name: 'ShareChat', logoText: 'SHCT', brandColor: '#eb5757',
    companyType: 'product', industry: 'Social Media',
    description: 'Indian-language social media and short video platform.',
    difficulty: 'hard', archetype: 'startup_product', ctc: [16, 32],
    roles: ['Software Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'physics-wallah', name: 'Physics Wallah', logoText: 'PW', brandColor: '#5a4bda',
    companyType: 'product', industry: 'EdTech',
    description: 'Education technology company delivering exam preparation at scale.',
    difficulty: 'moderate', archetype: 'startup_product', ctc: [8, 20],
    roles: ['Software Engineer'], locations: ['Noida', 'Bengaluru'], branches: CS_ECE, minCgpa: 6.5,
  },
  {
    slug: 'unacademy', name: 'Unacademy', logoText: 'UNAC', brandColor: '#08bd80',
    companyType: 'product', industry: 'EdTech',
    description: 'Online learning platform for competitive exam preparation.',
    difficulty: 'moderate', archetype: 'startup_product', ctc: [10, 24],
    roles: ['Software Development Engineer'], locations: ['Bengaluru'], branches: CS_ECE, minCgpa: 7,
  },
  {
    slug: 'jio', name: 'Reliance Jio', logoText: 'JIO', brandColor: '#0a2885',
    companyType: 'product', industry: 'Telecom & Digital Services',
    description: 'Telecom operator and digital services company building network and consumer platforms.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [6, 18],
    roles: ['Software Engineer', 'Network Engineer'], locations: ['Navi Mumbai', 'Bengaluru', 'Hyderabad'],
    branches: CIRCUIT, minCgpa: 6.5,
  },
  {
    slug: 'airtel', name: 'Bharti Airtel', logoText: 'AIRT', brandColor: '#e40000',
    companyType: 'product', industry: 'Telecom',
    description: 'Telecom operator with digital platform and network engineering teams.',
    difficulty: 'moderate', archetype: 'product_mid', ctc: [7, 18],
    roles: ['Engineer', 'Software Engineer'], locations: ['Gurugram', 'Bengaluru', 'Pune'], branches: CIRCUIT, minCgpa: 6.5,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Analytics & data
// ══════════════════════════════════════════════════════════════════════
const ANALYTICS: CompanyBrief[] = [
  {
    slug: 'mu-sigma', name: 'Mu Sigma', logoText: 'MUSI', brandColor: '#f5821f',
    companyType: 'service', industry: 'Decision Sciences & Analytics',
    description: 'Decision sciences firm hiring analysts to work on data-driven business problems.',
    difficulty: 'moderate', archetype: 'analytics_ds', ctc: [6, 12],
    roles: ['Decision Scientist'], locations: ['Bengaluru'], branches: ALL_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'fractal-analytics', name: 'Fractal Analytics', logoText: 'FRAC', brandColor: '#00a9ce',
    companyType: 'service', industry: 'AI & Analytics',
    description: 'Artificial intelligence and analytics company serving global consumer and financial clients.',
    difficulty: 'hard', archetype: 'analytics_ds', ctc: [8, 18],
    roles: ['Data Engineer', 'Analyst'], locations: ['Mumbai', 'Bengaluru', 'Gurugram'], branches: ALL_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'tiger-analytics', name: 'Tiger Analytics', logoText: 'TIGR', brandColor: '#f47b20',
    companyType: 'service', industry: 'Advanced Analytics',
    description: 'Advanced analytics and data science consulting company.',
    difficulty: 'hard', archetype: 'analytics_ds', ctc: [8, 18],
    roles: ['Analyst', 'Data Scientist'], locations: ['Chennai', 'Bengaluru', 'Hyderabad'], branches: ALL_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'latentview', name: 'LatentView Analytics', logoText: 'LTVW', brandColor: '#1b3a6b',
    companyType: 'service', industry: 'Analytics',
    description: 'Digital analytics company working on marketing, supply chain and customer analytics.',
    difficulty: 'moderate', archetype: 'analytics_ds', ctc: [6, 13],
    roles: ['Business Analyst'], locations: ['Chennai', 'Bengaluru'], branches: ALL_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'quantiphi', name: 'Quantiphi', logoText: 'QNTP', brandColor: '#f26722',
    companyType: 'service', industry: 'AI & Cloud Consulting',
    description: 'Applied artificial intelligence and cloud engineering company.',
    difficulty: 'hard', archetype: 'analytics_ds', ctc: [8, 18],
    roles: ['Machine Learning Engineer', 'Analyst'], locations: ['Mumbai', 'Bengaluru', 'Trivandrum'],
    branches: CIRCUIT, minCgpa: 7,
  },
  {
    slug: 'optum', name: 'Optum', logoText: 'OPTM', brandColor: '#ff612b',
    companyType: 'product', industry: 'Healthcare Technology',
    description: 'Health services and technology company, part of UnitedHealth Group, with large India engineering teams.',
    difficulty: 'hard', archetype: 'product_mid', ctc: [8, 20],
    roles: ['Software Engineer', 'Data Analyst'], locations: ['Hyderabad', 'Bengaluru', 'Noida', 'Chennai'],
    branches: CIRCUIT, minCgpa: 7,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Core engineering, manufacturing & energy
// ══════════════════════════════════════════════════════════════════════
const CORE_INDUSTRY: CompanyBrief[] = [
  {
    slug: 'larsen-toubro', name: 'Larsen & Toubro', logoText: 'L&T', brandColor: '#0072bc',
    companyType: 'product', industry: 'Engineering & Construction',
    description: 'Engineering, procurement and construction conglomerate hiring across civil, mechanical and electrical disciplines.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 11],
    roles: ['Graduate Engineer Trainee'], locations: ['Chennai', 'Mumbai', 'Vadodara', 'Site postings'],
    branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'tata-motors', name: 'Tata Motors', logoText: 'TAMO', brandColor: '#004c93',
    companyType: 'product', industry: 'Automotive',
    description: 'Automotive manufacturer covering passenger and commercial vehicles and electric mobility.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Pune', 'Jamshedpur', 'Lucknow'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'mahindra', name: 'Mahindra & Mahindra', logoText: 'M&M', brandColor: '#dc002e',
    companyType: 'product', industry: 'Automotive & Farm Equipment',
    description: 'Automotive and farm equipment manufacturer.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Chennai', 'Pune', 'Nashik'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'maruti-suzuki', name: 'Maruti Suzuki', logoText: 'MSIL', brandColor: '#e30613',
    companyType: 'product', industry: 'Automotive',
    description: 'India\'s largest passenger vehicle manufacturer.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 13],
    roles: ['Graduate Engineer Trainee'], locations: ['Gurugram', 'Manesar', 'Gujarat'], branches: CORE_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'hyundai-india', name: 'Hyundai Motor India', logoText: 'HMIL', brandColor: '#002c5f',
    companyType: 'product', industry: 'Automotive',
    description: 'Automotive manufacturer with engineering and manufacturing operations near Chennai.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5.5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Chennai'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'bajaj-auto', name: 'Bajaj Auto', logoText: 'BJAJ', brandColor: '#0057b8',
    companyType: 'product', industry: 'Automotive',
    description: 'Two-wheeler and three-wheeler manufacturer.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 11],
    roles: ['Graduate Engineer Trainee'], locations: ['Pune', 'Aurangabad'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'tvs-motor', name: 'TVS Motor Company', logoText: 'TVS', brandColor: '#004b8d',
    companyType: 'product', industry: 'Automotive',
    description: 'Two-wheeler manufacturer with growing electric vehicle engineering.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 11],
    roles: ['Graduate Engineer Trainee'], locations: ['Hosur', 'Chennai'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'hero-motocorp', name: 'Hero MotoCorp', logoText: 'HERO', brandColor: '#e2231a',
    companyType: 'product', industry: 'Automotive',
    description: 'Two-wheeler manufacturer with R&D at the Centre of Innovation and Technology in Jaipur.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 11],
    roles: ['Graduate Engineer Trainee'], locations: ['Gurugram', 'Jaipur', 'Dharuhera'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'ashok-leyland', name: 'Ashok Leyland', logoText: 'ALYD', brandColor: '#e4002b',
    companyType: 'product', industry: 'Commercial Vehicles',
    description: 'Commercial vehicle manufacturer.',
    difficulty: 'easy', archetype: 'core_engineering', ctc: [4.5, 9],
    roles: ['Graduate Engineer Trainee'], locations: ['Chennai', 'Hosur'], branches: CORE_BRANCHES, minCgpa: 6,
  },
  {
    slug: 'cummins', name: 'Cummins India', logoText: 'CMI', brandColor: '#e31837',
    companyType: 'product', industry: 'Power Systems',
    description: 'Engine and power generation systems manufacturer with a large Pune engineering centre.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 13],
    roles: ['Graduate Engineer Trainee'], locations: ['Pune', 'Phaltan'], branches: CORE_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'thermax', name: 'Thermax', logoText: 'TMX', brandColor: '#e1251b',
    companyType: 'product', industry: 'Energy & Environment Engineering',
    description: 'Energy and environment engineering company.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5, 10],
    roles: ['Graduate Engineer Trainee'], locations: ['Pune'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'jsw-steel', name: 'JSW Steel', logoText: 'JSW', brandColor: '#00539f',
    companyType: 'product', industry: 'Steel & Metals',
    description: 'Integrated steel producer.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 13],
    roles: ['Graduate Engineer Trainee'], locations: ['Vijayanagar', 'Dolvi', 'Mumbai'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'tata-steel', name: 'Tata Steel', logoText: 'TSTL', brandColor: '#0057a5',
    companyType: 'product', industry: 'Steel & Metals',
    description: 'Integrated steel manufacturer with operations across India and Europe.',
    difficulty: 'hard', archetype: 'core_engineering', ctc: [7, 15],
    roles: ['Graduate Engineer Trainee'], locations: ['Jamshedpur', 'Kalinganagar', 'Mumbai'],
    branches: CORE_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'reliance-industries', name: 'Reliance Industries', logoText: 'RIL', brandColor: '#0a2885',
    companyType: 'product', industry: 'Energy & Petrochemicals',
    description: 'Diversified conglomerate spanning refining, petrochemicals, retail and telecom.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 14],
    roles: ['Graduate Engineer Trainee'], locations: ['Jamnagar', 'Navi Mumbai', 'Hazira'],
    branches: ALL_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'adani', name: 'Adani Group', logoText: 'ADAN', brandColor: '#0072bc',
    companyType: 'product', industry: 'Infrastructure & Energy',
    description: 'Infrastructure conglomerate spanning ports, energy, airports and green hydrogen.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 14],
    roles: ['Graduate Engineer Trainee'], locations: ['Ahmedabad', 'Mundra', 'Multiple sites'],
    branches: ALL_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'bhel', name: 'BHEL', logoText: 'BHEL', brandColor: '#c8102e',
    companyType: 'product', industry: 'Power Equipment (PSU)',
    description: 'Public sector power generation equipment manufacturer.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [8, 14],
    roles: ['Engineer Trainee'], locations: ['Bhopal', 'Hyderabad', 'Trichy'], branches: CORE_BRANCHES, minCgpa: 6.5,
    insights: [advice('Public-sector selection often runs through GATE', 'Many public sector undertakings shortlist on GATE score rather than a company-specific aptitude test. Confirm the route before planning around this roadmap.')],
  },
  {
    slug: 'ntpc', name: 'NTPC', logoText: 'NTPC', brandColor: '#00447c',
    companyType: 'product', industry: 'Power Generation (PSU)',
    description: 'India\'s largest power generation company.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [9, 16],
    roles: ['Executive Trainee'], locations: ['Multiple plant locations'], branches: CORE_BRANCHES, minCgpa: 6.5,
    insights: [advice('Public-sector selection often runs through GATE', 'Shortlisting is commonly based on GATE score. Verify the current route with your placement cell before treating this roadmap as the path.')],
  },
  {
    slug: 'indian-oil', name: 'Indian Oil Corporation', logoText: 'IOCL', brandColor: '#f47216',
    companyType: 'product', industry: 'Oil & Gas (PSU)',
    description: 'State-owned oil and gas refiner and marketer.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [9, 17],
    roles: ['Engineer'], locations: ['Multiple refineries and offices'], branches: CORE_BRANCHES, minCgpa: 6.5,
    insights: [advice('Public-sector selection often runs through GATE', 'Recruitment commonly uses GATE scores for shortlisting, followed by group discussion and interview.')],
  },
  {
    slug: 'ongc', name: 'ONGC', logoText: 'ONGC', brandColor: '#e4002b',
    companyType: 'product', industry: 'Oil & Gas (PSU)',
    description: 'State-owned crude oil and natural gas exploration company.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [9, 17],
    roles: ['Graduate Trainee'], locations: ['Dehradun', 'Mumbai', 'Field locations'], branches: CORE_BRANCHES, minCgpa: 6.5,
    insights: [advice('Public-sector selection often runs through GATE', 'Shortlisting is commonly GATE-based. Treat the rounds here as aptitude practice rather than the selection path.')],
  },
  {
    slug: 'itc', name: 'ITC', logoText: 'ITC', brandColor: '#00447c',
    companyType: 'product', industry: 'FMCG & Manufacturing',
    description: 'Diversified conglomerate with FMCG, hotels, paperboards and agri businesses.',
    difficulty: 'hard', archetype: 'core_engineering', ctc: [8, 18],
    roles: ['Management Trainee', 'Engineer Trainee'], locations: ['Kolkata', 'Bengaluru', 'Multiple units'],
    branches: ALL_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'hindustan-unilever', name: 'Hindustan Unilever', logoText: 'HUL', brandColor: '#0056a4',
    companyType: 'product', industry: 'FMCG',
    description: 'Consumer goods company hiring engineers into supply chain and manufacturing roles.',
    difficulty: 'hard', archetype: 'consulting_tech', ctc: [10, 22],
    roles: ['Management Trainee — Supply Chain'], locations: ['Mumbai', 'Multiple factories'],
    branches: ALL_BRANCHES, minCgpa: 7.5,
  },
  {
    slug: 'asian-paints', name: 'Asian Paints', logoText: 'APNT', brandColor: '#e4002b',
    companyType: 'product', industry: 'Paints & Coatings',
    description: 'Decorative paints manufacturer with a strong supply chain and technology function.',
    difficulty: 'hard', archetype: 'core_engineering', ctc: [8, 18],
    roles: ['Graduate Engineer Trainee'], locations: ['Mumbai', 'Multiple plants'], branches: CORE_BRANCHES, minCgpa: 7,
  },
  {
    slug: 'godrej', name: 'Godrej', logoText: 'GODR', brandColor: '#00a44f',
    companyType: 'product', industry: 'Consumer & Industrial Products',
    description: 'Diversified group spanning consumer products, appliances and industrial engineering.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 14],
    roles: ['Graduate Engineer Trainee'], locations: ['Mumbai', 'Pune', 'Chennai'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'titan', name: 'Titan Company', logoText: 'TITN', brandColor: '#00539b',
    companyType: 'product', industry: 'Consumer Products',
    description: 'Watches, jewellery and eyewear company, part of the Tata Group.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 13],
    roles: ['Graduate Engineer Trainee'], locations: ['Hosur', 'Bengaluru'], branches: CORE_BRANCHES, minCgpa: 6.5,
  },
  {
    slug: 'havells', name: 'Havells India', logoText: 'HAVL', brandColor: '#e4002b',
    companyType: 'product', industry: 'Electrical Equipment',
    description: 'Electrical equipment and consumer durables manufacturer.',
    difficulty: 'easy', archetype: 'core_engineering', ctc: [5, 10],
    roles: ['Graduate Engineer Trainee'], locations: ['Noida', 'Multiple plants'], branches: CORE_BRANCHES, minCgpa: 6,
  },
  {
    slug: 'ultratech-cement', name: 'UltraTech Cement', logoText: 'UTCL', brandColor: '#00539b',
    companyType: 'product', industry: 'Cement & Building Materials',
    description: 'India\'s largest cement manufacturer.',
    difficulty: 'easy', archetype: 'core_engineering', ctc: [5.5, 11],
    roles: ['Graduate Engineer Trainee'], locations: ['Mumbai', 'Multiple plants'], branches: CORE_BRANCHES, minCgpa: 6,
  },
];

// ══════════════════════════════════════════════════════════════════════
// Healthcare & pharmaceuticals
// ══════════════════════════════════════════════════════════════════════
const PHARMA: CompanyBrief[] = [
  {
    slug: 'dr-reddys', name: "Dr. Reddy's Laboratories", logoText: 'DRL', brandColor: '#652d90',
    companyType: 'product', industry: 'Pharmaceuticals',
    description: 'Pharmaceutical company hiring engineers into manufacturing, quality and digital roles.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [6, 13],
    roles: ['Graduate Engineer Trainee'], locations: ['Hyderabad', 'Visakhapatnam'],
    branches: ['Chemical', 'Mechanical', 'CSE', 'IT'], minCgpa: 6.5,
  },
  {
    slug: 'sun-pharma', name: 'Sun Pharmaceutical', logoText: 'SUNP', brandColor: '#f57c20',
    companyType: 'product', industry: 'Pharmaceuticals',
    description: 'India\'s largest pharmaceutical company by revenue.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5.5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Mumbai', 'Vadodara', 'Halol'],
    branches: ['Chemical', 'Mechanical', 'CSE'], minCgpa: 6.5,
  },
  {
    slug: 'cipla', name: 'Cipla', logoText: 'CIPL', brandColor: '#0072bc',
    companyType: 'product', industry: 'Pharmaceuticals',
    description: 'Pharmaceutical company with manufacturing and R&D across India.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5.5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Mumbai', 'Goa', 'Indore'],
    branches: ['Chemical', 'Mechanical', 'CSE'], minCgpa: 6.5,
  },
  {
    slug: 'biocon', name: 'Biocon', logoText: 'BIOC', brandColor: '#00a651',
    companyType: 'product', industry: 'Biopharmaceuticals',
    description: 'Biopharmaceutical company working on biosimilars and novel therapeutics.',
    difficulty: 'moderate', archetype: 'core_engineering', ctc: [5.5, 12],
    roles: ['Graduate Engineer Trainee'], locations: ['Bengaluru', 'Visakhapatnam'],
    branches: ['Chemical', 'Biotechnology', 'CSE'], minCgpa: 6.5,
  },
];

const BRIEFS: CompanyBrief[] = [
  ...IT_SERVICES,
  ...CONSULTING,
  ...GLOBAL_PRODUCT,
  ...SEMICONDUCTOR,
  ...FINANCE,
  ...INDIAN_PRODUCT,
  ...ANALYTICS,
  ...CORE_INDUSTRY,
  ...PHARMA,
];

/** Expands each brief into a full company seed by attaching its archetype's rounds. */
function expand(brief: CompanyBrief): CompanySeed {
  const archetype = ARCHETYPES[brief.archetype];
  const insights: InsightSeed[] = [archetypeNote(brief.archetype, brief.name), ...(brief.insights ?? [])];

  // Core and semiconductor roadmaps lean on branch subjects the shared question
  // bank does not carry. Say so rather than letting a student read 0% mastery on
  // a topic that simply is not covered.
  if (brief.archetype === 'core_engineering' || brief.archetype === 'semiconductor') {
    insights.push({
      category: 'preparation_advice',
      title: 'Branch subjects are not in the question bank yet',
      body:
        'The rounds here cover aptitude, reasoning, verbal ability and programming fundamentals, which is what the shared question ' +
        'bank holds. Discipline subjects — thermodynamics, machine design, digital electronics, signals, control systems and the ' +
        'like — are examined by this employer but are not yet stocked here, so prepare those from your own coursework. Your ' +
        'placement cell can add them through the admin console, and they will then count towards readiness like anything else.',
      provenance: 'verified',
      sourceLabel: 'PlacePrep content coverage',
    });
  }

  return {
    slug: brief.slug,
    name: brief.name,
    logoText: brief.logoText,
    brandColor: brief.brandColor,
    companyType: brief.companyType,
    industry: brief.industry,
    description: brief.description,
    difficulty: brief.difficulty,
    hiringFrequency: brief.hiringFrequency ?? 'Annually (on-campus)',
    eligibleBranches: brief.branches ?? CS_ECE,
    eligibleYears: YEARS,
    minCgpa: brief.minCgpa,
    ctcMinLpa: brief.ctc[0],
    ctcMaxLpa: brief.ctc[1],
    rolesOffered: brief.roles,
    locations: brief.locations,
    expectedPrepWeeks: brief.prepWeeks ?? PREP_WEEKS[brief.difficulty],
    rounds: archetype.rounds,
    insights,
  };
}

export const EXTENDED_COMPANIES: CompanySeed[] = BRIEFS.map(expand);
