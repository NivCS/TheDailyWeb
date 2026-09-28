require('dotenv').config();

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');
mongoose.set('autoIndex', false);

const Article = require('../models/Article');
const ArticleViewBucket = require('../models/ArticleViewBucket');
const ArticlePublicationEvent = require('../models/ArticlePublicationEvent');
const Comment = require('../models/Comment');
const User = require('../models/User');
const { hashPassword } = require('../services/passwords');
const { estimateReadingTimeMinutes } = require('../services/readingTime');

const DAY_MS = 24 * 60 * 60 * 1000;
const BUCKET_MS = 5 * 60 * 1000;
const CATEGORIES = [
  { name: 'World', topics: [
    ['Regional transit pact', 'North Harbor', 'commuters face longer cross-border journeys', 'a shared ticketing pilot', 'agencies are aligning fares and schedules', 'jurisdictions still use different funding rules'],
    ['Coastal housing plan', 'Port Alder', 'rents have risen faster than local wages', 'a new mixed-income proposal', 'the city is reviewing public land for homes', 'residents want clearer protections for existing tenants'],
    ['Community power network', 'the Eastern District', 'small towns are vulnerable to grid interruptions', 'a regional energy agreement', 'local authorities are coordinating backup capacity', 'maintenance costs remain uneven across the region'],
    ['River crossing project', 'Westbridge', 'daily traffic is concentrating around one bridge', 'a two-year mobility study', 'planners are comparing repairs with a new crossing', 'nearby businesses worry about construction access'],
    ['Public records initiative', 'Mariton', 'residents struggle to track local spending', 'a searchable budget portal', 'officials are testing simpler public reporting', 'older records need review before release'],
    ['Emergency shelter network', 'the Lakes Region', 'seasonal storms can displace rural households', 'a shared shelter plan', 'community groups are coordinating supplies and transport', 'volunteer capacity varies between towns'],
    ['Language access program', 'Southgate', 'public services reach residents in many languages', 'a translation support desk', 'libraries and clinics are sharing interpretation resources', 'staffing needs remain a concern'],
    ['Neighborhood safety review', 'Old Market', 'residents report different safety needs by street', 'a block-by-block assessment', 'the council is comparing lighting and late-night transit options', 'groups disagree about which measures should come first']
  ] },
  { name: 'Technology', topics: [
    ['Digital identity service', 'Cedar County', 'residents repeat the same paperwork across agencies', 'a limited identity pilot', 'the technology office is testing a privacy-first sign-in', 'independent security review is still underway'],
    ['School device program', 'East Vale', 'students have uneven access to reliable devices', 'a refurbished laptop scheme', 'districts are coordinating repairs and lending', 'support after the first year is not yet funded'],
    ['Public data exchange', 'Riverton', 'city departments store overlapping service records', 'a shared data standard', 'teams are testing a narrow system for permit updates', 'access rules need agreement before expansion'],
    ['Small business cyber clinic', 'Northpoint', 'local firms report rising account fraud', 'a free security workshop series', 'the chamber is pairing owners with volunteer advisers', 'many shops lack time for lengthy training'],
    ['Rural broadband upgrade', 'Pine County', 'some households still rely on unstable connections', 'a new fiber construction phase', 'engineers are prioritizing remote schools and clinics', 'terrain and permits affect the schedule'],
    ['Transit app redesign', 'Central Loop', 'riders need clearer alerts during service changes', 'a simpler trip-planning interface', 'the operator is inviting regular commuters to test prototypes', 'accessibility checks will continue through the trial'],
    ['AI procurement guidance', 'the capital region', 'public teams are assessing automated tools', 'a draft purchasing framework', 'lawyers and technical staff are listing review requirements', 'the rules must keep pace with changing products'],
    ['Library technology desk', 'Brookfield', 'residents ask for help with online forms', 'weekly one-to-one support sessions', 'libraries are extending practical digital assistance', 'demand may exceed current staff hours']
  ] },
  { name: 'Business', topics: [
    ['Market hall renovation', 'South Quay', 'independent shops face rising operating costs', 'a shared renovation fund', 'vendors are negotiating a phased construction plan', 'some traders need temporary locations'],
    ['Regional food cooperative', 'Meadow County', 'small farms have limited routes to urban buyers', 'a pooled delivery service', 'producers are testing shared cold-storage and transport', 'reliable weekly volumes remain uncertain'],
    ['Apprenticeship exchange', 'Ironwood', 'manufacturers report gaps in skilled hiring', 'a cross-company training scheme', 'employers are sharing placements for new technicians', 'participants want clearer paths to permanent roles'],
    ['High street vacancy plan', 'Greenhaven', 'empty storefronts have changed the town center', 'short-term leases for local makers', 'the council is matching property owners with new tenants', 'insurance and fit-out costs remain barriers'],
    ['Credit access review', 'Stonebridge', 'young companies find early financing difficult', 'a local lending partnership', 'banks are reviewing smaller application thresholds', 'lenders still need stronger risk information'],
    ['Port logistics upgrade', 'Bayfield', 'delivery delays affect several regional suppliers', 'a shared cargo scheduling system', 'operators are testing more predictable arrival windows', 'weather and labor availability remain outside the pilot'],
    ['Worker ownership fund', 'Hillside', 'some retiring owners lack succession plans', 'a cooperative transition fund', 'advisers are helping staff explore ownership models', 'legal and valuation support is in short supply'],
    ['Night market trial', 'Maple Square', 'evening foot traffic has fallen on weekdays', 'a monthly late-opening event', 'restaurants and shops are coordinating offers', 'organizers will measure costs as well as attendance']
  ] },
  { name: 'Climate', topics: [
    ['Urban shade corridor', 'Sunfield', 'summer sidewalks are exposed to long periods of heat', 'a tree-planting route', 'designers are mapping shade near bus stops and schools', 'young trees need dependable watering'],
    ['Flood map update', 'Lower Bell River', 'older risk maps omit recent development', 'a neighborhood-level mapping review', 'scientists are combining drainage records with resident reports', 'private land data is incomplete'],
    ['Community solar program', 'Redstone', 'renters cannot install panels on their homes', 'a subscription solar project', 'the utility is testing bill credits for shared arrays', 'the first phase has limited capacity'],
    ['Wetland restoration', 'Morrow Marsh', 'habitat loss has reduced natural flood protection', 'a multi-year restoration plan', 'ecologists are reopening channels and monitoring wildlife', 'nearby farms want safeguards for drainage'],
    ['Clean heat transition', 'North Terrace', 'older buildings are costly to heat', 'a heat-pump advice service', 'housing groups are preparing practical upgrade guides', 'installation crews remain scarce'],
    ['Coastal retreat study', 'Harbor Point', 'erosion is affecting a small number of exposed streets', 'a voluntary relocation assessment', 'planners are comparing protection and buyout options', 'residents want decisions to remain locally led'],
    ['Food waste partnership', 'West County', 'shops discard unsold goods while families seek support', 'a coordinated collection route', 'nonprofits are linking safe surplus food with community kitchens', 'cold-chain capacity varies by town'],
    ['School energy challenge', 'Pine Ridge', 'district buildings use energy unevenly', 'a public efficiency scorecard', 'students and facilities teams are testing low-cost changes', 'older buildings need larger capital upgrades']
  ] },
  { name: 'Culture', topics: [
    ['Independent cinema archive', 'Parkview', 'regional film records are stored in fragile formats', 'a community digitization project', 'volunteers are cataloging screenings and oral histories', 'rights checks slow some releases'],
    ['Museum evening hours', 'Old Harbor', 'daytime opening hours exclude many workers', 'a three-month late-opening trial', 'curators are planning shorter tours and family events', 'staff scheduling will determine whether it can continue'],
    ['Public art route', 'Elm Quarter', 'new visitors often miss smaller cultural venues', 'a walking map linking local studios', 'artists are collaborating on signs and audio guides', 'the route needs regular maintenance'],
    ['Community theater fund', 'Lakewood', 'small productions struggle to cover venue costs', 'a shared equipment library', 'the arts council is pooling sets and technical gear', 'storage and insurance remain practical challenges'],
    ['Local language festival', 'Rosehill', 'younger residents have fewer places to practice heritage languages', 'a weekend storytelling program', 'schools and cultural groups are preparing open workshops', 'organizers want participation beyond formal classes'],
    ['Historic market survey', 'Northgate', 'traders have different accounts of the district’s past', 'a public oral-history collection', 'researchers are recording memories alongside planning records', 'the archive will need consent and long-term care'],
    ['Library makerspace', 'Fairmont', 'creative equipment is expensive for independent artists', 'a shared print and audio studio', 'the library is piloting low-cost booking sessions', 'training will be needed for safe equipment use'],
    ['Festival access review', 'Crown Park', 'large outdoor events can be difficult to navigate', 'a new accessibility checklist', 'organizers are consulting disabled visitors before next season', 'changes must fit temporary site layouts']
  ] },
  { name: 'Health', topics: [
    ['Mobile clinic schedule', 'Pine County', 'remote residents travel far for routine appointments', 'a rotating clinic calendar', 'health teams are coordinating stops with local groups', 'staffing limits the number of weekly visits'],
    ['Mental health referral line', 'East Harbor', 'people wait to learn which service can help', 'a single referral phone line', 'clinics are testing shared triage and follow-up', 'specialist capacity remains constrained'],
    ['Community pharmacy hours', 'Redfield', 'shift workers have difficulty collecting prescriptions', 'later opening at two branches', 'pharmacists are measuring demand before expanding', 'the change depends on additional evening staff'],
    ['Air quality alert network', 'Mill District', 'short pollution spikes are not always widely reported', 'a neighborhood sensor pilot', 'public health staff are comparing sensors with official readings', 'low-cost devices need careful calibration'],
    ['School meal nutrition review', 'Meadowbrook', 'families want clearer information about daily menus', 'a revised meal and allergy guide', 'district kitchens are testing seasonal ingredients', 'price changes complicate procurement'],
    ['Caregiver respite program', 'Westbridge', 'family caregivers have few short-term support options', 'a weekend respite pilot', 'local providers are coordinating trained relief workers', 'consistent funding is not yet secured'],
    ['Rural birth support', 'High Valley', 'expectant parents travel between distant care sites', 'a regional appointment navigator', 'midwives are mapping handoffs and emergency routes', 'coverage varies across the service area'],
    ['Healthy streets evaluation', 'South Market', 'residents link traffic noise with daily wellbeing', 'a joint street-health assessment', 'researchers are collecting observations across seasons', 'results will need to reflect different travel patterns']
  ] },
  { name: 'Science', topics: [
    ['River temperature study', 'the Alder Basin', 'summer water temperatures are changing across tributaries', 'a new sensor network', 'researchers are comparing shaded and exposed reaches', 'short records make long-term trends difficult to separate'],
    ['Pollinator garden survey', 'North Meadow', 'urban planting choices affect local insect habitat', 'a volunteer counting project', 'biologists are tracking visits across public gardens', 'weather can sharply change daily observations'],
    ['Night-sky monitoring', 'Cedar Ridge', 'light levels vary around new development', 'a citizen science survey', 'astronomers are training residents to collect consistent readings', 'cloud cover complicates comparisons'],
    ['Soil health trial', 'Red Valley', 'farmers seek ways to protect yields during dry seasons', 'a multi-field cover crop study', 'agronomists are comparing water retention and soil structure', 'results may differ by crop and soil type'],
    ['Urban heat research', 'Central Ward', 'street temperatures differ over short distances', 'a mobile measurement campaign', 'students are mapping shade, paving, and building density', 'measurements need repetition through the season'],
    ['Bird migration count', 'Cape Orin', 'coastal routes shift with wind and habitat conditions', 'a new observation station', 'researchers are combining volunteer logs with weather data', 'the first year will establish a baseline'],
    ['Local materials lab', 'Westport', 'construction waste is difficult to reuse consistently', 'a recycled aggregate test', 'engineers are comparing strength across sample mixes', 'building standards limit immediate application'],
    ['Freshwater algae watch', 'Lake Amity', 'warm periods can change water quality quickly', 'a community sampling schedule', 'scientists are sharing simple reporting guidance', 'laboratory confirmation remains essential']
  ] },
  { name: 'Other', topics: [
    ['Public transport accessibility audit', 'South Station', 'riders encounter different barriers at each stop', 'a station-by-station review', 'advocates are documenting lifts, signs, and boarding gaps', 'repairs require coordination with several operators'],
    ['Regional sports field plan', 'Oak County', 'youth teams compete for limited practice space', 'a shared booking calendar', 'clubs are testing new evening allocations', 'travel times matter as much as field capacity'],
    ['Civic repair workshop', 'Brookside', 'households replace items that could be repaired', 'a monthly fix-it clinic', 'volunteers are teaching basic maintenance skills', 'specialist tools are not always available'],
    ['Public restroom access map', 'Old Mill', 'visitors struggle to find facilities during busy periods', 'a verified local map', 'businesses and libraries are confirming opening hours', 'information needs frequent updates'],
    ['Trail maintenance agreement', 'North Woods', 'popular paths cross land managed by different groups', 'a shared maintenance schedule', 'volunteers are coordinating signs and seasonal repairs', 'storm damage can redirect limited crews'],
    ['Youth council expansion', 'Eastfield', 'students want more direct input into local decisions', 'a rotating neighborhood council', 'schools are preparing open meetings with city staff', 'participation must fit different class schedules'],
    ['Public charging station review', 'Riverfront', 'drivers report uneven access to charging points', 'a usage and reliability audit', 'operators are comparing repair times and evening demand', 'some sites need electrical upgrades'],
    ['Community garden water plan', 'Maple County', 'shared plots face higher watering needs in dry months', 'a rainwater storage pilot', 'gardeners are testing new collection and rotation rules', 'storage space differs between sites']
  ] }
];

