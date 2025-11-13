// ==========================
// Elements
// ==========================
const form = document.getElementById("loginForm");
const usernameInput = document.getElementById("username");
const passwordInput = document.getElementById("password");
const rememberCheck = document.getElementById("remember");

// Load saved username if "Remember me" was checked
if (localStorage.getItem("remember") === "true") {
  usernameInput.value = localStorage.getItem("username") || "";
  rememberCheck.checked = true;
}

// ==========================
// Handle form submission
// ==========================
form.addEventListener("submit", async (e) => {
  e.preventDefault();

  const username = usernameInput.value.trim();
  const password = passwordInput.value.trim();

  if (!username || !password) {
    alert("Please enter both fields.");
    return;
  }

  try {
    const response = await fetch("http://localhost:3000/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password })
    });

    const result = await response.json();

    if (!response.ok) {
      alert(result.message || "Login failed.");
      return;
    }

    // Always store userId and username for the dashboard
    localStorage.setItem("userId", result.userId);
    localStorage.setItem("username", result.username); // store username regardless

    // Only use "Remember me" to prefill next time
    if (rememberCheck.checked) {
      localStorage.setItem("remember", "true");
    } else {
      localStorage.removeItem("remember");
    }

    alert(result.message);
    window.location.href = "dashboard.html";

  } catch (err) {
    console.error("Error:", err);
    alert("An unexpected error occurred.");
  }
});
