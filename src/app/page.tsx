'use client';
import { useState, useEffect, useCallback } from 'react';
import { format, isToday, isTomorrow, parseISO, isThisWeek } from 'date-fns';
import type { Event } from '@/lib/supabase';

// ─── Icons ──────────────────────────────────────────────
function IconSearch({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
    </svg>
  );
}
function IconCalendar() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
    </svg>
  );
}
function IconClock() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  );
}
function IconPin() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>
    </svg>
  );
}
function IconUser() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="13" height="13">
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
    </svg>
  );
}
function IconRefresh({ spin }: { spin?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14"
      style={spin ? { animation: 'spin 1s linear infinite' } : {}}>
      <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/>
      <path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/>
      <path d="M8 16H3v5"/>
    </svg>
  );
}
function IconExternal() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
      <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
      <polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
    </svg>
  );
}
function IconGrid() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
      <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
    </svg>
  );
}
function IconList() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="14" height="14">
      <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
      <line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/>
      <line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
    </svg>
  );
}

// ─── Helpers ─────────────────────────────────────────────
function formatDateLabel(dateStr: string): string {
  try {
    const date = parseISO(dateStr);
    if (isToday(date)) return 'Today';
    if (isTomorrow(date)) return 'Tomorrow';
    if (isThisWeek(date)) return format(date, 'EEEE');
    return format(date, 'EEEE, MMMM d');
  } catch {
    return dateStr;
  }
}

function groupEventsByDate(events: Event[]): Record<string, Event[]> {
  return events.reduce((acc, event) => {
    const key = event.date.split('T')[0];
    if (!acc[key]) acc[key] = [];
    acc[key].push(event);
    return acc;
  }, {} as Record<string, Event[]>);
}

const ALL_TAGS = ['All', 'Free Food', 'Club', 'Social', 'Academic', 'Career', 'Cultural', 'Sports'];

// ─── Skeleton loader ─────────────────────────────────────
function SkeletonCard() {
  return (
    <div className="skeleton">
      <div className="skel-line h-20 w-60" style={{ marginBottom: 14 }} />
      <div className="skel-line w-40" />
      <div className="skel-line w-80" />
      <div className="skel-line w-60" />
    </div>
  );
}

// ─── Event Card ───────────────────────────────────────────
function EventCard({ event, onClick }: { event: Event; onClick: () => void }) {
  return (
    <div className="event-card" onClick={onClick} role="button" tabIndex={0}
      onKeyDown={e => e.key === 'Enter' && onClick()}>
      <div className="event-card-header">
        <div style={{ flex: 1 }}>
          <div className="food-badge" style={{ marginBottom: 8, display: 'inline-flex' }}>
            🍕 Free Food
          </div>
        </div>
      </div>
      <h3 className="event-title">{event.title}</h3>
      <div className="event-meta">
        <div className="event-meta-item">
          <IconCalendar />
          {formatDateLabel(event.date.split('T')[0])}
          {event.time && ` · ${event.time}`}
        </div>
        {event.location && (
          <div className="event-meta-item">
            <IconPin />{event.location}
          </div>
        )}
        {event.organizer && (
          <div className="event-meta-item">
            <IconUser />{event.organizer}
          </div>
        )}
      </div>
      {event.description && (
        <p className="event-description">{event.description}</p>
      )}
      <div className="event-tags">
        {(event.tags || []).map(tag => (
          <span key={tag} className={`event-tag ${tag === 'Free Food' ? '' : 'non-food'}`}>
            {tag}
          </span>
        ))}
      </div>
      <div className="event-source">
        <span className="source-name">{event.source_name}</span>
        {event.source_url && (
          <a className="source-link" href={event.source_url} target="_blank"
            rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
            View <IconExternal />
          </a>
        )}
      </div>
    </div>
  );
}

