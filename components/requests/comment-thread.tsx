"use client";

import { type FormEvent, useState, useTransition } from "react";

import {
  addComment,
  deleteComment,
  editComment,
} from "@/app/(app)/requests/actions";
import { Button } from "@/components/ui/button";

export interface Comment {
  id: string;
  authorId: string;
  authorEmail: string;
  body: string;
  editedAt: string | null;
  deletedAt: string | null;
  createdAt: string;
}

export function CommentThread({
  requestId,
  comments,
  currentUserId,
  isAdmin,
}: {
  requestId: string;
  comments: Comment[];
  currentUserId: string;
  isAdmin: boolean;
}) {
  const [body, setBody] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    startTransition(async () => {
      try {
        await addComment({ requestId, body });
        setBody("");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to comment");
      }
    });
  }

  function startEdit(comment: Comment) {
    setEditingId(comment.id);
    setEditBody(comment.body);
  }

  function saveEdit() {
    setError(null);
    startTransition(async () => {
      try {
        await editComment({ commentId: editingId!, body: editBody });
        setEditingId(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to save edit");
      }
    });
  }

  function handleDelete(commentId: string) {
    setError(null);
    startTransition(() => deleteComment({ commentId }));
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold">Comments</h2>
      <div className="space-y-3">
        {comments.map((comment) => (
          <div key={comment.id} className="border-border rounded-md border p-3">
            <div className="text-muted-foreground flex items-center justify-between text-xs">
              <span>
                {comment.authorEmail} ·{" "}
                {new Date(comment.createdAt).toLocaleString()}
                {comment.editedAt && !comment.deletedAt ? " · edited" : ""}
              </span>
              {!comment.deletedAt &&
                (comment.authorId === currentUserId || isAdmin) && (
                  <span className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => startEdit(comment)}
                      className="hover:text-foreground"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(comment.id)}
                      className="text-destructive hover:opacity-80"
                    >
                      Delete
                    </button>
                  </span>
                )}
            </div>
            {comment.deletedAt ? (
              <p className="text-muted-foreground mt-1 text-sm italic">
                Comment deleted.
              </p>
            ) : editingId === comment.id ? (
              <div className="mt-1 space-y-2">
                <textarea
                  value={editBody}
                  onChange={(event) => setEditBody(event.target.value)}
                  rows={2}
                  className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <Button type="button" disabled={isPending} onClick={saveEdit}>
                    Save
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setEditingId(null)}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mt-1 text-sm">{comment.body}</p>
            )}
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-muted-foreground text-sm">No comments yet.</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="space-y-2">
        <textarea
          value={body}
          onChange={(event) => setBody(event.target.value)}
          rows={2}
          required
          placeholder="Add a comment"
          className="border-input bg-background w-full rounded-md border px-3 py-2 text-sm"
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? "Posting…" : "Post comment"}
        </Button>
        {error && (
          <p role="alert" className="text-destructive text-xs">
            {error}
          </p>
        )}
      </form>
    </div>
  );
}
