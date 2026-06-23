import Image from "next/image";
import Link from "next/link";
import * as stylex from "@stylexjs/stylex";
import { NoProfileError } from "@repo/errors";
import { getCurrentUser } from "@/features/auth";
import { styles } from "./page.stylex";

type CurrentUserResult = Awaited<ReturnType<typeof getCurrentUser>>;
type StyleKey = keyof typeof styles;

const heroPosts: Array<{
  positionStyle: StyleKey;
  name: string;
  time: string;
  text: string;
  artStyle: StyleKey;
  title: string;
  artist: string;
}> = [
  {
    positionStyle: "heroPostPrimary",
    name: "Aoi",
    time: "2m ago",
    text: "夜の帰り道、風がちょっと優しくなる曲。",
    artStyle: "artCoast",
    title: "lights",
    artist: "Tempalay",
  },
  {
    positionStyle: "heroPostSecondary",
    name: "haru",
    time: "1h ago",
    text: "雨の匂いがする朝にぴったり。",
    artStyle: "artForest",
    title: "Lighthouse",
    artist: "haruka nakamura",
  },
  {
    positionStyle: "heroPostTertiary",
    name: "Yuuki",
    time: "3h ago",
    text: "何も考えたくない日にずっとリピートしてる。",
    artStyle: "artPastel",
    title: "スローモーション",
    artist: "betcover!!",
  },
];

const feedPosts: Array<{
  user: string;
  text: string;
  artStyle: StyleKey;
  title: string;
  artist: string;
}> = [
  {
    user: "mio",
    text: "このベースライン、ずっと聴いていられる。",
    artStyle: "artDusk",
    title: "Plastic Love",
    artist: "竹内まりや",
  },
  {
    user: "リョウ",
    text: "夕方の陽が沈む瞬間に聴きたくなる。",
    artStyle: "artGreen",
    title: "The Door",
    artist: "iri",
  },
];

const discoveryItems: Array<{
  artStyle: StyleKey;
  title: string;
  artist: string;
  user: string;
  likes: number;
  quote: string;
}> = [
  {
    artStyle: "artDusk",
    title: "夜を偉いはたして",
    artist: "Lucky Kilimanjaro",
    user: "あおい",
    likes: 24,
    quote: "終電後の静けさがちょうどいい。",
  },
  {
    artStyle: "artWindow",
    title: "ミラー",
    artist: "須田景凪",
    user: "しほ",
    likes: 31,
    quote: "過去の自分に会いに行くみたい。",
  },
  {
    artStyle: "artCoast",
    title: "海の幽霊",
    artist: "ヨルシカ",
    user: "KANA",
    likes: 28,
    quote: "波の音と一緒に思い出がよみがえる。",
  },
  {
    artStyle: "artRoom",
    title: "Nour",
    artist: "EGO-WRAPPIN'",
    user: "たいせい",
    likes: 19,
    quote: "休日の朝、部屋の静けさに合う。",
  },
];

function getCtaHref(result: CurrentUserResult) {
  if (!(result instanceof Error)) return "/account";
  if (result instanceof NoProfileError) return "/setup-profile";
  return "/login";
}

function Logo() {
  return <span {...stylex.props(styles.logo)}>otooto</span>;
}

