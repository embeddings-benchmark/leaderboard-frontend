<script lang="ts">
	interface Props {
		label: string;
		checked: boolean;
		onChange: (next: boolean) => void;
	}
	let { label, checked, onChange }: Props = $props();
</script>

<label class="switch">
	<input
		type="checkbox"
		{checked}
		onchange={(e) => onChange((e.currentTarget as HTMLInputElement).checked)}
	/>
	<span class="switch-track"><span class="switch-knob"></span></span>
	<span class="switch-label">{label}</span>
</label>

<style>
	.switch {
		display: inline-flex;
		align-items: center;
		gap: 10px;
		cursor: pointer;
		font-size: 13px;
		color: var(--text);
	}
	.switch input {
		position: absolute;
		opacity: 0;
		width: 0;
		height: 0;
		pointer-events: none;
	}
	.switch-track {
		position: relative;
		width: 34px;
		height: 20px;
		background: var(--border-strong);
		border-radius: 999px;
		transition: background 0.16s;
		flex-shrink: 0;
	}
	.switch-knob {
		position: absolute;
		top: 2px;
		left: 2px;
		width: 16px;
		height: 16px;
		background: var(--surface);
		border-radius: 50%;
		box-shadow: 0 1px 2px rgb(var(--shadow-tint) / 0.2);
		transition: transform 0.16s;
	}
	.switch input:checked + .switch-track {
		background: var(--primary);
	}
	.switch input:checked + .switch-track .switch-knob {
		transform: translateX(14px);
	}
	.switch-label {
		flex: 1;
	}
</style>
