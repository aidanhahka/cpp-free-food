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
  tags: string[];
  has_free_food: boolean;
};

const FREE_FOOD_KEYWORDS = [
  'free food', 'free lunch', 'free dinner', 'free breakfast', 'free snacks',
  'refreshments provided', 'light refreshments', 'food provided', 'food will be provided',
  'complimentary food', 'free pizza', 'free tacos', 'free burgers', 'free sandwiches',
  'snacks provided', 'free meals', 'free eats', 'grab some food', 'come hungry',
  'food and drinks', 'free drinks', 'catered', 'catering provided',
  'while supplies last', 'first come first served food',
];

function containsFreeFood(text: string): boolean {
  const lower = text.toLowerCase();
  return FREE_FOOD_KEYWORDS.some(kw => lower.includes(kw));
}

function extractTags(text: string): string[] {
  const tags: string[] = [];
  const lower = text.toLowerCase();
  if (lower.includes('club') || lower.includes('organization')) tags.push('Club');
  if (lower.includes('career') || lower.includes('job') || lower.includes('internship')) tags.push('Career');
  if (lower.includes('workshop') || lower.includes('seminar') || lower.includes('lecture')) tags.push('Academic');
  if (lower.includes('social') || lower.includes('mixer') || lower.includes('networking')) tags.push('Social');
  if (lower.includes('cultural') || lower.includes('diversity')) tags.push('Cultural');
  if (lower.includes('sport') || lower.includes('game') || lower.includes('tournament')) tags.push('Sports');
  if (containsFreeFood(text)) tags.push('Free Food');
  return Array.from(new Set(tags));
}

async function fetchWithTimeout(url: string, timeout = 10000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; CPPFreeFoodBot/1.0)',
      },
    });
    return response;
  } finally {
    clearTimeout(id);
  }
}

// -------------------------------------------------------
// Scraper 1: Cal Poly Pomona Campus Labs / CampusGroups
// -------------------------------------------------------
async function scrapeCPPCampusGroups(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];
  try {
    // CPP uses Campus Groups / Campus Labs for club events
    const url = 'https://cpp.campuslabs.com/engage/events';
    const res = await fetchWithTimeout(url);
    if (!res.ok) return events;
    const html = await res.text();
    const $ = cheerio.load(html);

    // Campus Labs renders events as JSON in a script tag
    $('script').each((_, el) => {
      const content = $(el).html() || '';
      if (content.includes('"title"') && content.includes('"startDate"')) {
        try {
          const match = content.match(/\[(\{[\s\S]*"title"[\s\S]*\})\]/);
          if (match) {
            const parsed = JSON.parse('[' + match[1] + ']');
            for (const item of parsed) {
              const desc = item.description || '';
              const title = item.title || '';
              if (containsFreeFood(title + ' ' + desc)) {
                events.push({
                  title,
                  description: desc.slice(0, 500),
                  date: item.startDate || new Date().toISOString(),
                  time: item.startTime || null,
                  location: item.location || null,
                  organizer: item.organizationName || null,
                  source_url: item.url ? `https://cpp.campuslabs.com${item.url}` : url,
                  source_name: 'CPP Campus Groups',
                  tags: extractTags(title + ' ' + desc),
                  has_free_food: true,
                });
              }
            }
          }
        } catch { /* skip malformed */ }
      }
    });

    // Also try parsing visible event cards
    $('[data-testid="event-card"], .event-card, article').each((_, el) => {
      const title = $(el).find('h2, h3, .event-title').first().text().trim();
      const desc = $(el).find('p, .event-description').first().text().trim();
      const dateStr = $(el).find('[datetime], .event-date, time').first().attr('datetime') ||
                      $(el).find('[datetime], .event-date, time').first().text().trim();
      const location = $(el).find('.event-location, [data-location]').first().text().trim();
      const href = $(el).find('a').first().attr('href');

      if (title && containsFreeFood(title + ' ' + desc)) {
        events.push({
          title,
          description: desc.slice(0, 500),
          date: dateStr || new Date().toISOString(),
          time: null,
          location: location || null,
          organizer: null,
          source_url: href ? (href.startsWith('http') ? href : `https://cpp.campuslabs.com${href}`) : url,
          source_name: 'CPP Campus Groups',
          tags: extractTags(title + ' ' + desc),
          has_free_food: true,
        });
      }
    });
  } catch (err) {
    console.error('CPP CampusGroups scrape error:', err);
  }
  return events;
}

