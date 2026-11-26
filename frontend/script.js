const API = "http://127.0.0.1:5001";

let allHistory = [];
let currentPage = 1;


// ===================================
// 1. DASHBOARD SUMMARY
// ===================================

async function loadSummary() {

    try {
        const response = await fetch(`${API}/api/summary`);

        if (!response.ok) {
            throw new Error("Unable to load summary");
        }

        const data = await response.json();

        document.getElementById("total").textContent =
            data.total_slots;

        document.getElementById("booked").textContent =
            data.occupied_slots;

        document.getElementById("available").textContent =
            data.available_slots;

        const percentage = data.total_slots > 0
            ? Math.round(
                data.occupied_slots / data.total_slots * 100
              )
            : 0;

        document.getElementById("occupancy").textContent =
            percentage + "%";

    } catch (error) {
        console.error("Summary error:", error);
        throw error;
    }
}


// ===================================
// 2. LOAD PARKING SLOTS
// ===================================

async function loadSlots() {

    try {
        const response = await fetch(`${API}/api/slots`);

        if (!response.ok) {
            throw new Error("Unable to load parking slots");
        }

        const slots = await response.json();

        const floorContainer =
            document.getElementById("floors");

        const summaryContainer =
            document.getElementById("floorSummary");

        floorContainer.innerHTML = "";
        summaryContainer.innerHTML = "";

        // Four demonstration floors
        const floors = [
            { name: "Upper Basement", start: 1, end: 5 },
            { name: "Basement 1", start: 6, end: 10 },
            { name: "Basement 2", start: 11, end: 15 },
            { name: "Lower Basement", start: 16, end: 20 }
        ];

        floors.forEach(floor => {

            const floorSlots = slots.filter(slot =>
                slot.id >= floor.start &&
                slot.id <= floor.end
            );

            const available = floorSlots.filter(slot =>
                slot.status === "Available"
            ).length;

            const occupied = floorSlots.filter(slot =>
                slot.status === "Occupied"
            ).length;

            // Floor summary
            summaryContainer.innerHTML += `
                <div class="floor-card">
                    <strong>${floor.name}</strong>

                    <p>Total Slots: ${floorSlots.length}</p>

                    <h4>Available: ${available}</h4>

                    <p>Occupied: ${occupied}</p>
                </div>
            `;

            // Floor parking slots
            floorContainer.innerHTML += `
                <h3 class="floor-title">
                    ${floor.name}
                </h3>

                <div class="slot-grid">

                    ${floorSlots.map(slot => `
                        <div class="slot ${
                            slot.status === "Available"
                            ? "available"
                            : "occupied"
                        }">

                            <strong>B${slot.id}</strong>

                            <span>${
                                slot.status === "Available"
                                ? "Available"
                                : "Occupied"
                            }</span>

                        </div>
                    `).join("")}

                </div>
            `;
        });

    } catch (error) {
        console.error("Slot error:", error);
        throw error;
    }
}


// ===================================
// 3. VEHICLE ENTRY
// ===================================

async function vehicleEntry() {

    const vehicleNumber =
        document.getElementById("vehicleNumber")
        .value.trim().toUpperCase();

    const slotId =
        document.getElementById("slotId").value;

    if (!vehicleNumber || !slotId) {
        alert("Please enter vehicle number and slot ID");
        return;
    }

    if (!/^[A-Z0-9-]+$/.test(vehicleNumber)) {
        alert("Enter a valid vehicle number");
        return;
    }

    try {

        const response = await fetch(`${API}/api/entry`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                vehicle_number: vehicleNumber,
                slot_id: Number(slotId)
            })

        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Entry failed");
        }

        alert(result.message);

        document.getElementById("vehicleNumber").value = "";
        document.getElementById("slotId").value = "";

        await refreshDashboard();

    } catch (error) {

        alert(error.message);

    }
}


// ===================================
// 4. VEHICLE EXIT
// ===================================

