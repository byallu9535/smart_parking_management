from flask import Flask, request, jsonify
from flask_cors import CORS
import sqlite3
from datetime import datetime

app = Flask(__name__)
CORS(app)

DATABASE = "parking.db"


# =================================
# 1. DATABASE CONNECTION
# =================================

def get_db_connection():
    conn = sqlite3.connect(DATABASE)
    conn.row_factory = sqlite3.Row
    return conn


# =================================
# 2. CREATE DATABASE TABLES
# =================================

def init_db():

    conn = get_db_connection()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS slots (
            id INTEGER PRIMARY KEY,
            status TEXT DEFAULT 'Available'
        )
    """)

    conn.execute("""
        CREATE TABLE IF NOT EXISTS vehicles (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            vehicle_number TEXT NOT NULL,
            slot_id INTEGER NOT NULL,
            entry_time TEXT NOT NULL,
            exit_time TEXT,
            FOREIGN KEY(slot_id) REFERENCES slots(id)
        )
    """)

    # Create 20 parking slots
    for i in range(1, 21):
        conn.execute("""
            INSERT OR IGNORE INTO slots (id)
            VALUES (?)
        """, (i,))

    conn.commit()
    conn.close()


# =================================
# 3. HOME API
# =================================

@app.route("/", methods=["GET"])
def home():

    return jsonify({
        "message": "Smart Parking Management System",
        "backend": "Connected",
        "database": "SQLite"
    })


# =================================
# 4. GET PARKING SLOTS
# =================================

@app.route("/api/slots", methods=["GET"])
def get_slots():

    conn = get_db_connection()

    slots = conn.execute("""
        SELECT * FROM slots ORDER BY id
    """).fetchall()

    conn.close()

    return jsonify([dict(slot) for slot in slots])


# =================================
# 5. PARKING SUMMARY
# =================================

@app.route("/api/summary", methods=["GET"])
def get_summary():

    conn = get_db_connection()

    total = conn.execute("""
        SELECT COUNT(*) FROM slots
    """).fetchone()[0]

    available = conn.execute("""
        SELECT COUNT(*) FROM slots
        WHERE status = 'Available'
    """).fetchone()[0]

    occupied = conn.execute("""
        SELECT COUNT(*) FROM slots
        WHERE status = 'Occupied'
    """).fetchone()[0]

    conn.close()

    return jsonify({
        "total_slots": total,
        "available_slots": available,
        "occupied_slots": occupied
    })


# =================================
# 6. VEHICLE ENTRY
# =================================

@app.route("/api/entry", methods=["POST"])
def vehicle_entry():

    data = request.get_json(silent=True) or {}

    number = data.get("vehicle_number")
    slot_id = data.get("slot_id")

    if not isinstance(number, str) or not number.strip():
        return jsonify({"error": "Vehicle number required"}), 400

    try:
        slot_id = int(slot_id)
    except (TypeError, ValueError):
        return jsonify({"error": "Valid slot ID required"}), 400

    number = number.strip().upper()

    conn = get_db_connection()

    try:
        active = conn.execute("""
            SELECT id FROM vehicles
            WHERE vehicle_number = ?
            AND exit_time IS NULL
        """, (number,)).fetchone()

        if active:
            return jsonify({
                "error": "Vehicle is already parked"
            }), 400

        slot = conn.execute("""
            SELECT * FROM slots
            WHERE id = ?
            AND status = 'Available'
        """, (slot_id,)).fetchone()

        if not slot:
            return jsonify({
                "error": "Parking slot is unavailable"
            }), 400

        entry_time = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        conn.execute("""
            INSERT INTO vehicles
            (vehicle_number, slot_id, entry_time)
            VALUES (?, ?, ?)
        """, (number, slot_id, entry_time))

        conn.execute("""
            UPDATE slots
            SET status = 'Occupied'
            WHERE id = ?
        """, (slot_id,))

        conn.commit()

        return jsonify({
            "message": "Vehicle parked successfully",
            "vehicle_number": number,
            "slot_id": slot_id,
            "entry_time": entry_time
        }), 201

    finally:
        conn.close()


# =================================
# 7. VEHICLE EXIT
# =================================

@app.route("/api/exit", methods=["POST"])
def vehicle_exit():

    data = request.get_json(silent=True) or {}

    number = data.get("vehicle_number")

    if not isinstance(number, str) or not number.strip():
        return jsonify({"error": "Vehicle number required"}), 400

    number = number.strip().upper()

    conn = get_db_connection()

    try:
        vehicle = conn.execute("""
            SELECT * FROM vehicles
            WHERE vehicle_number = ?
            AND exit_time IS NULL
            ORDER BY id DESC
            LIMIT 1
        """, (number,)).fetchone()

        if not vehicle:
            return jsonify({
                "error": "Active vehicle not found"
            }), 404

        exit_time = datetime.now().strftime(
            "%Y-%m-%d %H:%M:%S"
        )

        conn.execute("""
            UPDATE vehicles
            SET exit_time = ?
            WHERE id = ?
        """, (exit_time, vehicle["id"]))

        conn.execute("""
            UPDATE slots
            SET status = 'Available'
            WHERE id = ?
        """, (vehicle["slot_id"],))

        conn.commit()

        return jsonify({
            "message": "Vehicle exit successful",
            "vehicle_number": number,
            "slot_id": vehicle["slot_id"],
            "exit_time": exit_time
        })

    finally:
        conn.close()


# =================================
# 8. PARKING HISTORY
# =================================

@app.route("/api/history", methods=["GET"])
def get_history():

    conn = get_db_connection()

    records = conn.execute("""
        SELECT * FROM vehicles
        ORDER BY id DESC
    """).fetchall()

    conn.close()

    return jsonify([dict(record) for record in records])


# =================================
# 9. SEARCH VEHICLE
# =================================

@app.route("/api/vehicle/<vehicle_number>", methods=["GET"])
def search_vehicle(vehicle_number):

    conn = get_db_connection()

    records = conn.execute("""
        SELECT * FROM vehicles
        WHERE vehicle_number = ?
        ORDER BY id DESC
    """, (vehicle_number.strip().upper(),)).fetchall()

    conn.close()

    if not records:
        return jsonify({
            "error": "Vehicle not found"
        }), 404

    return jsonify([dict(record) for record in records])


# =================================
# 10. START SERVER
# =================================

if __name__ == "__main__":

    init_db()

    print("--------------------------------")
    print("SMART PARKING MANAGEMENT SYSTEM")
    print("Database connected successfully")
    print("Backend server starting...")
    print("--------------------------------")

    app.run(
        host="127.0.0.1",
        port=5001,
        debug=True
    )