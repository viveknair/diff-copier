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

// Helper function to check if the current URL is a PR page
function isPRPage() {
  return /^(https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+)/.test(
    window.location.href
  );
}

// --- Copy Review Dog Errors Logic ---
function copyReviewDogErrors() {
  // Find all review dog error comments
  const errorComments = document.querySelectorAll('.comment-body.markdown-body');
  const errors = [];
  
  errorComments.forEach(comment => {
    // Check if this is a review dog comment
    const textContent = comment.textContent;
    if (textContent.includes('[eslint]') && textContent.includes('reported by reviewdog')) {
      // Extract the error message
      const lines = textContent.split('\n').map(line => line.trim()).filter(line => line);
      
      // Find the rule name (e.g., @typescript-eslint/no-unused-vars)
      const ruleMatch = textContent.match(/<([^>]+)>/);
      const rule = ruleMatch ? ruleMatch[1] : 'unknown-rule';
      
      // The error message is typically on the last line before "reported by reviewdog"
      const errorMessage = lines.find(line => !line.includes('[eslint]') && !line.includes('reported by reviewdog') && !line.includes('⚠️'));
      
      if (errorMessage) {
        // Find the file path from the parent elements
        const discussionElement = comment.closest('[id^="discussion_r"]');
        if (discussionElement) {
          // Try to find file path from nearby elements
          const filePathElement = discussionElement.closest('.js-comment-container')?.querySelector('.Link--primary');
          const filePath = filePathElement ? filePathElement.textContent : 'unknown-file';
          
          errors.push({
            file: filePath,
            rule: rule,
            message: errorMessage
          });
        }
      }
    }
  });
  
  if (errors.length === 0) {
    console.log('No review dog errors found on this page');
    return false;
  }
  
  // Format errors as markdown
  const markdown = `## Review Dog Errors (${errors.length} total)\n\n` +
    errors.map((error, index) => 
      `${index + 1}. **${error.file}**\n   - Rule: \`${error.rule}\`\n   - Error: ${error.message}`
    ).join('\n\n');
  
  // Copy to clipboard
  navigator.clipboard.writeText(markdown)
    .then(() => {
      console.log(`Copied ${errors.length} review dog errors to clipboard`);
      
      // Show temporary notification
      const notification = document.createElement('div');
      notification.textContent = `Copied ${errors.length} review dog errors!`;
      notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #28a745;
        color: white;
        padding: 12px 20px;
        border-radius: 6px;
        font-size: 14px;
        z-index: 9999;
        box-shadow: 0 2px 5px rgba(0,0,0,0.2);
      `;
      document.body.appendChild(notification);
      
      setTimeout(() => {
        notification.remove();
      }, 3000);
    })
    .catch(err => {
      console.error('Failed to copy review dog errors:', err);
    });
  
  return true;
}

// --- Keyboard Shortcut Logic ---
let lastCmdCPressTime = 0;
const doublePressDelay = 500; // milliseconds

function handleKeyDown(event) {
  // Only process if on a PR page
  if (!isPRPage()) return;

  // Check for Cmd+C (or Ctrl+C on non-Mac)
  if (event.key === "c" && (event.metaKey || event.ctrlKey)) {
    const now = Date.now();
    if (now - lastCmdCPressTime < doublePressDelay) {
      // Double press detected

      // Check if text is selected
      if (window.getSelection().toString().length > 0) {
        lastCmdCPressTime = 0;
        return;
      }

      const button = document.getElementById("copy-pr-markdown-button");
      if (button && !button.disabled) {
        console.log(
          "Double Cmd+C detected (no selection), triggering copy action."
        );
        performCopyAction(button);
        lastCmdCPressTime = 0; // Reset time
      } else if (!button) {
        console.warn("Double Cmd+C detected, but copy button not found.");
      }
    } else {
      // First press, record time
      lastCmdCPressTime = now;
    }
  } else if (event.key === "k" && (event.metaKey || event.ctrlKey) && event.shiftKey) {
    // Cmd+Shift+K (or Ctrl+Shift+K) to copy review dog errors
    event.preventDefault();
    console.log("Cmd+Shift+K detected, copying review dog errors.");
    copyReviewDogErrors();
  } else {
    // Reset time if other keys are pressed
    lastCmdCPressTime = 0;
  }
}

// --- Initialization and Observation ---

// Check if we are on a PR page initially
if (isPRPage()) {
  addCopyDiffButton();
}

// Observe changes in the page structure
const observer = new MutationObserver((mutationsList, observer) => {
  // Check if we navigated to a PR page and the button isn't there
  if (
    isPRPage() &&
    document.querySelector(".gh-header-actions") &&
    !document.getElementById("copy-pr-markdown-button")
  ) {
    addCopyDiffButton(); // Add the button if we are on a PR page
  }
  // Optional: Could add logic here to *remove* the button if navigating *away* from a PR page,
  // but GitHub navigation usually replaces the whole container anyway.
});

// Only start observing and listening for keys if the script is running in a context
// where it *could* eventually be on a PR page (i.e., anywhere on github.com now).
// The internal checks `isPRPage()` handle the activation.
observer.observe(document.body, { childList: true, subtree: true });
document.addEventListener("keydown", handleKeyDown);
