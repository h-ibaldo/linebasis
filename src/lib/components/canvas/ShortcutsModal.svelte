<script lang="ts">
	/**
	 * ShortcutsModal - Display keyboard shortcuts
	 */

	import Modal from '$lib/components/common/Modal.svelte';

	export let isOpen = false;
	export let onClose: () => void;

	// Keyboard shortcuts data
	const shortcuts = {
		general: [
			{ keys: ['Cmd', 'S'], description: 'Save' },
			{ keys: ['Cmd', 'Z'], description: 'Undo' },
			{ keys: ['Cmd', 'Shift', 'Z'], description: 'Redo' },
			{ keys: ['Cmd', 'C'], description: 'Copy' },
			{ keys: ['Cmd', 'X'], description: 'Cut' },
			{ keys: ['Cmd', 'V'], description: 'Paste' },
			{ keys: ['Cmd', 'Shift', 'V'], description: 'Paste inside selected div' },
			{ keys: ['Cmd', 'D'], description: 'Duplicate' },
			{ keys: ['Delete'], description: 'Delete selection' },
			{ keys: ['Cmd', 'A'], description: 'Select all' },
			{ keys: ['Esc'], description: 'Deselect all' },
			{ keys: ['Cmd', 'K'], description: 'Toggle shortcuts' }
		],
		tools: [
			{ keys: ['V'], description: 'Move tool' },
			{ keys: ['H'], description: 'Hand tool' },
			{ keys: ['D'], description: 'Div tool' },
			{ keys: ['T'], description: 'Text tool' },
			{ keys: ['M'], description: 'Media tool' },
			{ keys: ['Space'], description: 'Temporary Hand tool (hold)' }
		],
		canvas: [
			{ keys: ['Cmd', "'"], description: 'Toggle baseline grid' },
			{ keys: ['Cmd', 'Shift', "'"], description: 'Toggle snap to baseline' },
			{ keys: ['Cmd', '+'], description: 'Zoom in' },
			{ keys: ['Cmd', '-'], description: 'Zoom out' },
			{ keys: ['Cmd', '0'], description: 'Zoom to 100%' },
			{ keys: ['Cmd', '1'], description: 'Fit all views' },
			{ keys: ['Cmd', '2'], description: 'Fit selected view' }
		],
		text: [
			{ keys: ['Cmd', 'B'], description: 'Toggle bold' },
			{ keys: ['Cmd', 'I'], description: 'Toggle italic' },
			{ keys: ['Cmd', 'U'], description: 'Toggle underline' },
			{ keys: ['Cmd', 'Shift', 'X'], description: 'Toggle strikethrough' },
			{ keys: ['Cmd', 'Shift', '7'], description: 'Toggle ordered list' },
			{ keys: ['Cmd', 'Shift', '8'], description: 'Toggle unordered list' },
			{ keys: ['Opt', 'Cmd', 'L'], description: 'Align left' },
			{ keys: ['Opt', 'Cmd', 'T'], description: 'Align center' },
			{ keys: ['Opt', 'Cmd', 'R'], description: 'Align right' },
			{ keys: ['Shift', 'Cmd', '.'], description: 'Increase font size' },
			{ keys: ['Shift', 'Cmd', ','], description: 'Decrease font size' }
		],
		layout: [
			{ keys: ['Shift', 'W'], description: 'Wrap selection in div' },
			{ keys: ['Cmd', 'Backspace'], description: 'Unwrap selected div' },
			{ keys: ['Cmd', 'G'], description: 'Group selected elements' },
			{ keys: ['Cmd', 'Shift', 'G'], description: 'Ungroup elements' },
			{ keys: ['Shift', 'A'], description: 'Toggle auto layout' }
		],
		layers: [
			{ keys: ['['], description: 'Send to back' },
			{ keys: [']'], description: 'Bring to front' },
			{ keys: ['Cmd', '['], description: 'Move layer backward' },
			{ keys: ['Cmd', ']'], description: 'Move layer forward' }
		]
	};
</script>