// ─── Event Modal ──────────────────────────────────────────
function EventModal({ event, onClose }: { event: Event; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="modal-food-badge">🍕 Free Food</div>
        <h2 className="modal-title">{event.title}</h2>
        <div className="modal-meta">
          <div className="modal-meta-item">
            <IconCalendar />
            <strong>{formatDateLabel(event.date.split('T')[0])}</strong>
            {event.time && `, ${event.time}`}
          </div>
          {event.location && (
            <div className="modal-meta-item">
              <IconPin />{event.location}
            </div>
          )}
          {event.organizer && (
            <div className="modal-meta-item">
              <IconUser />{event.organizer}
            </div>
          )}
        </div>
        {event.description && (
          <p className="modal-description">{event.description}</p>
        )}
        <div className="modal-tags">
          {(event.tags || []).map(tag => (
            <span key={tag} className={`event-tag ${tag === 'Free Food' ? '' : 'non-food'}`}>
              {tag}
            </span>
          ))}
        </div>
        <div className="modal-footer">
          <span style={{ fontSize: 13, color: 'var(--text-dim)' }}>
            Source: {event.source_name}
          </span>
          {event.source_url && (
            <a className="modal-source-link" href={event.source_url}
              target="_blank" rel="noopener noreferrer">
              More Info <IconExternal />
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────
export default function Home() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [activeTag, setActiveTag] = useState('All');
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [lastUpdated, setLastUpdated] = useState<string>('');
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setError(null);
    const params = new URLSearchParams();
    if (activeTag !== 'All') params.set('tag', activeTag);
    if (search) params.set('search', search);

    const res = await fetch(`/api/events?${params}`);
    const data = await res.json();
    if (data.error) {
      setError(data.error);
      return [];
    }
    return data.events as Event[];
  }, [activeTag, search]);

  useEffect(() => {
    setLoading(true);
    fetchEvents().then(evts => {
      setEvents(evts);
      setLoading(false);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    });
  }, [fetchEvents]);

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      // Trigger a new scrape
      await fetch('/api/scrape');
      // Then reload events
      const evts = await fetchEvents();
      setEvents(evts);
      setLastUpdated(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    } finally {
      setRefreshing(false);
    }
  };

  const grouped = groupEventsByDate(events);
  const sortedDates = Object.keys(grouped).sort();

  const todayCount = events.filter(e => {
    try { return isToday(parseISO(e.date.split('T')[0])); } catch { return false; }
  }).length;

  const thisWeekCount = events.filter(e => {
    try { return isThisWeek(parseISO(e.date.split('T')[0])); } catch { return false; }
  }).length;

  return (
    <>
      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* Header */}
      <header className="header">
        <div className="container">
          <div className="header-inner">
            <a className="logo" href="/">
              <div className="logo-icon">🐴</div>
              <span className="logo-text">CPP <span>Free Food</span></span>
            </a>
            <span className="last-updated">
              {lastUpdated ? `Updated ${lastUpdated}` : 'Loading…'}
            </span>
          </div>
        </div>
      </header>

      <main>
        <div className="container">

          {/* Hero */}
          <section className="hero">
            <div className="hero-badge">
              <span>🍕</span> Cal Poly Pomona
            </div>
            <h1>
              Never Miss <em>Free Food</em><br />
              on Campus Again
            </h1>
            <p>
              Daily-updated calendar of every CPP event with free food —
              club socials, department events, mixers, and more.
            </p>
            <div className="stats-row">
              <div className="stat">
                <span className="stat-number">{loading ? '—' : todayCount}</span>
                <span className="stat-label">Today</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-number">{loading ? '—' : thisWeekCount}</span>
                <span className="stat-label">This Week</span>
              </div>
              <div className="stat-divider" />
              <div className="stat">
                <span className="stat-number">{loading ? '—' : events.length}</span>
                <span className="stat-label">Total Events</span>
              </div>
            </div>
          </section>

          {/* Controls */}
          <div className="controls">
            <div className="search-wrap">
              <IconSearch className="search-icon" />
              <input
                className="search-input"
                placeholder="Search events, clubs, locations…"
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <button className="refresh-btn" onClick={handleRefresh} disabled={refreshing}>
              <IconRefresh spin={refreshing} />
              {refreshing ? 'Scraping…' : 'Refresh'}
            </button>
            <div className="view-toggle">
              <button className={`view-btn ${view === 'grid' ? 'active' : ''}`}
                onClick={() => setView('grid')}>
                <IconGrid /> Grid
              </button>
              <button className={`view-btn ${view === 'list' ? 'active' : ''}`}
                onClick={() => setView('list')}>
                <IconList /> List
              </button>
            </div>
          </div>

          {/* Tag filters */}
          <div className="tags-filter">
            {ALL_TAGS.map(tag => (
              <button
                key={tag}
                className={`tag-btn ${activeTag === tag ? 'active' : ''}`}
                onClick={() => setActiveTag(tag)}
              >
                {tag}
                {!loading && tag !== 'All' && (
                  <span style={{ opacity: 0.6, fontSize: 11 }}>
                    {events.filter(e => (e.tags || []).includes(tag)).length}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Error */}
          {error && (
            <div style={{
              background: 'rgba(255,80,80,0.08)',
              border: '1px solid rgba(255,80,80,0.2)',
              borderRadius: 10,
              padding: '14px 18px',
              color: '#ff8080',
              fontSize: 14,
              marginBottom: 24,
            }}>
              ⚠️ {error}
            </div>
          )}

          {/* Content */}
          {loading ? (
            <div className={view === 'grid' ? 'events-grid' : ''} style={view === 'list' ? { display: 'flex', flexDirection: 'column', gap: 12 } : {}}>
              {[...Array(6)].map((_, i) => <SkeletonCard key={i} />)}
            </div>
          ) : events.length === 0 ? (
            <div className="events-grid">
              <div className="empty-state">
                <span className="empty-icon">🔍</span>
                <h3>No events found</h3>
                <p>Try a different filter or check back after a refresh.</p>
              </div>
            </div>
          ) : (
            sortedDates.map(dateKey => (
              <div key={dateKey} className="date-section">
                <div className={`date-header ${isToday(parseISO(dateKey)) ? 'today-header' : ''}`}>
                  {formatDateLabel(dateKey)}
                  <span style={{ fontSize: 12, fontWeight: 400, opacity: 0.5, textTransform: 'none', letterSpacing: 0 }}>
                    {format(parseISO(dateKey), 'MMM d, yyyy')}
                  </span>
                </div>
                <div
                  className={view === 'grid' ? 'events-grid' : ''}
                  style={view === 'list' ? { display: 'flex', flexDirection: 'column', gap: 10 } : {}}
                >
                  {grouped[dateKey].map(event => (
                    <EventCard
                      key={event.id}
                      event={event}
                      onClick={() => setSelectedEvent(event)}
                    />
                  ))}
                </div>
              </div>
            ))
          )}

        </div>
      </main>

      {/* Footer */}
      <footer className="footer">
        <div className="container">
          <p>
            Built for Broncos 🐴 ·{' '}
            <a href="https://www.cpp.edu" target="_blank" rel="noopener noreferrer">Cal Poly Pomona</a>
            {' '}· Events scraped from{' '}
            <a href="https://cpp.campuslabs.com/engage" target="_blank" rel="noopener noreferrer">Campus Groups</a>,
            CPP website, and Eventbrite · Updates daily at 8 AM
          </p>
        </div>
      </footer>

      {/* Modal */}
      {selectedEvent && (
        <EventModal event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}
    </>
  );
}
