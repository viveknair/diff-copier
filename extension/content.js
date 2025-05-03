// --- Refactored Core Logic ---
async function performCopyAction(button) {
  // Extract the base PR URL (e.g., https://github.com/org/repo/pull/123)
  const urlMatch = window.location.href.match(
    /^(https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+)/
  );
  if (!urlMatch) {
    console.error("Could not extract base PR URL from:", window.location.href);
    button.textContent = "URL Error";
    // Keep button disabled temporarily to show the error
    setTimeout(() => {
      button.textContent = "Copy diff as Markdown";
      // Re-enable button only if it wasn't already disabled for another reason (unlikely here but good practice)
      // We can assume re-enabling is safe here as this path means the action failed early.
      button.disabled = false;
    }, 3000);
    return; // Stop if the URL doesn't match the expected pattern
  }
  const baseUrl = urlMatch[1];
  // Construct the URL for the diff file
  const diffUrl = `${baseUrl}.diff`;
  // console.log(`Constructed diff URL: ${diffUrl}`); // Optional: uncomment for debugging

  // Disable button and show feedback during operation
  button.textContent = "Copying...";
  button.disabled = true;

  // Send message to background script to fetch the diff
  chrome.runtime.sendMessage(
    { action: "fetchDiff", url: diffUrl },
    (response) => {
      if (chrome.runtime.lastError) {
        // Handle errors during message passing
        console.error(
          "Content script error sending message:",
          chrome.runtime.lastError.message
        );
        button.textContent = "Error!";
        setTimeout(() => {
          button.textContent = "Copy diff as Markdown";
          button.disabled = false;
        }, 3000);
        return;
      }

      if (response && response.success) {
        // Use the Clipboard API to copy the text
        navigator.clipboard
          .writeText(response.diffText)
          .then(() => {
            button.textContent = "Copied!";
            setTimeout(() => {
              button.textContent = "Copy diff as Markdown";
              button.disabled = false;
            }, 2000);
          })
          .catch((clipboardError) => {
            console.error("Content script clipboard error:", clipboardError);
            button.textContent = "Clip Err!";
            setTimeout(() => {
              button.textContent = "Copy diff as Markdown";
              button.disabled = false;
            }, 3000);
          });
      } else {
        // Handle fetch errors reported by the background script
        const errorMessage = response ? response.error : "No response";
        console.error(
          "Content script received error from background:",
          errorMessage
        );

        // Attempt to extract status code from the error message
        let errorText = "Error!";
        const statusMatch = errorMessage.match(/status:\s*(\d+)/);
        if (statusMatch && statusMatch[1]) {
          errorText = `Error! (${statusMatch[1]})`;
        }

        button.textContent = errorText;
        setTimeout(() => {
          button.textContent = "Copy diff as Markdown";
          button.disabled = false;
        }, 3000);
      }
    }
  );
}

function addCopyDiffButton() {
  const buttonId = "copy-pr-markdown-button";
  // Prevent adding duplicate buttons on partial page reloads
  if (document.getElementById(buttonId)) {
    return;
  }

  // Find a suitable place to insert the button. GitHub UI might change, so this selector may need updates.
  const actionsContainer = document.querySelector(".gh-header-actions");
  if (!actionsContainer) {
    // console.warn("GitHub PR Diff Copier: Could not find insertion point '.gh-header-actions'.");
    return; // Don't proceed if the target container isn't found
  }

  // Create the button element
  const button = document.createElement("button");
  button.id = buttonId;
  button.textContent = "Copy diff as Markdown";
  // Apply GitHub's styling classes and add some margin
  button.className = "btn btn-sm";

  // Define the action when the button is clicked
  button.onclick = () => {
    performCopyAction(button); // Call the refactored function
  };

  // Add the button to the page (insert before the first existing action)
  actionsContainer.insertBefore(button, actionsContainer.firstChild);
}

// --- Keyboard Shortcut Logic ---
let lastCmdCPressTime = 0;
const doublePressDelay = 500; // milliseconds

document.addEventListener("keydown", (event) => {
  // Check for Cmd+C (or Ctrl+C on non-Mac)
  if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
    const now = Date.now();
    if (now - lastCmdCPressTime < doublePressDelay) {
      // Double press detected

      // *** Check if text is selected ***
      if (window.getSelection().toString().length > 0) {
        // If text is selected, reset the timer and allow default copy behavior
        lastCmdCPressTime = 0;
        return;
      }

      const button = document.getElementById("copy-pr-markdown-button");
      if (button && !button.disabled) {
        console.log(
          "Double Cmd+C detected (no selection), triggering copy action."
        );
        performCopyAction(button);
        // Reset time to prevent triple press triggering immediately
        lastCmdCPressTime = 0;
      } else if (!button) {
        console.warn("Double Cmd+C detected, but copy button not found.");
      }
    } else {
      // First press, record time
      lastCmdCPressTime = now;
    }
    // We don't preventDefault() here initially
  } else {
    // Reset time if other keys are pressed
    lastCmdCPressTime = 0;
  }
});

// Initial attempt to add the button when the script first runs
addCopyDiffButton();

// Observe changes in the page structure
const observer = new MutationObserver((mutationsList, observer) => {
  // Check if the target container exists and our button doesn't,
  // indicating a navigation event likely occurred.
  if (
    document.querySelector(".gh-header-actions") &&
    !document.getElementById("copy-pr-markdown-button")
  ) {
    addCopyDiffButton(); // Re-run the button adding logic
  }
});

// Start observing the main body of the document for added/removed nodes
observer.observe(document.body, { childList: true, subtree: true });
