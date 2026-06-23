import Image from "next/image";
import Link from "next/link";
import { NoProfileError } from "@repo/errors";
import { getCurrentUser } from "@/features/auth";
import styles from "./page.module.css";

type CurrentUserResult = Awaited<ReturnType<typeof getCurrentUser>>;

const heroPosts = [
  {
    className: styles.heroPostPrimary,
    name: "Aoi",
    time: "2m ago",
    text: "夜の帰り道、風がちょっと優しくなる曲。",
    artClassName: styles.artCoast,
    title: "lights",
    artist: "Tempalay",
  },
  {
    className: styles.heroPostSecondary,
    name: "haru",
    time: "1h ago",
    text: "雨の匂いがする朝にぴったり。",
    artClassName: styles.artForest,
    title: "Lighthouse",
    artist: "haruka nakamura",
  },
  {
    className: styles.heroPostTertiary,
    name: "Yuuki",
    time: "3h ago",
    text: "何も考えたくない日にずっとリピートしてる。",
    artClassName: styles.artPastel,
    title: "スローモーション",
    artist: "betcover!!",
  },
];

const feedPosts = [
  {
    user: "mio",
    text: "このベースライン、ずっと聴いていられる。",
    artClassName: styles.artDusk,
    title: "Plastic Love",
    artist: "竹内まりや",
  },
  {
    user: "リョウ",
    text: "夕方の陽が沈む瞬間に聴きたくなる。",
    artClassName: styles.artGreen,
    title: "The Door",
    artist: "iri",
  },
];