const HEADLINE_ANGLES = [
  'A new pilot puts', 'Local leaders revisit', 'A wider plan emerges for',
  'New data sharpens debate over', 'Communities test a fresh approach to',
  'A regional review puts', 'The next phase begins for', 'Residents weigh new options for'
];
const IMAGES = [
  'https://images.unsplash.com/photo-1480714378408-67cf0d13bc1b?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1470770841072-f978cf4d019e?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1497366754035-f200968a6e72?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1518837695005-2083093ee35b?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1470252649378-9c29740c9fa8?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1497366216548-37526070297c?auto=format&fit=crop&w=1400&q=82',
  'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=1400&q=82'
];
const COMMENT_NAMES = ['Ari', 'Dana', 'Mina', 'Eli', 'Noa', 'Sam', 'Ruth', 'Talia', 'Jordan', 'Lee', 'Guest reader', 'Maya'];
const COMMENT_TEXTS = [
  'The local context makes this easier to understand. I hope the follow-up includes the neighborhoods most affected.',
  'It will be useful to see how the results compare after the first few months.',
  'This raises a practical question about who will maintain the program once the pilot ends.',
  'I appreciate the explanation of the trade-offs. More detail on the next public meeting would help.',
  'A clear timeline will make it easier for residents to follow what changes and when.',
  'The different experiences across the region deserve attention in the next update.',
  'Good to see the project measured against everyday needs as well as its headline target.',
  'I would like to know how people can share feedback while the trial is running.'
];
const REPORTER_ACCOUNTS = [
  { username: 'reporter.demo', displayName: 'Maya Levin' },
  { username: 'reporter.jordan', displayName: 'Jordan Hale' },
  { username: 'reporter.noa', displayName: 'Noa Ben-Ami' },
  { username: 'reporter.sam', displayName: 'Sam Rivera' }
];
const EDITOR_USERNAME = 'editor.demo';

