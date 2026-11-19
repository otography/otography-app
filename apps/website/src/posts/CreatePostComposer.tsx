import { CreatePostProvider } from "./composer/CreatePostProvider";
import { Composer } from "./composer/parts";

/** 曲を選んで、新しく投稿する。 */
export function CreatePostComposer() {
  return (
    <CreatePostProvider>
      <Composer.Frame>
        <Composer.LastPost />
        <Composer.SongField />
        <Composer.Input />
        <Composer.Footer>
          <Composer.Counter />
          <Composer.Submit />
        </Composer.Footer>
        <Composer.Error />
      </Composer.Frame>
      <Composer.Similar />
    </CreatePostProvider>
  );
}