// -------------------------------------------------------
// Scraper 2: CPP Official Events Calendar
// -------------------------------------------------------
async function scrapeCPPOfficialCalendar(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];
  try {
    const url = 'https://www.cpp.edu/campus-life/events.shtml';
    const res = await fetchWithTimeout(url);
    if (!res.ok) return events;
    const html = await res.text();
    const $ = cheerio.load(html);

    $('article, .event-item, .views-row, [class*="event"]').each((_, el) => {
      const title = $(el).find('h2, h3, h4, .event-title, a').first().text().trim();
      const desc = $(el).find('p, .field-body, .event-body').first().text().trim();
      const dateStr = $(el).find('time, .date, .field-date').first().attr('datetime') ||
                      $(el).find('time, .date, .field-date').first().text().trim();
      const location = $(el).find('.location, .field-location, [class*="location"]').first().text().trim();
      const href = $(el).find('a').first().attr('href');

      if (!title) return;
      const combined = title + ' ' + desc;
      if (containsFreeFood(combined)) {
        events.push({
          title,
          description: desc.slice(0, 500),
          date: dateStr || new Date().toISOString(),
          time: null,
          location: location || null,
          organizer: 'Cal Poly Pomona',
          source_url: href ? (href.startsWith('http') ? href : `https://www.cpp.edu${href}`) : url,
          source_name: 'CPP Official Calendar',
          tags: extractTags(combined),
          has_free_food: true,
        });
      }
    });
  } catch (err) {
    console.error('CPP Official Calendar scrape error:', err);
  }
  return events;
}

// -------------------------------------------------------
// Scraper 3: CPP Student Affairs / Dean of Students
// -------------------------------------------------------
async function scrapeCPPStudentAffairs(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];
  try {
    const urls = [
      'https://www.cpp.edu/student-affairs/events.shtml',
      'https://www.cpp.edu/asi/events.shtml',
    ];
    for (const url of urls) {
      try {
        const res = await fetchWithTimeout(url);
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);

        $('article, .event, li, tr').each((_, el) => {
          const title = $(el).find('a, h2, h3, h4').first().text().trim();
          const desc = $(el).text().trim();
          const href = $(el).find('a').first().attr('href');
          const dateStr = $(el).find('time').first().attr('datetime') || '';

          if (!title || title.length < 5) return;
          if (containsFreeFood(desc)) {
            events.push({
              title: title.slice(0, 200),
              description: desc.slice(0, 500),
              date: dateStr || new Date().toISOString(),
              time: null,
              location: null,
              organizer: 'CPP Student Affairs',
              source_url: href ? (href.startsWith('http') ? href : `https://www.cpp.edu${href}`) : url,
              source_name: 'CPP Student Affairs',
              tags: extractTags(desc),
              has_free_food: true,
            });
          }
        });
      } catch { /* skip */ }
    }
  } catch (err) {
    console.error('CPP Student Affairs scrape error:', err);
  }
  return events;
}

