<script lang="ts">
	/**
	 * MediaProperties - Properties for Media (img) elements
	 * 
	 * Features:
	 * - Image source selector (opens MediaPicker)
	 * - Alt text input
	 * - Object fit control
	 */

	import type { Element } from '$lib/types/events';
	import { updateElement, updateElementStyles } from '$lib/stores/design-store';
	import MediaPicker from '$lib/components/ui/MediaPicker.svelte';

	export let element: Element;

	let isPickerOpen = false;

	// Image source
	$: src = element.src || '';
	$: alt = element.alt || '';

	// Object fit - properly typed in ElementStyles interface
	$: objectFit = element.styles?.objectFit || 'cover';

	function openPicker() {
		isPickerOpen = true;
	}

	function closePicker() {
		isPickerOpen = false;
	}

	async function handleMediaSelect(media: { url: string; width?: number; height?: number; alt?: string }) {
		await updateElement(element.id, {
			src: media.url,
			alt: media.alt || alt
		});
	}

	async function updateAltText(e: Event) {
		const input = e.target as HTMLInputElement;
		await updateElement(element.id, { alt: input.value });
	}

	async function updateObjectFit(e: Event) {
		const select = e.target as HTMLSelectElement;
		const value = select.value as 'cover' | 'contain' | 'fill' | 'none' | 'scale-down';
		await updateElementStyles(element.id, { objectFit: value });
	}
</script>

<div class="media-properties">
	<!-- Image Source -->
	<div class="property-section">
		<h3>Image Source</h3>
		{#if src}
			<div class="current-image">
				<img src={src} alt={alt} class="thumbnail" />
				<button class="button-change" on:click={openPicker}>Change Image</button>
			</div>
		{:else}
			<div class="no-image">
				<p>No image selected</p>
				<button class="button-select" on:click={openPicker}>Select Image</button>
			</div>
		{/if}
	</div>

	<!-- Alt Text -->
	<div class="property-section">
		<h3>Alt Text</h3>
		<input
			type="text"
			class="alt-input"
			value={alt}
			on:input={updateAltText}
			placeholder="Describe the image"
		/>
		<p class="hint">Important for accessibility and SEO</p>
	</div>

	<!-- Display -->
	<div class="property-section">
		<h3>Object Fit</h3>
		<select class="object-fit-select" value={objectFit} on:change={updateObjectFit}>
			<option value="cover">Cover</option>
			<option value="contain">Contain</option>
			<option value="fill">Fill</option>
			<option value="none">None</option>
			<option value="scale-down">Scale Down</option>
		</select>
	</div>

	<!-- Info -->
	<div class="property-section">
		<h3>Info</h3>
		<div class="info-grid">
			<div class="info-item">
				<span class="info-label">Position</span>
				<span class="info-value">{Math.round(element.position.x)}, {Math.round(element.position.y)}</span>
			</div>
			<div class="info-item">
				<span class="info-label">Size</span>
				<span class="info-value">{Math.round(element.size.width)} × {Math.round(element.size.height)}</span>
			</div>
		</div>
	</div>
</div>

<!-- Media Picker Modal -->
<MediaPicker isOpen={isPickerOpen} onSelect={handleMediaSelect} onClose={closePicker} />

<style>
	.media-properties {
		display: flex;
		flex-direction: column;
		gap: 16px;
	}

	.property-section {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.property-section h3 {
		font-size: 12px;
		font-weight: 600;
		color: #333;
		text-transform: uppercase;
		letter-spacing: 0.5px;
		margin: 0;
	}

	.current-image {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	.thumbnail {
		width: 100%;
		height: 120px;
		object-fit: cover;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
	}

	.no-image {
		padding: 20px;
		text-align: center;
		border: 2px dashed #e0e0e0;
		border-radius: 4px;
	}

	.no-image p {
		margin: 0 0 10px 0;
		color: #666;
		font-size: 13px;
	}

	.button-select,
	.button-change {
		padding: 8px 16px;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		background: white;
		cursor: pointer;
		font-size: 13px;
	}

	.button-select:hover,
	.button-change:hover {
		background: #f5f5f5;
	}

	.alt-input,
	.object-fit-select {
		padding: 8px;
		border: 1px solid #e0e0e0;
		border-radius: 4px;
		font-size: 13px;
		font-family: inherit;
	}

	.hint {
		font-size: 11px;
		color: #999;
		margin: 0;
	}

	.info-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 8px;
		padding: 8px;
		background: #f5f5f5;
		border-radius: 4px;
		font-size: 12px;
	}

	.info-item {
		display: flex;
		flex-direction: column;
		gap: 2px;
	}

	.info-label {
		color: #666;
		font-size: 11px;
	}

	.info-value {
		color: #333;
		font-weight: 500;
	}
</style>

