export const normalizeUsername = (email: string | undefined, firebaseUid: string) => {
	const base = email?.split("@")[0]?.trim().toLowerCase() ?? `user_${firebaseUid}`;
	const normalized = base
		.replace(/[^a-z0-9_]/g, "_")
		.replace(/_+/g, "_")
		.slice(0, 50);
	const fallback = `user_${firebaseUid.slice(0, 12)}`;
	return normalized.length > 0 ? normalized : fallback;
};
