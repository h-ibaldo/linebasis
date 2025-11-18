<script lang="ts">
	/**
	 * MediaPicker - Upload or select images from media library
	 * 
	 * Dropdown panel with upload section and library grid
	 */


	export let isOpen: boolean = false;
	export let onSelect: (media: { url: string; width?: number; height?: number; alt?: string }) => void;
	export let onClose: () => void;

	type Media = {
		id: string;
		filename: string;
		url: string;
		mimeType: string;
		size: number;
		width?: number;
		height?: number;
		altText?: string;
	};

	let media: Media[] = [];
	let isLoading = true;
	let isUploading = false;
	let error = '';
	let selectedFile: File | null = null;
	let uploadInput: HTMLInputElement;
	let selectedMedia: Media | null = null;
	let showPreview = false;

	$: if (isOpen) {
		loadMedia();
	}

	async function loadMedia() {
		const token = localStorage.getItem('accessToken');
		if (!token) {
			error = 'Not authenticated';
			isLoading = false;
			return;
		}

		try {
			const response = await fetch('/api/media?type=image/', {
				headers: { Authorization: `Bearer ${token}` }
			});

			if (!response.ok) throw new Error('Failed to load media');

			const data = await response.json();
			media = data.media;
		} catch (err) {
			error = 'Failed to load media';
			console.error('Load media error:', err);
		} finally {
			isLoading = false;
		}
	}

	function handleFileSelect(e: Event) {
		const input = e.target as HTMLInputElement;
		if (input.files && input.files.length > 0) {
			selectedFile = input.files[0];
		}
	}

	async function handleUpload() {
		if (!selectedFile) return;

		const token = localStorage.getItem('accessToken');
		isUploading = true;
		error = '';

		try {
			const formData = new FormData();
			formData.append('file', selectedFile);

			const response = await fetch('/api/media/upload', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
				body: formData
			});

			if (!response.ok) {
				const data = await response.json();
				error = data.error || `Upload failed (${response.status})`;
				console.error('Upload error:', data);
				return;
			}

			const data = await response.json();
			
			// Auto-select uploaded image
			onSelect({
				url: data.media.url,
				width: data.media.width,
				height: data.media.height,
				alt: data.media.altText || data.media.filename
			});

			// Close modal
			handleClose();
		} catch (err) {
			error = 'Upload failed';
			console.error('Upload exception:', err);
		} finally {
			isUploading = false;
		}
	}

	function handleSelectMedia(item: Media) {
		selectedMedia = item;
		showPreview = true;
	}

	function handleConfirm() {
		if (selectedMedia) {
			onSelect({
				url: selectedMedia.url,
				width: selectedMedia.width,
				height: selectedMedia.height,
				alt: selectedMedia.altText || selectedMedia.filename
			});
			handleCancel();
		}
	}

	function handleCancel() {
		selectedMedia = null;
		showPreview = false;
		selectedFile = null;
		if (uploadInput) uploadInput.value = '';
	}

	function handleClose() {
		handleCancel();
		onClose();
	}
</script>

