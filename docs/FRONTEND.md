# Frontend Architecture - React + Vite

## Overview
The SayTruth frontend is a **React** single-page application (SPA) built with **Vite**. It provides the user interface for the platform, handling authentication, messaging, and social features.

**Technology Stack:**
- **Framework**: React (UI component library)
- **Build Tool**: Vite (fast build tool, hot module replacement)
- **Server**: Vite dev server (development), static build (production)
- **Language**: JavaScript/JSX (HTML-like syntax in JavaScript)
- **HTTP Client**: Fetch API / Axios (communicate with backend)
- **Internationalization**: Custom i18n (multi-language support)

---

## Project Structure

```
frontend/
├── src/
│   ├── main.jsx                # Entry point
│   ├── App.jsx                 # Root component
│   ├── index.css               # Global styles
│   ├── App.css                 # App-level styles
│   │
│   ├── components/             # Reusable UI components
│   │   ├── Header.jsx          # Navigation bar
│   │   ├── BottomNav.jsx       # Mobile bottom navigation
│   │   ├── LoginPage.jsx       # Login form
│   │   ├── SignupPage.jsx      # Signup form
│   │   ├── HomeTab.jsx         # Home feed
│   │   ├── LinksTab.jsx        # Shared links
│   │   ├── MessagesTab.jsx     # Messages
│   │   ├── SearchTab.jsx       # Search functionality
│   │   ├── ProfilePage.jsx     # User profile
│   │   ├── LinkCard.jsx        # Single link component
│   │   ├── UserProfilePage.jsx # Other user's profile
│   │   └── *.css               # Component-specific styles
│   │
│   ├── services/
│   │   └── api.js              # API calls to backend
│   │
│   ├── i18n/
│   │   └── translations.js     # Multi-language strings
│   │
│   └── assets/                 # Images, icons, etc.
│
├── public/                     # Static files (copied as-is)
├── package.json                # Dependencies
├── vite.config.js              # Vite configuration
├── eslint.config.js            # Code linting rules
├── Dockerfile                  # Container image
└── index.html                  # HTML entry point
```

---

## Key Concepts

### 1. **React Components**
Components are reusable UI pieces:

```jsx
// Functional component (modern way)
function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  
  const handleLogin = async () => {
    const response = await fetch("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password })
    });
    const data = await response.json();
    localStorage.setItem("token", data.access_token);
  };
  
  return (
    <div>
      <input 
        value={email} 
        onChange={(e) => setEmail(e.target.value)} 
      />
      <input 
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />
      <button onClick={handleLogin}>Login</button>
    </div>
  );
}
```

**Key terms:**
- **useState**: React hook to manage component state
- **JSX**: HTML-like syntax in JavaScript
- **Props**: Pass data from parent to child components
- **Re-render**: Update UI when state changes

### 2. **services/api.js** - Backend Communication

```javascript
const API_BASE = "http://localhost:8000/api";

export const apiCall = async (endpoint, options = {}) => {
  const token = localStorage.getItem("token");
  
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      ...options.headers
    },
    ...options
  });
  
  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }
  
  return response.json();
};

// Usage in components:
const user = await apiCall("/users/me");
```

**How it works:**
1. Store JWT token from login in `localStorage`
2. Add token to `Authorization` header for all requests
3. Backend validates token and returns data
4. Handle errors gracefully

### 3. **Vite Configuration**

```javascript
// vite.config.js
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',          // Listen on all interfaces
    port: 5173,               // Development port
    allowedHosts: ['localhost', 'frontend-service'],
    hmr: {
      host: 'localhost',
      port: 5173,
      protocol: 'http'        // Hot Module Replacement
    }
  }
});
```

**Key features:**
- **HMR** (Hot Module Replacement): Update code without page reload
- **Fast refresh**: Component state preserved during edits
- **Development server**: Built-in HTTP server with hot reload

### 4. **Authentication Flow**

```
User enters credentials
    ↓
LoginPage calls apiCall("/auth/login", { email, password })
    ↓
Backend validates, creates JWT token
    ↓
Frontend stores token in localStorage
    ↓
Add token to Authorization header in future requests
    ↓
Backend verifies token, returns user data
```

**LocalStorage:**
```javascript
// Store after login
localStorage.setItem("token", data.access_token);

// Retrieve for API calls
const token = localStorage.getItem("token");

// Clear on logout
localStorage.removeItem("token");
```

### 5. **Routing (Tab-based Navigation)**

This project uses tabs (Home, Links, Messages, Profile) instead of URL routing:

```jsx
// App.jsx
const [activeTab, setActiveTab] = useState("home");

return (
  <div>
    <Header />
    {activeTab === "home" && <HomeTab />}
    {activeTab === "links" && <LinksTab />}
    {activeTab === "messages" && <MessagesTab />}
    {activeTab === "profile" && <ProfilePage />}
    <BottomNav activeTab={activeTab} setActiveTab={setActiveTab} />
  </div>
);
```