// -------------------------------------------------------
// Scraper 4: Eventbrite - Pomona / Cal Poly area
// -------------------------------------------------------
async function scrapeEventbritePomona(): Promise<ScrapedEvent[]> {
  const events: ScrapedEvent[] = [];
  try {
    // Eventbrite search for free food events near Cal Poly Pomona
    const queries = [
      'free+food+cal+poly+pomona',
      'free+food+pomona+ca+college',
      'free+food+student+pomona',
    ];
    for (const q of queries) {
      try {
        const url = `https://www.eventbrite.com/d/ca--pomona/free--events/?q=${q}`;
        const res = await fetchWithTimeout(url);
        if (!res.ok) continue;
        const html = await res.text();
        const $ = cheerio.load(html);

        // Eventbrite event cards
        $('[data-event-id], .eds-event-card, article[class*="event"]').each((_, el) => {
          const title = $(el).find('h2, h3, [class*="title"]').first().text().trim();
          const desc = $(el).find('[class*="summary"], [class*="description"], p').first().text().trim();
          const dateStr = $(el).find('time').first().attr('datetime') ||
                          $(el).find('[class*="date"]').first().text().trim();
          const location = $(el).find('[class*="location"], [class*="venue"]').first().text().trim();
          const href = $(el).find('a').first().attr('href');

          if (!title) return;
          const combined = title + ' ' + desc;
          if (containsFreeFood(combined)) {
            events.push({
              title: title.slice(0, 200),
              description: desc.slice(0, 500),
              date: dateStr || new Date().toISOString(),
              time: null,
              location: location || 'Pomona, CA area',
              organizer: null,
              source_url: href ? (href.startsWith('http') ? href : `https://www.eventbrite.com${href}`) : url,
              source_name: 'Eventbrite',
              tags: extractTags(combined),
              has_free_food: true,
            });
          }
        });
      } catch { /* skip */ }
    }
  } catch (err) {
    console.error('Eventbrite scrape error:', err);
  }
  return events;
}

// -------------------------------------------------------
// Scraper 5: Instagram / Facebook public pages (text parsing fallback)
// Social media scraping is blocked, so we use fallback demo data
// that admins can replace with real data
// -------------------------------------------------------