async function vehicleExit() {

    const vehicleNumber =
        document.getElementById("exitNumber")
        .value.trim().toUpperCase();

    if (!vehicleNumber) {
        alert("Please enter vehicle number");
        return;
    }

    try {

        const response = await fetch(`${API}/api/exit`, {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify({
                vehicle_number: vehicleNumber
            })

        });

        const result = await response.json();

        if (!response.ok) {
            throw new Error(result.error || "Exit failed");
        }

        alert(result.message);

        document.getElementById("exitNumber").value = "";

        await refreshDashboard();

    } catch (error) {

        alert(error.message);

    }
}


// ===================================
// 5. LOAD PARKING HISTORY
// ===================================

async function loadHistory() {

    try {

        const response = await fetch(`${API}/api/history`);

        if (!response.ok) {
            throw new Error("Unable to load history");
        }

        allHistory = await response.json();

        currentPage = 1;

        renderHistory();

    } catch (error) {

        console.error("History error:", error);

        document.getElementById("historyBody").innerHTML =
            `<tr><td colspan="6">Unable to load history</td></tr>`;

    }
}


// ===================================
// 6. DISPLAY HISTORY
// ===================================

function renderHistory() {

    const tbody =
        document.getElementById("historyBody");

    const search =
        document.getElementById("searchInput")
        .value.trim().toLowerCase();

    const pageSize =
        Number(document.getElementById("pageSize").value);

    const filtered = allHistory.filter(record =>
        String(record.vehicle_number)
        .toLowerCase()
        .includes(search)
    );

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / pageSize)
    );

    currentPage = Math.min(currentPage, totalPages);

    const start = (currentPage - 1) * pageSize;

    const pageRecords =
        filtered.slice(start, start + pageSize);

    if (pageRecords.length === 0) {

        tbody.innerHTML = `
            <tr>
                <td colspan="6">No parking records found</td>
            </tr>
        `;

    } else {

        tbody.innerHTML = pageRecords.map(record => `

            <tr>

                <td>${record.id}</td>

                <td>${escapeHTML(record.vehicle_number)}</td>

                <td>B${record.slot_id}</td>

                <td>${escapeHTML(record.entry_time)}</td>

                <td>${record.exit_time
                    ? escapeHTML(record.exit_time)
                    : "-"
                }</td>

                <td>
                    ${record.exit_time
                        ? "Completed"
                        : "Currently Parked"
                    }
                </td>

            </tr>

        `).join("");

    }

    document.getElementById("pageInfo").textContent =
        `Page ${currentPage} of ${totalPages}`;

}


// ===================================
// 7. SEARCH AND PAGINATION
// ===================================

function changePage(direction) {

    const search =
        document.getElementById("searchInput")
        .value.trim().toLowerCase();

    const pageSize =
        Number(document.getElementById("pageSize").value);

    const filtered = allHistory.filter(record =>
        String(record.vehicle_number)
        .toLowerCase()
        .includes(search)
    );

    const totalPages = Math.max(
        1,
        Math.ceil(filtered.length / pageSize)
    );

    currentPage += direction;

    currentPage = Math.max(
        1,
        Math.min(currentPage, totalPages)
    );

    renderHistory();
}


// ===================================
// 8. SAFE TEXT DISPLAY
// ===================================

function escapeHTML(value) {

    return String(value ?? "").replace(
        /[&<>"']/g,
        character => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[character]
    );

}


// ===================================
// 9. REFRESH DASHBOARD
// ===================================

async function refreshDashboard() {

    try {

        await loadSummary();
        await loadSlots();
        await loadHistory();

    } catch (error) {

        alert(
            "Cannot connect to backend. " +
            "Please check whether Flask is running."
        );

    }

}


// ===================================
// 10. START APPLICATION
// ===================================

document.addEventListener("DOMContentLoaded", () => {

    refreshDashboard();

});