let randomState = 9282026;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x100000000;
}
function randomInt(min, max) { return min + Math.floor(random() * (max - min + 1)); }
function pick(items) { return items[randomInt(0, items.length - 1)]; }
function dateDaysAgo(days, hour = randomInt(6, 21), minute = randomInt(0, 59)) {
  const date = new Date(Date.now() - days * DAY_MS);
  date.setHours(hour, Math.floor(minute / 5) * 5, 0, 0);
  return date > new Date() ? new Date() : date;
}
function slugify(text, index) {
  const slug = text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 75);
  return `${slug}-${String(index + 1).padStart(3, '0')}`;
}
function storyFor(index) {
  const category = CATEGORIES[Math.floor(index / (8 * 8))];
  const categoryIndex = Math.floor(index / 8) % category.topics.length;
  const topic = category.topics[categoryIndex];
  const angle = HEADLINE_ANGLES[index % HEADLINE_ANGLES.length];
  const title = `${angle} ${topic[0]} in ${topic[1]}`;
  const signal = randomInt(8, 47);
  const year = new Date().getFullYear();
  const excerpt = `${topic[2].charAt(0).toUpperCase()}${topic[2].slice(1)}. The latest plan centers on ${topic[3]}, while local teams consider whether ${topic[5]}.`;
  const paragraphs = [
    `A new phase of ${topic[0].toLowerCase()} is taking shape in ${topic[1]}, where ${topic[2]}. The proposal brings together residents, service providers, and local officials around ${topic[3]}. Organizers say the immediate goal is to establish a workable process and publish results that can be checked over time. The first round is designed to surface practical problems before any wider commitment is made.`,
    `Early planning documents point to a measured rollout rather than a region-wide launch. Teams are reviewing a baseline of about ${signal} locations, service points, or participating groups, depending on the needs of each site. That number is a planning estimate, not a final outcome. Staff expect the first comparisons to show where the approach works consistently and where local conditions call for a different design.`,
    `The work is shaped by a familiar tension: a shared standard can make services easier to coordinate, but a uniform plan may miss the differences between neighborhoods. In ${topic[1]}, organizers are collecting feedback from people who would use the program as well as those responsible for running it. The schedule also leaves room to revise procedures when an early test exposes an unexpected cost or access barrier.`,
    `One open question is whether ${topic[5]}. Project staff have asked participating groups to document staffing, maintenance, and access needs alongside headline measures. They are also comparing short-term benefits with the effort required to keep the service reliable. Local partners say that clear responsibilities will matter as much as the initial funding if the work is to continue beyond its trial period.`,
    `The next stage will test the proposed response. ${topic[4].charAt(0).toUpperCase()}${topic[4].slice(1)}. Over the coming months, organizers plan to publish a progress summary, hold open sessions, and explain which parts of the plan changed in response to feedback. The review will include both successful sites and places where the approach did not meet expectations. That record should help decision-makers avoid treating a small pilot as proof that the same model will work everywhere.`,
    `For now, the project remains a local test rather than a settled policy. Residents can follow the schedule through public notices from participating organizations, which will share further details as dates are confirmed. A broader decision is expected only after the first results are reviewed. The central question is whether the process can deliver a dependable improvement without placing new burdens on the people it is meant to serve.`
  ];
  const paragraphCount = 3 + (index % 4);
  const content = paragraphs.slice(0, paragraphCount + 1);
  if (index % 5 === 0) {
    content.push(`The implementation also depends on details that are easy to overlook: how participants hear about the service, how quickly questions receive an answer, and which team is responsible when plans change. Organizers are documenting those steps so the public review can distinguish a promising idea from a process that is practical to operate. This record will be shared alongside the main results.`);
  }
  if (index % 17 === 0) {
    content.push(`Partners are also considering how the work can adapt over time. A process that fits a small initial group may need different staff, equipment, or schedules when more people take part. The current phase is intended to identify those needs early, before a permanent commitment is made. Any decision to extend the project will include a fresh review of costs, access, and local feedback.`);
  }
  if (index % 3 === 0) {
    content.push(`A separate review later in ${year} will look at participation, reliability, and recurring costs. Until then, the teams involved are treating the early numbers as a guide for planning rather than a final verdict. Any next phase will depend on what the public record shows and whether the partners can agree on a sustainable way to continue.`);
  }
  return { category: category.name, title, excerpt, content, image: IMAGES[index % IMAGES.length], topic: topic[0] };
}