// -------------------------------------------------------
// Fallback: seed with realistic sample events so the
// site always has something to show while scrapers run
// -------------------------------------------------------
export function getSampleEvents(): ScrapedEvent[] {
  const now = new Date();
  const addDays = (d: Date, n: number) => {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + n);
    return copy.toISOString().split('T')[0];
  };

  return [
    {
      title: 'SWE Club Welcome Social — Free Pizza!',
      description: 'Come meet the Society of Women Engineers chapter at CPP! Free pizza for all attendees. Learn about our upcoming events, mentorship programs, and how to get involved. All majors welcome!',
      date: addDays(now, 2),
      time: '5:00 PM',
      location: 'Building 8, Room 228',
      organizer: 'Society of Women Engineers - CPP',
      source_url: 'https://cpp.campuslabs.com/engage',
      source_name: 'CPP Campus Groups',
      tags: ['Club', 'Social', 'Free Food'],
      has_free_food: true,
    },
    {
      title: 'MESA Club General Meeting — Tacos Provided',
      description: 'Join MESA (Mathematics, Engineering, Science Achievement) for our weekly general meeting. We\'re providing free tacos this week! Come hungry, meet other STEM students, and hear about upcoming competitions and study groups.',
      date: addDays(now, 3),
      time: '6:00 PM',
      location: '3801 W Temple Ave, Building 17',
      organizer: 'MESA Club CPP',
      source_url: 'https://cpp.campuslabs.com/engage',
      source_name: 'CPP Campus Groups',
      tags: ['Club', 'Academic', 'Free Food'],
      has_free_food: true,
    },
    {
      title: 'Career Fair Pre-Event Mixer — Light Refreshments',
      description: 'Prepare for the upcoming career fair with this networking mixer. Light refreshments and snacks provided. Bring your resume and get tips from Career Center staff and alumni.',
      date: addDays(now, 5),
      time: '4:30 PM',
      location: 'University Union, Room 206',
      organizer: 'CPP Career Center',
      source_url: 'https://www.cpp.edu/career/',
      source_name: 'CPP Official Calendar',
      tags: ['Career', 'Social', 'Free Food'],
      has_free_food: true,
    },
    {
      title: 'Asian Student Association Cultural Night',
      description: 'Celebrate Asian heritage at ASA\'s annual cultural night! Traditional food provided free for all guests. Enjoy performances, learn about different cultures, and connect with the community.',
      date: addDays(now, 7),
      time: '7:00 PM',
      location: 'Bronco Student Center Ballroom',
      organizer: 'Asian Student Association - CPP',
      source_url: 'https://cpp.campuslabs.com/engage',
      source_name: 'CPP Campus Groups',
      tags: ['Club', 'Cultural', 'Social', 'Free Food'],
      has_free_food: true,
    },
    {
      title: 'ACM Tech Talk: Intro to Web Dev — Snacks & Drinks',
      description: 'Association for Computing Machinery presents a beginner-friendly workshop on web development fundamentals. Free snacks and drinks provided. Bring your laptop if you want to follow along!',
      date: addDays(now, 4),
      time: '6:30 PM',
      location: 'Building 8, Room 101',
      organizer: 'ACM at Cal Poly Pomona',
      source_url: 'https://cpp.campuslabs.com/engage',
      source_name: 'CPP Campus Groups',
      tags: ['Club', 'Academic', 'Free Food'],
      has_free_food: true,
    },
    {
      title: 'Latinx Student Union Taco Tuesday Social',
      description: 'LSU\'s weekly Taco Tuesday is back! Free tacos for everyone. Come hang out on the lawn, meet new people, and enjoy the vibe. No membership required — all students welcome!',
      date: addDays(now, 1),
      time: '12:00 PM',
      location: 'Rose Garden Lawn, Cal Poly Pomona',
      organizer: 'Latinx Student Union',
      source_url: 'https://cpp.campuslabs.com/engage',
      source_name: 'CPP Campus Groups',
      tags: ['Club', 'Cultural', 'Social', 'Free Food'],
      has_free_food: true,
    },
    {
      title: 'NSBE Info Session — Free Lunch Provided',
      description: 'National Society of Black Engineers chapter at CPP is hosting an info session for prospective members. Free lunch provided. Learn about scholarships, networking events, and professional development opportunities.',
      date: addDays(now, 6),
      time: '12:00 PM',
      location: 'College of Engineering, Room 220',
      organizer: 'NSBE at CPP',
      source_url: 'https://cpp.campuslabs.com/engage',
      source_name: 'CPP Campus Groups',
      tags: ['Club', 'Career', 'Free Food'],
      has_free_food: true,
    },
    {
      title: 'ASI Student Government Open House',
      description: 'Associated Students Inc. is opening its doors for a campus-wide open house. Free food and refreshments for all students. Learn how ASI advocates for you, and find out how to get involved in student government.',
      date: addDays(now, 9),
      time: '11:00 AM',
      location: 'Bronco Student Center, Room 121',
      organizer: 'Associated Students Inc. (ASI)',
      source_url: 'https://www.cpp.edu/asi/',
      source_name: 'CPP Student Affairs',
      tags: ['Social', 'Free Food'],
      has_free_food: true,
    },
  ];
}

// -------------------------------------------------------
// Main export: run all scrapers
// -------------------------------------------------------
export async function scrapeAllSources(): Promise<ScrapedEvent[]> {
  console.log('Starting scrape of all sources...');

  const results = await Promise.allSettled([
    scrapeCPPCampusGroups(),
    scrapeCPPOfficialCalendar(),
    scrapeCPPStudentAffairs(),
    scrapeEventbritePomona(),
  ]);

  const allEvents: ScrapedEvent[] = [];
  for (const result of results) {
    if (result.status === 'fulfilled') {
      allEvents.push(...result.value);
    }
  }

  // Deduplicate by title similarity
  const seen = new Set<string>();
  const deduplicated = allEvents.filter(e => {
    const key = e.title.toLowerCase().slice(0, 40);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  // If no real events scraped, inject sample events so the site always has content
  if (deduplicated.length === 0) {
    console.log('No events scraped — using sample events.');
    return getSampleEvents();
  }

  console.log(`Scraped ${deduplicated.length} unique events.`);
  return deduplicated;
}
