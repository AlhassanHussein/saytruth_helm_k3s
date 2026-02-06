# Guest User Mode - Step by Step Testing Guide

## Prerequisites:
- Frontend Docker image built: ✅ `saytruth-frontend:latest`
- Need to import to K3s and restart pods
- Access URL: http://192.168.1.130/

---

## 📋 DEPLOYMENT STEPS (Run These First):

### Step 1: Import Image to K3s
```bash
# This requires sudo password
docker save saytruth-frontend:latest | sudo k3s ctr images import -
```

### Step 2: Restart Frontend Pods
```bash
kubectl rollout restart deployment frontend -n saytruth-dev
```

### Step 3: Wait for Pods
```bash
kubectl wait --for=condition=ready pod -l app=frontend -n saytruth-dev --timeout=60s
```

### Step 4: Verify Pods Running
```bash
kubectl get pods -n saytruth-dev
# All pods should show 1/1 Running
```

---

## 🧪 TESTING CHECKLIST

### Test 1: Default Route → Links Tab ✅

**Steps:**
1. Open browser
2. Go to `http://192.168.1.130/`
3. Observe which tab is active

**Expected:**
- ✅ **Links tab** should be active/highlighted
- ✅ Should NOT be on home tab

**Pass Criteria:** Links tab is the active tab when opening the app

---

### Test 2: Guest Can Only Create 6h/12h Links ✅

**Steps:**
1. Make sure you're NOT logged in (guest mode)
2. Go to Links tab
3. Look at "Link Duration" dropdown

**Expected:**
- ✅ Dropdown should ONLY show: **6 hours**, **12 hours**
- ✅ Should NOT show: 24 hours, 7 days, 30 days
- ✅ Default selection should be **12 hours**

**Pass Criteria:** Guest sees only 2 options (6h, 12h), default is 12h

---

### Test 3: Create Link as Guest ✅

**Steps:**
1. As guest (not logged in)
2. Enter a display name (e.g., "Test Guest Link")
3. Select duration: **12 hours**
4. Click "Create Link"

**Expected:**
- ✅ Link created successfully
- ✅ Shows **Public Link** URL (for sending)
- ✅ Shows **Private Link** URL (for viewing messages)
- ✅ Can copy both URLs

**Pass Criteria:** Link created with both public and private URLs displayed

---

### Test 4: Send Message to Public Link ✅

**Steps:**
1. Copy the **Public Link** URL from previous test
2. Open a **new browser tab** (or incognito)
3. Paste the public link URL
4. Type a message (e.g., "Hello from guest!")
5. Click "Send Message"

**Expected:**
- ✅ Message sent successfully
- ✅ Shows confirmation message
- ✅ NO login required

**Pass Criteria:** Message sends without authentication

---

### Test 5: View Messages on Private Link 🔍

**Steps:**
1. Copy the **Private Link** URL
2. Open in new tab
3. **IMPORTANT:** Open browser console (F12 → Console tab)
4. Check for debug logs
5. Look for received messages

**Expected in Console:**
```
Private link data received: {messages: Array(1), display_name: "Test Guest Link", ...}
Messages array: [{...}] Length: 1
```

**Expected on Page:**
- ✅ Shows link info (display name, expiration countdown)
- ✅ Shows **Inbox (1)** or number of messages
- ✅ Message content is visible
- ✅ Shows message timestamp (e.g., "2 minutes ago")
- ✅ Delete button present

**⚠️ If Messages Don't Show:**
Check console for errors:
- Look for network errors (404, 500, CORS)
- Check API response structure
- Verify `/api/links/{private_id}/messages` returns data

**Pass Criteria:** Messages visible on private link page

---

### Test 6: Search Users as Guest ✅

**Steps:**
1. Go to **Search** tab (bottom navigation)
2. Type a username in search box
3. Click search or press Enter

**Expected:**
- ✅ Can search without login
- ✅ Shows search results
- ✅ Can view user profiles
- ✅ Can send anonymous message to users (one at a time)

