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
const DEMO_IMAGE_IDS = require('../data/demoImageIds.json');

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
const REVISION_HEADLINE_ANGLES = [
  'The revised plan for', 'A closer look at', 'What happens next for', 'New questions about',
  'How the proposal could reshape', 'Behind the plan for', 'A fresh update on', 'The case for rethinking'
];
const EXCERPT_STYLES = [
  (topic, detail) => `${topic[1]} is considering ${topic[3]} after ${topic[2]}. The first review will focus on ${detail}.`,
  (topic, detail) => `A proposal for ${topic[1]} would test ${topic[3]}. Its progress will depend on ${topic[5]}, with ${detail} on the schedule.`,
  (topic, detail) => `Local teams are weighing a response to ${topic[2]}. The plan pairs ${topic[3]} with ${detail}, while ${topic[5]} remains unresolved.`,
  (topic, detail) => `${topic[3]} is moving into a planning phase in ${topic[1]}. Organizers want to learn whether ${detail} can address ${topic[2]}.`,
  (topic, detail) => `The debate in ${topic[1]} centers on how to respond to ${topic[2]}. A proposed ${topic[3]} will be assessed through ${detail}.`,
  (topic, detail) => `A local test could change how ${topic[1]} handles ${topic[0].toLowerCase()}. The next decision follows ${detail} and a review of ${topic[5]}.`,
  (topic, detail) => `Residents and service providers are examining ${topic[3]} in response to ${topic[2]}. The work starts with ${detail}.`,
  (topic, detail) => `${topic[1]} is testing a new approach to ${topic[0].toLowerCase()}. Early reporting will track ${detail} before leaders decide whether to continue.`
];
const OPENING_STYLES = [
  (t) => `In ${t[1]}, ${t[2]}. ${t[0]} is moving from discussion to a time-limited test centered on ${t[3]}. Residents and operators have been asked to assess whether it fits local needs.`,
  (t) => `Officials in ${t[1]} are considering ${t[3]} after reports that ${t[2]}. The plan would begin at a small number of sites before any decision on wider use.`,
  (t) => `A proposed response to ${t[2]} is taking shape in ${t[1]}, where planners are advancing ${t[3]}. The next stage will test how well the idea works in everyday conditions.`,
  (t) => `For groups working on ${t[0].toLowerCase()}, the immediate question is whether ${t[3]} can address the problems reported in ${t[1]}. Organizers say the test is meant to produce evidence before a wider commitment.`,
  (t) => `New planning for ${t[1]} centers on ${t[3]}. It follows concerns that ${t[2]} and shifts attention toward service details residents can evaluate directly.`,
  (t) => `A local review in ${t[1]} is comparing options for ${t[0].toLowerCase()}. The current proposal responds to ${t[2]}, but its reach will depend on staffing and local support.`,
  (t) => `Residents and service providers in ${t[1]} are being asked to test a different response to ${t[2]}. The work focuses on ${t[3]} and includes a review before the program can expand.`,
  (t) => `After months of discussion, teams in ${t[1]} are preparing ${t[3]}. The decision follows a familiar gap: ${t[2]}. Organizers say the first phase will be judged on service quality as well as participation.`
];
const REPORTING_DETAILS = [
  (t, n, months) => `The initial plan covers about ${n} locations, service points, or participating groups, depending on the project. Organizers expect a review after ${months} months; these are planning figures, not final results.`,
  (t, n, months) => `Staff will track how many people use the service, where delays occur, and what support teams need. A check-in is planned within ${months} months, with the first phase limited to roughly ${n} sites or groups.`,
  (t, n, months) => `The rollout is deliberately narrow. Teams expect to begin with ${n} participating sites or groups and compare their experience over ${months} months before recommending any expansion.`,
  (t, n, months) => `A working group is preparing a baseline for the first ${n} locations or participants. The comparison period is expected to last ${months} months, although the schedule may change as local partners join.`,
  (t, n, months) => `Organizers plan to publish a progress note within ${months} months. It will include participation, staffing, and operating issues from an initial group of about ${n} sites or partners.`,
  (t, n, months) => `The practical test will follow a small group of about ${n} sites or participants. Teams will use the next ${months} months to record service gaps and adjust the process where needed.`,
  (t, n, months) => `Rather than launch everywhere at once, the project will compare results across about ${n} sites or groups. Partners expect the first review in ${months} months and say the measure will include reliability as well as reach.`,
  (t, n, months) => `Local teams will collect feedback during a ${months}-month trial involving roughly ${n} service points or participating groups. The figures may shift as access and staffing are confirmed.`
];
const COMMUNITY_DETAILS = [
  (t) => `In ${t[1]}, ${t[4]}. Those plans are intended to make the service easier to assess, though residents have asked for clear ways to report problems.`,
  (t) => `The proposal depends on local partners. ${t[4]}. Their experience will help show whether the plan works outside the initial test sites.`,
  (t) => `The next phase will rely on people who use and operate the service. ${t[4]}. Organizers say their feedback will be recorded alongside headline measures.`,
  (t) => `Local conditions could shape the result as much as the design. ${t[4]}. The project team says it will publish both successful approaches and obstacles.`,
  (t) => `Residents will be invited to compare the plan with current services. ${t[4]}. That feedback is expected to influence the final schedule and any changes to the pilot.`,
  (t) => `The work also requires coordination among groups that do not usually share day-to-day decisions. ${t[4]}. Organizers are mapping responsibilities before the test begins.`,
  (t) => `People affected by the change have asked to see how decisions are made. ${t[4]}. The team says it will publish a plain-language summary after the first review.`,
  (t) => `Partners are preparing practical guidance for the first phase. ${t[4]}. The details matter because staffing, access, and maintenance differ between locations.`
];
const UNCERTAINTY_DETAILS = [
  (t) => `The main uncertainty is whether ${t[5]}. Officials have not treated the pilot as proof that the same model would work in every neighborhood.`,
  (t) => `One unresolved issue is ${t[5]}. The project will need to show who is responsible for ongoing costs before leaders consider making it permanent.`,
  (t) => `The proposal still has an open question: ${t[5]}. Organizers say they will compare the benefits with the staff time and upkeep required.`,
  (t) => `Local groups have raised concerns about whether ${t[5]}. The review is expected to describe trade-offs as well as progress.`,
  (t) => `A decision will depend partly on ${t[5]}. Until those details are clearer, officials say the work remains a trial rather than a settled policy.`,
  (t) => `The schedule could be affected by ${t[5]}. Partners are documenting the constraint now so it can be weighed against the expected benefits.`,
  (t) => `It is not yet clear how teams will resolve ${t[5]}. The first report is expected to identify which parts of the plan need a different approach.`,
  (t) => `Whether the plan can continue may hinge on ${t[5]}. Organizers say cost, access, and local feedback will all be considered before a next phase.`
];
const NEXT_STEPS = [
  (t, month) => `The next public update is expected in about ${month} months. It should set out what changed, what did not work, and whether partners recommend continuing ${t[0].toLowerCase()}.`,
  (t, month) => `Teams plan to publish their first findings in roughly ${month} months. Any wider rollout would follow a review of participation, reliability, and recurring responsibilities.`,
  (t, month) => `A decision point is expected within ${month} months. Before then, organizers will share a progress summary and explain how community feedback affected the plan.`,
  (t, month) => `The next step is a public review, planned for about ${month} months from now. Leaders say they will consider both the measured results and the effort required to sustain the service.`,
  (t, month) => `Over the next ${month} months, the project team expects to publish its schedule and early findings. A permanent commitment will depend on what the review shows.`,
  (t, month) => `Organizers expect to revisit the proposal after ${month} months of operation. The report will describe where the approach helped and where a different response may be needed.`,
  (t, month) => `The public will receive another progress note in approximately ${month} months. Officials say any extension should be based on documented results rather than the initial plan alone.`,
  (t, month) => `Partners are preparing a follow-up review for the coming ${month} months. Its findings will help determine whether the work should continue, change direction, or end.`
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
  'reporter.demo',
  'reporter.jordan',
  'reporter.noa',
  'reporter.sam'
];
const EDITOR_USERNAME = 'editor.demo';