const discoveryItems = [
  {
    artClassName: styles.artDusk,
    title: "夜を偉いはたして",
    artist: "Lucky Kilimanjaro",
    user: "あおい",
    likes: 24,
    quote: "終電後の静けさがちょうどいい。",
  },
  {
    artClassName: styles.artWindow,
    title: "ミラー",
    artist: "須田景凪",
    user: "しほ",
    likes: 31,
    quote: "過去の自分に会いに行くみたい。",
  },
  {
    artClassName: styles.artCoast,
    title: "海の幽霊",
    artist: "ヨルシカ",
    user: "KANA",
    likes: 28,
    quote: "波の音と一緒に思い出がよみがえる。",
  },
  {
    artClassName: styles.artRoom,
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

function cx(...classNames: Array<string | undefined>) {
  return classNames.filter((className): className is string => Boolean(className)).join(" ");
}

function Logo() {
  return <span className={styles.logo}>otooto</span>;
}

function PrimaryLink({ href }: { href: string }) {
  return (
    <Link className={styles.primaryLink} href={href}>
      <span>無料ではじめる</span>
      <span aria-hidden="true">→</span>
    </Link>
  );
}

function HeroPostCard({
  className,
  name,
  time,
  text,
  artClassName,
  title,
  artist,
}: (typeof heroPosts)[number]) {
  return (
    <article className={cx(styles.heroPost, className)}>
      <div className={styles.postMeta}>
        <span className={styles.avatar}>{name.slice(0, 1)}</span>
        <span>{name}</span>
        <time>{time}</time>
      </div>
      <p>{text}</p>
      <MusicPill artClassName={artClassName} title={title} artist={artist} />
    </article>
  );
}

function MusicPill({
  artClassName,
  title,
  artist,
}: {
  artClassName: string | undefined;
  title: string;
  artist: string;
}) {
  return (
    <div className={styles.musicPill}>
      <span className={cx(styles.trackArt, artClassName)} aria-hidden="true" />
      <span>
        <strong>{title}</strong>
        <small>{artist}</small>
      </span>
    </div>
  );
}

function StepItem({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <li className={styles.stepItem}>
      <span>{number}</span>
      <div>
        <h3>{title}</h3>
        <p>{children}</p>
      </div>
    </li>
  );
}

function FeedMock() {
  return (
    <div className={styles.phoneMock}>
      <div className={styles.phoneHeader}>
        <strong>For you</strong>
        <span>Following</span>
        <span aria-hidden="true">♢</span>
      </div>
      <div className={styles.phoneFeed}>
        {feedPosts.map((post) => (
          <article className={styles.feedPost} key={post.title}>
            <div className={styles.feedUser}>
              <span className={styles.avatar}>{post.user.slice(0, 1)}</span>
              <span>
                <strong>{post.user}</strong>
                <small>5m ago</small>
              </span>
            </div>
            <p>{post.text}</p>
            <div className={styles.feedTrack}>
              <span className={cx(styles.trackArt, post.artClassName)} aria-hidden="true" />
              <span>
                <strong>{post.title}</strong>
                <small>{post.artist}</small>
              </span>
              <button aria-label={`${post.title} を再生`}>▶</button>
            </div>
          </article>
        ))}
      </div>
      <nav aria-label="アプリ内ナビゲーション" className={styles.phoneNav}>
        <span>⌂</span>
        <span>⌕</span>
        <span>＋</span>
        <span>⌁</span>
        <span>♙</span>
      </nav>
      <Image
        alt="otography のフィード画面"
        className={styles.phoneTexture}
        height={1024}
        src="/lp-asset-4.webp"
        width={1535}
      />
    </div>
  );
}

function DiscoveryCard({
  artClassName,
  title,
  artist,
  user,
  likes,
  quote,
}: (typeof discoveryItems)[number]) {
  return (
    <article className={styles.discoveryCard}>
      <div
        aria-label={`${title} のジャケット`}
        className={cx(styles.discoveryArt, artClassName)}
        role="img"
      />
      <h3>{title}</h3>
      <p>{artist}</p>
      <div className={styles.discoveryMeta}>
        <span className={styles.avatar}>{user.slice(0, 1)}</span>
        <span>{user}</span>
        <span aria-hidden="true">♡</span>
        <span>{likes}</span>
      </div>
      <blockquote>{quote}</blockquote>
    </article>
  );
}

export default async function Home() {
  const result = await getCurrentUser();
  const ctaHref = getCtaHref(result);

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Logo />
        <nav aria-label="メインナビゲーション" className={styles.nav}>
          <a href="#about">About</a>
          <a href="#how-it-works">How it works</a>
          <a href="#voices">Voices</a>
        </nav>
        <PrimaryLink href={ctaHref} />
        <button aria-label="メニューを開く" className={styles.menuButton}>
          <span />
          <span />
        </button>
      </header>

      <section className={styles.hero} id="about">
        <div className={styles.heroCopy}>
          <h1 aria-label="Music is passed on in words.">
            Music is
            <br />
            passed on
            <br />
            <Image
              alt=""
              aria-hidden="true"
              className={styles.inWordsImage}
              height={1024}
              priority
              src="/lp-asset-5.webp"
              width={1536}
            />
          </h1>
          <p className={styles.heroLead}>聴いた人の言葉をまとって、曲は次の誰かへ渡っていく。</p>
          <p className={styles.heroDescription}>
            otootoは、楽曲への短い感想を投稿し、誰かの音楽体験に触れられるプラットフォームです。
          </p>
          <div className={styles.heroActions}>
            <PrimaryLink href={ctaHref} />
            <a className={styles.secondaryLink} href="#how-it-works">
              <span>もっと知る</span>
              <span aria-hidden="true">⌄</span>
            </a>
          </div>
        </div>
        <div className={styles.heroVisual} aria-label="感想カードのプレビュー">
          <Image
            alt=""
            aria-hidden="true"
            className={styles.heroAura}
            priority
            src="/lp-asset-4.webp"
            height={1535}
            width={1535}
          />
          <Image
            alt=""
            aria-hidden="true"
            className={styles.heroDots}
            height={1024}
            priority
            src="/lp-asset-2.webp"
            width={1536}
          />
          <Image
            alt=""
            aria-hidden="true"
            className={styles.heroOval}
            height={1024}
            priority
            src="/lp-asset-3.webp"
            width={1535}
          />
          <Image
            alt=""
            aria-hidden="true"
            className={styles.heroScribble}
            height={1254}
            priority
            src="/lp-asset-1.webp"
            width={1254}
          />
          {heroPosts.map((post) => (
            <HeroPostCard key={post.name} {...post} />
          ))}
          <p className={styles.heroNote}>短い言葉が、新しい出会いになる。</p>
        </div>
      </section>

      <section className={styles.howItWorks} id="how-it-works">
        <div className={styles.sectionCopy}>
          <span className={styles.kicker}>HOW IT WORKS</span>
          <h2>感想がつなぐ、音楽との出会い。</h2>
          <ol className={styles.steps}>
            <StepItem number={1} title="短い言葉で、感想をシェア">
              楽曲を聴いて浮かんだ気持ちや情景を、短い言葉で気軽に投稿できます。
            </StepItem>
            <StepItem number={2} title="誰かの言葉から、曲に出会う">
              他の人の感想を読んで、気になる曲を見つけて聴いてみる。そんな出会いが生まれます。
            </StepItem>
            <StepItem number={3} title="曲ごとに、言葉が積もっていく">
              一つの楽曲に、いろんな人のいろんな言葉が集まり、その曲の新しい一面が見えてきます。
            </StepItem>
          </ol>
        </div>
        <FeedMock />
        <p className={styles.sideStatement}>Words create new music experiences.</p>
      </section>

      <section className={styles.discovery} id="voices">
        <div className={styles.discoveryIntro}>
          <span className={styles.kicker}>DISCOVER</span>
          <h2>いろんな人の、いろんな聴き方。</h2>
          <p>同じ曲でも、聴く人やタイミングで感じ方は違う。だからおもしろい。</p>
          <a href="#voices">
            <span>みんなの感想を見る</span>
            <span aria-hidden="true">→</span>
          </a>
        </div>
        <div className={styles.discoveryGrid}>
          {discoveryItems.map((item) => (
            <DiscoveryCard key={item.title} {...item} />
          ))}
        </div>
      </section>

      <section className={styles.finalCta}>
        <Image
          alt=""
          aria-hidden="true"
          className={styles.ctaPurpleAura}
          height={1024}
          src="/lp-asset-7.png"
          width={1535}
        />
        <Image
          alt=""
          aria-hidden="true"
          className={styles.ctaPinkOrb}
          height={511}
          src="/lp-asset-8.webp"
          width={511}
        />
        <Image
          alt=""
          aria-hidden="true"
          className={styles.ctaGoldOrb}
          height={1254}
          src="/lp-asset-9.png"
          width={1254}
        />
        <p>あなたの言葉が、誰かの音楽体験を変えるかもしれない。</p>
        <div>
          <PrimaryLink href={ctaHref} />
          <small>アカウント登録なしでも投稿や閲覧ができます</small>
        </div>
      </section>

      <footer className={styles.footer}>
        <Logo />
        <nav aria-label="フッターナビゲーション">
          <a href="#about">About</a>
          <a href="#how-it-works">How it works</a>
          <a href="#voices">Voices</a>
          <a href="#terms">Terms</a>
          <a href="#privacy">Privacy</a>
          <a href="#contact">Contact</a>
        </nav>
        <div className={styles.socialLinks} aria-label="ソーシャルリンク">
          <a href="#x" aria-label="X">
            X
          </a>
          <a href="#instagram" aria-label="Instagram">
            ◎
          </a>
          <a href="#tiktok" aria-label="TikTok">
            ♪
          </a>
        </div>
      </footer>
    </main>
  );
}