function makeBuckets(articleId, publishedAt, articleIndex) {
  const byKey = new Map();
  const daysSincePublication = Math.max(1, Math.floor((Date.now() - publishedAt.getTime()) / DAY_MS));
  const popularity = 0.5 + (articleIndex % 23) / 9 + (articleIndex % 11 === 0 ? 2.5 : 0);
  for (let day = 0; day <= daysSincePublication; day += 1) {
    const dayWeight = day > daysSincePublication - 4 ? 1.35 : 1;
    for (let slot = 0; slot < 8; slot += 1) {
      if (random() < 0.18) continue;
      const minute = randomInt(0, 11) * 5;
      const at = new Date(publishedAt.getTime() + day * DAY_MS);
      at.setHours(slot * 3 + randomInt(0, 2), minute, 0, 0);
      if (at < publishedAt || at > new Date()) continue;
      const bucketStart = new Date(Math.floor(at.getTime() / BUCKET_MS) * BUCKET_MS);
      const shard = randomInt(0, 7);
      const key = `${bucketStart.getTime()}:${shard}`;
      const views = Math.max(1, Math.round(randomInt(1, 8) * popularity * dayWeight));
      const prior = byKey.get(key);
      if (prior) prior.views += views;
      else byKey.set(key, { article: articleId, bucketStart, shard, views });
    }
  }
  return [...byKey.values()];
}

