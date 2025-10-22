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
        return '💬';
      case 'SMS_RECEIVED':
        return '📱';
      case 'EMAIL_SENT':
        return '📧';
      case 'EMAIL_RECEIVED':
        return '📨';
      case 'STATUS_CHANGE':
        return '🔄';
      case 'APPOINTMENT_BOOKED':
        return '📅';
      case 'APPOINTMENT_COMPLETED':
        return '✅';
      case 'APPOINTMENT_CANCELLED':
        return '❌';
      case 'APPLICATION_STARTED':
        return '📝';
      case 'APPLICATION_COMPLETED':
        return '🎉';
      default:
        return '📌';
    }
  };

  const getActivityColor = (type: string): string => {
    switch (type) {
      case 'SMS_SENT':
      case 'EMAIL_SENT':
        return 'border-l-[#625FFF]';
      case 'SMS_RECEIVED':
      case 'EMAIL_RECEIVED':
        return 'border-l-[#2E7D32]';
      case 'STATUS_CHANGE':
        return 'border-l-[#FF9800]';
      case 'APPOINTMENT_BOOKED':
        return 'border-l-[#2196F3]';
      case 'APPOINTMENT_COMPLETED':
        return 'border-l-[#4CAF50]';
      case 'APPOINTMENT_CANCELLED':
        return 'border-l-[#F44336]';
      case 'APPLICATION_STARTED':
      case 'APPLICATION_COMPLETED':
        return 'border-l-[#9C27B0]';
      default:
        return 'border-l-[#757575]';
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
    <div className="bg-white/90 backdrop-blur-sm rounded-xl shadow-sm border border-[#E4DDD3] p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-[#1C1B1A]">Recent Activity</h2>
        <div className="flex items-center gap-2">
          {autoRefresh && (
            <span className="text-xs text-[#55514D]">
              Auto-refresh: {refreshInterval}s
            </span>
          )}
          <button
            onClick={fetchActivities}
            className="text-xs text-[#625FFF] hover:text-[#524DD9] font-medium"
          >
            Refresh
          </button>
        </div>
      </div>

      <div className="space-y-3 max-h-[600px] overflow-y-auto">
        {activities.length === 0 ? (
          <div className="text-center py-8 text-[#55514D]">
            No recent activity in the last 24 hours
          </div>
        ) : (
          activities.map((activity) => (
            <div
              key={activity.id}
              className={`border-l-4 ${getActivityColor(activity.type)} pl-4 py-3 hover:bg-[#FBF3E7]/30 transition-colors cursor-pointer rounded-r`}
              onClick={() => onLeadClick?.(activity.leadId)}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{getActivityIcon(activity.type)}</span>
                    <span className="font-semibold text-[#1C1B1A] text-sm truncate">
                      {activity.leadName}
                    </span>
                    {activity.metadata?.autonomous && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-[#625FFF]/10 text-[#625FFF]">
                        🤖 Auto
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-[#55514D] mb-1">
                    {getActivityLabel(activity.type, activity.metadata)}
                  </div>
                  {activity.content && (
                    <div className="text-sm text-[#1C1B1A] bg-[#FBF3E7]/50 rounded px-2 py-1 mt-2">
                      "{truncateText(activity.content)}"
                    </div>
                  )}
                  {activity.subject && (
                    <div className="text-sm text-[#1C1B1A] font-medium mt-1">
                      {activity.subject}
                    </div>
                  )}
                </div>
                <div className="text-xs text-[#55514D] whitespace-nowrap">
                  {formatDistanceToNow(new Date(activity.createdAt), { addSuffix: true })}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
