import { appState } from './stateManager.js';
import { routeHandling } from './routeHandling.js';

// link and load the routeBox.css file
const link = document.createElement('link');
link.rel = 'stylesheet';
link.href = 'css/routeBox.css';
document.head.appendChild(link);

const routeBox = {
    showRouteBox: function(event) {
        let routeBox = document.getElementById('routeBox');
        if (!routeBox) {
            routeBox = document.createElement('div');
            routeBox.id = 'routeBox';
            routeBox.className = 'route-box-popup';
            document.body.appendChild(routeBox);

            // Optional: Add any internal elements here
            const content = document.createElement('div');
            content.textContent = 'Route Box Content';
            routeBox.appendChild(content);

            // Close button (optional)
            const closeButton = document.createElement('button');
            closeButton.textContent = 'Close';
            closeButton.onclick = () => routeBox.style.display = 'none';
            routeBox.appendChild(closeButton);
        }
        this.positionPopup(routeBox, event);
    },

    positionPopup: function(popup, event) {
        const iconRect = event.target.getBoundingClientRect();
        const popupWidth = popup.offsetWidth;
        const screenPadding = 10; // Padding from edge of the screen

        let leftPosition = iconRect.left + window.scrollX - (popupWidth / 2) + (iconRect.width / 2);
        if (leftPosition + popupWidth > window.innerWidth - screenPadding) {
            leftPosition = window.innerWidth - popupWidth - screenPadding;
        } else if (leftPosition < screenPadding) {
            leftPosition = screenPadding;
        }

        popup.style.left = `${leftPosition}px`;
        popup.style.top = `${iconRect.top + window.scrollY - popup.offsetHeight - 10}px`; // Position above the icon
        popup.style.display = 'block';
    }
}

export { routeBox };
