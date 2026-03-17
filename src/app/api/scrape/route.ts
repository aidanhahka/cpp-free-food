import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { scrapeAllSources, getSampleEvents } from '@/lib/scraper';

export const maxDuration = 60; // 60 second timeout for scraping

export async function GET(request: NextRequest) {
  // Protect this endpoint so only Vercel cron (or you) can call it
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Scrape from all sources
    const scrapedEvents = await scrapeAllSources();

    // If still empty, ensure sample data exists
    const eventsToInsert = scrapedEvents.length > 0 ? scrapedEvents : getSampleEvents();

    // Upsert to Supabase (update if title+date already exists)
    const { data, error } = await supabase
      .from('events')
      .upsert(
        eventsToInsert.map(event => ({
          title: event.title,
          description: event.description,
          date: event.date,
          time: event.time,
          location: event.location,
          organizer: event.organizer,
          source_url: event.source_url,
          source_name: event.source_name,
          tags: event.tags,
          has_free_food: event.has_free_food,
        })),
        {
          onConflict: 'title,date', // avoid duplicates
          ignoreDuplicates: false,
        }
      )
      .select();

    if (error) {
      console.error('Supabase upsert error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Clean up old events (older than 7 days)
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    await supabase
      .from('events')
      .delete()
      .lt('date', cutoff.toISOString().split('T')[0]);

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      total_scraped: eventsToInsert.length,
    });
  } catch (err) {
    console.error('Scrape API error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