async function ensureUser(username, role, createdUsers) {
  let user = await User.findOne({ username });
  if (user) {
    if (user.role !== role) throw new Error(`Existing account "${username}" has role "${user.role}", expected "${role}".`);
    return user;
  }
  const password = `${crypto.randomBytes(18).toString('base64url')}aA7!`;
  user = await User.create({ username, role, passwordHash: await hashPassword(password) });
  createdUsers.push({ username, role, password });
  return user;
}

function batches(items, size = 1000) {
  const result = [];
  for (let index = 0; index < items.length; index += size) result.push(items.slice(index, index + size));
  return result;
}

async function createDemoUsers() {
  const createdUsers = [];
  const reporters = [];
  for (const account of REPORTER_ACCOUNTS) {
    const user = await ensureUser(account.username, 'reporter', createdUsers);
    reporters.push({ id: user._id, username: user.username, displayName: account.displayName });
  }
  const editor = await ensureUser(EDITOR_USERNAME, 'editor', createdUsers);
  if (createdUsers.length) {
    const lines = ['The Daily Web demo accounts created by seedDemoData.js', 'Keep this local file private; it is excluded from Git.', ''];
    for (const account of createdUsers) lines.push(`${account.role}\t${account.username}\t${account.password}`);
    fs.writeFileSync(path.join(__dirname, '..', '.demo-credentials.txt'), `${lines.join('\n')}\n`, { flag: fs.existsSync(path.join(__dirname, '..', '.demo-credentials.txt')) ? 'a' : 'w' });
  }
  return { reporters, editor, createdCredentials: createdUsers.length > 0 };
}

