import Head from 'next/head';
import { useMemo, useState } from 'react';
import type { components } from '@ddms/sdk';

import { AppLayout } from '~/components/layout/AppLayout';
import { useActivityLog } from '~/hooks/useAuditLog';
import type { NextPageWithLayout } from '~/types/next';

type ApiEvent = components['schemas']['AuditLogEvent'];
type ActivityCategory = ApiEvent['category'];

type FormattedEvent = {
  id: number;
  category: ActivityCategory;
  actor: string;
  occurredAt: Date;
  dateLabel: string;
  timeLabel: string;
  summary: string;
  description: string;
  entityLabel?: string;
  recordId?: string;
  tags: string[];
  searchText: string;
};

type SummaryCard = {
  label: string;
  value: number;
  helper: string;
};

const CATEGORY_LABELS: Record<ActivityCategory, string> = {
  schema: 'Schema',
  record: 'Records',
  governance: 'Governance',
  import: 'Imports',
  integration: 'Integrations',
};

const ActivityLogPage: NextPageWithLayout = () => {
  const { data, isLoading, isError, error } = useActivityLog();
  const [selectedType, setSelectedType] = useState<ActivityCategory | 'all'>('all');
  const [searchTerm, setSearchTerm] = useState('');

  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }),
    [],
  );
  const timeFormatter = useMemo(
    () => new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }),
    [],
  );

  const formattedEvents = useMemo(() => {
    const events = data?.events ?? [];
    return events.map((event) => formatEvent(event, dateFormatter, timeFormatter));
  }, [data?.events, dateFormatter, timeFormatter]);

  const availableTypes = useMemo(() => {
    const typeSet = new Set<ActivityCategory>();
    (data?.events ?? []).forEach((event) => typeSet.add(event.category));
    return Array.from(typeSet);
  }, [data?.events]);

  const normalizedSearch = searchTerm.trim().toLowerCase();

  const filteredEvents = useMemo(
    () =>
      formattedEvents.filter((event) => {
        if (selectedType !== 'all' && event.category !== selectedType) {
          return false;
        }
        if (!normalizedSearch) {
          return true;
        }
        return event.searchText.includes(normalizedSearch);
      }),
    [formattedEvents, selectedType, normalizedSearch],
  );

  const groupedEvents = useMemo(
    () => groupEvents(filteredEvents),
    [filteredEvents],
  );

  const summaryCards = useMemo(
    () => buildSummaryCards(data?.summary, timeFormatter),
    [data?.summary, timeFormatter],
  );

  const rightPanel = useMemo(
    () => (
      <div className="stack">
        <section className="surface-card surface-card--muted stack-sm">
          <h3 style={{ margin: 0 }}>Summary</h3>
          {isLoading && summaryCards.length === 0 ? (
            <p className="helper-text">Loading activity summary…</p>
          ) : summaryCards.length === 0 ? (
            <p className="helper-text">No activity captured yet. Changes will appear here automatically.</p>
          ) : (
            <div className="insight-grid">
              {summaryCards.map((stat) => (
                <div key={stat.label} className="insight-card">
                  <span className="label">{stat.label}</span>
                  <span className="value">{stat.value}</span>
                  <span className="helper-text">{stat.helper}</span>
                </div>
              ))}
            </div>
          )}
        </section>
        <section className="surface-card surface-card--muted stack-sm">
          <h3 style={{ margin: 0 }}>Best practices</h3>
          <ul className="callout-list">
            <li className="callout callout--info">
              <strong>Subscribe webhooks</strong>
              <span>Forward events to downstream tools to keep audit trails in sync.</span>
            </li>
            <li className="callout callout--info">
              <strong>Label critical actions</strong>
              <span>Use tags to flag schema-breaking updates or sensitive imports.</span>
            </li>
            <li className="callout callout--warning">
              <strong>Rotate credentials</strong>
              <span>Automate API key rotation and verify it appears here as evidence.</span>
            </li>
          </ul>
        </section>
      </div>
    ),
    [isLoading, summaryCards],
  );

  const errorMessage = isError
    ? error instanceof Error
      ? error.message
      : 'Failed to load activity.'
    : null;

  return (
    <AppLayout
      title="Activity log"
      subtitle="Audit schema edits, record changes, and operational events across the workspace."
      breadcrumbs={[
        { label: 'Audit' },
        { label: 'Activity Log' },
      ]}
      rightPanel={rightPanel}
    >
      <Head>
        <title>Activity Log | DDMS</title>
      </Head>

      <div className="stack">
        <section className="surface-card activity-filters stack-sm">
          <div className="activity-filters__header">
            <div className="stack-sm">
              <h2 style={{ margin: 0 }}>Filter activity</h2>
              <p className="helper-text">
                Narrow events by type or search across actors, entities, and records.
              </p>
            </div>
          </div>
          <div className="activity-filters__controls">
            <div className="chip-group">
              <button
                type="button"
                className={`button stealth activity-filter${selectedType === 'all' ? ' is-active' : ''}`}
                onClick={() => setSelectedType('all')}
              >
                All
              </button>
              {availableTypes.map((type) => (
                <button
                  key={type}
                  type="button"
                  className={`button stealth activity-filter${selectedType === type ? ' is-active' : ''}`}
                  onClick={() => setSelectedType(type)}
                >
                  {CATEGORY_LABELS[type]}
                </button>
              ))}
            </div>
            <div className="activity-filters__search">
              <input
                type="search"
                placeholder="Search by actor, entity, or summary"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                aria-label="Search activity"
              />
            </div>
          </div>
        </section>

        <section className="surface-card activity-timeline stack">
          <div className="row row-wrap" style={{ justifyContent: 'space-between' }}>
            <div className="stack-sm">
              <h2 style={{ margin: 0 }}>Timeline</h2>
              <p className="helper-text">
                Events are ordered with the most recent on top. Subscribe to webhooks to sync this view externally.
              </p>
            </div>
          </div>

          {isLoading ? (
            <p className="helper-text">Loading activity…</p>
          ) : errorMessage ? (
            <p className="error">Error: {errorMessage}</p>
          ) : groupedEvents.length === 0 ? (
            <p className="helper-text">
              No activity matches your filters yet. Adjust filters or try a broader search.
            </p>
          ) : (
            <div className="timeline-groups">
              {groupedEvents.map((group) => (
                <div key={group.date} className="activity-group">
                  <div className="activity-group__date">{group.date}</div>
                  <div className="activity-group__events">
                    {group.events.map((event) => (
                      <article
                        key={event.id}
                        className={`activity-event activity-event--${event.category}`}
                      >
                        <header className="activity-event__header">
                          <span className="activity-event__actor">{event.actor}</span>
                          <span className="activity-event__time">{event.timeLabel}</span>
                        </header>
                        <h3>{event.summary}</h3>
                        {event.description && (
                          <p className="helper-text">{event.description}</p>
                        )}
                        <div className="activity-event__meta">
                          <span className="pill">{CATEGORY_LABELS[event.category]}</span>
                          {event.entityLabel && (
                            <span className="helper-text">
                              Entity: <strong>{event.entityLabel}</strong>
                            </span>
                          )}
                          {event.recordId && (
                            <span className="helper-text">
                              Record: <code>{event.recordId}</code>
                            </span>
                          )}
                        </div>
                        {event.tags.length > 0 && (
                          <div className="chip-group">
                            {event.tags.map((tag) => (
                              <span key={tag} className="chip">
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
};

ActivityLogPage.getLayout = (page) => page;

export default ActivityLogPage;

function formatEvent(
  event: ApiEvent,
  dateFormatter: Intl.DateTimeFormat,
  timeFormatter: Intl.DateTimeFormat,
): FormattedEvent {
  const occurredAt = new Date(event.occurredAt);
  const actor =
    (event.actorLabel && event.actorLabel.trim().length > 0
      ? event.actorLabel
      : null) ??
    event.actorId ??
    'System';
  const details = describeAuditEvent(event);

  const searchText = [
    actor,
    details.summary,
    details.description ?? '',
    details.entityLabel ?? '',
    details.recordId ?? '',
    ...details.tags,
    event.action,
  ]
    .join(' ')
    .toLowerCase();

  return {
    id: event.id,
    category: event.category,
    actor,
    occurredAt,
    dateLabel: dateFormatter.format(occurredAt),
    timeLabel: timeFormatter.format(occurredAt),
    summary: details.summary,
    description: details.description ?? '',
    entityLabel: details.entityLabel,
    recordId: details.recordId ?? (event.resourceId ?? undefined),
    tags: details.tags,
    searchText,
  };
}

function describeAuditEvent(event: ApiEvent) {
  const meta = (event.meta ?? {}) as Record<string, unknown>;
  const tags: string[] = [];

  const entityTypeKey = getString(meta, 'entityTypeKey') ?? getString(meta, 'key');
  const changedKeys = getStringArray(meta, 'changedKeys');
  const changeKeys = getChangeKeys(meta);
  const dataKeys = getStringArray(meta, 'dataKeys');

  switch (event.action) {
    case 'entity_type.created': {
      if (entityTypeKey) {
        tags.push(entityTypeKey);
      }
      return {
        summary: `Created entity type`,
        description: entityTypeKey ? `Key: ${entityTypeKey}` : undefined,
        entityLabel: entityTypeKey,
        tags,
      };
    }
    case 'entity_type.updated': {
      const keys = changeKeys.length > 0 ? changeKeys : changedKeys;
      keys.forEach((key) => tags.push(`updated:${key}`));
      return {
        summary: 'Updated entity type',
        description:
          keys.length > 0
            ? `Changed ${keys.join(', ')}`
            : 'No fields provided.',
        entityLabel: entityTypeKey,
        tags,
      };
    }
    case 'field_def.created': {
      const key = getString(meta, 'key');
      if (key) {
        tags.push(key);
      }
      if (meta.indexed === true) {
        tags.push('indexed');
      }
      return {
        summary: 'Added field definition',
        description: key ? `Key: ${key}` : undefined,
        entityLabel: entityTypeKey,
        tags,
      };
    }
    case 'field_def.updated': {
      const keys = changeKeys.length > 0 ? changeKeys : changedKeys;
      keys.forEach((key) => tags.push(`updated:${key}`));
      return {
        summary: 'Updated field definition',
        description:
          keys.length > 0
            ? `Changed ${keys.join(', ')}`
            : 'No fields provided.',
        entityLabel: entityTypeKey,
        tags,
      };
    }
    case 'field_def.deleted': {
      const key = getString(meta, 'key');
      if (key) {
        tags.push(key);
      }
      return {
        summary: 'Deleted field definition',
        description: key ? `Key: ${key}` : undefined,
        entityLabel: entityTypeKey,
        tags,
      };
    }
    case 'record.created': {
      dataKeys.slice(0, 5).forEach((key) => tags.push(`field:${key}`));
      return {
        summary: 'Created record',
        description:
          dataKeys.length > 0 ? `Captured ${dataKeys.join(', ')}` : undefined,
        entityLabel: entityTypeKey,
        recordId: event.resourceId ?? undefined,
        tags,
      };
    }
    case 'record.updated': {
      changedKeys.slice(0, 5).forEach((key) => tags.push(`updated:${key}`));
      return {
        summary: 'Updated record',
        description:
          changedKeys.length > 0
            ? `Edited ${changedKeys.join(', ')}`
            : undefined,
        entityLabel: entityTypeKey,
        recordId: event.resourceId ?? undefined,
        tags,
      };
    }
    case 'relation.created': {
      const fieldId = getString(meta, 'fieldId');
      if (fieldId) {
        tags.push(`field:${fieldId.slice(0, 8)}`);
      }
      return {
        summary: 'Created relation',
        description: 'Linked records via relation field.',
        recordId: event.resourceId ?? undefined,
        tags,
      };
    }
    case 'relation.deleted': {
      const fieldId = getString(meta, 'fieldId');
      if (fieldId) {
        tags.push(`field:${fieldId.slice(0, 8)}`);
      }
      return {
        summary: 'Deleted relation',
        description: 'Removed relation between records.',
        recordId: event.resourceId ?? undefined,
        tags,
      };
    }
    default: {
      return {
        summary: event.action.replace(/\./g, ' '),
        description: undefined,
        tags,
      };
    }
  }
}

function getString(meta: Record<string, unknown>, key: string): string | undefined {
  const value = meta[key];
  if (typeof value === 'string' && value.trim().length > 0) {
    return value.trim();
  }
  return undefined;
}

function getStringArray(meta: Record<string, unknown>, key: string): string[] {
  const value = meta[key];
  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === 'string' ? item.trim() : undefined))
      .filter((item): item is string => Boolean(item && item.length > 0));
  }
  return [];
}

function getChangeKeys(meta: Record<string, unknown>): string[] {
  const value = meta.changes;
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return Object.keys(value as Record<string, unknown>);
  }
  return [];
}

function groupEvents(events: FormattedEvent[]) {
  const groups = new Map<string, FormattedEvent[]>();
  events.forEach((event) => {
    if (!groups.has(event.dateLabel)) {
      groups.set(event.dateLabel, []);
    }
    groups.get(event.dateLabel)!.push(event);
  });

  return Array.from(groups.entries())
    .map(([date, grouped]) => ({
      date,
      events: grouped.sort(
        (a, b) => b.occurredAt.getTime() - a.occurredAt.getTime(),
      ),
    }))
    .sort(
      (a, b) =>
        b.events[0].occurredAt.getTime() - a.events[0].occurredAt.getTime(),
    );
}

function buildSummaryCards(
  summary: components['schemas']['ActivityLogSummary'] | undefined,
  timeFormatter: Intl.DateTimeFormat,
): SummaryCard[] {
  if (!summary) {
    return [];
  }
  const lastEvent =
    summary.lastEventAt && summary.lastEventAt.length > 0
      ? new Date(summary.lastEventAt)
      : null;

  return [
    {
      label: 'Total events (30d)',
      value: summary.totalEvents,
      helper: 'Across schema, records, governance, and integrations.',
    },
    {
      label: 'Schema edits',
      value: summary.schemaEdits,
      helper: `${summary.recordUpdates} record updates alongside.`,
    },
    {
      label: 'Active collaborators',
      value: summary.uniqueActors,
      helper: lastEvent
        ? `Latest at ${timeFormatter.format(lastEvent)}`
        : 'Awaiting first event.',
    },
  ];
}
