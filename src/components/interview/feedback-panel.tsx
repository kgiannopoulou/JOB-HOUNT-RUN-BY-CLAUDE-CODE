import { CircleAlert, CircleCheck, CircleMinus } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  criterionLabels,
  ratingLabels,
  type AnswerFeedback,
  type AnswerRating,
} from "@/lib/interview/feedback";

const ratingIcons = { strong: CircleCheck, adequate: CircleMinus, weak: CircleAlert };

export function RatingBadge({ rating }: { rating: AnswerRating }) {
  const Icon = ratingIcons[rating];
  return (
    <Badge variant={rating === "weak" ? "destructive" : rating === "strong" ? "default" : "secondary"}>
      <Icon aria-hidden /> {ratingLabels[rating]}
    </Badge>
  );
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-1">
      <h4 className="text-sm font-medium">{title}</h4>
      <ul className="list-inside list-disc space-y-0.5 text-sm">
        {items.map((item) => (
          <li key={item} className="break-words">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

export function FeedbackPanel({ feedback }: { feedback: AnswerFeedback }) {
  return (
    <section aria-label="Feedback" className="space-y-3 rounded-lg bg-muted/50 p-3">
      <div className="flex flex-wrap items-center gap-2">
        <RatingBadge rating={feedback.rating} />
        {feedback.summary && <p className="min-w-0 flex-1 text-sm">{feedback.summary}</p>}
      </div>

      {feedback.criteria.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">
          {feedback.criteria.map((item) => (
            <li key={item.criterion} className="rounded-md border bg-background p-2 text-sm">
              <p className="flex items-center justify-between gap-2 font-medium">
                {criterionLabels[item.criterion]}
                <span className="text-xs font-normal text-muted-foreground">
                  {ratingLabels[item.rating]}
                </span>
              </p>
              <p className="break-words text-muted-foreground">{item.comment}</p>
            </li>
          ))}
        </ul>
      )}

      <List title="What worked" items={feedback.strengths} />
      <List title="What was missing" items={feedback.weaknesses} />
      <List title="What to do next" items={feedback.improvements} />
    </section>
  );
}
