import Link from "next/link";

export default function LoginPage() {
	return (
		<main
			style={{
				display: "grid",
				placeItems: "center",
				minHeight: "100dvh",
				padding: "2rem",
			}}
		>
			<section
				style={{
					width: "100%",
					maxWidth: "32rem",
					padding: "2rem",
					border: "1px solid #d6d6d6",
					borderRadius: "0.75rem",
					backgroundColor: "#ffffff",
				}}
			>
				<h1 style={{ marginTop: 0, marginBottom: "0.75rem" }}>Login</h1>
				<p style={{ marginTop: 0, marginBottom: "1rem", lineHeight: 1.5 }}>
					Sign-in UI is not implemented yet. This page exists to handle unauthenticated redirects
					from Supabase middleware.
				</p>
				<Link href="/">Back to home</Link>
			</section>
		</main>
	);
}
