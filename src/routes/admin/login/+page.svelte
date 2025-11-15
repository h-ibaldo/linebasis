<script lang="ts">
	import { goto } from '$app/navigation';

	// Form state
	let email = '';
	let password = '';
	let isLoading = false;
	let error = '';

	async function handleSubmit() {
		// Clear previous error
		error = '';

		// Validate input
		if (!email || !password) {
			error = 'Please enter both email and password';
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/auth/login', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ email, password })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Login failed';
				return;
			}

			// Store tokens in localStorage (temporary - will move to httpOnly cookies later)
			localStorage.setItem('accessToken', data.accessToken);
			localStorage.setItem('refreshToken', data.refreshToken);

			// Redirect to dashboard
			goto('/admin');
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Login error:', err);
		} finally {
			isLoading = false;
		}
	}
</script>

<!-- STYLE: Main login page - full viewport height, centered content -->
<main class="login-page">
	<!-- STYLE: Login container - centered card/box on page -->
	<div class="login-container">
		<!-- STYLE: Logo/branding area - your Linabasis branding -->
		<div class="login-header">
			<h1 class="login-title">Linabasis</h1>
			<p class="login-subtitle">Sign in to your account</p>
		</div>

		<!-- STYLE: Form card - white background, shadow, rounded corners -->
		<form class="login-form" on:submit|preventDefault={handleSubmit}>
			<!-- STYLE: Error message - red background, visible when error exists -->
			{#if error}
				<div class="form-error" role="alert">
					<p>{error}</p>
				</div>
			{/if}

			<!-- STYLE: Form field group - email input with label -->
			<div class="form-group">
				<label for="email" class="form-label">Email address</label>
				<input
					type="email"
					id="email"
					class="form-input"
					placeholder="you@example.com"
					bind:value={email}
					disabled={isLoading}
					required
					autocomplete="email"
				/>
			</div>

			<!-- STYLE: Form field group - password input with label -->
			<div class="form-group">
				<label for="password" class="form-label">Password</label>
				<input
					type="password"
					id="password"
					class="form-input"
					placeholder="••••••••"
					bind:value={password}
					disabled={isLoading}
					required
					autocomplete="current-password"
				/>
			</div>

			<!-- STYLE: Additional options row - remember me, forgot password -->
			<div class="form-options">
				<label class="checkbox-label">
					<input type="checkbox" class="form-checkbox" />
					<span>Remember me</span>
				</label>
				<a href="/admin/forgot-password" class="link-forgot-password">Forgot password?</a>
			</div>

			<!-- STYLE: Submit button - primary brand color, full width -->
			<button type="submit" class="button-primary" disabled={isLoading}>
				{isLoading ? 'Signing in...' : 'Sign in'}
			</button>
		</form>

		<!-- STYLE: Footer section - register link, help text -->
		<div class="login-footer">
			<p class="footer-text">
				Don't have an account?
				<a href="/admin/register" class="link-register">Create one</a>
			</p>
		</div>
	</div>
</main>

<!--
  NO STYLES - Ready for Ibaldo's design!

  Styling areas marked above with STYLE comments
  All class names are semantic and ready for CSS

  Functionality included:
  ✅ Email/password validation
  ✅ API authentication call
  ✅ Error handling and display
  ✅ Loading states
  ✅ Token storage
  ✅ Redirect after login
  ✅ Accessible markup (labels, ARIA, keyboard nav)
-->
