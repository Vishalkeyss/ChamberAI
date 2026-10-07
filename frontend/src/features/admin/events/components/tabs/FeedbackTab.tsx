import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Star, MessageSquare, ThumbsUp, Loader2 } from 'lucide-react';
import type { EventFeedbackItem } from '../../services/admin-events.api';
import { fetchAdminEventFeedback } from '../../services/admin-events.api';

interface FeedbackTabProps {
  eventId: string;
  chamberSlug?: string;
}

export const FeedbackTab: React.FC<FeedbackTabProps> = ({ eventId, chamberSlug }) => {
  const [feedback, setFeedback] = useState<EventFeedbackItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    setIsLoading(true);
    fetchAdminEventFeedback(eventId, chamberSlug)
      .then((data) => {
        if (mounted) setFeedback(data);
      })
      .finally(() => {
        if (mounted) setIsLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [eventId, chamberSlug]);

  const avgRating =
    feedback.length > 0
      ? (feedback.reduce((acc, f) => acc + f.starRating, 0) / feedback.length).toFixed(1)
      : '0.0';

  const wouldAttendPct =
    feedback.length > 0
      ? Math.round((feedback.filter((f) => f.wouldAttendAgain).length / feedback.length) * 100)
      : 0;

  return (
    <div className="space-y-6">
      {/* Top metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Average CSAT Score</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground">{avgRating}</span>
            <div className="flex text-amber-500">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-4 h-4 ${
                    s <= Math.round(Number(avgRating)) ? 'fill-amber-500' : 'text-muted/40'
                  }`}
                />
              ))}
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Repeat Intent</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-2xl font-bold text-foreground">{wouldAttendPct}%</span>
            <span className="text-xs text-muted-foreground">would attend next year</span>
          </div>
        </Card>

        <Card className="p-4">
          <p className="text-xs text-muted-foreground font-medium">Total Responses</p>
          <p className="text-2xl font-bold text-foreground mt-1">{feedback.length}</p>
        </Card>
      </div>

      {/* Feedback entries */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Attendee Reviews & Suggestions</CardTitle>
          <CardDescription>Post-event survey submissions</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="py-8 text-center text-muted-foreground text-xs">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-primary" />
              Loading attendee feedback...
            </div>
          ) : feedback.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">
              <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
              <p className="text-sm font-medium text-foreground">No Feedback Submitted</p>
              <p className="text-xs mt-1">
                Attendees will be prompted to submit survey reviews after event completion.
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {feedback.map((item) => (
                <div key={item.id} className="py-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-xs text-foreground">{item.userName}</span>
                    <div className="flex text-amber-500">
                      {[1, 2, 3, 4, 5].map((s) => (
                        <Star
                          key={s}
                          className={`w-3.5 h-3.5 ${
                            s <= item.starRating ? 'fill-amber-500' : 'text-muted/40'
                          }`}
                        />
                      ))}
                    </div>
                  </div>

                  {item.likedMost && (
                    <p className="text-xs text-foreground bg-muted/30 p-2.5 rounded-lg">
                      <span className="font-semibold text-muted-foreground">Highlight: </span>
                      {item.likedMost}
                    </p>
                  )}

                  {item.suggestions && (
                    <p className="text-xs text-muted-foreground italic">
                      "Suggestions: {item.suggestions}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