async function removeRedundantIndexes(database) {
  const redundant = [
    ['comments', 'article_1'],
    ['articleviewbuckets', 'article_1_bucketStart_1'],
    ['articlepublicationevents', 'eventAt_1']
  ];
  for (const [collectionName, indexName] of redundant) {
    const exists = await database.listCollections({ name: collectionName }).hasNext();
    if (!exists) continue;
    const collection = database.collection(collectionName);
    const indexes = await collection.indexes();
    const index = indexes.find((candidate) => candidate.name === indexName);
    if (!index) continue;
    const key = Object.entries(index.key);
    const isExpected = (collectionName === 'comments' && key.length === 1 && key[0][0] === 'article')
      || (collectionName === 'articleviewbuckets' && key.length === 2 && key[0][0] === 'article' && key[1][0] === 'bucketStart')
      || (collectionName === 'articlepublicationevents' && key.length === 1 && key[0][0] === 'eventAt');
    if (isExpected) await collection.dropIndex(indexName);
  }
}

async function seed() {
  if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI is required.');
  if (process.env.NODE_ENV === 'production') throw new Error('Refusing to replace data while NODE_ENV=production.');
  if (!process.argv.includes('--replace')) throw new Error('This command replaces article demo data. Re-run with --replace to confirm.');

  await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 15000, autoIndex: false });
  const database = mongoose.connection.db;
  console.log(`Preparing a two-month demo dataset in MongoDB database "${database.databaseName}".`);
  const { reporters, editor, createdCredentials } = await createDemoUsers();

  await Promise.all([
    Article.deleteMany({}),
    Comment.deleteMany({}),
    ArticleViewBucket.deleteMany({}),
    ArticlePublicationEvent.deleteMany({})
  ]);
  const analyticsExists = await database.listCollections({ name: 'articleanalytics' }).hasNext();
  if (analyticsExists) await database.collection('articleanalytics').drop();
  await removeRedundantIndexes(database);

  const now = new Date();
  const articleDocs = [];
  const publicationEvents = [];
  const comments = [];
  const bucketRows = [];

  for (let index = 0; index < 500; index += 1) {
    const story = storyFor(index);
    const reporter = reporters[index % reporters.length];
    const createdAt = dateDaysAgo(randomInt(0, 60));
    const isPublished = index < 385;
    const isPending = index >= 385 && index < 425;
    const isDraft = index >= 425 && index < 465;
    const isReturned = index >= 465;
    const hasPublicVersion = isPublished || (isPending && index % 5 === 0) || (isReturned && index % 3 === 0);
    const firstPublishedAt = hasPublicVersion ? new Date(Math.min(now.getTime(), createdAt.getTime() + randomInt(0, 4) * 60 * 60 * 1000)) : null;
    const slug = slugify(story.title, index);
    const publicStory = { ...story };
    const pendingStory = {
      ...story,
      title: story.title.replace(/^(A new pilot puts|Local leaders revisit|A wider plan emerges for|New data sharpens debate over|Communities test a fresh approach to|A regional review puts|The next phase begins for|Residents weigh new options for)/, 'Editors review'),
      excerpt: `${story.excerpt} This proposed revision is awaiting editorial review.`
    };
    const article = {
      _id: new mongoose.Types.ObjectId(), slug, author: reporter.displayName, reporter: reporter.id,
      category: story.category, image: story.image, views: 0,
      createdAt, updatedAt: createdAt, __v: 0
    };

    if (hasPublicVersion) {
      Object.assign(article, publicStory, {
        status: 'published', approved: true, workflowStatus: isPending ? 'pending' : isReturned ? 'returned' : 'published',
        publishedAt: firstPublishedAt,
        readingTimeMinutes: estimateReadingTimeMinutes(publicStory.content),
        workingCopy: isPending || isReturned ? pendingStory : publicStory,
        submittedCopy: isPending || isReturned ? pendingStory : undefined,
        reviewNote: isReturned ? 'Please add more detail about how residents can take part and clarify the expected timeline.' : '',
        submittedAt: isPending || isReturned ? new Date(Math.min(now.getTime(), createdAt.getTime() + 2 * 60 * 60 * 1000)) : undefined
      });
      article.updatedAt = createdAt;
      publicationEvents.push({
        article: article._id, eventAt: firstPublishedAt, eventType: 'publication', editor: editor._id,
        articleTitle: story.title, eventKey: `demo-publication-${article._id}-${firstPublishedAt.getTime()}`,
        createdAt: firstPublishedAt, updatedAt: firstPublishedAt
      });

      const shouldHaveUpdates = index % 4 === 0 || index % 13 === 0;
      const updateCount = shouldHaveUpdates && (now.getTime() - firstPublishedAt.getTime()) > 3 * DAY_MS ? 1 + (index % 3) : 0;
      const updateDates = [];
      for (let update = 0; update < updateCount; update += 1) {
        const remainingDays = Math.max(1, Math.floor((now.getTime() - firstPublishedAt.getTime()) / DAY_MS));
        const updateAt = new Date(firstPublishedAt.getTime() + randomInt(1, remainingDays) * DAY_MS + randomInt(7, 20) * 60 * 60 * 1000);
        if (updateAt < now && updateAt > firstPublishedAt && !updateDates.some((date) => Math.abs(date - updateAt) < DAY_MS)) updateDates.push(updateAt);
      }
      updateDates.sort((left, right) => left - right);
      updateDates.forEach((eventAt, updateIndex) => {
        const titleAtUpdate = updateIndex === updateDates.length - 1 ? story.title : `${story.title} — follow-up ${updateIndex + 1}`;
        publicationEvents.push({
          article: article._id, eventAt, eventType: 'update', editor: editor._id,
          articleTitle: titleAtUpdate, eventKey: `demo-update-${article._id}-${eventAt.getTime()}`,
          createdAt: eventAt, updatedAt: eventAt
        });
      });
      if (updateDates.length) article.updatedAt = updateDates[updateDates.length - 1];
      bucketRows.push(...makeBuckets(article._id, firstPublishedAt, index));

      const commentCount = randomInt(2, 8);
      for (let commentIndex = 0; commentIndex < commentCount; commentIndex += 1) {
        const created = new Date(firstPublishedAt.getTime() + random() * Math.max(1, now.getTime() - firstPublishedAt.getTime()));
        comments.push({
          article: article._id, author: pick(COMMENT_NAMES), body: pick(COMMENT_TEXTS),
          createdAt: created, updatedAt: created
        });
      }
    } else {
      article.title = 'Untitled story';
      article.excerpt = '';
      article.content = [];
      article.image = '';
      article.publishedAt = null;
      article.readingTimeMinutes = estimateReadingTimeMinutes(story.content);
      article.status = isPending ? 'pending' : 'draft';
      article.approved = false;
      article.workflowStatus = isPending ? 'pending' : isReturned ? 'returned' : 'draft';
      article.workingCopy = story;
      article.submittedCopy = isPending || isReturned ? story : undefined;
      article.reviewNote = isReturned ? 'Please explain the reporting method and add a source note before resubmitting.' : '';
      article.submittedAt = isPending || isReturned ? createdAt : undefined;
    }
    articleDocs.push(article);
  }

  if (articleDocs.length !== 500) throw new Error(`Expected 500 article fixtures, built ${articleDocs.length}.`);
  await Article.insertMany(articleDocs, { ordered: true });
  if (comments.length) await Comment.insertMany(comments, { ordered: false });

  for (const batch of batches(publicationEvents, 1000)) {
    await ArticlePublicationEvent.insertMany(batch, { ordered: false });
  }
  for (const batch of batches(bucketRows, 1000)) {
    const operations = batch.map((row) => ({
      updateOne: {
        filter: { article: row.article, bucketStart: row.bucketStart, shard: row.shard },
        update: { $set: row }, upsert: true
      }
    }));
    await ArticleViewBucket.bulkWrite(operations, { ordered: false });
  }

  const totals = new Map();
  for (const row of bucketRows) totals.set(String(row.article), (totals.get(String(row.article)) || 0) + row.views);
  const viewUpdates = [...totals.entries()].map(([articleId, views]) => ({
    updateOne: { filter: { _id: new mongoose.Types.ObjectId(articleId) }, update: { $set: { views } } }
  }));
  for (const batch of batches(viewUpdates, 1000)) await Article.collection.bulkWrite(batch, { ordered: false });

  await Promise.all([
    Article.createIndexes(), Comment.createIndexes(), ArticleViewBucket.createIndexes(), ArticlePublicationEvent.createIndexes()
  ]);

  const counts = {
    articles: await Article.countDocuments(),
    published: await Article.countDocuments({ status: 'published', approved: true }),
    pending: await Article.countDocuments({ workflowStatus: 'pending' }),
    drafts: await Article.countDocuments({ workflowStatus: 'draft', status: 'draft' }),
    returned: await Article.countDocuments({ workflowStatus: 'returned' }),
    comments: await Comment.countDocuments(),
    viewBuckets: await ArticleViewBucket.countDocuments(),
    publicationEvents: await ArticlePublicationEvent.countDocuments(),
    totalViews: (await Article.aggregate([{ $group: { _id: null, total: { $sum: '$views' } } }]))[0]?.total || 0,
    analyticsCollectionRemoved: !(await database.listCollections({ name: 'articleanalytics' }).hasNext())
  };
  if (counts.articles !== 500 || counts.published < 400 || !counts.pending || !counts.drafts || !counts.returned || !counts.analyticsCollectionRemoved) {
    throw new Error(`Seed verification failed: ${JSON.stringify(counts)}`);
  }
  console.log(`Demo data ready: ${JSON.stringify(counts)}`);
  if (createdCredentials) console.log('New account credentials are saved in the Git-ignored .demo-credentials.txt file.');
}

seed()
  .catch((error) => {
    console.error(`Demo seed failed: ${error.message}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    if (mongoose.connection.readyState) await mongoose.disconnect();
  });
