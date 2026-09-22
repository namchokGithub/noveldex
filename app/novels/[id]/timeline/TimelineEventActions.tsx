import { secondaryButtonClassName } from "../../ui";

export function TimelineEventActions({
  isAdmin,
  deleting,
  editLabel,
  deleteLabel,
  onEdit,
  onDelete,
}: {
  isAdmin: boolean;
  deleting: boolean;
  editLabel: string;
  deleteLabel: string;
  onEdit: () => void;
  onDelete: () => void;
}) {
  if (!isAdmin) return null;
  return (
    <div className="flex shrink-0 items-center gap-2">
      <button type="button" onClick={onEdit} className={secondaryButtonClassName}>
        {editLabel}
      </button>
      <button
        type="button"
        onClick={onDelete}
        disabled={deleting}
        className={`${secondaryButtonClassName} hover:text-rose-600`}>
        {deleteLabel}
      </button>
    </div>
  );
}
