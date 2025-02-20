document.querySelector("form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const formData = new FormData(event.target);
    
    try {
        const response = await fetch("/update-product", {
            method: "POST",
            body: formData
        });

        const result = await response.json();
        alert(result.message);
    } catch (error) {
        console.error("Error submitting form:", error);
        alert("Failed to update product.");
    }
});
