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
    const eventsToInsert = getSampleEvents();

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

    const { data, error } = await supabase
      .from('events')
      .upsert(rows, { onConflict: 'title,date', ignoreDuplicates: false })
      .select();

    if (error) {
      console.error('Supabase error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      inserted: data?.length ?? 0,
      total: rows.length,
    });
  } catch (err) {
    console.error('Scrape route error:', err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}