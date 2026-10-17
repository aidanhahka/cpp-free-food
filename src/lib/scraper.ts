import * as cheerio from 'cheerio';

export type ScrapedEvent = {
  title: string;
  description: string;
  date: string;
  time: string | null;
  location: string | null;
  organizer: string | null;
  source_url: string | null;
  source_name: string;
  source_event_id?: string | null;
  tags: string[];
  has_free_food: boolean;
  food_evidence?: string | null;
  food_confidence?: number;
  rsvp_required?: boolean | null;
};

const CPP_EVENTS_URL =
  'https://www.cpp.edu/mobile-app/events/university-events/list.shtml';

const FREE_FOOD_PATTERNS = [
  /\bfree food\b/i,
  /\bfree lunch\b/i,
  /\bfree dinner\b/i,
  /\bfree breakfast\b/i,
  /\bfree snacks?\b/i,
  /\bfree pizza\b/i,
  /\bfree tacos?\b/i,
  /\bfree burgers?\b/i,
  /\bfree sandwiches?\b/i,
  /\bfree refreshments?\b/i,
  /\bcomplimentary food\b/i,
  /\bcomplimentary refreshments?\b/i,

  /\bfood (?:will be |is |are )?provided\b/i,
  /\bfood and drinks (?:will be |are )?provided\b/i,
  /\bdrinks and food (?:will be |are )?provided\b/i,
  /\blunch (?:will be |is )?provided\b/i,
  /\bdinner (?:will be |is )?provided\b/i,
  /\bbreakfast (?:will be |is )?provided\b/i,
  /\bsnacks? (?:will be |are )?provided\b/i,
  /\brefreshments? (?:will be |are )?provided\b/i,

  /\bwe(?:'ll| will) provide (?:food|lunch|dinner|pizza|tacos|snacks)\b/i,
  /\bwe(?:'ll| will) have (?:food|pizza|pizzas|tacos|snacks)\b/i,
];

const MONTHS: Record<string, string> = {
  january: '01',
  february: '02',
  march: '03',
  april: '04',
  may: '05',
  june: '06',
  july: '07',
  august: '08',
  september: '09',
  october: '10',
  november: '11',
  december: '12',
};

function cleanText(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function findFoodEvidence(text: string): string | null {
  const cleaned = cleanText(text);

  for (const pattern of FREE_FOOD_PATTERNS) {
    const match = cleaned.match(pattern);

    if (match && match.index !== undefined) {
      const start = Math.max(0, match.index - 80);
      const end = Math.min(
        cleaned.length,
        match.index + match[0].length + 120
      );

      return cleaned.slice(start, end).trim();
    }
  }

  return null;
}

function containsFreeFood(text: string): boolean {
  return findFoodEvidence(text) !== null;
}

function extractTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];

  if (
    lower.includes('student club') ||
    lower.includes('club event') ||
    lower.includes('student organization')
  ) {
    tags.push('Club');
  }

  if (
    lower.includes('career') ||
    lower.includes('internship') ||
    lower.includes('professional') ||
    lower.includes('industry')
  ) {
    tags.push('Career');
  }

  if (
    lower.includes('workshop') ||
    lower.includes('lecture') ||
    lower.includes('seminar') ||
    lower.includes('learn')
  ) {
    tags.push('Academic');
  }

  if (
    lower.includes('social') ||
    lower.includes('mixer') ||
    lower.includes('networking')
  ) {
    tags.push('Social');
  }

  if (
    lower.includes('cultural') ||
    lower.includes('culture') ||
    lower.includes('heritage')
  ) {
    tags.push('Cultural');
  }

  if (
    lower.includes('sport') ||
    lower.includes('game') ||
    lower.includes('tournament')
  ) {
    tags.push('Sports');
  }

  if (containsFreeFood(text)) {
    tags.push('Free Food');
  }

  return Array.from(new Set(tags));
}

async function fetchWithTimeout(
  url: string,
  timeout = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent':
          'Mozilla/5.0 (compatible; CPPFreeFood/1.0; public-event-indexer)',
        Accept: 'text/html,application/xhtml+xml',
      },
      cache: 'no-store',
    });
  } finally {
    clearTimeout(timeoutId);
  }
}

function parseDateAndTime(text: string): {
  date: string | null;
  time: string | null;
  matchIndex: number;
  matchLength: number;
} {
  const pattern =
    /\b(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4}),\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?(?:\s*[–-]\s*\d{1,2}(?::\d{2})?\s*(?:am|pm))?)/i;

  const match = text.match(pattern);

  if (!match || match.index === undefined) {
    return {
      date: null,
      time: null,
      matchIndex: -1,
      matchLength: 0,
    };
  }

  const month = MONTHS[match[1].toLowerCase()];
  const day = match[2].padStart(2, '0');
  const year = match[3];

  return {
    date: `${year}-${month}-${day}`,
    time: cleanText(match[4]),
    matchIndex: match.index,
    matchLength: match[0].length,
  };
}

