import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/current-user";
import { SignOutButton } from "./sign-out-button";

export default async function Home() {
	const currentUser = await getCurrentUser();

	if (!currentUser) {
		redirect("/login");
	}

	return (
		<main
			style={{
				display: "grid",
				placeItems: "center",
				minHeight: "100dvh",
				padding: "2rem",
				backgroundColor: "#f6f7fb",
			}}
		>
			<section
				style={{
					width: "100%",
					maxWidth: "40rem",
					padding: "2rem",
					borderRadius: "1rem",
					border: "1px solid #d6d6d6",
					backgroundColor: "#ffffff",
					display: "grid",
					gap: "1rem",
				}}
			>
				<header style={{ display: "grid", gap: "0.5rem" }}>
					<h1 style={{ margin: 0 }}>Authenticated Dashboard</h1>
					<p style={{ margin: 0, lineHeight: 1.5 }}>
						This page only consumes the API session. The Next.js app does not use Firebase or
						connect to the database directly.
					</p>
				</header>
				<dl
					style={{
						display: "grid",
						gridTemplateColumns: "max-content 1fr",
						gap: "0.75rem 1rem",
						margin: 0,
					}}
				>
					<dt>User ID</dt>
					<dd style={{ margin: 0 }}>{currentUser.userId}</dd>
					<dt>Email</dt>
					<dd style={{ margin: 0 }}>{currentUser.profile.email ?? "Not set"}</dd>
					<dt>Display name</dt>
					<dd style={{ margin: 0 }}>{currentUser.profile.displayName ?? "Not set"}</dd>
					<dt>Created at</dt>
					<dd style={{ margin: 0 }}>{new Date(currentUser.profile.createdAt).toLocaleString()}</dd>
				</dl>
				<SignOutButton />
			</section>
		</main>
	);
}
