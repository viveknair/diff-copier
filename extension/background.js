chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "fetchDiff") {
    fetch(request.url)
      .then((response) => {
        if (!response.ok) {
          // Check for redirect status explicitly if needed, but fetch handles redirects by default.
          // If the final response isn't OK, throw an error.
          throw new Error(
            `HTTP error! status: ${response.status} for URL: ${response.url}`
          );
        }
        return response.text();
      })
      .then((diffText) => {
        sendResponse({ success: true, diffText: diffText });
      })
      .catch((error) => {
        console.error("Background script fetch error:", error);
        sendResponse({ success: false, error: error.message });
      });

    // Return true to indicate that the response will be sent asynchronously
    return true;
  }
});