**Tab-based vs URL routing:**
- **Tab-based**: State changes (faster, no page reload)
- **URL routing**: Changes URL (better bookmarking, browser history)
- Project uses **tab-based** for mobile-first design

### 6. **i18n (Internationalization)**

```javascript
// i18n/translations.js
const translations = {
  en: {
    welcome: "Welcome to SayTruth",
    login: "Login",
    logout: "Logout"
  },
  ar: {
    welcome: "مرحبا بكم في SayTruth",
    login: "تسجيل الدخول",
    logout: "تسجيل الخروج"
  }
};

export const t = (key, lang = "en") => {
  return translations[lang]?.[key] || key;
};
```

---

## Build Process

### Development
```bash
npm install          # Install dependencies
npm run dev          # Start Vite dev server on port 5173
```

**What happens:**
1. Vite starts HTTP server
2. Browser loads `index.html`
3. `main.jsx` initializes React
4. HMR watches for file changes
5. Update component → Hot reload (instant)

### Production
```bash
npm run build        # Create optimized build
```

**What happens:**
1. Bundles all JavaScript files
2. Minifies code (removes whitespace, shortens variable names)
3. Tree-shaking (removes unused code)
4. Creates `dist/` folder with production files
5. Output: Single HTML + JS + CSS files

**Result:**
```
dist/
├── index.html       # Main HTML file
├── assets/
│   ├── main.*.js    # Minified JavaScript
│   └── style.*.css  # Minified styles
```

---

## Connecting to Kong (API Gateway)

### Development (Direct Backend)
```javascript
// Access backend directly
const API_BASE = "http://localhost:8000/api";
```

### Production (Through Kong)
```javascript
// Routes through Kong gateway
const API_BASE = "/api";  // Kong on localhost:80
// Kong routes /api/* → backend:8000
```

**Kong routing:**
```
Browser → Kong (port 80)
             ├─ /api/* → backend:8000
             └─ /* → frontend:5173
```

### How Kong helps:
- Single entry point for all requests
- TLS/HTTPS termination
- Rate limiting
- Authentication policies
- Load balancing

---

## CSS & Styling

Each component has its own CSS file:

```css
/* components/LoginPage.css */
.login-container {
  max-width: 400px;
  margin: 0 auto;
  padding: 20px;
}

.login-input {
  width: 100%;
  padding: 10px;
  margin: 10px 0;
  border: 1px solid #ddd;
}

.login-button {
  background-color: #007bff;
  color: white;
  padding: 10px 20px;
  border: none;
  cursor: pointer;
}
```

**Best practice:**
- One CSS file per component
- Use component name as prefix (`.LoginPage-`)
- Avoid global styles to prevent conflicts

---

## Common Errors & Debugging

### Error: "Cannot find module 'react'"
- **Cause**: Dependencies not installed
- **Solution**: `npm install`

### Error: "Vite blocked request. This host not allowed"
- **Cause**: Host not in `allowedHosts`
- **Solution**: Add host to `vite.config.js` allowedHosts

### Error: "Access to XMLHttpRequest blocked by CORS"
- **Cause**: Backend CORS not configured
- **Solution**: Backend must include `CORS middleware`

### Error: "401 Unauthorized"
- **Cause**: Invalid or missing token
- **Solution**: Check localStorage token, re-login

### API calls always 404
- **Cause**: API_BASE URL wrong
- **Solution**: Check if backend is running, correct API_BASE in api.js

---

## Performance Tips

### 1. **Code Splitting**
```javascript
// Load components only when needed
const ProfilePage = React.lazy(() => import("./components/ProfilePage"));

<Suspense fallback={<Loading />}>
  <ProfilePage />
</Suspense>
```

### 2. **Memoization**
```javascript
// Prevent unnecessary re-renders
const UserCard = React.memo(({ user }) => {
  return <div>{user.name}</div>;
});
```

### 3. **Image Optimization**
```javascript
// Use smaller images, optimize with tools like ImageOptim
<img src="/images/user.webp" alt="User" />
```

---

## Testing

### Manual Testing
```bash
# Terminal 1: Start backend
cd backend && python3 -m uvicorn app.main:app --reload --port 8000

# Terminal 2: Start frontend
cd frontend && npm run dev

# Visit http://localhost:5173
```

### Integration Testing
```bash
# Test full flow:
# 1. Sign up
# 2. Login
# 3. Create message
# 4. View messages
# 5. Logout
```

---

## Next Steps for Learning

1. Learn **React Hooks** (useState, useEffect, useContext)
2. Study **async/await** for API calls
3. Understand **component lifecycle** (mount, update, unmount)
4. Learn **state management** (Context API or Redux)
5. Practice **CSS-in-JS** or **Tailwind CSS** for styling
