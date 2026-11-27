// Pure helpers for the Build > Token palette. No DOM, Firebase, or VTT state.
export const tokenInitials = (name = "?") => name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]).join("").toUpperCase() || "?";

// Pictures in token/ are named like their creature: "Adult Black Dragon" is adult_black_dragon.png.
export const TOKEN_BASE = "token/";
export const tokenFileName = (file) => file.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ");
export const artFor = (name, files) => {
  const want = String(name || "").trim().toLowerCase().replace(/\s+/g, "_");
  const file = want && files.find((f) => f.replace(/\.[^.]+$/, "").toLowerCase() === want);
  return file ? TOKEN_BASE + encodeURIComponent(file) : "";
};

export const recentTokenRefs = (refs, available, limit = 5) => {
  const have = new Set(available.map((token) => `${token.kind}:${token.id}`));
  return [...new Set(refs)].filter((ref) => have.has(ref)).slice(0, limit);
};