<Modal {isOpen} {onClose} title="Keyboard Shortcuts" maxWidth="800px">
	<div class="shortcuts-grid">
		<!-- General -->
		<section class="shortcuts-section">
			<h3>General</h3>
			<div class="shortcuts-list">
				{#each shortcuts.general as shortcut}
					<div class="shortcut-row">
						<div class="keys">
							{#each shortcut.keys as key, i}
								<kbd>{key}</kbd>
								{#if i < shortcut.keys.length - 1}
									<span class="plus">+</span>
								{/if}
							{/each}
						</div>
						<span class="description">{shortcut.description}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Tools -->
		<section class="shortcuts-section">
			<h3>Tools</h3>
			<div class="shortcuts-list">
				{#each shortcuts.tools as shortcut}
					<div class="shortcut-row">
						<div class="keys">
							{#each shortcut.keys as key, i}
								<kbd>{key}</kbd>
								{#if i < shortcut.keys.length - 1}
									<span class="plus">+</span>
								{/if}
							{/each}
						</div>
						<span class="description">{shortcut.description}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Canvas -->
		<section class="shortcuts-section">
			<h3>Canvas</h3>
			<div class="shortcuts-list">
				{#each shortcuts.canvas as shortcut}
					<div class="shortcut-row">
						<div class="keys">
							{#each shortcut.keys as key, i}
								<kbd>{key}</kbd>
								{#if i < shortcut.keys.length - 1}
									<span class="plus">+</span>
								{/if}
							{/each}
						</div>
						<span class="description">{shortcut.description}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Text Editing -->
		<section class="shortcuts-section">
			<h3>Text Editing</h3>
			<div class="shortcuts-list">
				{#each shortcuts.text as shortcut}
					<div class="shortcut-row">
						<div class="keys">
							{#each shortcut.keys as key, i}
								<kbd>{key}</kbd>
								{#if i < shortcut.keys.length - 1}
									<span class="plus">+</span>
								{/if}
							{/each}
						</div>
						<span class="description">{shortcut.description}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Layout -->
		<section class="shortcuts-section">
			<h3>Layout & Structure</h3>
			<div class="shortcuts-list">
				{#each shortcuts.layout as shortcut}
					<div class="shortcut-row">
						<div class="keys">
							{#each shortcut.keys as key, i}
								<kbd>{key}</kbd>
								{#if i < shortcut.keys.length - 1}
									<span class="plus">+</span>
								{/if}
							{/each}
						</div>
						<span class="description">{shortcut.description}</span>
					</div>
				{/each}
			</div>
		</section>

		<!-- Layers -->
		<section class="shortcuts-section">
			<h3>Layers</h3>
			<div class="shortcuts-list">
				{#each shortcuts.layers as shortcut}
					<div class="shortcut-row">
						<div class="keys">
							{#each shortcut.keys as key, i}
								<kbd>{key}</kbd>
								{#if i < shortcut.keys.length - 1}
									<span class="plus">+</span>
								{/if}
							{/each}
						</div>
						<span class="description">{shortcut.description}</span>
					</div>
				{/each}
			</div>
		</section>
	</div>
</Modal>

<style>
	/* Shortcuts-specific styling - designer will style later */
	.shortcuts-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
		gap: 24px;
	}

	.shortcuts-section h3 {
		margin: 0 0 12px 0;
		font-size: 14px;
		font-weight: 600;
		color: #666;
		text-transform: uppercase;
		letter-spacing: 0.5px;
	}

	.shortcuts-list {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.shortcut-row {
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 16px;
		padding: 8px 0;
	}

	.keys {
		display: flex;
		align-items: center;
		gap: 4px;
		flex-shrink: 0;
	}

	kbd {
		display: inline-block;
		padding: 4px 8px;
		background: #f5f5f5;
		border: 1px solid #d0d0d0;
		border-radius: 4px;
		font-size: 12px;
		font-family: ui-monospace, monospace;
		font-weight: 500;
		color: #333;
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);
		min-width: 24px;
		text-align: center;
	}

	.plus {
		color: #999;
		font-size: 11px;
		font-weight: 600;
	}

	.description {
		font-size: 13px;
		color: #555;
		flex: 1;
	}

	/* Responsive adjustments */
	@media (max-width: 600px) {
		.modal-content {
			grid-template-columns: 1fr;
		}
	}
</style>
