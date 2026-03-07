'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, ChevronRight, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlatformIcon, getPlatformLabel, PLATFORM_BG_COLORS } from './PlatformIcon';
import type { ContentIdeaPlatform, ContentIdeaContentType, ContentIdeaStatus } from '@/db/schema';

interface CalendarIdea {
  id: string;
  title: string;
  platform: ContentIdeaPlatform;
  contentType: ContentIdeaContentType;
  status: ContentIdeaStatus;
  priorityScore: number;
  scheduledFor: Date | null;
}

interface CalendarDay {
  date: string;
  ideas: CalendarIdea[];
}

interface ContentCalendarProps {
  calendarData: CalendarDay[];
  year: number;
  month: number; // 0-indexed
}

const DAYS_OF_WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const STATUS_DOT: Record<ContentIdeaStatus, string> = {
  suggested: 'bg-amber-400',
  approved: 'bg-emerald-400',
  rejected: 'bg-rose-400',
  in_production: 'bg-blue-400',
  completed: 'bg-slate-400',
  published: 'bg-purple-400',
};

export function ContentCalendar({ calendarData, year, month }: ContentCalendarProps) {
  const [selectedDate, setSelectedDate] = useState<string | null>(null);

  // Build a lookup map: date string → ideas
  const ideasByDate = new Map<string, CalendarIdea[]>();
  for (const day of calendarData) {
    ideasByDate.set(day.date, day.ideas);
  }

  // Generate month grid
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const startDow = firstDay.getDay();
  const daysInMonth = lastDay.getDate();
  const today = new Date().toISOString().split('T')[0]!;

  const cells: Array<{ date: string; dayNum: number } | null> = [];
  for (let i = 0; i < startDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    cells.push({ date: dateStr, dayNum: d });
  }

  const selectedIdeas = selectedDate ? (ideasByDate.get(selectedDate) ?? []) : [];

  const prevMonth = new Date(year, month - 1, 1);
  const nextMonth = new Date(year, month + 1, 1);
  const prevHref = `/content/calendar?year=${prevMonth.getFullYear()}&month=${prevMonth.getMonth()}`;
  const nextHref = `/content/calendar?year=${nextMonth.getFullYear()}&month=${nextMonth.getMonth()}`;

  return (
    <div className="space-y-4">
      {/* Calendar controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href={prevHref}>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h2 className="min-w-40 text-center text-base font-semibold">
            {MONTH_NAMES[month]} {year}
          </h2>
          <Link href={nextHref}>
            <Button variant="outline" size="icon" className="h-8 w-8">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        <Link
          href={`/content/calendar?year=${new Date().getFullYear()}&month=${new Date().getMonth()}`}
          className="text-primary text-xs hover:underline"
        >
          Today
        </Link>
      </div>

      {/* Month grid */}
      <Card>
        <CardContent className="p-3">
          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7">
            {DAYS_OF_WEEK.map((d) => (
              <div key={d} className="text-muted-foreground py-1 text-center text-xs font-medium">
                {d}
              </div>
            ))}
          </div>

          {/* Day cells */}
          <div className="grid grid-cols-7 gap-px">
            {cells.map((cell, i) => {
              if (!cell) {
                return <div key={`empty-${i}`} className="min-h-16 rounded" />;
              }

              const { date, dayNum } = cell;
              const dayIdeas = ideasByDate.get(date) ?? [];
              const isToday = date === today;
              const isSelected = date === selectedDate;

              return (
                <button
                  key={date}
                  onClick={() => setSelectedDate(isSelected ? null : date)}
                  className={`hover:bg-accent min-h-16 rounded p-1 text-left transition-colors ${
                    isSelected ? 'bg-primary/10 ring-primary ring-1' : ''
                  } ${isToday ? 'font-bold' : ''}`}
                >
                  <div
                    className={`mb-1 flex h-6 w-6 items-center justify-center rounded-full text-xs ${
                      isToday ? 'bg-primary text-primary-foreground' : ''
                    }`}
                  >
                    {dayNum}
                  </div>
                  {/* Ideas dots / mini cards */}
                  <div className="space-y-0.5">
                    {dayIdeas.slice(0, 3).map((idea) => (
                      <div
                        key={idea.id}
                        className={`flex items-center gap-1 rounded border px-1 py-0.5 text-xs ${PLATFORM_BG_COLORS[idea.platform]}`}
                      >
                        <span
                          className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[idea.status]}`}
                        />
                        <span className="truncate leading-tight">{idea.title}</span>
                      </div>
                    ))}
                    {dayIdeas.length > 3 && (
                      <div className="text-muted-foreground px-1 text-xs">
                        +{dayIdeas.length - 3} more
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Legend */}
      <div className="flex flex-wrap gap-3 text-xs">
        {Object.entries(STATUS_DOT).map(([status, colorClass]) => (
          <div key={status} className="flex items-center gap-1">
            <span className={`h-2 w-2 rounded-full ${colorClass}`} />
            <span className="text-muted-foreground capitalize">{status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>

      {/* Selected day detail */}
      {selectedDate && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Calendar className="h-4 w-4" />
              {new Date(selectedDate + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
              })}
              <Badge variant="outline" className="ml-auto text-xs">
                {selectedIdeas.length} idea{selectedIdeas.length !== 1 ? 's' : ''}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedIdeas.length === 0 ? (
              <p className="text-muted-foreground text-sm">No ideas scheduled for this day.</p>
            ) : (
              <div className="space-y-2">
                {selectedIdeas
                  .sort((a, b) => b.priorityScore - a.priorityScore)
                  .map((idea) => (
                    <Link
                      key={idea.id}
                      href={`/content/ideas/${idea.id}`}
                      className="hover:bg-accent flex items-start gap-3 rounded-lg border p-3 transition-colors"
                    >
                      <PlatformIcon platform={idea.platform} className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{idea.title}</p>
                        <div className="text-muted-foreground mt-0.5 flex items-center gap-2 text-xs">
                          <span>{getPlatformLabel(idea.platform)}</span>
                          <span className={`h-1.5 w-1.5 rounded-full ${STATUS_DOT[idea.status]}`} />
                          <span className="capitalize">{idea.status.replace('_', ' ')}</span>
                        </div>
                      </div>
                      <span className="text-muted-foreground shrink-0 text-xs font-medium">
                        {idea.priorityScore}
                      </span>
                    </Link>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
