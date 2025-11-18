<script lang="ts">
	/**
	 * BaselineGrid - Typography baseline grid overlay
	 *
	 * Displays a visual grid to help align text to a baseline rhythm.
	 * Based on design system baseline settings.
	 */

	import { onMount } from 'svelte';

	// Default baseline settings (can be fetched from design tokens)
	export let baseline = 8; // 8px baseline grid
	export let color = 'rgba(0, 150, 255, 0.1)'; // Light blue overlay
	export let enabled = true;

	let canvasElement: HTMLCanvasElement;
	let context: CanvasRenderingContext2D | null;

	onMount(() => {
		if (!canvasElement) return;

		context = canvasElement.getContext('2d');
		if (!context) return;

		// Set canvas size to match page
		const parent = canvasElement.parentElement;
		if (parent) {
			canvasElement.width = parent.clientWidth;
			canvasElement.height = parent.clientHeight;
		}

		drawGrid();
	});

	function drawGrid() {
		if (!context || !canvasElement || !enabled) return;

		const width = canvasElement.width;
		const height = canvasElement.height;

		context.clearRect(0, 0, width, height);
		context.strokeStyle = color;
		context.lineWidth = 1;

		// Draw horizontal baseline lines
		for (let y = 0; y < height; y += baseline) {
			context.beginPath();
			context.moveTo(0, y);
			context.lineTo(width, y);
			context.stroke();
		}
	}

	// Redraw when settings change
	$: if (context) {
		drawGrid();
	}
</script>

<!-- STYLE: Baseline grid canvas - absolutely positioned overlay, pointer events disabled -->
{#if enabled}
	<canvas
		bind:this={canvasElement}
		class="baseline-grid"
		style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none; z-index: 1;"
	></canvas>
{/if}

<style>
	.baseline-grid {
		position: absolute;
		top: 0;
		left: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
		z-index: 1;
	}
</style>
