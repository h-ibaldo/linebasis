<script lang="ts">
	import { goto } from '$app/navigation';

	// Form state
	let name = '';
	let email = '';
	let password = '';
	let passwordConfirm = '';
	let isLoading = false;
	let error = '';

	async function handleSubmit() {
		// Clear previous error
		error = '';

		// Validate input
		if (!name || !email || !password || !passwordConfirm) {
			error = 'Please fill in all fields';
			return;
		}

		if (password !== passwordConfirm) {
			error = 'Passwords do not match';
			return;
		}

		if (password.length < 8) {
			error = 'Password must be at least 8 characters';
			return;
		}

		isLoading = true;

		try {
			const response = await fetch('/api/auth/register', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ name, email, password })
			});

			const data = await response.json();

			if (!response.ok) {
				error = data.error || 'Registration failed';
				return;
			}

			// Store tokens in localStorage
			localStorage.setItem('accessToken', data.accessToken);
			localStorage.setItem('refreshToken', data.refreshToken);

			// Redirect to dashboard
			goto('/admin');
		} catch (err) {
			error = 'Network error. Please try again.';
			console.error('Registration error:', err);
		} finally {
			isLoading = false;
		}
	}
</script>

<!-- STYLE: Main register page - full viewport height, centered content -->
<main class="register-page">
	<!-- STYLE: Register container - centered card/box on page -->
	<div class="register-container">
		<!-- STYLE: Logo/branding area - your Linabasis branding -->
		<div class="register-header">
			<h1 class="register-title">Linabasis</h1>
			<p class="register-subtitle">Create your account</p>
		</div>

		<!-- STYLE: Form card - white background, shadow, rounded corners -->
		<form class="register-form" on:submit|preventDefault={handleSubmit}>
			<!-- STYLE: Error message - red background, visible when error exists -->
			{#if error}
				<div class="form-error" role="alert">
					<p>{error}</p>
				</div>
			{/if}

			<!-- STYLE: Form field group - name input with label -->
			<div class="form-group">
				<label for="name" class="form-label">Full name</label>
				<input
					type="text"
					id="name"
					class="form-input"
					placeholder="John Doe"
					bind:value={name}
					disabled={isLoading}
					required
					autocomplete="name"
				/>
			</div>

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
					autocomplete="new-password"
				/>
				<p class="form-hint">Must be at least 8 characters</p>
			</div>

			<!-- STYLE: Form field group - password confirmation input -->
			<div class="form-group">
				<label for="password-confirm" class="form-label">Confirm password</label>
				<input
					type="password"
					id="password-confirm"
					class="form-input"
					placeholder="••••••••"
					bind:value={passwordConfirm}
					disabled={isLoading}
					required
					autocomplete="new-password"
				/>
			</div>

			<!-- STYLE: Submit button - primary brand color, full width -->
			<button type="submit" class="button-primary" disabled={isLoading}>
				{isLoading ? 'Creating account...' : 'Create account'}
			</button>
		</form>

		<!-- STYLE: Footer section - login link -->
		<div class="register-footer">
			<p class="footer-text">
				Already have an account?
				<a href="/admin/login" class="link-login">Sign in</a>
			</p>
		</div>
	</div>
</main>

<!--
  NO STYLES - Ready for Ibaldo's design!

  Styling areas marked above with STYLE comments
  All class names are semantic and ready for CSS

  Functionality included:
  ✅ Name/email/password validation
  ✅ Password confirmation matching
  ✅ Password strength check (8 chars minimum)
  ✅ API registration call
  ✅ Error handling and display
  ✅ Loading states
  ✅ Token storage
  ✅ Redirect after registration
  ✅ Accessible markup (labels, ARIA, keyboard nav)
-->
