document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");

    loginForm.addEventListener("submit", async (event) => {
        event.preventDefault(); // Prevent form from refreshing the page

        const phone = document.getElementById("phone").value;
        const pin = document.getElementById("pin").value;

        if (!phone || !pin) {
            alert("Please enter both Phone Number and PIN.");
            return;
        }

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ phone, pin })
            });

            const result = await response.json();

            if (response.ok) {
                window.location.href = "/home"; // Redirect to home.ejs on success
            } else {
                alert(result.error || "Login failed. Please check your credentials.");
            }
        } catch (error) {
            console.error("Login error:", error);
            alert("Something went wrong. Please try again.");
        }
    });
});
