import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { ChatWorkspace } from "#/chat/ChatWorkspace";
import { Landing } from "#/landing/Landing";
import { meQuery } from "#/lib/auth";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const me = useQuery(meQuery);

  if (me.isPending) {
    return (
      <main
        style={{
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          fontSize: 14,
          opacity: 0.7,
        }}
      >
        読み込み中…
      </main>
    );
  }

  if (!me.data) return <Landing />;

  return <ChatWorkspace user={me.data} />;
}
