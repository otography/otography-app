import * as stylex from "@stylexjs/stylex";
import type { StyleXStyles } from "@stylexjs/stylex";
import { Button } from "@ui-sdk/react/button";
import { PauseIcon, PlayIcon } from "#/chat/icons";
import type { AppleSong } from "#/lib/musickit";
import { usePreviewPlayer } from "./preview-player";

type PreviewToggleProps = {
  song: AppleSong;
  /** aria-label に使う曲名 */
  title: string;
  style?: StyleXStyles;
};

/** 試聴の再生・停止ボタン。試聴音源のない曲では何も描画しない。 */
export function PreviewToggle({ song, title, style }: PreviewToggleProps) {
  const preview = usePreviewPlayer();
  if (!song.attributes.previews?.length) return null;
  const playing = preview.state.playingId === song.id;

  return (
    <Button
      type="button"
      aria-label={playing ? `${title} の試聴を停止` : `${title} を試聴`}
      onClick={() => preview.actions.toggle(song)}
      {...stylex.props(style)}
    >
      {playing ? <PauseIcon /> : <PlayIcon />}
    </Button>
  );
}
