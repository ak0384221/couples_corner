"use client";

import { useMemo, useState } from "react";
import { EXPLORE_CATEGORIES, type ExploreCategory, type ExplorePost } from "@/lib/explore-categories";
import { t } from "@/lib/text";

type SortOrder = "newest" | "oldest" | "topic";

const categoryOrder = new Map<ExploreCategory, number>(
  EXPLORE_CATEGORIES.map((category, index) => [category, index]),
);

export function ExploreFeed({ posts }: { posts: ExplorePost[] }) {
  const [sortOrder, setSortOrder] = useState<SortOrder>("newest");
  const sortedPosts = useMemo(() => [...posts].sort((a, b) => {
    if (sortOrder === "topic") {
      const byCategory = (categoryOrder.get(a.category) ?? 0) - (categoryOrder.get(b.category) ?? 0);
      return byCategory || b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id);
    }
    const chronological = a.created_at.localeCompare(b.created_at) || a.id.localeCompare(b.id);
    return sortOrder === "newest" ? -chronological : chronological;
  }), [posts, sortOrder]);

  return (
    <section className="explore-feed" aria-label={t.explore.community}>
      <label className="explore-sort field-label">
        <span>{t.explore.sortLabel}</span>
        <select
          className="field-input"
          value={sortOrder}
          onChange={(event) => setSortOrder(event.target.value as SortOrder)}
        >
          <option value="newest">{t.explore.newest}</option>
          <option value="oldest">{t.explore.oldest}</option>
          <option value="topic">{t.explore.byTopic}</option>
        </select>
      </label>
      {sortedPosts.length ? (
        <div className="explore-post-list">
          {sortedPosts.map((post) => (
            <article className={`explore-post explore-post-${post.category}`} key={post.id}>
              <p>{post.content}</p>
              <footer>{t.explore.community}</footer>
            </article>
          ))}
        </div>
      ) : (
        <div className="explore-empty">
          <span aria-hidden="true">♡</span>
          <h2>{t.explore.emptyTitle}</h2>
          <p>{t.explore.emptyBody}</p>
        </div>
      )}
    </section>
  );
}
