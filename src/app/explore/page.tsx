import { AppFrame } from "@/components/app-frame";
import { ExploreFeed } from "@/components/explore-feed";
import { ExplorePostForm } from "@/components/explore-post-form";
import { getExplorePosts } from "@/lib/explore-posts";
import { getCurrentUser } from "@/lib/supabase/auth";
import { t } from "@/lib/text";
import Link from "next/link";

export default async function ExplorePage() {
  const [posts, user] = await Promise.all([getExplorePosts(), getCurrentUser()]);

  return (
    <AppFrame title={t.nav.explore}>
      <main className="explore-page">
        <p className="explore-intro">{t.explore.intro}</p>
        {user ? (
          <details className="explore-add">
            <summary aria-label={t.explore.addPost}>
              <span className="explore-add-icon" aria-hidden="true">+</span>
              <span>{t.explore.addPost}</span>
            </summary>
            <div className="explore-add-panel"><ExplorePostForm /></div>
          </details>
        ) : (
          <Link className="explore-add explore-sign-in" href="/login">
            <span className="explore-add-icon" aria-hidden="true">+</span>
            <span>{t.explore.signInToPost}</span>
          </Link>
        )}
        <ExploreFeed posts={posts} />
      </main>
    </AppFrame>
  );
}
