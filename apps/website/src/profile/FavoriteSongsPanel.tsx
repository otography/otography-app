import * as stylex from "@stylexjs/stylex";
import { Dialog, DialogTrigger } from "@ui-sdk/react/dialog";
import { MusicNoteIcon, PlusIcon } from "#/chat/icons";
import { type AppleSong, artworkUrl, searchSongs } from "#/lib/musickit";
import type { FavoriteSongItem } from "#/lib/profile";
import { PreviewToggle } from "#/songs/PreviewToggle";
import {
  EditFavoriteDialog,
  FavoriteDialogContent,
  FavoriteDialogFooter,
  FavoriteDialogForm,
  FavoriteSearchSection,
  FavoriteSelectedBox,
  useFavoriteAddDraft,
} from "./FavoriteDialog";
import { FavoriteDecorationFields } from "./FavoriteDecorationEditor";
import { FavoritePanel } from "./FavoritePanel";
import { FavoriteRow } from "./FavoriteRow";
import { favoriteStyles as styles } from "./favorite-styles";
import { useProfile } from "./ProfileContext";

function SongArt({
  song,
  size,
  style,
}: {
  song: AppleSong;
  size: number;
  style: stylex.StyleXStyles;
}) {
  const { artwork } = song.attributes;
  return artwork ? (
    <img
      src={artworkUrl(artwork.url, size * 2)}
      alt=""
      width={size}
      height={size}
      {...stylex.props(style)}
    />
  ) : (
    <div {...stylex.props(style, styles.artFallback)} aria-hidden="true">
      <MusicNoteIcon />
    </div>
  );
}

function AddFavoriteSongDialog() {
  const { state, actions, meta } = useProfile();
  const draft = useFavoriteAddDraft<AppleSong>(searchSongs);
  const { selected } = draft;

  const atLimit = state.favoriteSongs.length >= meta.favoriteLimit;
  const existingIsrcs = new Set(state.favoriteSongs.map((item) => item.song.isrc.toUpperCase()));
  const canSave =
    Boolean(selected?.attributes.isrc) && draft.isDecorationValid && !state.isSavingSongs;

  const handleSave = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!canSave) return;
    void draft.save(actions.addFavoriteSong);
  };

  return (
    <Dialog open={draft.open} onOpenChange={draft.onOpenChange}>
      <DialogTrigger disabled={atLimit} {...stylex.props(styles.addBtn)}>
        <PlusIcon />
        <span>好きな曲を追加</span>
      </DialogTrigger>
      <FavoriteDialogContent
        title="好きな曲を追加"
        description={`Apple Music から曲を検索して、最大 ${meta.favoriteLimit} 曲まで登録できます。`}
      >
        <FavoriteDialogForm onSubmit={handleSave}>
          {selected ? (
            <FavoriteSelectedBox resetLabel="別の曲を選ぶ" onReset={() => draft.setSelected(null)}>
              <SongArt song={selected} size={44} style={styles.art} />
              <div {...stylex.props(styles.meta)}>
                <span {...stylex.props(styles.title)}>{selected.attributes.name}</span>
                <span {...stylex.props(styles.sub)}>{selected.attributes.artistName}</span>
              </div>
            </FavoriteSelectedBox>
          ) : (
            <FavoriteSearchSection
              name="song-search"
              label="曲を検索"
              placeholder="曲名やアーティスト名を入力…"
              idleMessage="キーワードを入力して曲を検索してください"
              notFoundMessage="一致する曲が見つかりませんでした"
              search={draft.search}
            >
              <ul {...stylex.props(styles.resultList)} aria-label="曲の検索結果">
                {draft.search.results.map((song) => {
                  const isrc = song.attributes.isrc;
                  const alreadyAdded = Boolean(isrc && existingIsrcs.has(isrc.toUpperCase()));
                  const disabled = !isrc || alreadyAdded;
                  return (
                    <li key={song.id} {...stylex.props(styles.resultRow)}>
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => draft.setSelected(song)}
                        {...stylex.props(styles.resultSelectBtn)}
                      >
                        <SongArt song={song} size={38} style={styles.resultArt} />
                        <span {...stylex.props(styles.meta)}>
                          <span {...stylex.props(styles.title)}>{song.attributes.name}</span>
                          <span {...stylex.props(styles.sub)}>{song.attributes.artistName}</span>
                        </span>
                        {alreadyAdded ? (
                          <span {...stylex.props(styles.badge)}>登録済み</span>
                        ) : !isrc ? (
                          <span {...stylex.props(styles.badge)}>選択不可</span>
                        ) : null}
                      </button>
                      <PreviewToggle
                        song={song}
                        title={song.attributes.name}
                        style={styles.iconBtn}
                      />
                    </li>
                  );
                })}
              </ul>
            </FavoriteSearchSection>
          )}

          {selected ? (
            <FavoriteDecorationFields
              value={draft.decoration}
              onChange={draft.setDecoration}
              fieldPrefix="add-song"
            />
          ) : null}

          <FavoriteDialogFooter disabled={!canSave}>
            {state.isSavingSongs ? "追加中…" : "リストに追加"}
          </FavoriteDialogFooter>
        </FavoriteDialogForm>
      </FavoriteDialogContent>
    </Dialog>
  );
}