let randomState = 9282026;
function random() {
  randomState = (randomState * 1664525 + 1013904223) >>> 0;
  return randomState / 0x100000000;
}
function randomInt(min, max) { return min + Math.floor(random() * (max - min + 1)); }
function pick(items) { return items[randomInt(0, items.length - 1)]; }
function stableInt(index, salt, min, max) {
  let value = Math.imul(index + 1, 0x45d9f3b) ^ Math.imul(salt + 1, 0x27d4eb2d);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value = Math.imul(value ^ (value >>> 16), 0x45d9f3b);
  value ^= value >>> 16;
  return min + ((value >>> 0) % (max - min + 1));
}
function imageFor(index) {
  const id = DEMO_IMAGE_IDS[index];
  if (!id) throw new Error(`Missing demo image ID for fixture ${index}.`);
  return `https://picsum.photos/id/${id}/1400/900`;
}
function revisionImageFor(index) {
  const offset = index < 425 ? 500 + Math.floor((index - 385) / 5) : 508 + (index - 465);
  return imageFor(offset);
}
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
  const categoryIndex = Math.floor(index / (8 * 8)) % CATEGORIES.length;
  const category = CATEGORIES[categoryIndex];
  const topicIndex = Math.floor(index / 8) % category.topics.length;
  const topic = category.topics[topicIndex];
  const angle = HEADLINE_ANGLES[index % HEADLINE_ANGLES.length];
  const title = `${angle} ${topic[0]} in ${topic[1]}`;
  const variant = index % 8;
  const siteCount = stableInt(index, 0, 8, 42);
  const reviewMonths = stableInt(index, 1, 2, 9);
  const excerpt = EXCERPT_STYLES[variant](topic, `${siteCount} locations or participating groups`);
  const content = [
    OPENING_STYLES[variant](topic),
    REPORTING_DETAILS[(variant + categoryIndex) % REPORTING_DETAILS.length](topic, siteCount, reviewMonths),
    COMMUNITY_DETAILS[(variant + topicIndex) % COMMUNITY_DETAILS.length](topic),
    UNCERTAINTY_DETAILS[(variant + 2) % UNCERTAINTY_DETAILS.length](topic),
    NEXT_STEPS[(variant + categoryIndex + topicIndex) % NEXT_STEPS.length](topic, reviewMonths)
  ];
  return {
    category: category.name, title, excerpt, content, image: imageFor(index),
    topicDetails: { topic: topic[0], place: topic[1], issue: topic[2], proposal: topic[3], update: topic[4], uncertainty: topic[5] }
  };
}

