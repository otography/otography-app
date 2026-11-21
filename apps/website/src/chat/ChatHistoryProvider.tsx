import { useInfiniteQuery, useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { catalogSongsQuery } from "#/lib/musickit";
import type { AppleSong } from "#/lib/musickit";
import { authorPostsInfiniteQuery } from "#/lib/profile";
import { useMediaQuery } from "#/lib/use-media-query";
import { ChatHistoryContext } from "./ChatHistoryContext";
import { groupPostsByDate } from "./history-groups";

export function ChatHistoryProvider({
  publicId,
  children,
}: {
  publicId: string;
  children: ReactNode;
}) {
  const isDesktop = useMediaQuery("(min-width: 860px)");
  const [desktopOpen, setDesktopOpen] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

  const postsQuery = useInfiniteQuery(authorPostsInfiniteQuery(publicId));

  const posts = useMemo(
    () => postsQuery.data?.pages.flatMap((page) => page.posts) ?? [],
    [postsQuery.data],
  );

  const groups = useMemo(() => groupPostsByDate(posts), [posts]);

  const songIds = useMemo(
    () => posts.map((post) => post.song?.appleSongId).filter((id): id is string => Boolean(id)),
    [posts],
  );

  const catalogQuery = useQuery(catalogSongsQuery(songIds));

  const catalogSongs = useMemo(() => {
    const byId = new Map<string, AppleSong>();
    const byIsrc = new Map<string, AppleSong>();
    for (const song of catalogQuery.data ?? []) {
      byId.set(song.id, song);
      if (song.attributes.isrc) {
        byIsrc.set(song.attributes.isrc.toUpperCase(), song);
      }
    }
    return { byId, byIsrc };
  }, [catalogQuery.data]);

  return (
    <ChatHistoryContext
      value={{
        state: {
          groups,
          totalCount: posts.length,
          catalogSongs,
          isPending: postsQuery.isPending,
          error: postsQuery.isError ? postsQuery.error.message : null,
          hasNextPage: Boolean(postsQuery.hasNextPage),
          isFetchingNextPage: postsQuery.isFetchingNextPage,
          isDesktop,
          desktopOpen,
          mobileOpen,
        },
        actions: {
          fetchNextPage: () => {
            void postsQuery.fetchNextPage();
          },
          setDesktopOpen,
          toggleDesktop: () => setDesktopOpen((prev) => !prev),
          setMobileOpen,
        },
      }}
    >
      {children}
    </ChatHistoryContext>
  );
}
