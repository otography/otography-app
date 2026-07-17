import { Fragment } from "react";
import * as stylex from "@stylexjs/stylex";
import { loadDefaultJapaneseParser } from "budoux";

const parser = loadDefaultJapaneseParser();

const styles = stylex.create({
  // 日本語はデフォルトで文字間ならどこでも改行可能なため、word-break: keep-all で
  // それを止めた上で <wbr> による文節境界のみを改行点にする（BudouXの公式仕様に準拠）。
  root: {
    wordBreak: "keep-all",
    overflowWrap: "anywhere",
  },
});

/**
 * 日本語の文章を文節境界で改行できるように <wbr> を挿入する。
 * word-break: auto-phrase がブラウザで使えるようになるまでの代替。
 */
export function BudouxText({ text }: { text: string }) {
  return (
    <span {...stylex.props(styles.root)}>
      {parser.parse(text).map((phrase, index) => (
        <Fragment key={index}>
          {index > 0 && <wbr />}
          {phrase}
        </Fragment>
      ))}
    </span>
  );
}