{#if isOpen}
	<!-- svelte-ignore a11y-click-events-have-key-events -->
	<!-- svelte-ignore a11y-no-static-element-interactions -->
	<div class="media-picker-overlay" on:click={handleClose} role="presentation">
		<!-- svelte-ignore a11y-no-noninteractive-element-interactions -->
		<div class="media-picker-panel" on:click|stopPropagation role="dialog" aria-label="Media picker" tabindex="-1">
			{#if showPreview && selectedMedia}
				<!-- Preview section -->
				<div class="preview-section">
					<h3>Preview</h3>
					<div class="preview-image">
						<img src={selectedMedia.url} alt={selectedMedia.altText || selectedMedia.filename} />
					</div>
					<div class="preview-info">
						<p class="filename">{selectedMedia.filename}</p>
						{#if selectedMedia.width && selectedMedia.height}
							<p class="dimensions">{selectedMedia.width} × {selectedMedia.height}</p>
						{/if}
					</div>
					<div class="preview-actions">
						<button class="button-confirm" on:click={handleConfirm}>Use this image</button>
						<button class="button-cancel" on:click={handleCancel}>Cancel</button>
					</div>
				</div>
			{:else}
				<!-- Upload section -->
				<div class="upload-section">
					<h3>Upload Image</h3>
					<div class="upload-controls">
						<input
							type="file"
							accept="image/*"
							bind:this={uploadInput}
							on:change={handleFileSelect}
							class="file-input"
						/>
						{#if selectedFile}
							<p class="selected-file">{selectedFile.name}</p>
						{/if}
						<button
							class="button-upload"
							on:click={handleUpload}
							disabled={!selectedFile || isUploading}
						>
							{isUploading ? 'Uploading...' : 'Upload'}
						</button>
					</div>
				</div>

				<!-- Library section -->
				<div class="library-section">
					<h3>Media Library</h3>
					{#if error}
						<p class="error-message">{error}</p>
					{/if}
					{#if isLoading}
						<p class="loading-message">Loading...</p>
					{:else if media.length === 0}
						<p class="empty-message">No images in library</p>
					{:else}
						<div class="media-grid">
							{#each media as item (item.id)}
								<button
									class="media-item"
									on:click={() => handleSelectMedia(item)}
								>
									<img src={item.url} alt={item.altText || item.filename} />
									<span class="media-filename">{item.filename}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>

				<div class="picker-actions">
					<button class="button-close" on:click={handleClose}>Close</button>
				</div>
			{/if}
		</div>
	</div>
{/if}

<style>
	.media-picker-overlay {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background: rgba(0, 0, 0, 0.5);
		z-index: 2000;
		display: flex;
		align-items: center;
		justify-content: center;
	}

	.media-picker-panel {
		background: white;
		border-radius: 8px;
		max-width: 800px;
		max-height: 80vh;
		overflow-y: auto;
		padding: 20px;
	}

	.upload-section,
	.library-section,
	.preview-section {
		margin-bottom: 20px;
	}

	h3 {
		margin: 0 0 10px 0;
		font-size: 14px;
		font-weight: 600;
	}

	.upload-controls {
		display: flex;
		flex-direction: column;
		gap: 10px;
	}

	.file-input {
		padding: 8px;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.selected-file {
		font-size: 12px;
		color: #666;
		margin: 0;
	}

	.button-upload,
	.button-confirm,
	.button-cancel,
	.button-close {
		padding: 8px 16px;
		border: 1px solid #ddd;
		border-radius: 4px;
		background: white;
		cursor: pointer;
	}

	.button-upload:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}

	.button-confirm {
		background: #3b82f6;
		color: white;
		border-color: #3b82f6;
	}

	.media-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 10px;
	}

	.media-item {
		border: 2px solid #ddd;
		border-radius: 4px;
		padding: 8px;
		cursor: pointer;
		background: white;
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.media-item:hover {
		border-color: #3b82f6;
	}

	.media-item img {
		width: 100%;
		height: 100px;
		object-fit: cover;
		border-radius: 4px;
	}

	.media-filename {
		font-size: 11px;
		color: #666;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview-section {
		text-align: center;
	}

	.preview-image {
		margin: 20px 0;
	}

	.preview-image img {
		max-width: 100%;
		max-height: 400px;
		border: 1px solid #ddd;
		border-radius: 4px;
	}

	.preview-info {
		margin-bottom: 20px;
	}

	.filename {
		font-weight: 600;
		margin: 0 0 4px 0;
	}

	.dimensions {
		font-size: 12px;
		color: #666;
		margin: 0;
	}

	.preview-actions {
		display: flex;
		gap: 10px;
		justify-content: center;
	}

	.picker-actions {
		display: flex;
		justify-content: flex-end;
		margin-top: 20px;
	}

	.error-message,
	.loading-message,
	.empty-message {
		padding: 20px;
		text-align: center;
		color: #666;
	}

	.error-message {
		color: #dc2626;
	}
</style>