**Pass Criteria:** Search works, can view users without login

---

### Test 7: Bad URL Redirects to Links ✅

**Steps:**
1. Go to: `http://192.168.1.130/totally-invalid-url-123`
2. Observe where you end up

**Expected:**
- ✅ Automatically redirects to `http://192.168.1.130/links`
- ✅ Shows Links tab

**Pass Criteria:** Bad URL redirects to Links tab

---

### Test 8: Login → Redirects to Links ✅

**Steps:**
1. Click Login button
2. Enter credentials and login
3. Observe where you land after successful login

**Expected:**
- ✅ After login, automatically goes to **Links tab**
- ✅ NOT home tab

**Pass Criteria:** Post-login redirect goes to Links

---

### Test 9: Signup → Redirects to Links ✅

**Steps:**
1. Click Signup
2. Create new account
3. Complete signup
4. Observe redirect

**Expected:**
- ✅ After signup, goes to **Links tab**
- ✅ NOT home tab

**Pass Criteria:** Post-signup redirect goes to Links

---

### Test 10: Logged-In User Sees More Options ✅

**Steps:**
1. Make sure you're logged in
2. Go to Links tab
3. Look at "Link Duration" dropdown

**Expected:**
- ✅ Dropdown shows: **6h, 12h, 24h, 7 days, 30 days**
- ✅ All 5 options visible
- ✅ Can select any option

**Pass Criteria:** Logged-in users see all duration options

---

### Test 11: Logged-In User Links Are Saved ✅

**Steps:**
1. As logged-in user, create a link
2. Navigate away (go to Search tab)
3. Come back to Links tab

**Expected:**
- ✅ Previously created links still visible
- ✅ Shows link history
- ✅ Can see all your links

**Pass Criteria:** Links persist for logged-in users

---

## 🐛 DEBUGGING GUIDE

### If Private Link Messages Don't Load:

**Open Browser Console (F12):**

1. **Check for logs:**
   ```
   Private link data received: {messages: [...], ...}
   Messages array: [...] Length: X
   ```

2. **If you see Network Error:**
   - Check Network tab (F12 → Network)
   - Look for `/api/links/{private_id}/messages` request
   - Check status code (should be 200)
   - Check response body

3. **Common Issues:**
   - **404 Error:** Link not found or expired
   - **500 Error:** Backend error (check backend logs)
   - **CORS Error:** Kong routing issue
   - **Empty messages array:** No messages sent yet

4. **Check Backend Logs:**
   ```bash
   kubectl logs -f deployment/backend -n saytruth-dev
   ```

---

## 📊 FINAL VERIFICATION

### Guest User Checklist:
- [ ] Only sees 6h/12h duration options ✅
- [ ] Default is 12h ✅
- [ ] Can create links ✅
- [ ] Can send messages to public links ✅
- [ ] Can view messages on private link ✅
- [ ] Can search users ✅
- [ ] Can view user profiles ✅

### Navigation Checklist:
- [ ] App opens to Links tab ✅
- [ ] Bad URLs redirect to Links ✅
- [ ] Login redirects to Links ✅
- [ ] Signup redirects to Links ✅

### Logged-In User Checklist:
- [ ] Sees all 5 duration options ✅
- [ ] Links are saved ✅
- [ ] Can view link history ✅

---

## 🎯 SUCCESS CRITERIA

**All tests pass = Guest user mode working correctly!**

### Key Points Verified:
1. ✅ Guests restricted to 6h/12h only
2. ✅ Default route is Links (not Home)
3. ✅ Login/Signup navigate to Links
4. ✅ Bad URLs redirect to Links
5. ✅ Private link messages load (with debugging)
6. ✅ Logged-in users get more options

---

## 📞 REPORT RESULTS

After testing, report:

1. **Which tests passed:** ✅
2. **Which tests failed:** ❌
3. **Console errors (if any):**
4. **Screenshots (if issues found):**

This will help identify any remaining issues!
