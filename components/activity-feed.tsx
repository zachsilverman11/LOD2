"use client";

import { useEffect, useState } from "react";
import { formatDistanceToNow } from "date-fns";

interface Activity {
  id: string;
  type: string;
  leadId: string;
  leadName: string;
  leadStatus: string;
  content?: string;
  subject?: string;
  channel?: string;
  direction?: string;
  createdAt: Date;
  metadata?: any;
}

interface ActivityFeedProps {
  onLeadClick?: (leadId: string) => void;
  limit?: number;
  autoRefresh?: boolean;
  refreshInterval?: number; // in seconds
}

export function ActivityFeed({
  onLeadClick,
  limit = 20,
  autoRefresh = true,
  refreshInterval = 30,
}: ActivityFeedProps) {
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchActivities = async () => {
    try {
      const res = await fetch(`/api/activity/recent?limit=${limit}`);
      const data = await res.json();

      if (data.success) {
        setActivities(data.data);
        setError(null);
      } else {
        setError(data.error || 'Failed to fetch activities');
      }
    } catch (err) {
      console.error('Error fetching activities:', err);
      setError('Failed to load activity feed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchActivities();

    if (autoRefresh) {
      const interval = setInterval(fetchActivities, refreshInterval * 1000);
      return () => clearInterval(interval);
    }
  }, [limit, autoRefresh, refreshInterval]);

  const getActivityIcon = (type: string): string => {
    switch (type) {
      case 'SMS_SENT':
      case 'SMS_RECEIVED':
        return '💬';
      case 'EMAIL_SENT':
      case 'EMAIL_RECEIVED':
        return '📧';
      case 'STATUS_CHANGE':
        return '→';
      case 'APPOINTMENT_BOOKED':
        return '📅';
      case 'APPOINTMENT_COMPLETED':
      case 'CALL_COMPLETED':
        return '✓';
      case 'APPOINTMENT_CANCELLED':
        return '✕';
      case 'NOTE_ADDED':
        return '📝';
      default:
        return '•';
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'SMS_SENT':
      case 'EMAIL_SENT':
        return 'border-l-[#625FFF]/40';
      case 'SMS_RECEIVED':
      case 'EMAIL_RECEIVED':
        return 'border-l-green-500/40';
      case 'STATUS_CHANGE':
        return 'border-l-blue-400/40';
      case 'APPOINTMENT_BOOKED':
        return 'border-l-purple-500/40';
      case 'CALL_COMPLETED':
        return 'border-l-green-600/40';
      case 'APPOINTMENT_CANCELLED':
        return 'border-l-red-400/40';
      case 'NOTE_ADDED':
        return 'border-l-gray-400/40';
      default:
        return 'border-l-gray-300/40';
    }
  };

  const getActivityLabel = (type: string, metadata?: any): string => {
    switch (type) {
      case 'SMS_SENT':
        return metadata?.autonomous ? 'Holly sent SMS' : 'SMS sent';
      case 'SMS_RECEIVED':
        return 'Replied via SMS';
      case 'EMAIL_SENT':
        return 'Email sent';
      case 'EMAIL_RECEIVED':
        return 'Replied via Email';
      case 'STATUS_CHANGE':
        return 'Stage changed';
      case 'APPOINTMENT_BOOKED':
        return 'Appointment booked';
      case 'APPOINTMENT_COMPLETED':
        return 'Call completed';
      case 'APPOINTMENT_CANCELLED':
        return 'Appointment cancelled';
      case 'APPLICATION_STARTED':
        return 'Application started';
      case 'APPLICATION_COMPLETED':
        return 'Application completed';
      default:
        return type.replace(/_/g, ' ').toLowerCase();
    }
  };

  const truncateText = (text: string, maxLength: number = 80): string => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
  };

  if (loading) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
        <h2 className="text-xl font-bold text-[#1C1B1A] mb-4">Recent Activity</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-[#55514D]">Loading activity...</div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
        <h2 className="text-xl font-bold text-[#1C1B1A] mb-4">Recent Activity</h2>
        <div className="flex items-center justify-center py-8">
          <div className="text-red-600">{error}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-lg shadow-sm border border-[#E4DDD3]/50 p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-[#55514D] uppercase tracking-wide">Activity</h3>
        <button
          onClick={fetchActivities}
          className="text-xs text-[#625FFF]/70 hover:text-[#625FFF] transition-colors"
          title="Refresh"
        >
          ↻
        </button>
      </div>

      <div className="space-y-1.5 max-h-[calc(100vh-250px)] overflow-y-auto pr-1">
        {activities.length === 0 ? (
          <div className="text-center py-6 text-xs text-[#55514D]">
            No recent activity
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className={`border-l-2 ${getActivityColor(activity.type)} pl-2.5 py-2 hover:bg-[#FBF3E7]/20 transition-colors cursor-pointer rounded-r`}
              onClick={() => onLeadClick?.(activity.leadId)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-xs opacity-60">{getActivityIcon(activity.type)}</span>
                    <span className="font-medium text-[#1C1B1A] text-xs truncate">
                      {activity.leadName}
                    </span>
                    {activity.metadata?.autonomous && (
                      <span className="inline-flex items-center px-1 py-0.5 rounded text-[10px] font-medium bg-[#625FFF]/5 text-[#625FFF]/70">
                        auto
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-[#55514D]/80 leading-tight">
                    {getActivityLabel(activity.type, activity.metadata)}
                  </div>
                  {activity.content && (
                    <div className="text-[11px] text-[#55514D]/70 mt-1 leading-tight">
                      "{truncateText(activity.content, 60)}"
                    </div>
                  )}
                </div>
                <div className="text-[10px] text-[#55514D]/60 whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true }).replace(' ago', '')}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
