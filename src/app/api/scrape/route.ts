import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { getSampleEvents } from '@/lib/scraper';

export const maxDuration = 60;
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Try live scraping first, fall back to samples on any network error
    let eventsToInsert;
    try {
      const { scrapeAllSources } = await import('@/lib/scraper');
      const scraped = await scrapeAllSources();
      eventsToInsert = scraped.length > 0 ? scraped : getSampleEvents();
    } catch {
      console.log('Live scraping failed, using sample events');
      eventsToInsert = getSampleEvents();
    }

    const rows = eventsToInsert.map(event => ({
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
    }));

    // Insert in small batches to avoid timeouts
    let totalInserted = 0;
    const batchSize = 20;
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const { data, error } = await supabase
        .from('events')
        .upsert(batch, { onConflict: 'title,date', ignoreDuplicates: false })
        .select();

      if (error) {
        console.error('Supabase batch error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
      }
      totalInserted += data?.length ?? 0;
    }

    // Clean up events older than 7 days
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 7);
    await supabase
      .from('events')
      .delete()
      .lt('date', cutoff.toISOString().split('T')[0]);

    return NextResponse.json({
      success: true,
      inserted: totalInserted,
      total: rows.length,
    });
  } catch (err) {
    console.error('Scrape route error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}