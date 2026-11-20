import * as stylex from "@stylexjs/stylex";
import { Dialog, DialogTrigger } from "@ui-sdk/react/dialog";
import { PlusIcon } from "#/chat/icons";
import { type AppleArtist, artworkUrl, searchArtists } from "#/lib/musickit";
import type { FavoriteArtistItem } from "#/lib/profile";
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
import { UserIcon } from "./icons";
import { useProfile } from "./ProfileContext";

function ArtistArt({
  artist,
  size,
  style,
  roundStyle,
}: {
  artist: AppleArtist;
  size: number;
  style: stylex.StyleXStyles;
  roundStyle: stylex.StyleXStyles;
}) {
  const { artwork } = artist.attributes;
  return artwork ? (
    <img
      src={artworkUrl(artwork.url, size * 2)}
      alt=""
      width={size}
      height={size}
      {...stylex.props(style, roundStyle)}
    />
  ) : (
    <div {...stylex.props(style, styles.artFallback, roundStyle)} aria-hidden="true">
      <UserIcon />
    </div>
  );
}

function ArtistGenres({ artist }: { artist: AppleArtist }) {
  const genres = artist.attributes.genreNames;
  return genres?.length ? (
    <span {...stylex.props(styles.sub)}>{genres.slice(0, 2).join(" / ")}</span>
  ) : null;
}

