"use client";

import { useActionState } from "react";
import {
  markAllNotificationsRead,
  markNotificationRead,
  type FormState,
} from "@/lib/alert-actions";
import { useActionAnnounce } from "@/components/a11y/use-action-announce";

export function MarkAllNotificationsReadButton() {
  const [state, action, pending] = useActionState<FormState, FormData>(
    markAllNotificationsRead,
    undefined,
  );
  useActionAnnounce(state, pending, "全部通知已標為已讀");

  return (
    <form action={action}>
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn btn-outline btn-sm whitespace-nowrap"
      >
        {pending ? "更新中…" : "全部標為已讀"}
      </button>
    </form>
  );
}

export function MarkNotificationReadButton({ id }: { id: string }) {
  const [state, action, pending] = useActionState<FormState, FormData>(
    markNotificationRead,
    undefined,
  );
  useActionAnnounce(state, pending, "通知已標為已讀");

  return (
    <form action={action} className="contents">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className="btn btn-outline btn-sm shrink-0 whitespace-nowrap"
      >
        {pending ? "更新中…" : "標為已讀"}
      </button>
    </form>
  );
}
