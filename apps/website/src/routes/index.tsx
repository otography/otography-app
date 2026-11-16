import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { client } from "#/lib/api";
import { authClient } from "#/lib/auth-client";

export const Route = createFileRoute("/")({ component: Home });

type Me = { name: string; publicId: string };

// ログインの動作を確かめるための仮の画面。
function Home() {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    void client.api.me.$get().then(async (res) => setMe(res.ok ? await res.json() : null));
  }, []);

  if (me === undefined) return <p className="p-8">読み込み中…</p>;

  return (
    <div className="p-8 space-y-4">
      {me ? (
        <>
          <p>
            {me.name}（{me.publicId}）としてログイン中
          </p>
          <button
            type="button"
            className="rounded border px-4 py-2"
            onClick={() => void authClient.signOut().then(() => setMe(null))}
          >
            ログアウト
          </button>
        </>
      ) : (
        <button
          type="button"
          className="rounded border px-4 py-2"
          onClick={() => void authClient.signIn.social({ provider: "google", callbackURL: "/" })}
        >
          Google でログイン
        </button>
      )}
    </div>
  );
}
