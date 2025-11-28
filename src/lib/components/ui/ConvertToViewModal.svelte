<script lang="ts">
	/**
	 * ConvertToViewModal - Modal for converting div to view
	 *
	 * Collects:
	 * - View name (e.g., "Desktop", "Mobile")
	 * - Breakpoint width (e.g., 1920, 375)
	 */

	import { createEventDispatcher, onMount } from 'svelte';

	export let elementWidth: number = 1440; // Default to current element width

	const dispatch = createEventDispatcher<{ submit: { viewName: string; breakpointWidth: number }; cancel: void }>();

	let viewName = '';
	let breakpointWidth = elementWidth;
	let nameInput: HTMLInputElement;

	// Common breakpoint presets
	const presets = [
		{ name: 'Desktop', width: 1920 },
		{ name: 'Laptop', width: 1440 },
		{ name: 'Tablet', width: 768 },
		{ name: 'Mobile', width: 375 }
	];

	onMount(() => {
		// Focus name input
		nameInput?.focus();
	});

	function handleSubmit() {
		if (!viewName.trim()) {
			alert('Please enter a view name');
			return;
		}
		if (breakpointWidth <= 0) {
			alert('Breakpoint width must be greater than 0');
			return;
		}

		dispatch('submit', {
			viewName: viewName.trim(),
			breakpointWidth
		});
	}

	function handleCancel() {
		dispatch('cancel');
	}

	function applyPreset(preset: { name: string; width: number }) {
		viewName = preset.name;
		breakpointWidth = preset.width;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Enter') {
			e.preventDefault();
			handleSubmit();
		} else if (e.key === 'Escape') {
			e.preventDefault();
			handleCancel();
		}
	}
</script>

<div class="modal-overlay" on:click={handleCancel}>
	<div class="modal" on:click|stopPropagation on:keydown={handleKeydown}>
		<h2>Convert to View</h2>
		<p class="description">
			Views represent responsive breakpoints. The view's width will be used as the breakpoint width in media queries.
		</p>

		<!-- Presets -->
		<div class="presets">
			<label class="presets-label">Quick presets:</label>
			<div class="preset-buttons">
				{#each presets as preset}
					<button
						type="button"
						class="preset-btn"
						on:click={() => applyPreset(preset)}
					>
						{preset.name} ({preset.width}px)
					</button>
				{/each}
			</div>
		</div>

		<!-- Form -->
		<div class="form">
			<div class="form-group">
				<label for="viewName">View Name</label>
				<input
					id="viewName"
					type="text"
					bind:this={nameInput}
					bind:value={viewName}
					placeholder="e.g., Desktop, Mobile"
				/>
			</div>

			<div class="form-group">
				<label for="breakpointWidth">Breakpoint Width (px)</label>
				<input
					id="breakpointWidth"
					type="number"
					bind:value={breakpointWidth}
					min="1"
					step="1"
					placeholder="1440"
				/>
			</div>
		</div>

		<!-- Actions -->
		<div class="actions">
			<button type="button" class="btn btn-cancel" on:click={handleCancel}>Cancel</button>
			<button type="button" class="btn btn-primary" on:click={handleSubmit}>Convert to View</button>
		</div>
	</div>
</div>

<style>
	.modal-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 9999;
	}

	.modal {
		background: white;
		border-radius: 8px;
		padding: 24px;
		width: 90%;
		max-width: 480px;
		box-shadow: 0 8px 24px rgba(0, 0, 0, 0.2);
	}

	h2 {
		margin: 0 0 8px 0;
		font-size: 20px;
		font-weight: 600;
		color: #333;
	}

	.description {
		margin: 0 0 24px 0;
		font-size: 13px;
		color: #666;
		line-height: 1.5;
	}

	.presets {
		margin-bottom: 24px;
	}

	.presets-label {
		display: block;
		font-size: 12px;
		font-weight: 500;
		color: #666;
		margin-bottom: 8px;
	}

	.preset-buttons {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
	}

	.preset-btn {
		padding: 10px 12px;
		background: #f5f5f5;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		font-size: 12px;
		color: #333;
		cursor: pointer;
		transition: all 0.15s;
	}

	.preset-btn:hover {
		background: #e8e8e8;
		border-color: #d0d0d0;
	}

	.form {
		display: flex;
		flex-direction: column;
		gap: 16px;
		margin-bottom: 24px;
	}

	.form-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.form-group label {
		font-size: 13px;
		font-weight: 500;
		color: #333;
	}

	.form-group input {
		padding: 10px 12px;
		border: 1px solid #e0e0e0;
		border-radius: 6px;
		font-size: 14px;
		font-family: inherit;
		transition: border-color 0.15s;
	}

	.form-group input:focus {
		outline: none;
		border-color: #007aff;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 12px;
	}

	.btn {
		padding: 10px 20px;
		border: none;
		border-radius: 6px;
		font-size: 14px;
		font-weight: 500;
		cursor: pointer;
		transition: all 0.15s;
	}

	.btn-cancel {
		background: #f5f5f5;
		color: #333;
	}

	.btn-cancel:hover {
		background: #e8e8e8;
	}

	.btn-primary {
		background: #007aff;
		color: white;
	}

	.btn-primary:hover {
		background: #0051d5;
	}
</style>
