import { map } from './map.js';
import { pathDrawing } from './pathDrawing.js';

const lineEvents = {
    // Keep track of different types of popups
    routePopups: [],
    hoverPopups: [],

    clearPopups: (type) => {
        let popups;
        switch (type) {
            case 'route':
                popups = lineEvents.routePopups;
                break;
            case 'hover':
                popups = lineEvents.hoverPopups;
                break;
            case 'all':
                popups = [...lineEvents.routePopups, ...lineEvents.hoverPopups];
                break;
            default:
                popups = [];
        }
        popups.forEach(popup => map.closePopup(popup));
        if (type !== 'all') {
            lineEvents[type + 'Popups'] = [];
        } else {
            lineEvents.routePopups = [];
            lineEvents.hoverPopups = [];
        }
    },

    showRoutePopup: (event, routeData, visibleLine, invisibleLine) => {
        const { originAirport, destinationAirport, price, date } = routeData;

        let content = `<div style="line-height: 1.5;">
            <strong>Route Information</strong><br>
            <strong>From:</strong> ${originAirport.name} (${originAirport.iata_code})<br>
            <strong>To:</strong> ${destinationAirport.name} (${destinationAirport.iata_code})<br>
            <strong>Price:</strong> $${price}<br>`;

        if (date) {
            let formattedDate = new Date(date).toLocaleDateString("en-US", {
                year: 'numeric', month: 'long', day: 'numeric'
            });
            content += `<strong>Date:</strong> ${formattedDate}<br>`;
        }

        content += `</div>`;

        // Ensure no other route popups are open before creating a new one
        lineEvents.clearPopups('route');

        // Create the popup and add event listeners after initialization
        const popup = L.popup({ autoClose: false, closeOnClick: false })
            .setLatLng(event.latlng)
            .setContent(content)
            .on('remove', function () {
                pathDrawing.popupFromClick = false; // Reset flag on popup removal
            })
            .on('add', function () {
                // Ensure the lines remain visible when the popup is added
                if (visibleLine && !map.hasLayer(visibleLine)) {
                    visibleLine.addTo(map);
                }
                if (invisibleLine && !map.hasLayer(invisibleLine)) {
                    invisibleLine.addTo(map);
                }
                pathDrawing.popupFromClick = true; // Set flag on popup addition
            });

        // Open the popup on the map
        setTimeout(() => {
            popup.openOn(map);
        }, 100); // Delay to avoid immediate closure by other events

        // Track this popup
        lineEvents.routePopups.push(popup);
    },

    onMouseOver: (e, visibleLine, map, hoveredLine, hoverPopup, routeData, pathDrawing) => {
        if (!pathDrawing.popupFromClick) {
            if (hoveredLine && hoveredLine !== visibleLine) {
                hoveredLine.setStyle({ color: hoveredLine.originalColor });
                map.closePopup(hoverPopup);
                // Remove hover popup from the list
                lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== hoverPopup);
            }

            hoveredLine = visibleLine;
            visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 }); // Ensure the line is highlighted

            let displayPrice = Math.round(routeData.price || 0); // Ensure price is valid
            let city = routeData.destinationAirport && routeData.destinationAirport.city ? routeData.destinationAirport.city : 'Unknown City'; // Ensure city is valid
            let content = `<div style="line-height: 1.2; margin: 0;">${city}<br><span><strong><span style="color: #ccc; font-size: 14px;">$${displayPrice}</span></strong></span>`;
            if (routeData.date) {
                let lowestDate = new Date(routeData.date).toLocaleDateString("en-US", {
                    year: 'numeric', month: 'long', day: 'numeric'
                });
                content += `<br><span style="line-height: 1; display: block; color: #666">on ${lowestDate}</span>`;
            }
            content += `</div>`;

            hoverPopup = L.popup({ autoClose: false, closeOnClick: true })
                .setLatLng(e.latlng)
                .setContent(content)
                .openOn(map);

            // Track this popup
            lineEvents.hoverPopups.push(hoverPopup);
        }
    },

    onMouseOut: (visibleLine, map, hoveredLine, hoverPopup, pathDrawing) => {
        if (!pathDrawing.popupFromClick) {
            visibleLine.setStyle({ color: visibleLine.originalColor });
            map.closePopup(hoverPopup);
            // Remove hover popup from the list
            lineEvents.hoverPopups = lineEvents.hoverPopups.filter(p => p !== hoverPopup);
            hoveredLine = null;
            hoverPopup = null;
        }
    },

    onClickHandler: (e, visibleLine, invisibleLine, onClick) => {
        if (typeof onClick === 'function') {
            onClick(e, visibleLine, invisibleLine);
        }
        if (visibleLine && invisibleLine) {
            // Ensure the visible and invisible lines are displayed
            if (!map.hasLayer(visibleLine)) {
                visibleLine.addTo(map);
            }
            if (!map.hasLayer(invisibleLine)) {
                invisibleLine.addTo(map);
            }
            // Highlight the visible line
            visibleLine.setStyle({ color: 'white', weight: 2, opacity: 1 });
        }
    },
};

export { lineEvents };
