import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { scrapeAllSources } from '@/lib/scraper';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const supabase = getSupabaseAdmin();

    const scrapedEvents = await scrapeAllSources();

    if (scrapedEvents.length === 0) {
      return NextResponse.json({
        success: true,
        inserted: 0,
        total: 0,
        method: 'live',
        message: 'No confirmed free-food events found.',
      });
    }

    const rows = scrapedEvents.map(event => ({
      title: event.title,
      description: event.description,
      date: event.date,
      time: event.time,
      location: event.location,
      organizer: event.organizer,
      source_url: event.source_url,
      source_name: event.source_name,
      source_event_id: event.source_event_id ?? null,
      tags: event.tags,
      has_free_food: event.has_free_food,
      food_evidence: event.food_evidence ?? null,
      food_confidence: event.food_confidence ?? 1,
      rsvp_required: event.rsvp_required ?? null,
      updated_at: new Date().toISOString(),
      last_seen_at: new Date().toISOString(),
    }));

    const { data, error } = await supabase
      .from('events')
      .upsert(rows, {
        onConflict: 'title,date',
        ignoreDuplicates: false,
      })
      .select();

    if (error) {
      console.error('Supabase error:', error);

      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      total: rows.length,
      method: 'live',
    });
  } catch (err) {
    console.error('Scrape route error:', err);

    return NextResponse.json(
      { error: String(err) },
      { status: 500 }
    );
  }
}