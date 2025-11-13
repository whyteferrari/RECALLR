// ==========================
// Ensure User is Logged In
// ==========================
const userId = localStorage.getItem("userId");
console.log("userId from localStorage:", userId);

if (!userId) {
  alert("No user detected. Please login first.");
  window.location.href = "login.html";
}

// ==========================
// Elements
// ==========================
const deckNameInput = document.getElementById("deckName");
const previewDeckName = document.getElementById("previewDeckName");
const folderSelect = document.getElementById("folderSelect");
const previewDeckFolder = document.getElementById("previewDeckFolder");
const colorInput = document.getElementById("deckColor");
const colorPreview = document.getElementById("deckColorPreview");
const previewIndicator = document.querySelector(".deck-card__indicator");
const addDeckForm = document.getElementById("addDeckForm");

let createdDeckId = null;

// ==========================
// Deck Live Preview
// ==========================
deckNameInput.addEventListener("input", () => {
  previewDeckName.textContent = deckNameInput.value || "New Deck";
});

folderSelect.addEventListener("change", () => {
  previewDeckFolder.textContent = folderSelect.value || "Folder Name";
});

colorInput.addEventListener("input", () => {
  colorPreview.textContent = colorInput.value.toUpperCase();
  previewIndicator.style.background = colorInput.value;
});

document.querySelectorAll(".coming-soon").forEach((el) => {
  el.addEventListener("click", (e) => {
    e.preventDefault();
    alert("Feature coming soon!");
  });
});

// ==========================
// Deck Creation
// ==========================
addDeckForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = deckNameInput.value.trim();
  const folder = folderSelect.value || "";
  const color = colorInput.value;
  const description = document.getElementById("deckDescription").value.trim();

  if (!name) return alert("Deck name is required.");

  try {
    // ✅ Dynamic backend URL based on current origin
    const apiUrl = `${window.location.origin}/api/decks`;

    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId: parseInt(userId, 10),
        name,
        folder,
        color,
        description,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("❌ Deck creation error:", data);
      alert(data.error || "Failed to create deck.");
      return;
    }

    console.log("✅ Deck created:", data);
    createdDeckId = data.id;

    // Store deck info in localStorage
    localStorage.setItem("currentDeckId", data.id);
    localStorage.setItem("currentDeckName", data.name);

    alert("Deck created successfully!");

    // Redirect to editdecks.html
    window.location.href = `editdecks.html?deckId=${data.id}&deckName=${encodeURIComponent(
      data.name
    )}`;
  } catch (err) {
    console.error("💥 Error adding deck:", err);
    alert("Error adding deck.");
  }
});
