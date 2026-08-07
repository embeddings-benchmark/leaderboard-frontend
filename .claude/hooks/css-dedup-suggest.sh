#!/usr/bin/env bash
# PostToolUse hook: when an Edit/Write/MultiEdit actually touches CSS,
# emit a `hookSpecificOutput.additionalContext` reminder telling Claude to
# scan other modules for duplicate selectors / declarations. Pure .css
# / .scss files always qualify. For .svelte / .vue / .html the edit's
# new content must itself carry CSS-specific tokens — a script-only edit
# on a style-bearing component no longer fires.
set -u

payload=$(cat)
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' <<<"$payload")
[ -z "$f" ] && exit 0

# Pull whatever the tool wrote (Edit ⇒ new_string, Write ⇒ content,
# MultiEdit ⇒ concatenated edits[].new_string).
content=$(jq -r '
	if .tool_input.new_string then .tool_input.new_string
	elif .tool_input.content then .tool_input.content
	elif .tool_input.edits then ([.tool_input.edits[].new_string] | join("\n"))
	else empty
	end
' <<<"$payload")

# CSS-only tokens: @-rules, custom-property declarations, var(--…),
# light-dark / color-mix functions, CSS units after a number, pseudo
# classes / elements, <style> tag manipulation, class selectors followed
# by an open brace. None of these appear in idiomatic TS / JS / Svelte
# script or markup.
css_pattern='@media|@keyframes|@supports|@container|@layer|@import|@font-face|--[a-z][a-z0-9-]*\s*:|var\(--|color-mix\(|light-dark\(|[0-9]+(px|rem|em|vh|vw|fr|deg)\b|::before|::after|:hover|:focus-visible|</?style|\.[a-zA-Z][a-zA-Z0-9_-]*\s*\{'

case "${f##*.}" in
	css|scss) ;;
	svelte|html|vue)
		# Style-bearing component: require the edit content itself to
		# carry CSS markers. Script-only edits skip here.
		[ -z "$content" ] && exit 0
		grep -qE "$css_pattern" <<<"$content" || exit 0
		;;
	*) exit 0 ;;
esac

jq -nc --arg f "$f" '{
	hookSpecificOutput: {
		hookEventName: "PostToolUse",
		additionalContext: ("Edited CSS in " + $f + ". Before continuing, scan sibling .css files and other component <style> blocks for duplicate selectors or declarations — consider hoisting shared rules into src/app.css or src/lib/styles/.")
	}
}'
