#!/usr/bin/env bash
# PostToolUse hook: when an Edit/Write/MultiEdit touches a CSS-bearing file,
# emit a `hookSpecificOutput.additionalContext` reminder telling Claude to
# scan other modules for duplicate selectors / declarations. Silent on
# non-CSS files.
set -u

# Tool payload is on stdin. Pull the file path the harness wrote (Write) or
# edited (Edit/MultiEdit).
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
[ -z "$f" ] && exit 0

case "${f##*.}" in
	css|scss) ;;
	svelte|html|vue)
		# Only fire when the touched component actually has a <style> block.
		grep -q '<style' "$f" 2>/dev/null || exit 0
		;;
	*) exit 0 ;;
esac

jq -nc --arg f "$f" '{
	hookSpecificOutput: {
		hookEventName: "PostToolUse",
		additionalContext: ("Edited CSS in " + $f + ". Before continuing, scan sibling .css files and other component <style> blocks for duplicate selectors or declarations — consider hoisting shared rules into src/app.css or src/lib/styles/.")
	}
}'
