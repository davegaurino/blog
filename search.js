
document.addEventListener("DOMContentLoaded", () => {
  const input = document.getElementById("searchPageInput");
  const status = document.getElementById("searchStatus");
  const results = document.getElementById("searchResults");
  const index = Array.isArray(window.SITE_SEARCH_INDEX) ? window.SITE_SEARCH_INDEX : [];
  const params = new URLSearchParams(window.location.search);
  const rawQuery = (params.get("q") || "").trim();

  if (!input || !status || !results) return;
  input.value = rawQuery;

  function normalize(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/[’‘]/g, "'")
      .replace(/[–—]/g, "-")
      .replace(/\s+/g, " ")
      .trim();
  }

  function tokensFor(query) {
    return normalize(query)
      .split(/\s+/)
      .map(t => t.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}'-]+$/gu, ""))
      .filter(Boolean);
  }

  function makeSnippet(text, tokens) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (!clean) return "";
    const lower = normalize(clean);
    let pos = -1;
    for (const token of tokens) {
      const p = lower.indexOf(token);
      if (p !== -1 && (pos === -1 || p < pos)) pos = p;
    }

    const radius = 115;
    let start = Math.max(0, pos === -1 ? 0 : pos - radius);
    let end = Math.min(clean.length, pos === -1 ? 230 : pos + radius);

    if (start > 0) {
      const nextSpace = clean.indexOf(" ", start);
      if (nextSpace !== -1 && nextSpace < start + 25) start = nextSpace + 1;
    }
    if (end < clean.length) {
      const prevSpace = clean.lastIndexOf(" ", end);
      if (prevSpace > end - 25) end = prevSpace;
    }

    return (start > 0 ? "…" : "") + clean.slice(start, end).trim() + (end < clean.length ? "…" : "");
  }

  function appendHighlighted(parent, text, tokens) {
    const source = String(text || "");
    if (!tokens.length) {
      parent.textContent = source;
      return;
    }

    const escapedTokens = [...new Set(tokens)]
      .sort((a, b) => b.length - a.length)
      .map(token => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

    if (!escapedTokens.length) {
      parent.textContent = source;
      return;
    }

    const regex = new RegExp("(" + escapedTokens.join("|") + ")", "gi");
    let last = 0;
    source.replace(regex, (match, _group, offset) => {
      parent.append(document.createTextNode(source.slice(last, offset)));
      const mark = document.createElement("mark");
      mark.textContent = match;
      parent.append(mark);
      last = offset + match.length;
      return match;
    });
    parent.append(document.createTextNode(source.slice(last)));
  }

  if (!rawQuery) {
    status.textContent = "Enter a keyword above to search the website.";
    return;
  }

  const tokens = tokensFor(rawQuery);
  if (!tokens.length) {
    status.textContent = "Enter a valid search keyword.";
    return;
  }

  const matches = index
    .map(item => {
      const title = normalize(item.title);
      const text = normalize(item.text);
      const haystack = title + " " + text;
      const allMatch = tokens.every(token => haystack.includes(token));
      if (!allMatch) return null;

      let score = 0;
      tokens.forEach(token => {
        if (title === token) score += 30;
        else if (title.includes(token)) score += 12;
        if (text.includes(token)) score += 2;
      });

      return { ...item, score };
    })
    .filter(Boolean)
    .sort((a, b) => b.score - a.score || a.title.localeCompare(b.title));

  status.textContent = matches.length
    ? `${matches.length} result${matches.length === 1 ? "" : "s"} for “${rawQuery}”`
    : `No results found for “${rawQuery}”.`;

  matches.forEach(item => {
    const card = document.createElement("article");
    card.className = "search-result-card";

    const heading = document.createElement("h2");
    const link = document.createElement("a");
    link.href = item.url;
    appendHighlighted(link, item.title, tokens);
    heading.append(link);

    const snippet = document.createElement("p");
    appendHighlighted(snippet, makeSnippet(item.text, tokens), tokens);

    const openLink = document.createElement("a");
    openLink.href = item.url;
    openLink.className = "search-result-link";
    openLink.textContent = "Open Page →";

    card.append(heading, snippet, openLink);
    results.append(card);
  });
});
