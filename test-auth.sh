#!/bin/bash

# Linabasis Auth API Test Script
# Tests the authentication endpoints

BASE_URL="http://localhost:5173"
echo "Testing Linabasis Auth API at $BASE_URL"
echo "========================================="
echo ""

# Test 1: Register a new user
echo "1. Testing POST /api/auth/register..."
REGISTER_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/register" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "name": "Test User"
  }')

echo "Response: $REGISTER_RESPONSE"
echo ""

# Extract tokens from registration response
ACCESS_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
REFRESH_TOKEN=$(echo $REGISTER_RESPONSE | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Registration failed or user already exists"
  echo "Trying to login instead..."
  echo ""

  # Test 2: Login with existing user
  echo "2. Testing POST /api/auth/login..."
  LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
    -H "Content-Type: application/json" \
    -d '{
      "email": "test@example.com",
      "password": "password123"
    }')

  echo "Response: $LOGIN_RESPONSE"
  echo ""

  ACCESS_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)
  REFRESH_TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"refreshToken":"[^"]*' | cut -d'"' -f4)
fi

if [ -z "$ACCESS_TOKEN" ]; then
  echo "❌ Failed to get access token. Exiting."
  exit 1
fi

echo "✅ Got access token: ${ACCESS_TOKEN:0:20}..."
echo "✅ Got refresh token: ${REFRESH_TOKEN:0:20}..."
echo ""

# Test 3: Get current user info (authenticated)
echo "3. Testing GET /api/auth/me (with auth)..."
ME_RESPONSE=$(curl -s -X GET "$BASE_URL/api/auth/me" \
  -H "Authorization: Bearer $ACCESS_TOKEN")

echo "Response: $ME_RESPONSE"
echo ""

# Test 4: Refresh token
echo "4. Testing POST /api/auth/refresh..."
REFRESH_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "Response: $REFRESH_RESPONSE"
echo ""

NEW_ACCESS_TOKEN=$(echo $REFRESH_RESPONSE | grep -o '"accessToken":"[^"]*' | cut -d'"' -f4)

if [ ! -z "$NEW_ACCESS_TOKEN" ]; then
  echo "✅ Got new access token: ${NEW_ACCESS_TOKEN:0:20}..."
  echo ""
fi

# Test 5: Logout
echo "5. Testing POST /api/auth/logout..."
LOGOUT_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/logout" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "Response: $LOGOUT_RESPONSE"
echo ""

# Test 6: Try to use logged out refresh token (should fail)
echo "6. Testing refresh with logged out token (should fail)..."
FAIL_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/refresh" \
  -H "Content-Type: application/json" \
  -d "{
    \"refreshToken\": \"$REFRESH_TOKEN\"
  }")

echo "Response: $FAIL_RESPONSE"
echo ""

if echo $FAIL_RESPONSE | grep -q "error"; then
  echo "✅ Correctly rejected logged out token"
else
  echo "❌ Should have rejected the token"
fi

echo ""
echo "========================================="
echo "Auth API tests complete!"