function FavoriteSongRow({
  item,
  index,
  total,
}: {
  item: FavoriteSongItem;
  index: number;
  total: number;
}) {
  const { state, actions } = useProfile();
  const title = item.song.title ?? "（曲名なし）";
  const catalogSong =
    state.catalogSongs.byId.get(item.song.appleSongId) ??
    state.catalogSongs.byIsrc.get(item.song.isrc.toUpperCase());

  return (
    <FavoriteRow.Root color={item.color}>
      <FavoriteRow.Main>
        <FavoriteRow.Rank index={index} />
        <FavoriteRow.Art
          src={item.song.artworkUrl}
          emoji={item.emoji}
          fallback={<MusicNoteIcon />}
        />

        <FavoriteRow.Meta>
          {item.song.url ? (
            <a
              href={item.song.url}
              target="_blank"
              rel="noreferrer"
              {...stylex.props(styles.title, styles.titleLink)}
            >
              {title}
            </a>
          ) : (
            <span {...stylex.props(styles.title)}>{title}</span>
          )}
          {item.song.artistName ? (
            <span {...stylex.props(styles.sub)}>{item.song.artistName}</span>
          ) : null}
        </FavoriteRow.Meta>

        <FavoriteRow.Actions>
          {catalogSong ? (
            <PreviewToggle song={catalogSong} title={title} style={styles.iconBtn} />
          ) : null}
          <FavoriteRow.MoveButtons
            label={title}
            index={index}
            total={total}
            saving={state.isSavingSongs}
            onMove={(direction) => void actions.moveFavoriteSong(index, direction)}
          />
          <EditFavoriteDialog
            title={title}
            initial={{ comment: item.comment, emoji: item.emoji, color: item.color }}
            fieldPrefix={`edit-song-${item.song.isrc}`}
            saving={state.isSavingSongs}
            onSave={(decoration) => actions.updateFavoriteSong(item.song.isrc, decoration)}
          />
          <FavoriteRow.RemoveDialog
            label={title}
            noun="好きな曲"
            saving={state.isSavingSongs}
            onRemove={() => actions.removeFavoriteSong(item.song.isrc)}
          />
        </FavoriteRow.Actions>
      </FavoriteRow.Main>

      <FavoriteRow.Comment>{item.comment}</FavoriteRow.Comment>
    </FavoriteRow.Root>
  );
}

export function FavoriteSongsPanel() {
  const { state, meta } = useProfile();

  return (
    <FavoritePanel.Root>
      <FavoritePanel.Bar
        title="好きな曲"
        count={state.favoriteSongs.length}
        limit={meta.favoriteLimit}
      >
        <AddFavoriteSongDialog />
      </FavoritePanel.Bar>

      {state.isProfilePending ? (
        <FavoritePanel.Loading>好きな曲を読み込んでいます…</FavoritePanel.Loading>
      ) : state.favoriteSongs.length === 0 ? (
        <FavoritePanel.Empty icon={<MusicNoteIcon />} title="まだ好きな曲が登録されていません">
          自分を象徴する曲や、いま聴いている曲を最大 {meta.favoriteLimit} 曲まで並べられます。
        </FavoritePanel.Empty>
      ) : (
        <FavoritePanel.List label="好きな曲一覧">
          {state.favoriteSongs.map((item, index) => (
            <FavoriteSongRow
              key={item.song.isrc}
              item={item}
              index={index}
              total={state.favoriteSongs.length}
            />
          ))}
        </FavoritePanel.List>
      )}
    </FavoritePanel.Root>
  );
}