function AddFavoriteArtistDialog() {
  const { state, actions, meta } = useProfile();
  const draft = useFavoriteAddDraft<AppleArtist>(searchArtists);
  const { selected } = draft;

  const atLimit = state.favoriteArtists.length >= meta.favoriteLimit;
  const existingIds = new Set(state.favoriteArtists.map((item) => item.artist.id));
  const canSave = Boolean(selected) && draft.isDecorationValid && !state.isSavingArtists;

  const handleSave = (event: { preventDefault: () => void }) => {
    event.preventDefault();
    if (!canSave) return;
    void draft.save(actions.addFavoriteArtist);
  };

  return (
    <Dialog open={draft.open} onOpenChange={draft.onOpenChange}>
      <DialogTrigger disabled={atLimit} {...stylex.props(styles.addBtn)}>
        <PlusIcon />
        <span>好きなアーティストを追加</span>
      </DialogTrigger>
      <FavoriteDialogContent
        title="好きなアーティストを追加"
        description={`Apple Music からアーティストを検索して、最大 ${meta.favoriteLimit} 組まで登録できます。`}
      >
        <FavoriteDialogForm onSubmit={handleSave}>
          {selected ? (
            <FavoriteSelectedBox
              resetLabel="別のアーティストを選ぶ"
              onReset={() => draft.setSelected(null)}
            >
              <ArtistArt
                artist={selected}
                size={44}
                style={styles.art}
                roundStyle={styles.roundArt}
              />
              <div {...stylex.props(styles.meta)}>
                <span {...stylex.props(styles.title)}>{selected.attributes.name}</span>
                <ArtistGenres artist={selected} />
              </div>
            </FavoriteSelectedBox>
          ) : (
            <FavoriteSearchSection
              name="artist-search"
              label="アーティストを検索"
              placeholder="アーティスト名を入力…"
              idleMessage="キーワードを入力してアーティストを検索してください"
              notFoundMessage="一致するアーティストが見つかりませんでした"
              search={draft.search}
            >
              <ul {...stylex.props(styles.resultList)} aria-label="アーティストの検索結果">
                {draft.search.results.map((artist) => {
                  const alreadyAdded = existingIds.has(artist.id);
                  return (
                    <li key={artist.id} {...stylex.props(styles.resultRow)}>
                      <button
                        type="button"
                        disabled={alreadyAdded}
                        onClick={() => draft.setSelected(artist)}
                        {...stylex.props(styles.resultSelectBtn)}
                      >
                        <ArtistArt
                          artist={artist}
                          size={38}
                          style={styles.resultArt}
                          roundStyle={styles.roundResultArt}
                        />
                        <span {...stylex.props(styles.meta)}>
                          <span {...stylex.props(styles.title)}>{artist.attributes.name}</span>
                          <ArtistGenres artist={artist} />
                        </span>
                        {alreadyAdded ? (
                          <span {...stylex.props(styles.badge)}>登録済み</span>
                        ) : null}
                      </button>
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
              fieldPrefix="add-artist"
            />
          ) : null}

          <FavoriteDialogFooter disabled={!canSave}>
            {state.isSavingArtists ? "追加中…" : "リストに追加"}
          </FavoriteDialogFooter>
        </FavoriteDialogForm>
      </FavoriteDialogContent>
    </Dialog>
  );
}

function FavoriteArtistRow({
  item,
  index,
  total,
}: {
  item: FavoriteArtistItem;
  index: number;
  total: number;
}) {
  const { state, actions } = useProfile();
  const name = item.artist.name ?? "（アーティスト名なし）";

  return (
    <FavoriteRow.Root color={item.color}>
      <FavoriteRow.Main>
        <FavoriteRow.Rank index={index} />
        <FavoriteRow.Art
          shape="round"
          src={item.artist.artworkUrl}
          emoji={item.emoji}
          fallback={<UserIcon />}
        />

        <FavoriteRow.Meta>
          {item.artist.url ? (
            <a
              href={item.artist.url}
              target="_blank"
              rel="noreferrer"
              {...stylex.props(styles.title, styles.titleLink)}
            >
              {name}
            </a>
          ) : (
            <span {...stylex.props(styles.title)}>{name}</span>
          )}
        </FavoriteRow.Meta>

        <FavoriteRow.Actions>
          <FavoriteRow.MoveButtons
            label={name}
            index={index}
            total={total}
            saving={state.isSavingArtists}
            onMove={(direction) => void actions.moveFavoriteArtist(index, direction)}
          />
          <EditFavoriteDialog
            title={name}
            initial={{ comment: item.comment, emoji: item.emoji, color: item.color }}
            fieldPrefix={`edit-artist-${item.artist.id}`}
            saving={state.isSavingArtists}
            onSave={(decoration) => actions.updateFavoriteArtist(item.artist.id, decoration)}
          />
          <FavoriteRow.RemoveDialog
            label={name}
            noun="好きなアーティスト"
            saving={state.isSavingArtists}
            onRemove={() => actions.removeFavoriteArtist(item.artist.id)}
          />
        </FavoriteRow.Actions>
      </FavoriteRow.Main>

      <FavoriteRow.Comment>{item.comment}</FavoriteRow.Comment>
    </FavoriteRow.Root>
  );
}

export function FavoriteArtistsPanel() {
  const { state, meta } = useProfile();

  return (
    <FavoritePanel.Root>
      <FavoritePanel.Bar
        title="好きなアーティスト"
        count={state.favoriteArtists.length}
        limit={meta.favoriteLimit}
      >
        <AddFavoriteArtistDialog />
      </FavoritePanel.Bar>

      {state.isProfilePending ? (
        <FavoritePanel.Loading>好きなアーティストを読み込んでいます…</FavoritePanel.Loading>
      ) : state.favoriteArtists.length === 0 ? (
        <FavoritePanel.Empty icon={<UserIcon />} title="まだ好きなアーティストが登録されていません">
          よく聴くアーティストや推しのバンドを最大 {meta.favoriteLimit} 組まで並べられます。
        </FavoritePanel.Empty>
      ) : (
        <FavoritePanel.List label="好きなアーティスト一覧">
          {state.favoriteArtists.map((item, index) => (
            <FavoriteArtistRow
              key={item.artist.id}
              item={item}
              index={index}
              total={state.favoriteArtists.length}
            />
          ))}
        </FavoritePanel.List>
      )}
    </FavoritePanel.Root>
  );
}