function extractOrganizer(text: string): string | null {
  const match = text.match(/Organization:\s*(.+)$/i);

  if (!match) return null;

  let organizer = match[1];

  organizer = organizer
    .split(/\s+List Other Equipment/i)[0]
    .split(/\s+What type of parking/i)[0]
    .split(/\s+Event Name:/i)[0]
    .trim();

  return organizer || null;
}

function extractEventLocator(text: string): string | null {
  const match = text.match(/Event Locator:\s*([A-Z0-9-]+)/i);
  return match ? match[1].trim() : null;
}

function extractDescription(
  text: string,
  dateMatchIndex: number,
  dateMatchLength: number
): string {
  if (dateMatchIndex < 0) return '';

  let description = text.slice(dateMatchIndex + dateMatchLength).trim();

  description = description.split(/Event type:/i)[0].trim();

  return description.slice(0, 1000);
}

function extractLocation(
  text: string,
  title: string,
  dateMatchIndex: number
): string | null {
  if (dateMatchIndex < 0) return null;

  let beforeDate = text.slice(0, dateMatchIndex).trim();

  if (beforeDate.startsWith(title)) {
    beforeDate = beforeDate.slice(title.length).trim();
  }

  beforeDate = beforeDate.replace(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+\d{1,2}\s+/i,
    ''
  );

  return beforeDate || null;
}

function findEventBlock(
  $: cheerio.CheerioAPI,
  heading: any
): string | null {
  let current = $(heading).parent();

  for (let i = 0; i < 7; i++) {
    const text = cleanText(current.text());

    const locatorCount = (text.match(/Event Locator:/gi) || []).length;

    if (
      locatorCount === 1 &&
      /(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday),/.test(
        text
      )
    ) {
      return text;
    }

    current = current.parent();

    if (!current.length) break;
  }

  return null;
}

async function scrapeCPPUniversityEvents(): Promise<ScrapedEvent[]> {
  const response = await fetchWithTimeout(CPP_EVENTS_URL);

  if (!response.ok) {
    throw new Error(
      `CPP events page returned HTTP ${response.status}`
    );
  }

  const html = await response.text();
  const $ = cheerio.load(html);

  const events: ScrapedEvent[] = [];

  $('h2, h3').each((_, heading) => {
    const title = cleanText($(heading).text());

    if (!title || title === 'University Events') {
      return;
    }

    const blockText = findEventBlock($, heading);

    if (!blockText) {
      return;
    }

    const foodEvidence = findFoodEvidence(blockText);

    if (!foodEvidence) {
      return;
    }

    const parsed = parseDateAndTime(blockText);

    if (!parsed.date) {
      console.log(`Skipping event with no date: ${title}`);
      return;
    }

    const eventLocator = extractEventLocator(blockText);
    const organizer = extractOrganizer(blockText);

    const description = extractDescription(
      blockText,
      parsed.matchIndex,
      parsed.matchLength
    );

    const location = extractLocation(
      blockText,
      title,
      parsed.matchIndex
    );

    let sourceUrl = CPP_EVENTS_URL;

    const headingLink =
      $(heading).find('a').first().attr('href') ||
      $(heading).parent().find('a').first().attr('href');

    if (headingLink) {
      try {
        sourceUrl = new URL(
          headingLink,
          'https://www.cpp.edu'
        ).toString();
      } catch {
        sourceUrl = CPP_EVENTS_URL;
      }
    }

    events.push({
      title,
      description,
      date: parsed.date,
      time: parsed.time,
      location,
      organizer,
      source_url: sourceUrl,
      source_name: 'CPP University Events',
      source_event_id: eventLocator,
      tags: extractTags(blockText),
      has_free_food: true,
      food_evidence: foodEvidence,
      food_confidence: 1,
      rsvp_required:
        /registration required|register for|registration is required/i.test(
          blockText
        )
          ? true
          : /no registration required|no advance registration required/i.test(
              blockText
            )
          ? false
          : null,
    });
  });

  return events;
}

// Temporary compatibility with the current API route.
// This intentionally returns NOTHING.
// We never want fake/sample events shown again.
export function getSampleEvents(): ScrapedEvent[] {
  return [];
}

export async function scrapeAllSources(): Promise<ScrapedEvent[]> {
  console.log('Scraping CPP University Events...');

  try {
    const events = await scrapeCPPUniversityEvents();

    const seen = new Set<string>();

    const deduplicated = events.filter(event => {
      const key =
        event.source_event_id ||
        `${event.title.toLowerCase()}|${event.date}`;

      if (seen.has(key)) {
        return false;
      }

      seen.add(key);
      return true;
    });

    console.log(
      `Found ${deduplicated.length} confirmed free-food events.`
    );

    return deduplicated;
  } catch (error) {
    console.error('CPP University Events scrape failed:', error);

    // Important: return nothing instead of inventing events.
    return [];
  }
}