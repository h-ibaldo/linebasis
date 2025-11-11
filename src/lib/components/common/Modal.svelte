<script lang="ts">
	/**
	 * Modal - Reusable modal component
	 *
	 * Minimal styling - designer will style later
	 */

	export let isOpen = false;
	export let onClose: () => void;
	export let title = '';
	export let maxWidth = '800px';

	function handleKeyDown(e: KeyboardEvent) {
		if (e.key === 'Escape') {
			onClose();
		}
	}

	function handleBackdropClick(e: MouseEvent) {
		if (e.target === e.currentTarget) {
			onClose();
		}
	}
</script>

<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
<svelte:window on:keydown={handleKeyDown} />

{#if isOpen}
	<div class="modal-backdrop" on:click={handleBackdropClick}>
		<div class="modal" style="max-width: {maxWidth}">
			<div class="modal-header">
				<h2>{title}</h2>
				<button class="close-button" on:click={onClose}>×</button>
			</div>

			<div class="modal-content">
				<slot />
			</div>
		</div>
	</div>
{/if}

<style>
	/* Minimal styling - designer will style later */
	.modal-backdrop {
		position: fixed;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		background: rgba(0, 0, 0, 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		z-index: 10000;
	}

	.modal {
		background: white;
		border-radius: 8px;
		width: 90%;
		max-height: 90vh;
		overflow: hidden;
		display: flex;
		flex-direction: column;
		box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 20px 24px;
		border-bottom: 1px solid #e0e0e0;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 20px;
		font-weight: 600;
		color: #333;
	}

	.close-button {
		background: none;
		border: none;
		font-size: 32px;
		line-height: 1;
		cursor: pointer;
		color: #666;
		padding: 0;
		width: 32px;
		height: 32px;
		display: flex;
		align-items: center;
		justify-content: center;
		border-radius: 4px;
	}

	.close-button:hover {
		background: #f0f0f0;
		color: #333;
	}

	.modal-content {
		padding: 24px;
		overflow-y: auto;
	}
</style>
