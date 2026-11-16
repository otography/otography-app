# 試聴は、Apple Music API の previews の音源を <audio> で再生する

画面での曲の試聴は、MusicKit JS の再生機能（`setQueue` と `play`）ではなく、Apple Music API が返す曲の `previews` の音源（約 30 秒）を、HTML の `<audio>` 要素で再生する。MusicKit JS の再生機能では、Safari で音が出なかったからである。MusicKit JS は、曲の検索にだけ使う。

## 前提

- 設計ドキュメントでは、曲の試聴は MusicKit JS で行うと決めていた。
- Apple Music API の曲の属性 `previews` には、試聴用の音源の URL が入っている。2026-11-17 に、jp のストアフロントの検索結果の曲に入っていることを確かめた。
- Safari は、利用者の操作（ボタンを押すなど）を処理する関数の中で同期的に呼ばれた `play()` だけを許し、それ以外の `play()` を止める。
- MusicKit JS で曲を再生するには、`setQueue` で曲を再生の順番に入れてから `play()` を呼ぶ。`setQueue` は曲の情報を取得するので、完了を待つ必要がある。

## 理由

### 1. MusicKit JS の再生機能では、Safari で `play()` が止められる

- `setQueue` の完了を待ってから `play()` を呼ぶと、`play()` は、ボタンを押した処理とは別の処理の中で実行される。そのため、Safari はこの `play()` を止める。2026-11-17 に、Safari で試聴のボタンを押しても音が出ないことを確かめた。
- `<audio>` 要素に `previews` の URL を入れる形では、ボタンを押した処理の中で、何も待たずに `play()` を呼べる。

### 2. 試聴の音源の提供元は変わらない

- `previews` の音源は、Apple が試聴のために配っているものである。MusicKit JS の再生機能も、Apple Music にログインしていない利用者には、同じ試聴の音源を再生する。

## 実装

- `apps/website/src/songs/preview-player.tsx`：`PreviewPlayerProvider` が `<audio>` 要素を 1 つ持ち、試聴を 1 曲ずつ再生する。別の曲を試聴すると、前の曲を止める。Provider が画面から外れると、再生を止める。
- `apps/website/src/songs/SongPicker.tsx`：`previews` がない曲では、試聴のボタンを押せないようにする。
- `apps/website/src/lib/musickit.ts`：MusicKit JS は、曲の検索（`/v1/catalog/jp/search`）にだけ使う。

## 検討した他の案

- **MusicKit JS の再生機能を使う**：理由 1 のとおり、Safari で音が出ないので、採用しない。

## この決定による影響

- Apple Music の全曲の再生（Apple Music へのログインが必要）を入れるときは、MusicKit JS の再生機能を使う必要があり、Safari で `play()` が止められる問題を、その時点で解決する必要がある。
- 設計ドキュメントの「試聴は MusicKit JS で行う」という記述は、この ADR で置き換える。
