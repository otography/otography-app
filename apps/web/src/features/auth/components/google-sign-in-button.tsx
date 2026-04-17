"use client";

// Google OAuth ログインボタン
// プレーンなリンク要素で /api/auth/google へ遷移する
// Next.js Link ではなくプレーンな <a> を使う（OAuth リダイレクトを正しく処理するため）
// Firebase SDK や Google SDK は使用しない

export function GoogleSignInButton() {
  return (
    // oxlint-disable-next-line no-html-link-for-pages -- OAuth リダイレクトのためプレーンな <a> が必要（Next.js Link は fetch で CORS エラーになる）
    <a
      href="/api/auth/google"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "0.75rem 1rem",
        borderRadius: "0.5rem",
        border: "1px solid #d6d6d6",
        backgroundColor: "#ffffff",
        color: "#333",
        textDecoration: "none",
        fontSize: "1rem",
        cursor: "pointer",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
          fill="#4285F4"
        />
        <path
          d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"
          fill="#34A853"
        />
        <path
          d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"
          fill="#FBBC05"
        />
        <path
          d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
          fill="#EA4335"
        />
      </svg>
      Sign in with Google
    </a>
  );
}