function PrimaryLink({ href, extraStyles = [] }: { href: string; extraStyles?: StyleKey[] }) {
  return (
    <Link href={href} {...stylex.props(styles.primaryLink, ...extraStyles.map((k) => styles[k]))}>
      <span>無料ではじめる</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function HeroPostCard({
  positionStyle,
  name,
  time,
  text,
  artStyle,
  title,
  artist,
}: (typeof heroPosts)[number]) {
  return (
    <article {...stylex.props(styles.heroPost, styles[positionStyle])}>
      <div {...stylex.props(styles.postMeta)}>
        <span {...stylex.props(styles.avatar)}>{name.slice(0, 1)}</span>
        <span>{name}</span>
        <time {...stylex.props(styles.postMetaTime)}>{time}</time>
      </div>
      <p {...stylex.props(styles.heroPostText)}>{text}</p>
      <MusicPill artStyle={artStyle} title={title} artist={artist} />
    </article>
  );
}

function MusicPill({
  artStyle,
  title,
  artist,
}: {
  artStyle: StyleKey;
  title: string;
  artist: string;
}) {
  return (
    <div {...stylex.props(styles.musicPill)}>
      <span {...stylex.props(styles.trackArt, styles[artStyle])} aria-hidden="true" />
      <span>
        <strong {...stylex.props(styles.pillTitle)}>{title}</strong>
        <small {...stylex.props(styles.pillSubtitle)}>{artist}</small>
      </span>
    </div>
  );
}

function StepItem({
  number,
  title,
  numberVariant,
  children,
}: {
  number: number;
  title: string;
  numberVariant?: StyleKey;
  children: React.ReactNode;
}) {
  return (
    <li {...stylex.props(styles.stepItem)}>
      <span {...stylex.props(styles.stepNumber, numberVariant ? styles[numberVariant] : null)}>
        {number}
      </span>
      <div>
        <h3 {...stylex.props(styles.stepTitle)}>{title}</h3>
        <p {...stylex.props(styles.stepText)}>{children}</p>
      </div>
    </li>
  );
}

function FeedMock() {
  return (
    <div {...stylex.props(styles.phoneMock)}>
      <div {...stylex.props(styles.phoneHeader)}>
        <strong {...stylex.props(styles.phoneHeaderActive)}>For you</strong>
        <span>Following</span>
        <span aria-hidden="true">♢</span>
      </div>
      <div {...stylex.props(styles.phoneFeed)}>
        {feedPosts.map((post) => (
          <article key={post.title} {...stylex.props(styles.feedPost)}>
            <div {...stylex.props(styles.feedUser)}>
              <span {...stylex.props(styles.avatar)}>{post.user.slice(0, 1)}</span>
              <span>
                <strong {...stylex.props(styles.feedUserName)}>{post.user}</strong>
                <small {...stylex.props(styles.feedUserTime)}>5m ago</small>
              </span>
            </div>
            <p {...stylex.props(styles.feedPostText)}>{post.text}</p>
            <div {...stylex.props(styles.feedTrack)}>
              <span
                {...stylex.props(styles.trackArt, styles.feedTrackArt, styles[post.artStyle])}
                aria-hidden="true"
              />
              <span>
                <strong {...stylex.props(styles.pillTitle)}>{post.title}</strong>
                <small {...stylex.props(styles.pillSubtitle)}>{post.artist}</small>
              </span>
              <button aria-label={`${post.title} を再生`} {...stylex.props(styles.feedPlayButton)}>
                ▶
              </button>
            </div>
          </article>
        ))}
      </div>
      <nav aria-label="アプリ内ナビゲーション" {...stylex.props(styles.phoneNav)}>
        <span>⌂</span>
        <span>⌕</span>
        <span {...stylex.props(styles.phoneNavAdd)}>＋</span>
        <span>⌁</span>
        <span>♙</span>
      </nav>
      <Image
        alt="otography のフィード画面"
        height={1024}
        src="/lp-asset-4.webp"
        width={1535}
        {...stylex.props(styles.phoneTexture)}
      />
    </div>
  );
}

function DiscoveryCard({
  artStyle,
  title,
  artist,
  user,
  likes,
  quote,
}: (typeof discoveryItems)[number]) {
  return (
    <article {...stylex.props(styles.discoveryCard)}>
      <div
        aria-label={`${title} のジャケット`}
        role="img"
        {...stylex.props(styles.discoveryArt, styles[artStyle])}
      />
      <h3 {...stylex.props(styles.discoveryCardTitle)}>{title}</h3>
      <p {...stylex.props(styles.discoveryCardArtist)}>{artist}</p>
      <div {...stylex.props(styles.discoveryMeta)}>
        <span {...stylex.props(styles.avatar, styles.discoveryAvatar)}>{user.slice(0, 1)}</span>
        <span>{user}</span>
        <span aria-hidden="true" {...stylex.props(styles.heartIcon)}>
          ♡
        </span>
        <span>{likes}</span>
      </div>
      <blockquote {...stylex.props(styles.discoveryCardQuote)}>{quote}</blockquote>
    </article>
  );
}

export default async function Home() {
  const result = await getCurrentUser();
  const ctaHref = getCtaHref(result);

  return (
    <main {...stylex.props(styles.page)}>
      <header {...stylex.props(styles.header)}>
        <Logo />
        <nav aria-label="メインナビゲーション" {...stylex.props(styles.nav)}>
          <a href="#about" {...stylex.props(styles.navLink)}>
            About
          </a>
          <a href="#how-it-works" {...stylex.props(styles.navLink)}>
            How it works
          </a>
          <a href="#voices" {...stylex.props(styles.navLink)}>
            Voices
          </a>
        </nav>
        <PrimaryLink href={ctaHref} extraStyles={["headerPrimaryLinkHidden"]} />
        <button aria-label="メニューを開く" {...stylex.props(styles.menuButton)}>
          <span {...stylex.props(styles.menuButtonBar)} />
          <span {...stylex.props(styles.menuButtonBar)} />
        </button>
      </header>

      <section {...stylex.props(styles.hero)} id="about">
        <div {...stylex.props(styles.heroCopy)}>
          <h1 aria-label="Music is passed on in words." {...stylex.props(styles.heroTitle)}>
            Music is
            <br />
            passed on
            <br />
            <Image
              alt=""
              aria-hidden="true"
              height={1024}
              priority
              src="/lp-asset-5.webp"
              width={1536}
              {...stylex.props(styles.inWordsImage)}
            />
          </h1>
          <p {...stylex.props(styles.heroLead)}>
            聴いた人の言葉をまとって、曲は次の誰かへ渡っていく。
          </p>
          <p {...stylex.props(styles.heroDescription)}>
            otootoは、楽曲への短い感想を投稿し、誰かの音楽体験に触れられるプラットフォームです。
          </p>
          <div {...stylex.props(styles.heroActions)}>
            <PrimaryLink href={ctaHref} extraStyles={["heroActionPrimaryLink"]} />
            <a href="#how-it-works" {...stylex.props(styles.secondaryLink)}>
              <span>もっと知る</span>
              <span aria-hidden="true">⌄</span>
            </a>
          </div>
        </div>
        <div {...stylex.props(styles.heroVisual)} aria-label="感想カードのプレビュー">
          <Image
            alt=""
            aria-hidden="true"
            height={1535}
            priority
            src="/lp-asset-4.webp"
            width={1535}
            {...stylex.props(styles.heroAura)}
          />
          <Image
            alt=""
            aria-hidden="true"
            height={1024}
            priority
            src="/lp-asset-2.webp"
            width={1536}
            {...stylex.props(styles.heroDots)}
          />
          <Image
            alt=""
            aria-hidden="true"
            height={1024}
            priority
            src="/lp-asset-3.webp"
            width={1535}
            {...stylex.props(styles.heroOval)}
          />
          <Image
            alt=""
            aria-hidden="true"
            height={1254}
            priority
            src="/lp-asset-1.webp"
            width={1254}
            {...stylex.props(styles.heroScribble)}
          />
          {heroPosts.map((post) => (
            <HeroPostCard key={post.name} {...post} />
          ))}
          <p {...stylex.props(styles.heroNote)}>短い言葉が、新しい出会いになる。</p>
        </div>
      </section>

      <section {...stylex.props(styles.howItWorks)} id="how-it-works">
        <div {...stylex.props(styles.sectionCopy)}>
          <span {...stylex.props(styles.kicker)}>HOW IT WORKS</span>
          <h2 {...stylex.props(styles.sectionTitle)}>感想がつなぐ、音楽との出会い。</h2>
          <ol {...stylex.props(styles.steps)}>
            <StepItem number={1} title="短い言葉で、感想をシェア">
              楽曲を聴いて浮かんだ気持ちや情景を、短い言葉で気軽に投稿できます。
            </StepItem>
            <StepItem number={2} title="誰かの言葉から、曲に出会う" numberVariant="stepNumber2">
              他の人の感想を読んで、気になる曲を見つけて聴いてみる。そんな出会いが生まれます。
            </StepItem>
            <StepItem number={3} title="曲ごとに、言葉が積もっていく" numberVariant="stepNumber3">
              一つの楽曲に、いろんな人のいろんな言葉が集まり、その曲の新しい一面が見えてきます。
            </StepItem>
          </ol>
        </div>
        <FeedMock />
        <p {...stylex.props(styles.sideStatement)}>Words create new music experiences.</p>
      </section>

      <section {...stylex.props(styles.discovery)} id="voices">
        <div {...stylex.props(styles.discoveryIntro)}>
          <span {...stylex.props(styles.kicker)}>DISCOVER</span>
          <h2 {...stylex.props(styles.sectionTitle)}>いろんな人の、いろんな聴き方。</h2>
          <p {...stylex.props(styles.discoveryIntroText)}>
            同じ曲でも、聴く人やタイミングで感じ方は違う。だからおもしろい。
          </p>
          <a href="#voices" {...stylex.props(styles.discoveryLink)}>
            <span>みんなの感想を見る</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
        <div {...stylex.props(styles.discoveryGrid)}>
          {discoveryItems.map((item) => (
            <DiscoveryCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section {...stylex.props(styles.finalCta)}>
        <Image
          alt=""
          aria-hidden="true"
          height={1024}
          src="/lp-asset-7.png"
          width={1535}
          {...stylex.props(styles.ctaPurpleAura)}
        />
        <Image
          alt=""
          aria-hidden="true"
          height={511}
          src="/lp-asset-8.webp"
          width={511}
          {...stylex.props(styles.ctaPinkOrb)}
        />
        <Image
          alt=""
          aria-hidden="true"
          height={1254}
          src="/lp-asset-9.png"
          width={1254}
          {...stylex.props(styles.ctaGoldOrb)}
        />
        <p {...stylex.props(styles.finalCtaText)}>
          あなたの言葉が、誰かの音楽体験を変えるかもしれない。
        </p>
        <div {...stylex.props(styles.finalCtaActions)}>
          <PrimaryLink href={ctaHref} />
          <small {...stylex.props(styles.finalCtaSmall)}>
            アカウント登録なしでも投稿や閲覧ができます
          </small>
        </div>
      </section>

      <footer {...stylex.props(styles.footer)}>
        <Logo />
        <nav aria-label="フッターナビゲーション" {...stylex.props(styles.footerNav)}>
          <a href="#about" {...stylex.props(styles.footerLink)}>
            About
          </a>
          <a href="#how-it-works" {...stylex.props(styles.footerLink)}>
            How it works
          </a>
          <a href="#voices" {...stylex.props(styles.footerLink)}>
            Voices
          </a>
          <a href="#terms" {...stylex.props(styles.footerLink)}>
            Terms
          </a>
          <a href="#privacy" {...stylex.props(styles.footerLink)}>
            Privacy
          </a>
          <a href="#contact" {...stylex.props(styles.footerLink)}>
            Contact
          </a>
        </nav>
        <div {...stylex.props(styles.socialLinks)} aria-label="ソーシャルリンク">
          <a href="#x" aria-label="X" {...stylex.props(styles.footerLink)}>
            X
          </a>
          <a href="#instagram" aria-label="Instagram" {...stylex.props(styles.footerLink)}>
            ◎
          </a>
          <a href="#tiktok" aria-label="TikTok" {...stylex.props(styles.footerLink)}>
            ♪
          </a>
        </div>
      </footer>
    </main>
  );
}
