# Changes Summary - Guest User Mode Fixes

## Date: February 6, 2026

## Changes Made:

### 1. ✅ Fixed Guest Duration Options
**File:** `frontend/src/components/LinksTab.jsx`
**Line 25:**
```javascript
// BEFORE:
const guestExpirations = ['6h', '12h', '24h'];

// AFTER:
const guestExpirations = ['6h', '12h'];  // ✅ ONLY 6h and 12h for guests
```

**Line 13:**
```javascript
// BEFORE:
const [expiration, setExpiration] = useState('24h');

// AFTER:
const [expiration, setExpiration] = useState('12h');  // ✅ Safe default for both guests and logged-in users
```

---

### 2. ✅ Changed Default Route to Links Tab
**File:** `frontend/src/App.jsx`

**Changed all default redirects from `/home` to `/links`:**

1. **After Login:**
   ```javascript
   // Line ~185
   const handleLoginSuccess = () => {
       navigate('/links');  // Was /home
   };
   ```

2. **After Signup:**
   ```javascript
   // Line ~190
   const handleSignupSuccess = () => {
       navigate('/links');  // Was /home
   };
   ```

3. **After Password Recovery:**
   ```javascript
   // Line ~195
   const handleRecoverySuccess = () => {
       navigate('/links');  // Was /home
   };
   ```

4. **Default Route (opening app or bad URL):**
   ```javascript
   // Lines ~335-336
   <Route path="/" element={<Navigate to="/links" replace />} />
   <Route path="*" element={<Navigate to="/links" replace />} />
   ```

5. **Active Tab Detection:**
   ```javascript
   // Lines ~71-79
   const getActiveTabFromPath = () => {
       const path = location.pathname;
       if (path === '/' || path === '/home') return 'links';  // Changed from 'home'
       // ... rest
       return 'links';  // Changed default from 'home'
   };
   ```

6. **Back Buttons in Link Pages:**
   ```javascript
   // Lines ~27-32 and ~36-41
   // Both PublicLinkPageWrapper and PrivateLinkPageWrapper now navigate to '/links'
   <button onClick={() => navigate('/links')}>  // Was /home
     ← Back To Links  // Updated text
   </button>
   ```

---

### 3. ✅ Enhanced Private Link Message Loading Debugging
**File:** `frontend/src/components/PrivateLinkPage.jsx`

**Added console logging to diagnose message loading issues:**
```javascript
// Lines ~88-103
useEffect(() => {
  const fetchMessages = async () => {
    try {
      setLoading(true);
      const data = await linksAPI.getLinkMessages(privateId);
      console.log('Private link data received:', data);  // ✅ NEW
      
      const messagesList = data?.messages || [];
      console.log('Messages array:', messagesList, 'Length:', messagesList.length);  // ✅ NEW
      setMessages(messagesList);
      setExpiresAt(data?.expires_at || null);
    } catch (err) {
      setError(t.error || 'Failed to load messages');  // ✅ Better error message
      console.error('Failed to load messages:', err);
      console.error('Error details:', err.message, err.response);  // ✅ NEW
    } finally {
      setLoading(false);
    }
  };
  
  fetchMessages();
}, [privateId, t]);
```

---

## What Was NOT Changed (Already Correct):

1. ✅ **Backend API** - Already supports guest users with `get_current_user_optional`
2. ✅ **Kong Configuration** - Already routing correctly, NOT blocking guests
3. ✅ **Message Encryption** - Already encrypting/decrypting properly
4. ✅ **Link Creation Flow** - Already working for both guests and logged-in users
5. ✅ **Search Functionality** - Already accessible to guests

---

## Files Modified:

1. `frontend/src/components/LinksTab.jsx` - Guest duration options (removed 24h), default to 12h
2. `frontend/src/App.jsx` - Default routes changed to /links, navigation after auth
3. `frontend/src/components/PrivateLinkPage.jsx` - Added debugging for message loading

---

## Next Steps to Complete:

### 🔄 Deploy Updated Frontend:

```bash
# 1. Frontend is already built (npm run build completed)
# 2. Docker image is built: saytruth-frontend:latest
# 3. Need to import to K3s (requires sudo password):
docker save saytruth-frontend:latest | sudo k3s ctr images import -

# 4. Restart frontend pods to use new image:
kubectl rollout restart deployment frontend -n saytruth-dev

# 5. Wait for new pods to be ready:
kubectl wait --for=condition=ready pod -l app=frontend -n saytruth-dev --timeout=60s

# 6. Check pods are running:
kubectl get pods -n saytruth-dev
```

### ✅ Test Guest User Mode:

1. **Open Application:**
   - Go to http://192.168.1.130/
   - Should automatically show **Links Tab** (not home)

2. **Create Link (Guest):**
   - Should only see **6h** and **12h** options (NOT 24h)
   - Default should be **12h** selected
   - Create a link
   - Copy public and private URLs

3. **Send Message to Public Link:**
   - Open public link in another browser/tab
   - Send a message
   - Should work without login

4. **View Messages on Private Link:**
   - Open private link
   - **Check browser console** for debug logs:
     - "Private link data received: ..."
     - "Messages array: ... Length: X"
   - Messages should display

5. **Search Users:**
   - Go to Search tab
   - Search for a user
   - Should work as guest

6. **Test Login/Signup Navigation:**
   - Sign up or login
   - Should redirect to **/links** (not /home)

7. **Test Bad URL:**
   - Go to http://192.168.1.130/invalid-url
   - Should redirect to **/links**

---

## Verification Checklist:

### Guest Mode:
- [ ] Only sees 6h/12h duration options (NO 24h)
- [ ] Default is 12h when creating link
- [ ] Can create links without login
- [ ] Can search users
- [ ] Can send messages to public links
- [ ] Can view messages on private link (check console logs if not showing)

### Navigation:
- [ ] Opening app shows Links tab
- [ ] Bad URLs redirect to Links tab
- [ ] After login → Links tab
- [ ] After signup → Links tab
- [ ] After password recovery → Links tab

### Logged-In Mode:
- [ ] Sees all duration options: 6h, 12h, 24h, 7d, 30d
- [ ] Links are saved and visible in Links tab
- [ ] Can view link history

---

## Debugging Private Link Messages:

If messages don't load on private link, check browser console (F12):

**Expected logs:**
```
Private link data received: {messages: Array(X), display_name: "...", expires_at: "...", status: "active"}
Messages array: [{...}, {...}] Length: X
```

**If you see errors:**
```
Failed to load messages: Error: ...
Error details: ... 
```

This will help diagnose:
- Network issues (CORS, 404, 500)
- API response format issues
- Authentication problems

---

## Summary:

✅ **3 files modified**
✅ **Guest duration fixed** (only 6h/12h)
✅ **Default duration safe** (12h for all)
✅ **Default route is Links** (not home)
✅ **Debugging added** for private link messages
✅ **Frontend built and Docker image created**

⏳ **Waiting for:** Sudo password to import image to K3s, then restart pods

🎯 **Ready to test** after deployment!
