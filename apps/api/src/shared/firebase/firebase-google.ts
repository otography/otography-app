// 互換性維持用のbarrel。
// Google OAuthトークン交換とFirebase IdPサインインは責務が異なる外部サービス連携のため
// firebase-google-token.ts / firebase-idp.ts へ分割済み。既存のimport元を壊さないよう再export する。
export { exchangeGoogleCode } from "./firebase-google-token";
export { signInWithGoogleIdp } from "./firebase-idp";
