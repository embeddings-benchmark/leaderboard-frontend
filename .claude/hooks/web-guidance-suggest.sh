#!/usr/bin/env bash
# PostToolUse hook: when an Edit/Write/MultiEdit on a web file (html/css/js/
# ts/svelte/…) introduces content referencing modern web APIs or
# accessibility features, suggest the /modern-web-guidance:modern-web-guidance
# skill. Pattern list mirrors the trigger topics in the skill's own
# description — see the system prompt entry.
set -u

payload=$(cat)
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty' <<<"$payload")
[ -z "$f" ] && exit 0

case "${f##*.}" in
	html|htm|css|scss|js|jsx|ts|tsx|svelte|vue|astro) ;;
	*) exit 0 ;;
esac

# Pull whatever the tool wrote. Edit ⇒ new_string, Write ⇒ content,
# MultiEdit ⇒ concatenated edits[].new_string.
new_content=$(jq -r '
	if .tool_input.new_string then .tool_input.new_string
	elif .tool_input.content then .tool_input.content
	elif .tool_input.edits then ([.tool_input.edits[].new_string] | join("\n"))
	else empty
	end
' <<<"$payload")
[ -z "$new_content" ] && exit 0

# Trigger vocabulary:
#  * Modern CSS:    container queries, :has(), anchor positioning, scroll-driven anim,
#                   View Transitions, content-visibility, backdrop-filter, popover,
#                   color-scheme, :user-valid/:user-invalid, :focus-visible
#  * HTML / APIs:   <dialog>, showModal, popover attr, inert, IntersectionObserver,
#                   ResizeObserver, navigator.share, showOpenFilePicker, navigator.usb,
#                   WebAssembly, WebTransport, fetchpriority
#  * Accessibility: aria-*, role=, tabindex, prefers-reduced-motion, prefers-color-scheme
patterns='backdrop-filter|container-type|@container|:has\(|anchor-name|anchor-position|view-transition|content-visibility|:user-valid|:user-invalid|:focus-visible|popover|<dialog|showModal|\binert\b|prefers-reduced-motion|prefers-color-scheme|\bcolor-scheme\b|aria-[a-z-]+|role=|tabindex=|IntersectionObserver|requestIdleCallback|ResizeObserver|navigator\.share|showOpenFilePicker|navigator\.usb|WebAssembly|WebTransport|fetchpriority|scroll-timeline|view-timeline'

grep -qE "$patterns" <<<"$new_content" || exit 0

topics=$(grep -oE "$patterns" <<<"$new_content" | sort -u | head -6 | paste -sd ',' - | sed 's/,/, /g')
jq -nc --arg f "$f" --arg topics "$topics" '{
	hookSpecificOutput: {
		hookEventName: "PostToolUse",
		additionalContext: ("Edit to " + $f + " referenced modern web / a11y features (" + $topics + "). Consider running /modern-web-guidance:modern-web-guidance to confirm current best practices before continuing.")
	}
}'
