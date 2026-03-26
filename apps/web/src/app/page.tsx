import { SignOutButton } from "./sign-out-button";

export default function Home() {
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
				<h1 style={{ margin: 0 }}>Otography</h1>
				<p style={{ margin: 0, lineHeight: 1.5 }}>Welcome to Otography App</p>
				<SignOutButton />
			</section>
		</main>
	);
}