function submittedStory(story, index, image = story.image) {
  const topic = story.topicDetails;
  const variant = index % 8;
  const title = `${REVISION_HEADLINE_ANGLES[variant]} ${topic.topic} in ${topic.place}`;
  const excerpt = [
    `The revised copy adds detail on how ${topic.proposal} would respond to ${topic.issue}, and identifies what residents can expect during the first review.`,
    `This version puts the local timetable in focus, with new context on ${topic.update} and the question of ${topic.uncertainty}.`,
    `The update explains who would take part in ${topic.proposal} and how the team plans to assess whether it is working.`,
    `A revised account of the proposal includes more on ${topic.issue}, the expected local impact, and the limits of the first phase.`,
    `The new draft adds reporting about ${topic.update} and clarifies why ${topic.uncertainty} remains unresolved.`,
    `This submission expands the explanation of ${topic.proposal}, including the practical questions raised by residents and local partners.`,
    `The reporter has added context on the groups affected in ${topic.place} and the evidence needed before the plan can grow.`,
    `The revised story distinguishes the early test from a permanent policy and adds detail about ${topic.uncertainty}.`
  ][variant];
  const revisionParagraphs = [
    `This version follows the people responsible for putting ${topic.proposal} into practice. In ${topic.place}, their first task is to respond to ${topic.issue} while making the service understandable to residents.`,
    story.content[1],
    `The reporter's update adds a closer look at ${topic.update}. That work is expected to show where the proposal fits local routines and where additional coordination is needed.`,
    story.content[3],
    `The next review will examine ${topic.uncertainty} alongside participation and reliability. Organizers say they will publish the findings before deciding whether to continue.`
  ];
  return { category: story.category, title, excerpt, content: revisionParagraphs, image };
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
  const displayName = username.split(/[._-]+/).filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(' ');
  let user = await User.findOne({ username });
  if (user) {
    if (user.role !== role) throw new Error(`Existing account "${username}" has role "${user.role}", expected "${role}".`);
    if (!user.displayName) {
      user.displayName = displayName;
      await user.save();
    }
    return user;
  }
  const password = `${crypto.randomBytes(18).toString('base64url')}aA7!`;
  user = await User.create({ username, displayName, role, passwordHash: await hashPassword(password) });
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
  for (const username of REPORTER_ACCOUNTS) {
    const user = await ensureUser(username, 'reporter', createdUsers);
    reporters.push({ id: user._id, username: user.username, displayName: user.displayName || user.username });
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
    const pendingStory = submittedStory(
      story,
      index,
      hasPublicVersion && (isPending || isReturned) ? revisionImageFor(index) : story.image
    );
    const article = {
      _id: new mongoose.Types.ObjectId(), slug, author: reporter.displayName, reporter: reporter.id,
      category: story.category, image: story.image, views: 0,
      createdAt, updatedAt: createdAt, __v: 0
    };

    if (hasPublicVersion) {
      const { topicDetails: _topicDetails, ...publicVersion } = publicStory;
      Object.assign(article, publicVersion, {
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
      article.workingCopy = isPending || isReturned ? pendingStory : story;
      article.submittedCopy = isPending || isReturned ? pendingStory : undefined;
      article.reviewNote = isReturned ? 'Please explain the reporting method and add a source note before resubmitting.' : '';
      article.submittedAt = isPending || isReturned ? createdAt : undefined;
    }
    articleDocs.push(article);
  }

  if (articleDocs.length !== 500) throw new Error(`Expected 500 article fixtures, built ${articleDocs.length}.`);
  const fixtureTitles = articleDocs.map((article) => article.workingCopy?.title || article.title);
  if (new Set(fixtureTitles).size !== 500) throw new Error('Fixture story titles must be unique.');
  if (DEMO_IMAGE_IDS.length < 520) throw new Error('At least 520 distinct Picsum image IDs are required.');
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

if (require.main === module) {
  seed()
    .catch((error) => {
      console.error(`Demo seed failed: ${error.message}`);
      process.exitCode = 1;
    })
    .finally(async () => {
      if (mongoose.connection.readyState) await mongoose.disconnect();
    });
}

module.exports = { storyFor, submittedStory, imageFor, revisionImageFor };
