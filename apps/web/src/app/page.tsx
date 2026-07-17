import * as stylex from "@stylexjs/stylex";
import { NoProfileError } from "@repo/errors";
import { getCurrentUser } from "@/features/auth";
import { Header, Hero, HowItWorks, Discovery, FinalCta, Footer } from "@/features/landing";
import { styles } from "./page.stylex";

type CurrentUserResult = Awaited<ReturnType<typeof getCurrentUser>>;

function getCtaHref(result: CurrentUserResult) {
  if (!(result instanceof Error)) return "/account";
  if (result instanceof NoProfileError) return "/setup-profile";
  return "/login";
}

export default async function Home() {
  const result = await getCurrentUser();
  const ctaHref = getCtaHref(result);

  return (
    <main {...stylex.props(styles.page)}>
      <Header ctaHref={ctaHref} />
      <Hero ctaHref={ctaHref} />
      <HowItWorks />
      <Discovery />
      <FinalCta ctaHref={ctaHref} />
      <Footer />
    </main>
  );
}
