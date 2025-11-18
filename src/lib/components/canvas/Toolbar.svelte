<script lang="ts">
	/**
	 * Toolbar - Top toolbar with tool selector and component tools
	 *
	 * Layout:
	 * - Left: Tool selector (Move/Hand/Scale) + Component tools (Div/Text/Media)
	 * - Middle: Undo/Redo + Zoom + Page selector
	 * - Right: Save/Preview/Publish
	 */

	import { currentTool, type Tool } from '$lib/stores/tool-store';
	import { undo, redo } from '$lib/stores/design-store';

	function selectTool(tool: Tool) {
		currentTool.set(tool);
	}

	function handleUndo() {
		undo();
	}

	function handleRedo() {
		redo();
	}
</script>

<!-- Top Toolbar - Fixed at top of viewport -->
<div class="toolbar">
	<!-- Left Section: Tools -->
	<div class="toolbar-left">
		<!-- Tool Selector Dropdown -->
		<select bind:value={$currentTool} class="tool-selector">
			<option value="move">Move</option>
			<option value="hand">Hand</option>
			<option value="scale">Scale</option>
		</select>

		<!-- Component Tools -->
		<button
			on:click={() => selectTool('div')}
			class="tool-btn"
			class:active={$currentTool === 'div'}
			title="Div (Container)"
		>
			Div
		</button>
		<button
			on:click={() => selectTool('text')}
			class="tool-btn"
			class:active={$currentTool === 'text'}
			title="Text"
		>
			Text
		</button>
		<button
			on:click={() => selectTool('media')}
			class="tool-btn"
			class:active={$currentTool === 'media'}
			title="Media (Image/Video)"
		>
			Media
		</button>
	</div>

	<!-- Middle Section: Canvas Controls -->
	<div class="toolbar-middle">
		<button class="tool-btn" on:click={handleUndo} title="Undo (Cmd+Z)">↶</button>
		<button class="tool-btn" on:click={handleRedo} title="Redo (Cmd+Shift+Z)">↷</button>
		<span class="separator"></span>
		<select class="zoom-selector">
			<option>100%</option>
			<option>75%</option>
			<option>50%</option>
			<option>25%</option>
			<option>125%</option>
			<option>150%</option>
			<option>200%</option>
		</select>
	</div>

	<!-- Right Section: Actions -->
	<div class="toolbar-right">
		<span class="save-status">Saved</span>
		<button class="tool-btn">Preview</button>
		<button class="tool-btn primary">Publish</button>
	</div>
</div>

<style>
	/* Top Toolbar - Fixed at top */
	.toolbar {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		height: 60px;
		background: white;
		border-bottom: 1px solid #e5e7eb;
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding: 0 16px;
		z-index: 1000;
		gap: 24px;
	}

	/* Sections */
	.toolbar-left,
	.toolbar-middle,
	.toolbar-right {
		display: flex;
		align-items: center;
		gap: 8px;
	}

	.toolbar-middle {
		flex: 1;
		justify-content: center;
	}

	/* Tool Selector Dropdown */
	.tool-selector {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: white;
		font-size: 14px;
		cursor: pointer;
		min-width: 100px;
	}

	.tool-selector:hover {
		border-color: #9ca3af;
	}

	.tool-selector:focus {
		outline: none;
		border-color: #3b82f6;
		box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
	}

	/* Tool Buttons */
	.tool-btn {
		padding: 8px 16px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: white;
		font-size: 14px;
		cursor: pointer;
		transition: all 0.15s;
	}

	.tool-btn:hover {
		background: #f3f4f6;
		border-color: #9ca3af;
	}

	.tool-btn.active {
		background: #3b82f6;
		color: white;
		border-color: #3b82f6;
	}

	.tool-btn.primary {
		background: #3b82f6;
		color: white;
		border-color: #3b82f6;
	}

	.tool-btn.primary:hover {
		background: #2563eb;
	}

	/* Zoom Selector */
	.zoom-selector {
		padding: 8px 12px;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		background: white;
		font-size: 14px;
		cursor: pointer;
		min-width: 80px;
	}

	/* Save Status */
	.save-status {
		font-size: 14px;
		color: #6b7280;
		padding: 0 8px;
	}

	/* Separator */
	.separator {
		width: 1px;
		height: 24px;
		background: #e5e7eb;
		margin: 0 4px;
	}
</style>
